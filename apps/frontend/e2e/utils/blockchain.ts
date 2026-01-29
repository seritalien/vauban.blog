/**
 * E2E Test Utilities for Blockchain Interactions
 *
 * These utilities allow E2E tests to interact directly with the Madara devnet.
 */

import { Account, RpcProvider, shortString } from 'starknet';
import { DEPLOYER, CONTRACTS, RPC_URL } from '../fixtures/test-accounts';

// Re-export for convenience
export { DEPLOYER, CONTRACTS, RPC_URL };

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
