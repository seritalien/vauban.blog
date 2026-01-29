// @vitest-environment node

/**
 * E2E Tests for Follows (Social Graph)
 *
 * Tests follow/unfollow, counts, and error cases.
 * Each test ensures clean state before running.
 *
 * Prerequisites:
 * - Madara devnet running (docker-compose up)
 * - Contracts deployed (.deployments.json exists)
 *
 * Run with: pnpm test:e2e
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Account } from 'starknet';
import {
  getDeployerAccount,
  getUserAccount,
  getBlockNumber,
  followUser,
  unfollowUser,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
  RPC_URL,
  DEPLOYER,
  USER_A,
  USER_B,
} from './utils/blockchain';

const BLOCKCHAIN_TIMEOUT = 120_000;

/**
 * Best-effort unfollow — silently ignores errors (e.g., not following, fee issues).
 * Waits for state to propagate after unfollowing.
 */
async function safeUnfollow(account: Account, targetAddress: string): Promise<void> {
  try {
    const following = await isFollowing(account.address, targetAddress);
    if (following) {
      await unfollowUser(account, targetAddress);
      // Wait for state to propagate
      const start = Date.now();
      while (Date.now() - start < 10000) {
        const stillFollowing = await isFollowing(account.address, targetAddress);
        if (!stillFollowing) break;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  } catch {
    // Ignore cleanup errors — state might already be clean
  }
}

describe('Follows Social E2E', () => {
  let deployer: Account;
  let userA: Account;
  let userB: Account;

  beforeAll(async () => {
    try {
      const blockNumber = await getBlockNumber();
      console.log(`Connected to Madara at ${RPC_URL}, block #${blockNumber}`);
    } catch (error) {
      throw new Error(`Cannot connect to Madara at ${RPC_URL}. Is it running? Error: ${error}`);
    }

    deployer = getDeployerAccount();
    userA = getUserAccount(USER_A);
    userB = getUserAccount(USER_B);

    // Disable follow cooldown (best-effort, deployer may not own Follows contract)
    try {
      const { CONTRACTS } = await import('../fixtures/test-accounts');
      const result = await deployer.execute({
        contractAddress: CONTRACTS.Follows,
        entrypoint: 'set_follow_cooldown',
        calldata: ['0'],
      });
      await deployer.waitForTransaction(result.transaction_hash);
    } catch {
      console.log('Could not disable follow cooldown (deployer may not be Follows owner)');
    }
  }, BLOCKCHAIN_TIMEOUT);

  // Clean up ALL follow relationships before each test
  beforeEach(async () => {
    await safeUnfollow(userA, USER_B.address);
    await safeUnfollow(userA, DEPLOYER.address);
    await safeUnfollow(userB, USER_A.address);
    await safeUnfollow(deployer, USER_A.address);
  }, BLOCKCHAIN_TIMEOUT);

  it('should follow a user and verify counts', async () => {
    const followerCountBefore = await getFollowerCount(USER_B.address);
    const followingCountBefore = await getFollowingCount(USER_A.address);

    await followUser(userA, USER_B.address);

    expect(await isFollowing(USER_A.address, USER_B.address)).toBe(true);

    const followerCountAfter = await getFollowerCount(USER_B.address);
    expect(followerCountAfter).toBe(followerCountBefore + 1);

    const followingCountAfter = await getFollowingCount(USER_A.address);
    expect(followingCountAfter).toBe(followingCountBefore + 1);
  }, BLOCKCHAIN_TIMEOUT);

  it('should prevent following self', async () => {
    await expect(followUser(deployer, DEPLOYER.address)).rejects.toThrow();
  }, BLOCKCHAIN_TIMEOUT);

  it('should prevent double-following', async () => {
    await followUser(userA, DEPLOYER.address);

    // Second follow should revert
    await expect(followUser(userA, DEPLOYER.address)).rejects.toThrow();
  }, BLOCKCHAIN_TIMEOUT);

  it('should unfollow a user and verify counts decrease', async () => {
    await followUser(userA, USER_B.address);
    expect(await isFollowing(USER_A.address, USER_B.address)).toBe(true);

    const followerCountBefore = await getFollowerCount(USER_B.address);

    await unfollowUser(userA, USER_B.address);

    expect(await isFollowing(USER_A.address, USER_B.address)).toBe(false);

    const followerCountAfter = await getFollowerCount(USER_B.address);
    expect(followerCountAfter).toBe(followerCountBefore - 1);
  }, BLOCKCHAIN_TIMEOUT);

  it('should support mutual follows (bidirectional)', async () => {
    await followUser(userA, USER_B.address);
    await followUser(userB, USER_A.address);

    expect(await isFollowing(USER_A.address, USER_B.address)).toBe(true);
    expect(await isFollowing(USER_B.address, USER_A.address)).toBe(true);

    const aFollowing = await getFollowingCount(USER_A.address);
    const bFollowing = await getFollowingCount(USER_B.address);
    expect(aFollowing).toBeGreaterThanOrEqual(1);
    expect(bFollowing).toBeGreaterThanOrEqual(1);
  }, BLOCKCHAIN_TIMEOUT);
});
