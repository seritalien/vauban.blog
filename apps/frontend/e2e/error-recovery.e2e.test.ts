// @vitest-environment node

/**
 * E2E Tests for Error Recovery and Edge Cases
 *
 * Tests error handling: accessing non-existent resources,
 * invalid operations, pause/unpause, and soft delete.
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
  getProvider,
  getBlockNumber,
  getPost,
  disablePublishCooldown,
  publishTweet,
  unlikePost,
  pauseBlogRegistry,
  unpauseBlogRegistry,
  deletePost,
  isPostDeleted,
  disableCommentCooldown,
  waitForState,
  RPC_URL,
} from './utils/blockchain';

const BLOCKCHAIN_TIMEOUT = 120_000;

describe('Error Recovery E2E', () => {
  let deployer: Account;

  beforeAll(async () => {
    try {
      const blockNumber = await getBlockNumber();
      console.log(`Connected to Madara at ${RPC_URL}, block #${blockNumber}`);
    } catch (error) {
      throw new Error(`Cannot connect to Madara at ${RPC_URL}. Is it running? Error: ${error}`);
    }

    deployer = getDeployerAccount();
    await disablePublishCooldown(deployer);
    await disableCommentCooldown(deployer);
  }, BLOCKCHAIN_TIMEOUT);

  it('should revert when accessing a non-existent post', async () => {
    await expect(getPost(999999)).rejects.toThrow();
  }, BLOCKCHAIN_TIMEOUT);

  it('should revert when unliking a post that was not liked', async () => {
    const { postId } = await publishTweet(deployer, 'Post for unlike test');

    // Try to unlike without having liked
    await expect(unlikePost(deployer, postId)).rejects.toThrow();
  }, BLOCKCHAIN_TIMEOUT);

  it('should block publishing while BlogRegistry is paused', async () => {
    await pauseBlogRegistry(deployer);

    try {
      await expect(publishTweet(deployer, 'Should fail - paused')).rejects.toThrow();
    } finally {
      // Always unpause and WAIT for propagation to avoid breaking other tests
      await unpauseBlogRegistry(deployer);
      // Verify unpause took effect by successfully publishing
      let unpaused = false;
      for (let i = 0; i < 10; i++) {
        try {
          await publishTweet(deployer, 'Unpause verification');
          unpaused = true;
          break;
        } catch {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      if (!unpaused) {
        // Try unpause one more time
        await unpauseBlogRegistry(deployer);
      }
    }
  }, BLOCKCHAIN_TIMEOUT);

  it('should soft-delete a post and verify is_deleted flag', async () => {
    const { postId } = await publishTweet(deployer, 'Post to be deleted');

    expect(await isPostDeleted(postId)).toBe(false);

    await deletePost(deployer, postId);

    expect(await isPostDeleted(postId)).toBe(true);
  }, BLOCKCHAIN_TIMEOUT);

  it('should resume normal operation after unpause', async () => {
    // Verify the unpause from the pause test worked
    const { postId } = await publishTweet(deployer, 'Post after unpause');
    const post = await getPost(postId);
    expect(post.id).toBe(postId);
  }, BLOCKCHAIN_TIMEOUT);
});
