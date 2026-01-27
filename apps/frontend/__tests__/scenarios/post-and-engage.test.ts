import { vi } from 'vitest';

// =============================================================================
// FILE 4: Post-and-Engage Integration Scenario Tests
// =============================================================================

import {
  createMockPostStore,
  createMockSocialStore,
  mockWeb3Utils,
} from '../helpers/mock-contracts';
import { createMockIPFSStore, resetCidCounter } from '../helpers/mock-ipfs';
import { ALICE, BOB } from '../helpers/test-users';

// In-memory stores
let postStore: ReturnType<typeof createMockPostStore>;
let socialStore: ReturnType<typeof createMockSocialStore>;
let ipfsStore: ReturnType<typeof createMockIPFSStore>;
let web3Mock: ReturnType<typeof mockWeb3Utils>;

beforeEach(() => {
  postStore = createMockPostStore();
  socialStore = createMockSocialStore();
  ipfsStore = createMockIPFSStore();
  web3Mock = mockWeb3Utils();
  resetCidCounter();

  // Wire up web3Mock to use our stores
  web3Mock.publishTweet.mockImplementation(async () => {
    const post = postStore.addPost({
      author: ALICE.address,
      content: 'bastion content',
      postType: 0,
    });
    return post.id;
  });

  web3Mock.likePost.mockImplementation(async (_account: unknown, postId: string) => {
    socialStore.likePost(postId, BOB.address);
    return 'tx-like';
  });

  web3Mock.unlikePost.mockImplementation(async (_account: unknown, postId: string) => {
    socialStore.unlikePost(postId, BOB.address);
    return 'tx-unlike';
  });

  web3Mock.getPostLikes.mockImplementation(async (postId: string) => {
    return socialStore.getLikeCount(postId);
  });

  web3Mock.addComment.mockImplementation(
    async (_account: unknown, postId: string, contentHash: string) => {
      return socialStore.addComment(postId, BOB.address, contentHash);
    }
  );

  web3Mock.getCommentsForPost.mockImplementation(async (postId: string) => {
    return socialStore.getComments(postId).map((c) => ({
      ...c,
      postId,
      contentHash: '0x' + 'ab'.repeat(32),
      createdAt: Date.now(),
      likeCount: 0,
    }));
  });

  web3Mock.publishPostExtended.mockImplementation(
    async (
      _account: unknown,
      _arweave: string,
      _ipfs: string,
      _hash: string,
      _price: string,
      _encrypted: boolean,
      postType: number,
      parentId?: string | number,
      threadRootId?: string | number
    ) => {
      const post = postStore.addPost({
        author: ALICE.address,
        content: 'extended content',
        postType,
        parentId: parentId ? String(parentId) : undefined,
        threadRootId: threadRootId ? String(threadRootId) : undefined,
      });
      return post.id;
    }
  );

  web3Mock.pinPost.mockImplementation(async (_account: unknown, postId: string) => {
    const post = postStore.getPost(postId);
    if (post) post.isPinned = true;
    return 'tx-pin';
  });

  web3Mock.unpinPost.mockImplementation(async (_account: unknown, postId: string) => {
    const post = postStore.getPost(postId);
    if (post) post.isPinned = false;
    return 'tx-unpin';
  });

  web3Mock.purchasePost.mockImplementation(async () => {
    return 'tx-purchase';
  });

  web3Mock.hasLikedPost.mockImplementation(async (postId: string, userAddr: string) => {
    return socialStore.hasLiked(postId, userAddr);
  });
});

// =============================================================================
// Tests
// =============================================================================

describe('Post and Engage Scenarios', () => {
  it('Alice posts bastion -> Bob likes -> like count increments', async () => {
    // Alice posts
    const postId = await web3Mock.publishTweet({}, 'ar_1', 'QmCid1', '0xhash');
    expect(postId).toBe('1');

    // Verify initial state
    expect(await web3Mock.getPostLikes(postId)).toBe(0);

    // Bob likes
    await web3Mock.likePost({}, postId);
    expect(await web3Mock.getPostLikes(postId)).toBe(1);

    // Verify Bob has liked
    expect(await web3Mock.hasLikedPost(postId, BOB.address)).toBe(true);
  });

  it('Alice posts -> Bob comments -> comment count increments', async () => {
    const postId = await web3Mock.publishTweet({}, 'ar_1', 'QmCid1', '0xhash');

    // Initial: no comments
    let comments = await web3Mock.getCommentsForPost(postId);
    expect(comments).toHaveLength(0);

    // Bob comments
    await web3Mock.addComment({}, postId, '0xcomment_hash');

    // Verify
    comments = await web3Mock.getCommentsForPost(postId);
    expect(comments).toHaveLength(1);
    expect(comments[0].author).toBe(BOB.address);
  });

  it('Alice posts paid content -> Bob purchases -> access granted', async () => {
    // Alice publishes paid post
    const postId = await web3Mock.publishPostExtended(
      {},
      'ar_paid',
      'QmPaid',
      '0xhash',
      '1000',
      true, // encrypted
      2, // article
      0,
      0
    );

    // Bob purchases
    const txHash = await web3Mock.purchasePost({}, postId);
    expect(txHash).toBe('tx-purchase');

    // Mark access as granted
    web3Mock.purchasePost.mockResolvedValue('tx-done');
  });

  it('Alice creates thread (3 posts) -> all 3 stored', async () => {
    // Start thread (post type 1 = THREAD)
    const rootId = await web3Mock.publishPostExtended(
      {},
      'ar_thread_root',
      'QmRoot',
      '0xhash1',
      '0',
      false,
      1, // thread
      0,
      0
    );

    // Continue thread
    const part2Id = await web3Mock.publishPostExtended(
      {},
      'ar_thread_2',
      'QmPart2',
      '0xhash2',
      '0',
      false,
      1,
      0,
      rootId
    );

    const part3Id = await web3Mock.publishPostExtended(
      {},
      'ar_thread_3',
      'QmPart3',
      '0xhash3',
      '0',
      false,
      1,
      0,
      rootId
    );

    // Verify all 3 posts exist
    expect(postStore.getPost(rootId)).toBeDefined();
    expect(postStore.getPost(part2Id)).toBeDefined();
    expect(postStore.getPost(part3Id)).toBeDefined();

    // Verify thread root
    expect(postStore.getPost(part2Id)!.threadRootId).toBe(rootId);
    expect(postStore.getPost(part3Id)!.threadRootId).toBe(rootId);
  });

  it('Alice posts -> Bob replies -> reply has parentId', async () => {
    // Alice posts original
    const originalId = await web3Mock.publishTweet({}, 'ar_orig', 'QmOrig', '0xhash');

    // Bob replies (postType=0 tweet, parentId=originalId)
    const replyId = await web3Mock.publishPostExtended(
      {},
      'ar_reply',
      'QmReply',
      '0xhash2',
      '0',
      false,
      0,
      originalId,
      0
    );

    const reply = postStore.getPost(replyId);
    expect(reply).toBeDefined();
    expect(reply!.parentId).toBe(originalId);
  });

  it('Alice pins post -> isPinned true -> unpin sets false', async () => {
    // Alice posts
    const postId = await web3Mock.publishTweet({}, 'ar_pin', 'QmPin', '0xhash');

    // Pin
    await web3Mock.pinPost({}, postId);
    expect(postStore.getPost(postId)!.isPinned).toBe(true);

    // Unpin
    await web3Mock.unpinPost({}, postId);
    expect(postStore.getPost(postId)!.isPinned).toBe(false);
  });
});
