// @vitest-environment node

/**
 * E2E Tests for Social Engagement (Comments + Likes)
 *
 * Prerequisites:
 * - Madara devnet running (docker-compose up)
 * - Contracts deployed (.deployments.json exists)
 *
 * Run with: pnpm test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Account } from 'starknet';
import {
  getDeployerAccount,
  getUserAccount,
  getProvider,
  getBlockNumber,
  publishTweet,
  disablePublishCooldown,
  disableCommentCooldown,
  addComment,
  getCommentCount,
  getCommentsForPost,
  likePost,
  unlikePost,
  getPostLikes,
  hasLikedPost,
  likeComment,
  getComment,
  isBanned,
  unbanUser,
  waitForState,
  RPC_URL,
  USER_A,
} from './utils/blockchain';

const BLOCKCHAIN_TIMEOUT = 60_000;

describe('Social Engagement E2E', () => {
  let deployer: Account;
  let userA: Account;

  beforeAll(async () => {
    try {
      const blockNumber = await getBlockNumber();
      console.log(`Connected to Madara at ${RPC_URL}, block #${blockNumber}`);
    } catch (error) {
      throw new Error(`Cannot connect to Madara at ${RPC_URL}. Is it running? Error: ${error}`);
    }

    deployer = getDeployerAccount();
    userA = getUserAccount(USER_A);

    await disablePublishCooldown(deployer);
    await disableCommentCooldown(deployer);

    // Ensure USER_A is not banned (may be left over from moderation tests)
    if (await isBanned(USER_A.address)) {
      await unbanUser(deployer, USER_A.address);
    }
  }, BLOCKCHAIN_TIMEOUT);

  it('should add a comment to a post', async () => {
    // Fresh post per test to avoid stale state
    const { postId } = await publishTweet(deployer, 'Post for comment test');
    const countBefore = await getCommentCount(postId);
    const contentHash = `0x${Date.now().toString(16)}`;

    await addComment(deployer, postId, contentHash);

    const countAfter = await getCommentCount(postId);
    expect(countAfter).toBe(countBefore + 1);
  }, BLOCKCHAIN_TIMEOUT);

  it('should add a nested comment (reply)', async () => {
    const { postId } = await publishTweet(deployer, 'Post for reply test');

    // Add parent comment
    const parentHash = `0x${Date.now().toString(16)}a`;
    await addComment(deployer, postId, parentHash);

    // Get the actual global comment ID from the comments list
    const comments = await getCommentsForPost(postId);
    const parentCommentId = comments[comments.length - 1].id;

    // Add reply
    const replyHash = `0x${Date.now().toString(16)}b`;
    await addComment(deployer, postId, replyHash, parentCommentId);

    // Verify reply has correct parent
    const updatedComments = await getCommentsForPost(postId);
    const reply = updatedComments[updatedComments.length - 1];
    expect(reply.parentCommentId).toBe(parentCommentId);
    expect(reply.postId).toBe(postId);
  }, BLOCKCHAIN_TIMEOUT);

  it('should like and unlike a post', async () => {
    // Fresh post so no prior likes
    const { postId } = await publishTweet(deployer, 'Post for like test');

    expect(await getPostLikes(postId)).toBe(0);

    await likePost(deployer, postId);

    const likesAfterLike = await waitForState(() => getPostLikes(postId), 1, 20000);
    expect(likesAfterLike).toBe(1);
    expect(await hasLikedPost(postId, deployer.address)).toBe(true);

    await unlikePost(deployer, postId);

    const likesAfterUnlike = await waitForState(() => getPostLikes(postId), 0, 20000);
    expect(likesAfterUnlike).toBe(0);
    expect(await hasLikedPost(postId, deployer.address)).toBe(false);
  }, BLOCKCHAIN_TIMEOUT);

  it('should like a comment', async () => {
    const { postId } = await publishTweet(deployer, 'Post for comment like test');

    const contentHash = `0x${Date.now().toString(16)}c`;
    await addComment(deployer, postId, contentHash);

    // Get the actual global comment ID
    const comments = await getCommentsForPost(postId);
    const commentId = comments[comments.length - 1].id;

    await likeComment(deployer, commentId);

    const comment = await getComment(commentId);
    expect(comment.likeCount).toBeGreaterThanOrEqual(1);
  }, BLOCKCHAIN_TIMEOUT);

  it('should allow multiple users to comment on the same post', async () => {
    const { postId } = await publishTweet(deployer, 'Post for multi-user comments');
    const countBefore = await getCommentCount(postId);

    const hash1 = `0x${Date.now().toString(16)}d`;
    const hash2 = `0x${(Date.now() + 1).toString(16)}e`;

    await addComment(deployer, postId, hash1);
    await addComment(userA, postId, hash2);

    const countAfter = await getCommentCount(postId);
    expect(countAfter).toBe(countBefore + 2);
  }, BLOCKCHAIN_TIMEOUT);

  it('should prevent double-liking a post', async () => {
    const { postId } = await publishTweet(deployer, 'Post for double-like test');

    await likePost(deployer, postId);

    // Second like should revert
    await expect(likePost(deployer, postId)).rejects.toThrow();
  }, BLOCKCHAIN_TIMEOUT);
});
