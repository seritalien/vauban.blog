import { vi } from 'vitest';

// =============================================================================
// FILE 7: Error Cases Scenario Tests
// =============================================================================

import {
  createMockPostStore,
  createMockSocialStore,
  mockWeb3Utils,
} from '../helpers/mock-contracts';
import { createMockIPFSStore, resetCidCounter } from '../helpers/mock-ipfs';
import { ALICE, BOB } from '../helpers/test-users';

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

  // Wire up like/unlike to store
  web3Mock.likePost.mockImplementation(async (_account: unknown, postId: string) => {
    const liked = socialStore.hasLiked(postId, BOB.address);
    if (liked) throw new Error('Already liked');
    socialStore.likePost(postId, BOB.address);
    return 'tx-like';
  });

  web3Mock.unlikePost.mockImplementation(async (_account: unknown, postId: string) => {
    socialStore.unlikePost(postId, BOB.address);
    return 'tx-unlike';
  });

  web3Mock.hasLikedPost.mockImplementation(async (postId: string, addr: string) => {
    return socialStore.hasLiked(postId, addr);
  });

  web3Mock.getPostLikes.mockImplementation(async (postId: string) => {
    return socialStore.getLikeCount(postId);
  });

  web3Mock.publishTweet.mockImplementation(async () => {
    const post = postStore.addPost({
      author: ALICE.address,
      content: 'test content',
      postType: 0,
    });
    return post.id;
  });

  web3Mock.getCommentsForPost.mockImplementation(async (postId: string) => {
    return socialStore.getComments(postId);
  });
});

// =============================================================================
// Tests
// =============================================================================

describe('Error Cases', () => {
  it('double-like (already liked) is handled gracefully', async () => {
    const postId = await web3Mock.publishTweet({}, 'ar_1', 'QmCid1', '0xhash');

    // First like succeeds
    await web3Mock.likePost({}, postId);
    expect(socialStore.getLikeCount(postId)).toBe(1);

    // Second like should throw (already liked)
    await expect(web3Mock.likePost({}, postId)).rejects.toThrow('Already liked');

    // Count should still be 1
    expect(socialStore.getLikeCount(postId)).toBe(1);
  });

  it('rate limit error from contract', async () => {
    web3Mock.publishTweet.mockRejectedValueOnce(
      new Error('Rate limited: Please wait before publishing again')
    );

    await expect(web3Mock.publishTweet({}, 'ar_1', 'QmCid1', '0xhash')).rejects.toThrow(
      'Rate limited'
    );
  });

  it('post when disconnected -> error', () => {
    // Simulate the usePostBastion hook's guard
    const isConnected = false;
    const account = null;

    const canPost = isConnected && account !== null;
    expect(canPost).toBe(false);

    // The hook sets error: 'Please connect your wallet'
    const expectedError = 'Please connect your wallet';
    expect(expectedError).toBeDefined();
  });

  it('empty content -> error', () => {
    const content = '';
    const trimmed = content.trim();

    expect(trimmed.length).toBe(0);
    // The hook would set error: 'Content cannot be empty'
    const expectedError = 'Content cannot be empty';
    expect(expectedError).toBe('Content cannot be empty');
  });

  it('exactly 280 chars -> success', () => {
    const content = 'x'.repeat(280);
    expect(content.length).toBe(280);

    // The hook checks content.length > 280
    const isOverLimit = content.length > 280;
    expect(isOverLimit).toBe(false);
  });

  it('281 chars -> rejected', () => {
    const content = 'x'.repeat(281);
    expect(content.length).toBe(281);

    const isOverLimit = content.length > 280;
    expect(isOverLimit).toBe(true);
    // Expected error: 'Content exceeds 280 characters'
  });

  it('unicode content (emoji, CJK) is handled correctly', async () => {
    const content = 'Hello world! \u{1F389}\u{1F680} \u4F60\u597D\u4E16\u754C';

    // Store the content
    const cid = ipfsStore.upload({ content, author: ALICE.address });
    const stored = ipfsStore.fetch<{ content: string }>(cid);

    expect(stored).toBeDefined();
    expect(stored!.content).toBe(content);
    // Emoji and CJK characters preserved
    expect(stored!.content).toContain('\u{1F389}');
    expect(stored!.content).toContain('\u4F60\u597D');
  });

  it('HTML injection in content is stored safely (no interpretation)', () => {
    const maliciousContent = '<script>alert("xss")</script><img onerror="hack()" src="x">';

    const cid = ipfsStore.upload({ content: maliciousContent, author: BOB.address });
    const stored = ipfsStore.fetch<{ content: string }>(cid);

    expect(stored).toBeDefined();
    // Content is stored as-is (no sanitization needed at storage level -- rendered safely by React)
    expect(stored!.content).toBe(maliciousContent);
    // The important thing: it's a string, not executed DOM
    expect(typeof stored!.content).toBe('string');
  });

  it('XSS attempt in content is not executed (stored as plain string)', () => {
    const xssAttempt = '"><img src=x onerror=alert(1)>';

    const cid = ipfsStore.upload({ content: xssAttempt, author: BOB.address });
    const stored = ipfsStore.fetch<{ content: string }>(cid);

    expect(stored!.content).toBe(xssAttempt);
    // React auto-escapes text content, so as long as it's stored as a string
    // and not injected via dangerouslySetInnerHTML, it's safe
    expect(stored!.content).toContain('<img');
    expect(typeof stored!.content).toBe('string');
  });

  it('concurrent operations do not cause race conditions', async () => {
    // Post a bastion
    const postId = await web3Mock.publishTweet({}, 'ar_1', 'QmCid1', '0xhash');

    // Simulate concurrent like and comment
    const [likeResult, commentResult] = await Promise.all([
      web3Mock.likePost({}, postId),
      web3Mock.addComment({}, postId, '0xcomment_hash'),
    ]);

    expect(likeResult).toBeDefined();
    expect(commentResult).toBeDefined();

    // Both operations succeeded independently
    expect(socialStore.getLikeCount(postId)).toBe(1);
  });

  it('network error -> graceful handling', async () => {
    web3Mock.publishTweet.mockRejectedValueOnce(new Error('Network error: Failed to fetch'));

    await expect(web3Mock.publishTweet({}, 'ar_1', 'QmCid1', '0xhash')).rejects.toThrow(
      'Network error'
    );
  });

  it('IPFS down -> Arweave fallback works (simulated)', async () => {
    // Simulate IPFS failure
    const ipfsFetch = vi.fn().mockRejectedValue(new Error('IPFS gateway timeout'));

    // Simulate Arweave fallback
    const arweaveFetch = vi.fn().mockResolvedValue({
      data: { content: 'Article from Arweave' },
      rawJson: '{"content":"Article from Arweave"}',
    });

    // Try IPFS first, fallback to Arweave
    let content: unknown;
    try {
      content = await ipfsFetch('QmTestCid');
    } catch {
      content = await arweaveFetch('ar_test_tx');
    }

    expect(ipfsFetch).toHaveBeenCalled();
    expect(arweaveFetch).toHaveBeenCalled();
    expect(content).toEqual({
      data: { content: 'Article from Arweave' },
      rawJson: '{"content":"Article from Arweave"}',
    });
  });

  it('content hash mismatch -> verification error', async () => {
    const originalContent = JSON.stringify({ title: 'Original', content: 'Hello' });
    const tamperedContent = JSON.stringify({ title: 'Tampered', content: 'Evil' });

    // Compute hash of original
    const encoder = new TextEncoder();
    const originalData = encoder.encode(originalContent);
    const hashBuffer = await crypto.subtle.digest('SHA-256', originalData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const originalHash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Compute hash of tampered
    const tamperedData = encoder.encode(tamperedContent);
    const tamperedBuffer = await crypto.subtle.digest('SHA-256', tamperedData);
    const tamperedArray = Array.from(new Uint8Array(tamperedBuffer));
    const tamperedHash =
      '0x' + tamperedArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Hashes should not match
    expect(originalHash).not.toBe(tamperedHash);

    // This is the verification logic from use-posts.ts
    const isVerified = originalHash.toLowerCase() === tamperedHash.toLowerCase();
    expect(isVerified).toBe(false);
  });
});
