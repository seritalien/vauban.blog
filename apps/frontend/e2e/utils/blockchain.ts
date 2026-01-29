/**
 * E2E Test Utilities for Blockchain Interactions
 *
 * These utilities allow E2E tests to interact directly with the Madara devnet.
 */

import { Account, RpcProvider, shortString, Contract } from 'starknet';
import { DEPLOYER, CONTRACTS, RPC_URL, USER_A, USER_B } from '../fixtures/test-accounts';
import type { TestAccount } from '../fixtures/test-accounts';
import socialAbi from '../../abis/social.json';

// Re-export for convenience
export { DEPLOYER, CONTRACTS, RPC_URL, USER_A, USER_B };

/**
 * Get a configured RPC provider for the devnet
 */
export function getProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC_URL });
}

/**
 * Get the deployer account (pre-funded, ready to use)
 */
export function getDeployerAccount(): Account {
  const provider = getProvider();
  return new Account(provider, DEPLOYER.address, DEPLOYER.privateKey);
}

/**
 * Wait for a transaction to be accepted
 */
export async function waitForTx(provider: RpcProvider, txHash: string): Promise<void> {
  await provider.waitForTransaction(txHash);
}

/**
 * Get current block number
 */
export async function getBlockNumber(): Promise<number> {
  const provider = getProvider();
  const block = await provider.getBlock('latest');
  return block.block_number;
}

/**
 * Disable publish cooldown for testing
 * This allows atomic thread posting in a single multicall transaction
 */
export async function disablePublishCooldown(account: Account): Promise<void> {
  // Defensively ensure BlogRegistry is not paused (may be left paused by error-recovery tests)
  await ensureUnpaused(account);

  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'set_publish_cooldown',
    calldata: ['0'], // 0 seconds cooldown
  });
  await account.waitForTransaction(result.transaction_hash);
  console.log('Publish cooldown disabled for testing');
}

/**
 * Get current publish cooldown
 */
export async function getPublishCooldown(): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'get_publish_cooldown',
    calldata: [],
  });
  return Number(result[0]);
}

/**
 * Get ETH balance of an address
 */
export async function getBalance(address: string): Promise<bigint> {
  const provider = getProvider();
  // ETH contract on Starknet devnet
  const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

  try {
    const result = await provider.callContract({
      contractAddress: ETH_ADDRESS,
      entrypoint: 'balanceOf',
      calldata: [address],
    });
    return BigInt(result[0]);
  } catch {
    return BigInt(0);
  }
}

/**
 * Get post count from BlogRegistry
 */
export async function getPostCount(): Promise<number> {
  const provider = getProvider();

  try {
    const result = await provider.callContract({
      contractAddress: CONTRACTS.BlogRegistry,
      entrypoint: 'get_post_count',
      calldata: [],
    });
    return Number(result[0]);
  } catch (error) {
    console.error('Error getting post count:', error);
    return 0;
  }
}

/**
 * Get a post by ID
 *
 * PostMetadata struct field indices (accounting for u256 taking 2 slots):
 * 0: id, 1: author, 2-3: arweave, 4-5: ipfs, 6: content_hash,
 * 7-8: price (u256 = 2 felts), 9: is_encrypted, 10: created_at, 11: updated_at,
 * 12: is_deleted, 13: current_version, 14: status, 15: reviewer, 16: reviewed_at,
 * 17: featured, 18: featured_at, 19: featured_by,
 * 20: post_type, 21: parent_id, 22: thread_root_id, 23: is_pinned
 */
export async function getPost(postId: number): Promise<{
  id: number;
  author: string;
  postType: number;
  threadRootId: number;
  parentId: number;
  createdAt: number;
}> {
  const provider = getProvider();

  const result = await provider.callContract({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'get_post',
    calldata: [postId.toString()],
  });

  // Parse the result based on the contract's PostMetadata return structure
  return {
    id: Number(result[0]),
    author: result[1],
    postType: Number(result[20] || 0),
    parentId: Number(result[21] || 0),
    threadRootId: Number(result[22] || 0),
    createdAt: Number(result[10] || 0),
  };
}

/**
 * Get thread post count (simpler than parsing full PostMetadata array)
 */
export async function getThreadPostCount(threadRootId: number): Promise<number> {
  const provider = getProvider();

  try {
    const result = await provider.callContract({
      contractAddress: CONTRACTS.BlogRegistry,
      entrypoint: 'get_thread_post_count',
      calldata: [threadRootId.toString()],
    });
    return Number(result[0]);
  } catch (error) {
    console.error('Error getting thread post count:', error);
    return 0;
  }
}

/**
 * Get thread post IDs by iterating from threadRootId
 * Since posts in a thread are sequential, we can derive the IDs from the count
 */
export async function getThreadPosts(threadRootId: number): Promise<number[]> {
  const count = await getThreadPostCount(threadRootId);
  const postIds: number[] = [];

  // Thread posts are: [threadRootId, threadRootId+1, ..., threadRootId+count-1]
  for (let i = 0; i < count; i++) {
    postIds.push(threadRootId + i);
  }
  return postIds;
}

/**
 * Split a string for felt252 (max 31 chars per felt)
 */
export function splitStringForFelt252(str: string): [string, string] {
  if (str.length <= 31) {
    return [str, ''];
  }
  return [str.slice(0, 31), str.slice(31)];
}

/**
 * Publish a thread atomically (all posts in one transaction)
 */
export async function publishThreadAtomic(
  account: Account,
  posts: Array<{ content: string }>
): Promise<{ txHash: string; threadRootId: number }> {
  // Validate input - empty threads are not allowed
  if (!posts || posts.length === 0) {
    throw new Error('Cannot publish empty thread: at least one post is required');
  }

  const postCountBefore = await getPostCount();
  const predictedThreadRootId = postCountBefore + 1;

  // Build multicall
  const calls = posts.map((_post, index) => {
    // Generate a mock CID/hash for testing
    const mockCid = `QmTest${Date.now()}${index}`;
    const mockHash = `0x${(BigInt(index + 1) * BigInt(Date.now())).toString(16).slice(0, 62)}`;

    const [cid1, cid2] = splitStringForFelt252(mockCid);
    const threadRootId = index === 0 ? '0' : String(predictedThreadRootId);

    return {
      contractAddress: CONTRACTS.BlogRegistry,
      entrypoint: 'publish_post_extended',
      calldata: [
        shortString.encodeShortString(cid1),
        cid2 ? shortString.encodeShortString(cid2) : '0',
        shortString.encodeShortString(cid1), // Same for IPFS
        cid2 ? shortString.encodeShortString(cid2) : '0',
        mockHash, // content hash
        '0', // price_low (u256)
        '0', // price_high (u256)
        0, // is_encrypted
        1, // POST_TYPE_THREAD
        '0', // parent_id
        threadRootId,
      ],
    };
  });

  const result = await account.execute(calls);
  const receipt = await account.waitForTransaction(result.transaction_hash);

  // Verify transaction succeeded
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const revertReason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`Transaction failed with status: ${executionStatus}, reason: ${revertReason}`);
  }

  // Return the predicted thread root ID (which we used in the calldata)
  // This is reliable because the first post in the multicall gets ID = postCountBefore + 1
  return {
    txHash: result.transaction_hash,
    threadRootId: predictedThreadRootId,
  };
}

/**
 * Publish a single tweet
 */
export async function publishTweet(
  account: Account,
  _content: string
): Promise<{ txHash: string; postId: number }> {
  const mockCid = `QmTweet${Date.now()}`;
  const mockHash = `0x${BigInt(Date.now()).toString(16).slice(0, 62)}`;
  const [cid1, cid2] = splitStringForFelt252(mockCid);

  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'publish_post_extended',
    calldata: [
      shortString.encodeShortString(cid1),
      cid2 ? shortString.encodeShortString(cid2) : '0',
      shortString.encodeShortString(cid1),
      cid2 ? shortString.encodeShortString(cid2) : '0',
      mockHash,
      '0', // price_low (u256)
      '0', // price_high (u256)
      0, // is_encrypted
      0, // POST_TYPE_TWEET
      '0', // parent_id
      '0', // thread_root_id
    ],
  });

  const receipt = await account.waitForTransaction(result.transaction_hash);

  // Verify transaction succeeded
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    throw new Error(`Transaction failed with status: ${executionStatus}`);
  }

  // Get actual post ID from post count after transaction
  const postCountAfter = await getPostCount();

  return {
    txHash: result.transaction_hash,
    postId: postCountAfter,
  };
}

/**
 * Wait for a state change by polling until a condition is met or timeout.
 * Useful when the RPC node hasn't propagated state yet after waitForTransaction.
 */
export async function waitForState<T>(
  fn: () => Promise<T>,
  expected: T,
  timeoutMs: number = 10000,
  intervalMs: number = 500
): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result === expected) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return fn(); // Final attempt - return whatever it is for the assertion
}

// =============================================================================
// Account Helpers
// =============================================================================

/**
 * Get an Account instance from a TestAccount
 */
export function getUserAccount(testAccount: TestAccount): Account {
  const provider = getProvider();
  return new Account(provider, testAccount.address, testAccount.privateKey);
}

// =============================================================================
// Article / BlogRegistry Helpers
// =============================================================================

/**
 * Publish an article using publish_post (POST_TYPE_ARTICLE).
 * Admins/editors get status PUBLISHED; non-admins get DRAFT.
 */
export async function publishArticle(
  account: Account
): Promise<{ txHash: string; postId: number }> {
  const mockCid = `QmArticle${Date.now()}`;
  const mockHash = `0x${BigInt(Date.now()).toString(16).slice(0, 62)}`;
  const [cid1, cid2] = splitStringForFelt252(mockCid);

  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'publish_post',
    calldata: [
      shortString.encodeShortString(cid1),
      cid2 ? shortString.encodeShortString(cid2) : '0',
      shortString.encodeShortString(cid1),
      cid2 ? shortString.encodeShortString(cid2) : '0',
      mockHash,
      '0', // price_low (u256)
      '0', // price_high (u256)
      0, // is_encrypted
    ],
  });

  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`publishArticle failed: ${executionStatus}, reason: ${reason}`);
  }

  const postCountAfter = await getPostCount();
  return { txHash: result.transaction_hash, postId: postCountAfter };
}

/**
 * Get a post's status field (index 14 in PostMetadata)
 */
export async function getPostStatus(postId: number): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'get_post',
    calldata: [postId.toString()],
  });
  return Number(result[14]);
}

/**
 * Submit a post for review (DRAFT -> PENDING_REVIEW or REJECTED -> PENDING_REVIEW)
 */
export async function submitForReview(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'submit_for_review',
    calldata: [postId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`submitForReview failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Admin approves a post (PENDING_REVIEW -> PUBLISHED)
 */
export async function approvePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'approve_post',
    calldata: [postId.toString()],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Admin rejects a post (PENDING_REVIEW -> REJECTED)
 */
export async function rejectPost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'reject_post',
    calldata: [postId.toString()],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Feature a published post
 */
export async function featurePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'feature_post',
    calldata: [postId.toString()],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Unfeature a post
 */
export async function unfeaturePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'unfeature_post',
    calldata: [postId.toString()],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Archive a published post (PUBLISHED -> ARCHIVED)
 */
export async function archivePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'archive_post',
    calldata: [postId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`archivePost failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Unarchive an archived post (ARCHIVED -> PUBLISHED)
 */
export async function unarchivePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'unarchive_post',
    calldata: [postId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`unarchivePost failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Soft-delete a post (admin only)
 */
export async function deletePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'delete_post',
    calldata: [postId.toString()],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Check if a post is deleted (index 12 in PostMetadata)
 */
export async function isPostDeleted(postId: number): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'get_post',
    calldata: [postId.toString()],
  });
  return Number(result[12]) === 1;
}

/**
 * Pause the BlogRegistry
 */
export async function pauseBlogRegistry(account: Account): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'pause',
    calldata: [],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Unpause the BlogRegistry
 */
export async function unpauseBlogRegistry(account: Account): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.BlogRegistry,
    entrypoint: 'unpause',
    calldata: [],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Ensure BlogRegistry is not paused (defensive check).
 * Silently succeeds if already unpaused.
 */
export async function ensureUnpaused(account: Account): Promise<void> {
  try {
    const provider = getProvider();
    const result = await provider.callContract({
      contractAddress: CONTRACTS.BlogRegistry,
      entrypoint: 'is_paused',
      calldata: [],
    });
    const paused = Number(result[0]) === 1;
    if (paused) {
      await unpauseBlogRegistry(account);
    }
  } catch {
    // Ignore — might not have is_paused endpoint
  }
}

// =============================================================================
// Social Contract Helpers
// =============================================================================

/**
 * Add a comment on a post
 */
export async function addComment(
  account: Account,
  postId: number,
  contentHash: string,
  parentCommentId: number = 0
): Promise<{ txHash: string }> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'add_comment',
    calldata: [postId.toString(), contentHash, parentCommentId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`addComment failed: ${executionStatus}, reason: ${reason}`);
  }
  return { txHash: result.transaction_hash };
}

/**
 * Get comment count for a post
 */
export async function getCommentCount(postId: number): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'get_comment_count_for_post',
    calldata: [postId.toString()],
  });
  return Number(result[0]);
}

/**
 * Get comments for a post (returns array with global comment IDs).
 * Uses Contract with ABI for proper deserialization of Array<Comment>.
 */
export async function getCommentsForPost(
  postId: number,
  limit: number = 100,
  offset: number = 0
): Promise<Array<{ id: number; postId: number; author: string; parentCommentId: number }>> {
  const provider = getProvider();
  const abi = (socialAbi as any).abi || socialAbi;
  const contract = new Contract(abi as any, CONTRACTS.Social, provider);
  const result = await contract.get_comments_for_post(postId, limit, offset);

  // Contract class returns deserialized array of Comment structs
  return (result as any[]).map((comment: any) => ({
    id: Number(comment.id),
    postId: Number(comment.post_id),
    author: comment.author?.toString() || '',
    parentCommentId: Number(comment.parent_comment_id),
  }));
}

/**
 * Get a comment by ID.
 * Comment struct: id, post_id, author, content_hash, parent_comment_id, created_at, is_deleted, like_count
 */
export async function getComment(commentId: number): Promise<{
  id: number;
  postId: number;
  author: string;
  contentHash: string;
  parentCommentId: number;
  isDeleted: boolean;
  likeCount: number;
}> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'get_comment',
    calldata: [commentId.toString()],
  });
  return {
    id: Number(result[0]),
    postId: Number(result[1]),
    author: result[2],
    contentHash: result[3],
    parentCommentId: Number(result[4]),
    isDeleted: Number(result[6]) === 1,
    likeCount: Number(result[7]),
  };
}

/**
 * Like a post
 */
export async function likePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'like_post',
    calldata: [postId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`likePost failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Unlike a post
 */
export async function unlikePost(account: Account, postId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'unlike_post',
    calldata: [postId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`unlikePost failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Get like count for a post
 */
export async function getPostLikes(postId: number): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'get_post_likes',
    calldata: [postId.toString()],
  });
  return Number(result[0]);
}

/**
 * Check if a user has liked a post
 */
export async function hasLikedPost(postId: number, userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'has_liked_post',
    calldata: [postId.toString(), userAddress],
  });
  return Number(result[0]) === 1;
}

/**
 * Like a comment
 */
export async function likeComment(account: Account, commentId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'like_comment',
    calldata: [commentId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`likeComment failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Delete a comment (moderator or owner)
 */
export async function deleteComment(account: Account, commentId: number): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'delete_comment',
    calldata: [commentId.toString()],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`deleteComment failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Ban a user (moderator or owner)
 */
export async function banUser(account: Account, userAddress: string): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'ban_user',
    calldata: [userAddress],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`banUser failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Unban a user (moderator or owner)
 */
export async function unbanUser(account: Account, userAddress: string): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'unban_user',
    calldata: [userAddress],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`unbanUser failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Check if a user is banned
 */
export async function isBanned(userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'is_banned',
    calldata: [userAddress],
  });
  return Number(result[0]) === 1;
}

/**
 * Disable comment cooldown for testing
 */
export async function disableCommentCooldown(account: Account): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Social,
    entrypoint: 'set_comment_cooldown',
    calldata: ['0'],
  });
  await account.waitForTransaction(result.transaction_hash);
}

/**
 * Disable follow cooldown for testing
 */
export async function disableFollowCooldown(account: Account): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Follows,
    entrypoint: 'set_follow_cooldown',
    calldata: ['0'],
  });
  await account.waitForTransaction(result.transaction_hash);
}

// =============================================================================
// Follows Contract Helpers
// =============================================================================

/**
 * Follow a user
 */
export async function followUser(account: Account, targetAddress: string): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Follows,
    entrypoint: 'follow',
    calldata: [targetAddress],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`followUser failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Unfollow a user
 */
export async function unfollowUser(account: Account, targetAddress: string): Promise<void> {
  const result = await account.execute({
    contractAddress: CONTRACTS.Follows,
    entrypoint: 'unfollow',
    calldata: [targetAddress],
  });
  const receipt = await account.waitForTransaction(result.transaction_hash);
  const executionStatus = (receipt as { execution_status?: string }).execution_status;
  if (executionStatus !== 'SUCCEEDED') {
    const reason = (receipt as { revert_reason?: string }).revert_reason || 'Unknown';
    throw new Error(`unfollowUser failed: ${executionStatus}, reason: ${reason}`);
  }
}

/**
 * Check if one user is following another
 */
export async function isFollowing(
  followerAddress: string,
  followedAddress: string
): Promise<boolean> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Follows,
    entrypoint: 'is_following',
    calldata: [followerAddress, followedAddress],
  });
  return Number(result[0]) === 1;
}

/**
 * Get follower count for a user
 */
export async function getFollowerCount(userAddress: string): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Follows,
    entrypoint: 'get_follower_count',
    calldata: [userAddress],
  });
  return Number(result[0]);
}

/**
 * Get following count for a user
 */
export async function getFollowingCount(userAddress: string): Promise<number> {
  const provider = getProvider();
  const result = await provider.callContract({
    contractAddress: CONTRACTS.Follows,
    entrypoint: 'get_following_count',
    calldata: [userAddress],
  });
  return Number(result[0]);
}
