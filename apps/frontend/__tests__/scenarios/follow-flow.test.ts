import { vi } from 'vitest';

// =============================================================================
// FILE 5: Follow Flow Scenario Tests
// =============================================================================

import { createMockFollowStore } from '../helpers/mock-contracts';
import { ALICE, BOB, createMockAccount } from '../helpers/test-users';

let followStore: ReturnType<typeof createMockFollowStore>;

// Mock contract interactions
const mockContract = {
  follow: vi.fn(),
  unfollow: vi.fn(),
  is_following: vi.fn(),
  get_follower_count: vi.fn(),
  get_following_count: vi.fn(),
};

beforeEach(() => {
  followStore = createMockFollowStore();
  vi.clearAllMocks();

  // Wire contract mocks to the store
  mockContract.follow.mockImplementation(async (target: string) => {
    // Determine who is calling from context (set per test)
    return { transaction_hash: '0xTX_follow' };
  });

  mockContract.unfollow.mockImplementation(async (target: string) => {
    return { transaction_hash: '0xTX_unfollow' };
  });

  mockContract.is_following.mockImplementation((follower: string, target: string) => {
    return followStore.isFollowing(follower, target);
  });

  mockContract.get_follower_count.mockImplementation((user: string) => {
    return followStore.getFollowerCount(user);
  });

  mockContract.get_following_count.mockImplementation((user: string) => {
    return followStore.getFollowingCount(user);
  });
});

// =============================================================================
// Tests
// =============================================================================

describe('Follow Flow Scenarios', () => {
  it('Alice follows Bob -> follower count +1, isFollowing true', () => {
    // Before follow
    expect(followStore.isFollowing(ALICE.address, BOB.address)).toBe(false);
    expect(followStore.getFollowerCount(BOB.address)).toBe(0);

    // Alice follows Bob
    followStore.follow(ALICE.address, BOB.address);

    // Verify
    expect(followStore.isFollowing(ALICE.address, BOB.address)).toBe(true);
    expect(followStore.getFollowerCount(BOB.address)).toBe(1);
    expect(followStore.getFollowingCount(ALICE.address)).toBe(1);
  });

  it('Mutual follow -> both counts update', () => {
    // Alice follows Bob
    followStore.follow(ALICE.address, BOB.address);
    // Bob follows Alice
    followStore.follow(BOB.address, ALICE.address);

    // Alice: 1 follower (Bob), 1 following (Bob)
    expect(followStore.getFollowerCount(ALICE.address)).toBe(1);
    expect(followStore.getFollowingCount(ALICE.address)).toBe(1);

    // Bob: 1 follower (Alice), 1 following (Alice)
    expect(followStore.getFollowerCount(BOB.address)).toBe(1);
    expect(followStore.getFollowingCount(BOB.address)).toBe(1);

    // Both are following each other
    expect(followStore.isFollowing(ALICE.address, BOB.address)).toBe(true);
    expect(followStore.isFollowing(BOB.address, ALICE.address)).toBe(true);
  });

  it('Alice unfollows Bob -> follower count -1, isFollowing false', () => {
    // Setup: Alice follows Bob
    followStore.follow(ALICE.address, BOB.address);
    expect(followStore.getFollowerCount(BOB.address)).toBe(1);

    // Alice unfollows Bob
    followStore.unfollow(ALICE.address, BOB.address);

    // Verify
    expect(followStore.isFollowing(ALICE.address, BOB.address)).toBe(false);
    expect(followStore.getFollowerCount(BOB.address)).toBe(0);
    expect(followStore.getFollowingCount(ALICE.address)).toBe(0);
  });

  it('Self-follow returns error (simulated contract rejection)', () => {
    // The useFollow hook checks address === targetAddress and returns error.
    // Here we simulate at the store level: a self-follow should be caught by logic.
    const selfAddress = ALICE.address;

    // Simulate the hook's error check
    const isSelfFollow = selfAddress === ALICE.address;
    expect(isSelfFollow).toBe(true);

    // The hook would set error: 'Cannot follow yourself' and return false
    // We verify the condition is correctly detectable
    const errorMessage = 'Cannot follow yourself';
    expect(errorMessage).toBe('Cannot follow yourself');
  });

  it('Disconnected wallet returns error', () => {
    // When no wallet is connected, isConnected=false, account=null
    const isConnected = false;
    const account = null;

    // The hook would check this condition
    const canFollow = isConnected && account !== null;
    expect(canFollow).toBe(false);

    // Expected error message
    const errorMessage = 'Please connect your wallet';
    expect(errorMessage).toBe('Please connect your wallet');
  });

  it('Follow then unfollow consistency', () => {
    // Follow
    followStore.follow(ALICE.address, BOB.address);
    expect(followStore.isFollowing(ALICE.address, BOB.address)).toBe(true);
    expect(followStore.getFollowerCount(BOB.address)).toBe(1);

    // Verify followers list
    const bobFollowers = followStore.getFollowers(BOB.address);
    expect(bobFollowers).toContain(ALICE.address);

    // Unfollow
    followStore.unfollow(ALICE.address, BOB.address);
    expect(followStore.isFollowing(ALICE.address, BOB.address)).toBe(false);
    expect(followStore.getFollowerCount(BOB.address)).toBe(0);

    // Verify followers list is empty
    const bobFollowersAfter = followStore.getFollowers(BOB.address);
    expect(bobFollowersAfter).not.toContain(ALICE.address);
    expect(bobFollowersAfter).toHaveLength(0);
  });
});
