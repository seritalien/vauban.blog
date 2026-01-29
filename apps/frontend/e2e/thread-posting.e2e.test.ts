/**
 * E2E Tests for Thread Posting
 *
 * These tests interact directly with the Madara devnet blockchain.
 * They test the atomic thread posting functionality that was previously broken.
 *
 * Run with: npx vitest run e2e/thread-posting.e2e.test.ts
 *
 * Prerequisites:
 * - Madara devnet running (docker-compose up)
 * - Contracts deployed (.deployments.json exists)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDeployerAccount,
  getProvider,
  getPostCount,
  getPost,
  getThreadPosts,
  publishThreadAtomic,
  publishTweet,
  getBlockNumber,
  disablePublishCooldown,
  getPublishCooldown,
  RPC_URL,
} from './utils/blockchain';
import type { Account } from 'starknet';

// Increase timeout for blockchain operations
const BLOCKCHAIN_TIMEOUT = 60000; // 60 seconds

describe('Thread Posting E2E', () => {
  let account: Account;
  let initialPostCount: number;

  beforeAll(async () => {
    // Verify Madara is running
    getProvider(); // verify provider is available
    try {
      const blockNumber = await getBlockNumber();
      console.log(`Connected to Madara at ${RPC_URL}, block #${blockNumber}`);
    } catch (error) {
      throw new Error(`Cannot connect to Madara at ${RPC_URL}. Is it running? Error: ${error}`);
    }

    account = getDeployerAccount();

    // Disable cooldown for atomic thread posting tests
    const currentCooldown = await getPublishCooldown();
    if (currentCooldown > 0) {
      console.log(`Current cooldown: ${currentCooldown}s, disabling for tests...`);
      await disablePublishCooldown(account);
    }

    initialPostCount = await getPostCount();
    console.log(`Initial post count: ${initialPostCount}`);
  }, BLOCKCHAIN_TIMEOUT);

  describe('Single Tweet', () => {
    it('should publish a single tweet successfully', async () => {
      const postCountBefore = await getPostCount();

      const result = await publishTweet(account, 'Hello from E2E test!');

      expect(result.txHash).toBeTruthy();
      expect(result.txHash.startsWith('0x')).toBe(true);

      const postCountAfter = await getPostCount();
      expect(postCountAfter).toBe(postCountBefore + 1);

      // Verify the post
      const post = await getPost(result.postId);
      expect(post.id).toBe(result.postId);
      expect(post.postType).toBe(0); // POST_TYPE_TWEET
      expect(post.threadRootId).toBe(0); // Not part of a thread
    }, BLOCKCHAIN_TIMEOUT);
  });

  describe('Atomic Thread Posting', () => {
    it('should publish a 2-post thread atomically', async () => {
      const postCountBefore = await getPostCount();

      const result = await publishThreadAtomic(account, [
        { content: 'Thread post 1 - The beginning' },
        { content: 'Thread post 2 - The continuation' },
      ]);

      expect(result.txHash).toBeTruthy();
      expect(result.threadRootId).toBe(postCountBefore + 1);

      const postCountAfter = await getPostCount();
      expect(postCountAfter).toBe(postCountBefore + 2);

      // Verify thread root
      const rootPost = await getPost(result.threadRootId);
      expect(rootPost.id).toBe(result.threadRootId);
      expect(rootPost.postType).toBe(1); // POST_TYPE_THREAD
      expect(rootPost.threadRootId).toBe(0); // Root has no thread_root_id

      // Verify continuation
      const continuationPost = await getPost(result.threadRootId + 1);
      expect(continuationPost.postType).toBe(1); // POST_TYPE_THREAD
      expect(continuationPost.threadRootId).toBe(result.threadRootId);

      // Verify thread posts retrieval
      const threadPostIds = await getThreadPosts(result.threadRootId);
      expect(threadPostIds.length).toBeGreaterThanOrEqual(2);
      expect(threadPostIds).toContain(result.threadRootId);
      expect(threadPostIds).toContain(result.threadRootId + 1);
    }, BLOCKCHAIN_TIMEOUT);

    it('should publish a 3-post thread atomically (the bug case)', async () => {
      const postCountBefore = await getPostCount();

      // This was the failing case - 3 posts caused nonce issues
      const result = await publishThreadAtomic(account, [
        { content: 'Thread 1/3 - Introduction' },
        { content: 'Thread 2/3 - Development' },
        { content: 'Thread 3/3 - Conclusion' },
      ]);

      expect(result.txHash).toBeTruthy();
      expect(result.threadRootId).toBe(postCountBefore + 1);

      const postCountAfter = await getPostCount();
      expect(postCountAfter).toBe(postCountBefore + 3);

      // Verify all posts are linked correctly
      for (let i = 0; i < 3; i++) {
        const post = await getPost(result.threadRootId + i);
        expect(post.postType).toBe(1); // POST_TYPE_THREAD

        if (i === 0) {
          // Root post
          expect(post.threadRootId).toBe(0);
        } else {
          // Continuation posts
          expect(post.threadRootId).toBe(result.threadRootId);
        }
      }

      // Verify thread retrieval - count should be at least 3
      const threadPostIds = await getThreadPosts(result.threadRootId);
      expect(threadPostIds.length).toBeGreaterThanOrEqual(3);
    }, BLOCKCHAIN_TIMEOUT);

    it('should publish a 5-post thread atomically', async () => {
      const postCountBefore = await getPostCount();

      const result = await publishThreadAtomic(account, [
        { content: 'Long thread 1/5' },
        { content: 'Long thread 2/5' },
        { content: 'Long thread 3/5' },
        { content: 'Long thread 4/5' },
        { content: 'Long thread 5/5' },
      ]);

      expect(result.txHash).toBeTruthy();

      const postCountAfter = await getPostCount();
      expect(postCountAfter).toBe(postCountBefore + 5);

      // All 5 posts should be in the thread (at minimum)
      const threadPostIds = await getThreadPosts(result.threadRootId);
      expect(threadPostIds.length).toBeGreaterThanOrEqual(5);
    }, BLOCKCHAIN_TIMEOUT);

    it('should handle single-post thread', async () => {
      const postCountBefore = await getPostCount();

      const result = await publishThreadAtomic(account, [
        { content: 'Just a single post thread' },
      ]);

      expect(result.txHash).toBeTruthy();

      const postCountAfter = await getPostCount();
      expect(postCountAfter).toBe(postCountBefore + 1);

      const post = await getPost(result.threadRootId);
      expect(post.postType).toBe(1); // Still a thread type
      expect(post.threadRootId).toBe(0);
    }, BLOCKCHAIN_TIMEOUT);
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple threads created back-to-back', async () => {
      const postCountBefore = await getPostCount();

      // Create two threads sequentially (not in parallel to avoid nonce issues)
      const thread1 = await publishThreadAtomic(account, [
        { content: 'First thread - part 1' },
        { content: 'First thread - part 2' },
      ]);

      const thread2 = await publishThreadAtomic(account, [
        { content: 'Second thread - part 1' },
        { content: 'Second thread - part 2' },
      ]);

      const postCountAfter = await getPostCount();
      expect(postCountAfter).toBe(postCountBefore + 4);

      // Verify threads are independent
      expect(thread2.threadRootId).toBe(thread1.threadRootId + 2);

      // Verify each thread has correct posts
      const thread1Posts = await getThreadPosts(thread1.threadRootId);
      expect(thread1Posts.length).toBe(2);

      const thread2Posts = await getThreadPosts(thread2.threadRootId);
      expect(thread2Posts.length).toBe(2);
    }, BLOCKCHAIN_TIMEOUT * 2);
  });

  describe('Edge Cases', () => {
    it('should reject empty thread', async () => {
      // This should throw synchronously before any blockchain call
      await expect(
        publishThreadAtomic(account, [])
      ).rejects.toThrow('Cannot publish empty thread');
    }, 5000); // Short timeout - this should fail fast

    it('should handle thread after tweet', async () => {
      // Tweet first
      const tweet = await publishTweet(account, 'A simple tweet');

      // Then thread
      const thread = await publishThreadAtomic(account, [
        { content: 'Thread after tweet - 1' },
        { content: 'Thread after tweet - 2' },
      ]);

      expect(thread.threadRootId).toBe(tweet.postId + 1);

      // Verify tweet is not part of thread
      const tweetPost = await getPost(tweet.postId);
      expect(tweetPost.postType).toBe(0); // TWEET
      expect(tweetPost.threadRootId).toBe(0);

      // Verify thread is separate
      const threadRoot = await getPost(thread.threadRootId);
      expect(threadRoot.postType).toBe(1); // THREAD
    }, BLOCKCHAIN_TIMEOUT);
  });
});
