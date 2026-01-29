// @vitest-environment node

/**
 * E2E Tests for Moderation (Comment deletion, banning)
 *
 * Tests moderator actions: deleting comments, banning/unbanning users,
 * and verifying that banned users cannot comment.
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
  disablePublishCooldown,
  disableCommentCooldown,
  publishTweet,
  addComment,
  getComment,
  getCommentsForPost,
  deleteComment,
  banUser,
  unbanUser,
  isBanned,
  waitForState,
  RPC_URL,
  USER_A,
} from './utils/blockchain';

const BLOCKCHAIN_TIMEOUT = 120_000;

/**
 * Best-effort ensure user is unbanned.
 * Waits for state propagation.
 */
async function ensureUnbanned(deployer: Account, userAddress: string): Promise<void> {
  const banned = await isBanned(userAddress);
  if (banned) {
    await unbanUser(deployer, userAddress);
    await waitForState(() => isBanned(userAddress), false, 15000);
  }
}

/**
 * Best-effort ensure user is banned.
 * Waits for state propagation.
 */
async function ensureBanned(deployer: Account, userAddress: string): Promise<void> {
  const banned = await isBanned(userAddress);
  if (!banned) {
    await banUser(deployer, userAddress);
    await waitForState(() => isBanned(userAddress), true, 15000);
  }
}

describe('Moderation E2E', () => {
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

    // Ensure user is not banned from previous runs (with propagation wait)
    await ensureUnbanned(deployer, USER_A.address);
  }, BLOCKCHAIN_TIMEOUT);

  it('should allow moderator to delete a comment', async () => {
    // Create fresh post and comment
    const { postId } = await publishTweet(deployer, 'Post for delete comment test');
    const contentHash = `0xmod${Date.now().toString(16)}`;
    await addComment(userA, postId, contentHash);

    // Get the actual global comment ID
    const comments = await getCommentsForPost(postId);
    const commentId = comments[comments.length - 1].id;

    // Deployer (owner) deletes the comment
    await deleteComment(deployer, commentId);

    const deletedComment = await getComment(commentId);
    expect(deletedComment.isDeleted).toBe(true);
  }, BLOCKCHAIN_TIMEOUT);

  it('should ban a user and verify', async () => {
    await ensureUnbanned(deployer, USER_A.address);

    await banUser(deployer, USER_A.address);
    const banned = await waitForState(() => isBanned(USER_A.address), true, 15000);
    expect(banned).toBe(true);

    // Clean up
    await unbanUser(deployer, USER_A.address);
    const unbanned = await waitForState(() => isBanned(USER_A.address), false, 15000);
    expect(unbanned).toBe(false);
  }, BLOCKCHAIN_TIMEOUT);

  it('should prevent banned user from commenting', async () => {
    const { postId } = await publishTweet(deployer, 'Post for ban test');

    await ensureBanned(deployer, USER_A.address);

    const contentHash = `0xbanned${Date.now().toString(16)}`;
    await expect(addComment(userA, postId, contentHash)).rejects.toThrow();

    // Clean up
    await unbanUser(deployer, USER_A.address);
    await waitForState(() => isBanned(USER_A.address), false, 15000);
  }, BLOCKCHAIN_TIMEOUT);

  it('should allow unbanned user to comment again', async () => {
    const { postId } = await publishTweet(deployer, 'Post for unban test');

    await ensureBanned(deployer, USER_A.address);

    await unbanUser(deployer, USER_A.address);
    await waitForState(() => isBanned(USER_A.address), false, 15000);

    // Should succeed now
    const contentHash = `0xunbanned${Date.now().toString(16)}`;
    await addComment(userA, postId, contentHash);
  }, BLOCKCHAIN_TIMEOUT);

  it('should prevent non-moderator from deleting comments', async () => {
    // Ensure user is not banned (so they can create the comment)
    await ensureUnbanned(deployer, USER_A.address);

    const { postId } = await publishTweet(deployer, 'Post for non-mod test');
    const contentHash = `0xnodelete${Date.now().toString(16)}`;
    await addComment(deployer, postId, contentHash);

    // Get the actual global comment ID
    const comments = await getCommentsForPost(postId);
    const commentId = comments[comments.length - 1].id;

    // userA is not a moderator, should fail
    await expect(deleteComment(userA, commentId)).rejects.toThrow();
  }, BLOCKCHAIN_TIMEOUT);
});
