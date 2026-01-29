import { Contract, RpcProvider, Account, AccountInterface, shortString } from 'starknet';

// Use AccountInterface to support both Account and wallet-provided accounts
type AccountLike = Account | AccountInterface;
import type { PostMetadata, CommentMetadata } from '@vauban/shared-types';

// Static ABI imports — avoids dynamic import() code-splitting that breaks in browser context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import blogRegistryAbi from './abis/blog_registry.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import socialAbi from './abis/social.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import roleRegistryAbi from './abis/role_registry.json';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import reputationAbi from './abis/reputation.json';

// ============================================================================
// PROVIDER CONFIGURATION
// ============================================================================

let providerInstance: RpcProvider | null = null;

export interface StarknetConfig {
  nodeUrl?: string;
  chainId?: string;
}

/**
 * Initialize Starknet provider
 */
export function initStarknetProvider(config: StarknetConfig = {}): RpcProvider {
  const {
    nodeUrl = process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944',
    chainId,
  } = config;

  providerInstance = new RpcProvider({ nodeUrl, chainId: chainId as any });
  return providerInstance;
}

/**
 * Get Starknet provider (initialize if not already done)
 */
export function getProvider(): RpcProvider {
  if (!providerInstance) {
    return initStarknetProvider();
  }
  return providerInstance;
}

// ============================================================================
// CONTRACT ADDRESSES (from config or env)
// ============================================================================

// Contract addresses that can be set at runtime
let contractAddresses: {
  blogRegistry?: string;
  social?: string;
  paymaster?: string;
  sessionKeyManager?: string;
  roleRegistry?: string;
  reputation?: string;
} = {};

/**
 * Set contract addresses (call this from your frontend with Next.js env vars)
 */
export function setContractAddresses(addresses: {
  blogRegistry?: string;
  social?: string;
  paymaster?: string;
  sessionKeyManager?: string;
  roleRegistry?: string;
  reputation?: string;
}) {
  contractAddresses = { ...contractAddresses, ...addresses };
}

export function getBlogRegistryAddress(): string {
  const address = contractAddresses.blogRegistry || process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error('Blog Registry address not set. Call setContractAddresses() first.');
  }
  return address;
}

export function getSocialAddress(): string {
  const address = contractAddresses.social || process.env.NEXT_PUBLIC_SOCIAL_ADDRESS;
  if (!address) {
    throw new Error('Social address not set. Call setContractAddresses() first.');
  }
  return address;
}

export function getPaymasterAddress(): string {
  const address = contractAddresses.paymaster || process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS;
  if (!address) {
    throw new Error('Paymaster address not set. Call setContractAddresses() first.');
  }
  return address;
}

export function getSessionKeyManagerAddress(): string {
  const address = contractAddresses.sessionKeyManager || process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS;
  if (!address) {
    throw new Error('Session Key Manager address not set. Call setContractAddresses() first.');
  }
  return address;
}

// ============================================================================
// BLOG REGISTRY FUNCTIONS
// ============================================================================

/**
 * Get post count
 */
export async function getPostCount(): Promise<number> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_post_count();
    return Number(result);
  } catch (error) {
    console.error('Error getting post count:', error);
    throw new Error(`Failed to get post count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Safely decode a felt252 to string, handling zero values
 */
function safeDecodeShortString(value: any): string {
  if (!value || value.toString() === '0' || value === 0n) {
    return '';
  }
  try {
    return shortString.decodeShortString(value.toString());
  } catch {
    return '';
  }
}

/**
 * Get post metadata by ID
 * Returns extended metadata including post type, parent/thread IDs, and pinned status
 */
export async function getPost(postId: string): Promise<PostMetadata> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_post(postId);

    // Decode and join split felt252 fields
    const arweave1 = safeDecodeShortString(result.arweave_tx_id_1);
    const arweave2 = safeDecodeShortString(result.arweave_tx_id_2);
    const ipfs1 = safeDecodeShortString(result.ipfs_cid_1);
    const ipfs2 = safeDecodeShortString(result.ipfs_cid_2);

    return {
      id: result.id.toString(),
      author: '0x' + BigInt(result.author).toString(16),
      arweaveTxId: joinFelt252Parts(arweave1, arweave2),
      ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
      contentHash: result.content_hash.toString(),
      price: result.price.toString(),
      isEncrypted: result.is_encrypted,
      createdAt: Number(result.created_at),
      updatedAt: Number(result.updated_at),
      isDeleted: result.is_deleted || false,
      // eXtended fields
      postType: Number(result.post_type ?? 2), // Default to article (2) for backwards compatibility
      parentId: result.parent_id && Number(result.parent_id) > 0 ? result.parent_id.toString() : undefined,
      threadRootId: result.thread_root_id && Number(result.thread_root_id) > 0 ? result.thread_root_id.toString() : undefined,
      isPinned: result.is_pinned || false,
    };
  } catch (error) {
    console.error(`Error getting post ${postId}:`, error);
    throw new Error(`Failed to get post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get multiple posts with pagination
 * Returns extended metadata for all posts
 */
export async function getPosts(limit: number = 10, offset: number = 0): Promise<PostMetadata[]> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_posts(limit, offset);

    return result.map((post: any) => {
      // Decode and join split felt252 fields
      const arweave1 = safeDecodeShortString(post.arweave_tx_id_1);
      const arweave2 = safeDecodeShortString(post.arweave_tx_id_2);
      const ipfs1 = safeDecodeShortString(post.ipfs_cid_1);
      const ipfs2 = safeDecodeShortString(post.ipfs_cid_2);

      return {
        id: post.id.toString(),
        author: '0x' + BigInt(post.author).toString(16),
        arweaveTxId: joinFelt252Parts(arweave1, arweave2),
        ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
        contentHash: post.content_hash.toString(),
        price: post.price.toString(),
        isEncrypted: post.is_encrypted,
        createdAt: Number(post.created_at),
        updatedAt: Number(post.updated_at),
        isDeleted: post.is_deleted || false,
        // eXtended fields
        postType: Number(post.post_type ?? 2),
        parentId: post.parent_id && Number(post.parent_id) > 0 ? post.parent_id.toString() : undefined,
        threadRootId: post.thread_root_id && Number(post.thread_root_id) > 0 ? post.thread_root_id.toString() : undefined,
        isPinned: post.is_pinned || false,
      };
    });
  } catch (error) {
    console.error('Error getting posts:', error);
    throw new Error(`Failed to get posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Split a string into two parts for felt252 storage (31 chars each = 62 chars max)
 */
function splitStringForFelt252(str: string): [string, string] {
  if (!str || typeof str !== 'string') {
    throw new Error(`Invalid string for felt252 split: ${str}`);
  }
  const part1 = str.slice(0, 31);
  const part2 = str.slice(31, 62);
  return [part1, part2 || ''];
}

/**
 * Join two felt252 string parts back together
 */
function joinFelt252Parts(part1: string, part2: string): string {
  return (part1 + part2).replace(/\0/g, '');
}

/**
 * Publish a post (requires account)
 */
export async function publishPost(
  account: AccountLike,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string,
  price: string,
  isEncrypted: boolean = false
): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    // Split strings into two parts for felt252 storage (31 chars each)
    const [arweave1, arweave2] = splitStringForFelt252(arweaveTxId);
    const [ipfs1, ipfs2] = splitStringForFelt252(ipfsCid);

    const result = await contract.publish_post(
      shortString.encodeShortString(arweave1),
      arweave2 ? shortString.encodeShortString(arweave2) : 0,
      shortString.encodeShortString(ipfs1),
      ipfs2 ? shortString.encodeShortString(ipfs2) : 0,
      contentHash,
      price,
      isEncrypted
    );

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post published: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error publishing post:', error);
    throw new Error(`Failed to publish post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// EXTENDED POST FUNCTIONS (Twitter-like)
// ============================================================================

// Post type constants (matching contract)
export const POST_TYPE_TWEET = 0;
export const POST_TYPE_THREAD = 1;
export const POST_TYPE_ARTICLE = 2;

/**
 * Publish a post with extended fields (post type, parent, thread)
 * Use this for tweets, thread posts, and replies
 */
export async function publishPostExtended(
  account: AccountLike,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string,
  price: string,
  isEncrypted: boolean = false,
  postType: number = POST_TYPE_ARTICLE,
  parentId: string | number = 0,
  threadRootId: string | number = 0
): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    const [arweave1, arweave2] = splitStringForFelt252(arweaveTxId);
    const [ipfs1, ipfs2] = splitStringForFelt252(ipfsCid);

    const result = await contract.publish_post_extended(
      shortString.encodeShortString(arweave1),
      arweave2 ? shortString.encodeShortString(arweave2) : 0,
      shortString.encodeShortString(ipfs1),
      ipfs2 ? shortString.encodeShortString(ipfs2) : 0,
      contentHash,
      price,
      isEncrypted,
      postType,
      String(parentId),
      String(threadRootId)
    );

    await account.waitForTransaction(result.transaction_hash);

    // Read the post ID from the contract (post_count == latest post_id after publish)
    const postId = await getPostCount();
    console.log(`Extended post published (type=${postType}, id=${postId}): TX ${result.transaction_hash}`);

    return String(postId);
  } catch (error) {
    console.error('Error publishing extended post:', error);
    throw new Error(`Failed to publish extended post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Publish a tweet (short content, < 280 chars)
 */
export async function publishTweet(
  account: AccountLike,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string
): Promise<string> {
  return publishPostExtended(account, arweaveTxId, ipfsCid, contentHash, '0', false, POST_TYPE_TWEET);
}

/**
 * Publish a reply to an existing post
 */
export async function publishReply(
  account: AccountLike,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string,
  parentId: string | number
): Promise<string> {
  return publishPostExtended(account, arweaveTxId, ipfsCid, contentHash, '0', false, POST_TYPE_TWEET, parentId);
}

/**
 * Start a new thread
 */
export async function startThread(
  account: AccountLike,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string
): Promise<string> {
  return publishPostExtended(account, arweaveTxId, ipfsCid, contentHash, '0', false, POST_TYPE_THREAD);
}

/**
 * Continue an existing thread
 */
export async function continueThread(
  account: AccountLike,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string,
  threadRootId: string | number
): Promise<string> {
  return publishPostExtended(account, arweaveTxId, ipfsCid, contentHash, '0', false, POST_TYPE_THREAD, 0, threadRootId);
}

/**
 * Batch publish multiple thread continuations in a single transaction using multicall.
 * This solves nonce issues by bundling all posts into one atomic transaction.
 *
 * @param account - The account to use for signing
 * @param posts - Array of prepared posts with { arweaveTxId, ipfsCid, contentHash }
 * @param threadRootId - The root post ID that all continuations reference
 * @returns Transaction hash
 */
export async function continueThreadBatch(
  account: AccountLike,
  posts: Array<{ arweaveTxId: string; ipfsCid: string; contentHash: string }>,
  threadRootId: string | number
): Promise<string> {
  if (posts.length === 0) {
    throw new Error('No posts to publish');
  }

  const address = getBlogRegistryAddress();

  // Build an array of calls for multicall
  const calls = posts.map((post) => {
    const [arweave1, arweave2] = splitStringForFelt252(post.arweaveTxId);
    const [ipfs1, ipfs2] = splitStringForFelt252(post.ipfsCid);

    return {
      contractAddress: address,
      entrypoint: 'publish_post_extended',
      calldata: [
        shortString.encodeShortString(arweave1),
        arweave2 ? shortString.encodeShortString(arweave2) : '0',
        shortString.encodeShortString(ipfs1),
        ipfs2 ? shortString.encodeShortString(ipfs2) : '0',
        post.contentHash,
        '0', // price_low (u256 low part)
        '0', // price_high (u256 high part)
        0, // is_encrypted (false)
        POST_TYPE_THREAD,
        '0', // parent_id
        String(threadRootId),
      ],
    };
  });

  try {
    // Execute all calls in a single transaction
    const result = await account.execute(calls);
    await account.waitForTransaction(result.transaction_hash);

    console.log(`Thread batch published (${posts.length} posts): TX ${result.transaction_hash}`);
    return result.transaction_hash;
  } catch (error) {
    console.error('Error publishing thread batch:', error);
    throw new Error(`Failed to publish thread batch: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Publish an entire thread atomically in a single transaction.
 * This includes the thread root and all continuations, avoiding nonce issues.
 *
 * @param account - The account to use for signing
 * @param posts - Array of prepared posts (first one becomes thread root)
 * @returns The thread root post ID
 */
export async function publishThreadAtomic(
  account: AccountLike,
  posts: Array<{ arweaveTxId: string; ipfsCid: string; contentHash: string }>
): Promise<string> {
  if (posts.length === 0) {
    throw new Error('No posts to publish');
  }

  const address = getBlogRegistryAddress();

  // Get current post count to predict the thread root ID
  const currentPostCount = await getPostCount();
  const predictedThreadRootId = currentPostCount + 1;

  // Build calls: first post is thread root (threadRootId=0), rest reference the predicted root ID
  const calls = posts.map((post, index) => {
    const [arweave1, arweave2] = splitStringForFelt252(post.arweaveTxId);
    const [ipfs1, ipfs2] = splitStringForFelt252(post.ipfsCid);

    // First post: thread root (threadRootId = 0)
    // Subsequent posts: continuation (threadRootId = predicted root ID)
    const threadRootId = index === 0 ? '0' : String(predictedThreadRootId);

    return {
      contractAddress: address,
      entrypoint: 'publish_post_extended',
      calldata: [
        shortString.encodeShortString(arweave1),
        arweave2 ? shortString.encodeShortString(arweave2) : '0',
        shortString.encodeShortString(ipfs1),
        ipfs2 ? shortString.encodeShortString(ipfs2) : '0',
        post.contentHash,
        '0', // price_low (u256 low part)
        '0', // price_high (u256 high part)
        0, // is_encrypted (false)
        POST_TYPE_THREAD,
        '0', // parent_id
        threadRootId,
      ],
    };
  });

  try {
    // Execute ALL posts in a single atomic transaction
    const result = await account.execute(calls);
    await account.waitForTransaction(result.transaction_hash);

    console.log(`Thread published atomically (${posts.length} posts, root=${predictedThreadRootId}): TX ${result.transaction_hash}`);
    return String(predictedThreadRootId);
  } catch (error) {
    console.error('Error publishing thread atomically:', error);
    throw new Error(`Failed to publish thread: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Pin a post to author's profile
 */
export async function pinPost(account: AccountLike, postId: string): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    const result = await contract.pin_post(postId);
    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post ${postId} pinned: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error pinning post:', error);
    throw new Error(`Failed to pin post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Unpin a post from author's profile
 */
export async function unpinPost(account: AccountLike, postId: string): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    const result = await contract.unpin_post(postId);
    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post ${postId} unpinned: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error unpinning post:', error);
    throw new Error(`Failed to unpin post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the pinned post for an author
 */
export async function getPinnedPost(authorAddress: string): Promise<string | null> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_pinned_post(authorAddress);
    const pinnedId = Number(result);
    return pinnedId > 0 ? pinnedId.toString() : null;
  } catch (error) {
    console.error('Error getting pinned post:', error);
    return null;
  }
}

/**
 * Get posts by type (tweet/thread/article) with pagination
 */
export async function getPostsByType(
  postType: number,
  limit: number = 10,
  offset: number = 0
): Promise<PostMetadata[]> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_posts_by_type(postType, limit, offset);

    return result.map((post: any) => {
      const arweave1 = safeDecodeShortString(post.arweave_tx_id_1);
      const arweave2 = safeDecodeShortString(post.arweave_tx_id_2);
      const ipfs1 = safeDecodeShortString(post.ipfs_cid_1);
      const ipfs2 = safeDecodeShortString(post.ipfs_cid_2);

      return {
        id: post.id.toString(),
        author: '0x' + BigInt(post.author).toString(16),
        arweaveTxId: joinFelt252Parts(arweave1, arweave2),
        ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
        contentHash: post.content_hash.toString(),
        price: post.price.toString(),
        isEncrypted: post.is_encrypted,
        createdAt: Number(post.created_at),
        updatedAt: Number(post.updated_at),
        isDeleted: post.is_deleted || false,
        postType: Number(post.post_type ?? 2),
        parentId: post.parent_id && Number(post.parent_id) > 0 ? post.parent_id.toString() : undefined,
        threadRootId: post.thread_root_id && Number(post.thread_root_id) > 0 ? post.thread_root_id.toString() : undefined,
        isPinned: post.is_pinned || false,
      };
    });
  } catch (error) {
    console.error('Error getting posts by type:', error);
    throw new Error(`Failed to get posts by type: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get replies to a post with pagination
 */
export async function getPostReplies(
  parentId: string,
  limit: number = 10,
  offset: number = 0
): Promise<PostMetadata[]> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_post_replies(parentId, limit, offset);

    return result.map((post: any) => {
      const arweave1 = safeDecodeShortString(post.arweave_tx_id_1);
      const arweave2 = safeDecodeShortString(post.arweave_tx_id_2);
      const ipfs1 = safeDecodeShortString(post.ipfs_cid_1);
      const ipfs2 = safeDecodeShortString(post.ipfs_cid_2);

      return {
        id: post.id.toString(),
        author: '0x' + BigInt(post.author).toString(16),
        arweaveTxId: joinFelt252Parts(arweave1, arweave2),
        ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
        contentHash: post.content_hash.toString(),
        price: post.price.toString(),
        isEncrypted: post.is_encrypted,
        createdAt: Number(post.created_at),
        updatedAt: Number(post.updated_at),
        isDeleted: post.is_deleted || false,
        postType: Number(post.post_type ?? 2),
        parentId: post.parent_id && Number(post.parent_id) > 0 ? post.parent_id.toString() : undefined,
        threadRootId: post.thread_root_id && Number(post.thread_root_id) > 0 ? post.thread_root_id.toString() : undefined,
        isPinned: post.is_pinned || false,
      };
    });
  } catch (error) {
    console.error('Error getting post replies:', error);
    throw new Error(`Failed to get post replies: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get reply count for a post
 */
export async function getReplyCount(parentId: string): Promise<number> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_reply_count(parentId);
    return Number(result);
  } catch (error) {
    console.error('Error getting reply count:', error);
    return 0;
  }
}

/**
 * Get posts in a thread with pagination
 */
export async function getThreadPosts(
  threadRootId: string,
  limit: number = 25,
  offset: number = 0
): Promise<PostMetadata[]> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_thread_posts(threadRootId, limit, offset);

    return result.map((post: any) => {
      const arweave1 = safeDecodeShortString(post.arweave_tx_id_1);
      const arweave2 = safeDecodeShortString(post.arweave_tx_id_2);
      const ipfs1 = safeDecodeShortString(post.ipfs_cid_1);
      const ipfs2 = safeDecodeShortString(post.ipfs_cid_2);

      return {
        id: post.id.toString(),
        author: '0x' + BigInt(post.author).toString(16),
        arweaveTxId: joinFelt252Parts(arweave1, arweave2),
        ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
        contentHash: post.content_hash.toString(),
        price: post.price.toString(),
        isEncrypted: post.is_encrypted,
        createdAt: Number(post.created_at),
        updatedAt: Number(post.updated_at),
        isDeleted: post.is_deleted || false,
        postType: Number(post.post_type ?? 2),
        parentId: post.parent_id && Number(post.parent_id) > 0 ? post.parent_id.toString() : undefined,
        threadRootId: post.thread_root_id && Number(post.thread_root_id) > 0 ? post.thread_root_id.toString() : undefined,
        isPinned: post.is_pinned || false,
      };
    });
  } catch (error) {
    console.error('Error getting thread posts:', error);
    throw new Error(`Failed to get thread posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get post count in a thread
 */
export async function getThreadPostCount(threadRootId: string): Promise<number> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_thread_post_count(threadRootId);
    return Number(result);
  } catch (error) {
    console.error('Error getting thread post count:', error);
    return 0;
  }
}

/**
 * Get count of posts by type
 */
export async function getPostsCountByType(postType: number): Promise<number> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_posts_count_by_type(postType);
    return Number(result);
  } catch (error) {
    console.error('Error getting posts count by type:', error);
    return 0;
  }
}

/**
 * Get the current publish cooldown in seconds
 */
export async function getPublishCooldown(): Promise<number> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_publish_cooldown();
    return Number(result);
  } catch (error) {
    console.error('Error getting publish cooldown:', error);
    return 60; // Default assumption
  }
}

/**
 * Set the publish cooldown (owner only)
 */
export async function setPublishCooldown(
  account: AccountLike,
  cooldownSeconds: number
): Promise<void> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    const result = await contract.set_publish_cooldown(cooldownSeconds);
    await account.waitForTransaction(result.transaction_hash);
  } catch (error) {
    console.error('Error setting publish cooldown:', error);
    throw new Error(`Failed to set cooldown: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if user has access to a post
 */
export async function hasAccess(postId: string, userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.has_access(postId, userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking access:', error);
    return false;
  }
}

/**
 * Purchase access to a paid post
 */
export async function purchasePost(account: AccountLike, postId: string): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    const result = await contract.purchase_post(postId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post ${postId} purchased: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error purchasing post:', error);
    throw new Error(`Failed to purchase post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get post price
 */
export async function getPostPrice(postId: string): Promise<string> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const post = await contract.get_post(postId);
    return post.price.toString();
  } catch (error) {
    console.error('Error getting post price:', error);
    return '0';
  }
}

/**
 * Update a post (requires admin account)
 */
export async function updatePost(
  account: AccountLike,
  postId: string,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string
): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    // Split strings into two parts for felt252 storage (31 chars each)
    const [arweave1, arweave2] = splitStringForFelt252(arweaveTxId);
    const [ipfs1, ipfs2] = splitStringForFelt252(ipfsCid);

    const result = await contract.update_post(
      postId,
      shortString.encodeShortString(arweave1),
      arweave2 ? shortString.encodeShortString(arweave2) : 0,
      shortString.encodeShortString(ipfs1),
      ipfs2 ? shortString.encodeShortString(ipfs2) : 0,
      contentHash
    );

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post ${postId} updated: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error updating post:', error);
    throw new Error(`Failed to update post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a post (soft delete - requires admin account)
 */
export async function deletePost(account: AccountLike, postId: string): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, account);

    const result = await contract.delete_post(postId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post ${postId} deleted: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error deleting post:', error);
    throw new Error(`Failed to delete post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// POST VERSION HISTORY
// ============================================================================

export interface PostVersion {
  version: number;
  arweaveTxId: string;
  ipfsCid: string;
  contentHash: string;
  createdAt: number;
  editor: string;
}

/**
 * Get a specific version of a post
 */
export async function getPostVersion(postId: string, version: number): Promise<PostVersion> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_post_version(postId, version);

    const arweave1 = safeDecodeShortString(result.arweave_tx_id_1);
    const arweave2 = safeDecodeShortString(result.arweave_tx_id_2);
    const ipfs1 = safeDecodeShortString(result.ipfs_cid_1);
    const ipfs2 = safeDecodeShortString(result.ipfs_cid_2);

    return {
      version: Number(result.version),
      arweaveTxId: joinFelt252Parts(arweave1, arweave2),
      ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
      contentHash: result.content_hash.toString(),
      createdAt: Number(result.created_at),
      editor: result.editor.toString(),
    };
  } catch (error) {
    console.error(`Error getting post ${postId} version ${version}:`, error);
    throw new Error(`Failed to get post version: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the total number of versions for a post
 */
export async function getPostVersionCount(postId: string): Promise<number> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_post_version_count(postId);
    return Number(result);
  } catch (error) {
    console.error(`Error getting version count for post ${postId}:`, error);
    return 0;
  }
}

/**
 * Get version history for a post (newest first)
 */
export async function getPostVersions(
  postId: string,
  limit: number = 10,
  offset: number = 0
): Promise<PostVersion[]> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const contract = new Contract(blogRegistryAbi as any, address, provider);

    const result = await contract.get_post_versions(postId, limit, offset);

    return result.map((v: any) => {
      const arweave1 = safeDecodeShortString(v.arweave_tx_id_1);
      const arweave2 = safeDecodeShortString(v.arweave_tx_id_2);
      const ipfs1 = safeDecodeShortString(v.ipfs_cid_1);
      const ipfs2 = safeDecodeShortString(v.ipfs_cid_2);

      return {
        version: Number(v.version),
        arweaveTxId: joinFelt252Parts(arweave1, arweave2),
        ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
        contentHash: v.content_hash.toString(),
        createdAt: Number(v.created_at),
        editor: v.editor.toString(),
      };
    });
  } catch (error) {
    console.error(`Error getting versions for post ${postId}:`, error);
    return [];
  }
}

// ============================================================================
// SOCIAL CONTRACT FUNCTIONS
// ============================================================================

/**
 * Get comments for a post
 */
export async function getCommentsForPost(
  postId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CommentMetadata[]> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.get_comments_for_post(postId, limit, offset);

    return result.map((comment: any) => ({
      id: comment.id.toString(),
      postId: comment.post_id.toString(),
      author: '0x' + BigInt(comment.author).toString(16),
      contentHash: comment.content_hash.toString(),
      parentCommentId: comment.parent_comment_id > 0 ? comment.parent_comment_id.toString() : undefined,
      createdAt: Number(comment.created_at),
      isDeleted: comment.is_deleted,
      likeCount: Number(comment.like_count),
    }));
  } catch (error) {
    console.error(`Error getting comments for post ${postId}:`, error);
    throw new Error(`Failed to get comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get comment count for a post (without fetching full comment objects)
 */
export async function getCommentCountForPost(postId: string): Promise<number> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.get_comment_count_for_post(postId);
    return Number(result);
  } catch (error) {
    console.error(`Error getting comment count for post ${postId}:`, error);
    return 0;
  }
}

/**
 * Add a comment (requires account or session key)
 */
export async function addComment(
  account: AccountLike,
  postId: string,
  contentHash: string,
  parentCommentId: string = '0'
): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, account);

    const result = await contract.add_comment(postId, contentHash, parentCommentId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Comment added: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw new Error(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Like a post
 */
export async function likePost(account: AccountLike, postId: string): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, account);

    const result = await contract.like_post(postId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post liked: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error liking post:', error);
    throw new Error(`Failed to like post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if user liked a post
 */
export async function hasLikedPost(postId: string, userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.has_liked_post(postId, userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking like status:', error);
    return false;
  }
}

/**
 * Get post like count
 */
export async function getPostLikes(postId: string): Promise<number> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.get_post_likes(postId);
    return Number(result);
  } catch (error) {
    console.error('Error getting post likes:', error);
    return 0;
  }
}

/**
 * Unlike a post
 */
export async function unlikePost(account: AccountLike, postId: string): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, account);

    const result = await contract.unlike_post(postId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Post unliked: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error unliking post:', error);
    throw new Error(`Failed to unlike post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Like a comment
 */
export async function likeComment(account: AccountLike, commentId: string): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, account);

    const result = await contract.like_comment(commentId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Comment liked: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error liking comment:', error);
    throw new Error(`Failed to like comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Unlike a comment
 */
export async function unlikeComment(account: AccountLike, commentId: string): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, account);

    const result = await contract.unlike_comment(commentId);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Comment unliked: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error unliking comment:', error);
    throw new Error(`Failed to unlike comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if user liked a comment
 */
export async function hasLikedComment(commentId: string, userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.has_liked_comment(commentId, userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking comment like status:', error);
    return false;
  }
}

// ============================================================================
// SESSION KEY FUNCTIONS
// ============================================================================

/**
 * Add a comment using session key (gasless for the user)
 * This allows authorized session keys to post on behalf of users
 */
export async function addCommentWithSessionKey(
  relayerAccount: Account,  // The account that pays for gas (relayer/paymaster)
  postId: string,
  contentHash: string,
  parentCommentId: string = '0',
  sessionPublicKey: string,
  onBehalfOf: string,  // The user's address the comment is attributed to
  nonce: number
): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, relayerAccount);

    const result = await contract.add_comment_with_session_key(
      postId,
      contentHash,
      parentCommentId,
      sessionPublicKey,
      onBehalfOf,
      nonce
    );

    await relayerAccount.waitForTransaction(result.transaction_hash);
    console.log(`Comment added via session key: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error adding comment with session key:', error);
    throw new Error(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the current nonce for a session key
 */
export async function getSessionKeyNonce(sessionPublicKey: string): Promise<number> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.get_session_key_nonce(sessionPublicKey);
    return Number(result);
  } catch (error) {
    console.error('Error getting session key nonce:', error);
    return 0;
  }
}

/**
 * Get the session key manager address
 */
export async function getSessionKeyManager(): Promise<string> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, provider);

    const result = await contract.get_session_key_manager();
    return result.toString();
  } catch (error) {
    console.error('Error getting session key manager:', error);
    return '';
  }
}

/**
 * Set the session key manager address (admin only)
 */
export async function setSessionKeyManager(
  account: AccountLike,
  managerAddress: string
): Promise<string> {
  const address = getSocialAddress();

  try {
    const contract = new Contract(socialAbi as any, address, account);

    const result = await contract.set_session_key_manager(managerAddress);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Session key manager set: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error setting session key manager:', error);
    throw new Error(`Failed to set session key manager: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate SHA256 hash of content (truncated to fit felt252)
 * Note: felt252 can hold ~252 bits, so we truncate the 256-bit hash to 62 hex chars
 */
export async function calculateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  // Truncate to 62 hex chars (248 bits) to safely fit in felt252
  return `0x${hashHex.slice(0, 62)}`;
}

/**
 * Check if address is valid Starknet address
 */
export function isValidStarknetAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{1,64}$/.test(address);
}

/**
 * Format address for display (truncate middle)
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Check RPC connection
 */
export async function checkRPCConnection(): Promise<boolean> {
  try {
    const provider = getProvider();
    await provider.getChainId();
    return true;
  } catch (error) {
    console.error('RPC connection failed:', error);
    return false;
  }
}

/**
 * Get current block number
 */
export async function getBlockNumber(): Promise<number> {
  const provider = getProvider();
  try {
    const block = await provider.getBlock('latest');
    return block.block_number;
  } catch (error) {
    console.error('Error getting block number:', error);
    throw new Error(`Failed to get block: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// ROLE REGISTRY FUNCTIONS
// ============================================================================

// Role constants matching the Cairo contract
export const ROLE_READER = 0;
export const ROLE_WRITER = 1;
export const ROLE_CONTRIBUTOR = 2;
export const ROLE_MODERATOR = 3;
export const ROLE_EDITOR = 4;
export const ROLE_ADMIN = 5;
export const ROLE_OWNER = 6;

// Role names for display
export const ROLE_NAMES: Record<number, string> = {
  [ROLE_READER]: 'Reader',
  [ROLE_WRITER]: 'Writer',
  [ROLE_CONTRIBUTOR]: 'Contributor',
  [ROLE_MODERATOR]: 'Moderator',
  [ROLE_EDITOR]: 'Editor',
  [ROLE_ADMIN]: 'Admin',
  [ROLE_OWNER]: 'Owner',
};

export interface UserRoleInfo {
  user: string;
  role: number;
  roleName: string;
  grantedAt: number;
  grantedBy: string;
  approvedPostCount: number;
  reputation: bigint;
}

export interface RoleStats {
  totalUsers: number;
  readerCount: number;
  writerCount: number;
  contributorCount: number;
  moderatorCount: number;
  editorCount: number;
  adminCount: number;
  ownerCount: number;
}

/**
 * Get Role Registry contract address
 */
export function getRoleRegistryAddress(): string {
  const address = contractAddresses.roleRegistry || process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error('Role Registry address not set. Call setContractAddresses() first.');
  }
  return address;
}

/**
 * Get a user's role information
 */
export async function getUserRole(userAddress: string): Promise<UserRoleInfo> {
  const provider = getProvider();
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, provider);

    const result = await contract.get_user_role(userAddress);

    return {
      user: result.user.toString(),
      role: Number(result.role),
      roleName: ROLE_NAMES[Number(result.role)] || 'Unknown',
      grantedAt: Number(result.granted_at),
      grantedBy: result.granted_by.toString(),
      approvedPostCount: Number(result.approved_post_count),
      reputation: BigInt(result.reputation.toString()),
    };
  } catch (error) {
    console.error(`Error getting role for user ${userAddress}:`, error);
    // Return default role (READER) for unregistered users
    return {
      user: userAddress,
      role: ROLE_READER,
      roleName: ROLE_NAMES[ROLE_READER],
      grantedAt: 0,
      grantedBy: '',
      approvedPostCount: 0,
      reputation: 0n,
    };
  }
}

/**
 * Check if user has minimum role level
 */
export async function hasMinRole(userAddress: string, minRole: number): Promise<boolean> {
  const provider = getProvider();
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, provider);

    const result = await contract.has_role(userAddress, minRole);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Get role statistics
 */
export async function getRoleStats(): Promise<RoleStats> {
  const provider = getProvider();
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, provider);

    const [totalUsers, reader, writer, contributor, moderator, editor, admin, owner] = await Promise.all([
      contract.get_total_users(),
      contract.get_users_by_role(ROLE_READER),
      contract.get_users_by_role(ROLE_WRITER),
      contract.get_users_by_role(ROLE_CONTRIBUTOR),
      contract.get_users_by_role(ROLE_MODERATOR),
      contract.get_users_by_role(ROLE_EDITOR),
      contract.get_users_by_role(ROLE_ADMIN),
      contract.get_users_by_role(ROLE_OWNER),
    ]);

    return {
      totalUsers: Number(totalUsers),
      readerCount: Number(reader),
      writerCount: Number(writer),
      contributorCount: Number(contributor),
      moderatorCount: Number(moderator),
      editorCount: Number(editor),
      adminCount: Number(admin),
      ownerCount: Number(owner),
    };
  } catch (error) {
    console.error('Error getting role stats:', error);
    return {
      totalUsers: 0,
      readerCount: 0,
      writerCount: 0,
      contributorCount: 0,
      moderatorCount: 0,
      editorCount: 0,
      adminCount: 0,
      ownerCount: 0,
    };
  }
}

/**
 * Grant a role to a user (requires sufficient permissions)
 */
export async function grantRole(
  account: AccountLike,
  userAddress: string,
  role: number
): Promise<string> {
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, account);

    const result = await contract.grant_role(userAddress, role);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Role ${ROLE_NAMES[role]} granted to ${userAddress}: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error granting role:', error);
    throw new Error(`Failed to grant role: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Revoke a user's role (demotes to READER)
 */
export async function revokeRole(account: AccountLike, userAddress: string): Promise<string> {
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, account);

    const result = await contract.revoke_role(userAddress);

    await account.waitForTransaction(result.transaction_hash);
    console.log(`Role revoked for ${userAddress}: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error revoking role:', error);
    throw new Error(`Failed to revoke role: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Register as a new user (gets WRITER role)
 */
export async function registerUser(account: AccountLike): Promise<string> {
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, account);

    const result = await contract.register_user();

    await account.waitForTransaction(result.transaction_hash);
    console.log(`User registered: TX ${result.transaction_hash}`);

    return result.transaction_hash;
  } catch (error) {
    console.error('Error registering user:', error);
    throw new Error(`Failed to register user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if user can publish immediately (CONTRIBUTOR+)
 */
export async function canPublishImmediately(userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, provider);

    const result = await contract.can_publish_immediately(userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking publish permission:', error);
    return false;
  }
}

/**
 * Check if user can manage users (ADMIN+)
 */
export async function canManageUsers(userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const address = getRoleRegistryAddress();

  try {
    const contract = new Contract(roleRegistryAbi as any, address, provider);

    const result = await contract.can_manage_users(userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking manage users permission:', error);
    return false;
  }
}

// ============================================================================
// REPUTATION CONTRACT FUNCTIONS
// ============================================================================

// Badge constants matching the Cairo contract (bitmap values)
export const BADGE_FIRST_POST = 1n;
export const BADGE_PROLIFIC_WRITER = 2n;
export const BADGE_CENTURY_CLUB = 4n;
export const BADGE_FEATURED_AUTHOR = 8n;
export const BADGE_CONVERSATIONALIST = 16n;
export const BADGE_BELOVED = 32n;
export const BADGE_EARLY_ADOPTER = 64n;
export const BADGE_VERIFIED = 128n;
export const BADGE_TOP_WRITER = 256n;
export const BADGE_PREMIUM_AUTHOR = 512n;
export const BADGE_TRUSTED = 1024n;
export const BADGE_GUARDIAN = 2048n;

// Badge metadata for display
export const BADGE_INFO: Record<string, { name: string; description: string; icon: string }> = {
  FIRST_POST: { name: 'First Post', description: 'Published your first article', icon: '✏️' },
  PROLIFIC_WRITER: { name: 'Prolific Writer', description: 'Published 10+ articles', icon: '📝' },
  CENTURY_CLUB: { name: 'Century Club', description: 'Published 100+ articles', icon: '💯' },
  FEATURED_AUTHOR: { name: 'Featured Author', description: 'Had a featured article', icon: '⭐' },
  CONVERSATIONALIST: { name: 'Conversationalist', description: 'Posted 100+ comments', icon: '💬' },
  BELOVED: { name: 'Beloved', description: 'Received 1000+ likes', icon: '❤️' },
  EARLY_ADOPTER: { name: 'Early Adopter', description: 'Joined in the first month', icon: '🚀' },
  VERIFIED: { name: 'Verified', description: 'Completed identity verification', icon: '✅' },
  TOP_WRITER: { name: 'Top Writer', description: 'Monthly top 10 writer', icon: '🏆' },
  PREMIUM_AUTHOR: { name: 'Premium Author', description: 'Has paid subscribers', icon: '💎' },
  TRUSTED: { name: 'Trusted', description: 'Earned Contributor role', icon: '🛡️' },
  GUARDIAN: { name: 'Guardian', description: 'Active moderator', icon: '⚔️' },
};

// Level names
export const LEVEL_NAMES: Record<number, string> = {
  1: 'Newcomer',
  2: 'Active Writer',
  3: 'Established',
  4: 'Veteran',
  5: 'Legend',
};

export interface UserReputation {
  user: string;
  totalPoints: bigint;
  level: number;
  levelName: string;
  badges: bigint;
  badgeList: string[];
  joinedAt: number;
  postCount: number;
  commentCount: number;
  likesReceived: number;
  subscribers: number;
  featuredCount: number;
}

/**
 * Get Reputation contract address
 */
export function getReputationAddress(): string {
  const address = contractAddresses.reputation || process.env.NEXT_PUBLIC_REPUTATION_ADDRESS;
  if (!address) {
    throw new Error('Reputation address not set. Call setContractAddresses() first.');
  }
  return address;
}

/**
 * Parse badge bitmap into list of badge names
 */
function parseBadges(badgeBitmap: bigint): string[] {
  const badges: string[] = [];
  const badgeValues = [
    { value: BADGE_FIRST_POST, name: 'FIRST_POST' },
    { value: BADGE_PROLIFIC_WRITER, name: 'PROLIFIC_WRITER' },
    { value: BADGE_CENTURY_CLUB, name: 'CENTURY_CLUB' },
    { value: BADGE_FEATURED_AUTHOR, name: 'FEATURED_AUTHOR' },
    { value: BADGE_CONVERSATIONALIST, name: 'CONVERSATIONALIST' },
    { value: BADGE_BELOVED, name: 'BELOVED' },
    { value: BADGE_EARLY_ADOPTER, name: 'EARLY_ADOPTER' },
    { value: BADGE_VERIFIED, name: 'VERIFIED' },
    { value: BADGE_TOP_WRITER, name: 'TOP_WRITER' },
    { value: BADGE_PREMIUM_AUTHOR, name: 'PREMIUM_AUTHOR' },
    { value: BADGE_TRUSTED, name: 'TRUSTED' },
    { value: BADGE_GUARDIAN, name: 'GUARDIAN' },
  ];

  for (const badge of badgeValues) {
    if ((badgeBitmap & badge.value) !== 0n) {
      badges.push(badge.name);
    }
  }

  return badges;
}

/**
 * Get user's reputation data
 */
export async function getUserReputation(userAddress: string): Promise<UserReputation> {
  const provider = getProvider();
  const address = getReputationAddress();

  try {
    const contract = new Contract(reputationAbi as any, address, provider);

    const result = await contract.get_reputation(userAddress);
    const badges = BigInt(result.badges.toString());
    const level = Number(result.level);

    return {
      user: result.user.toString(),
      totalPoints: BigInt(result.total_points.toString()),
      level,
      levelName: LEVEL_NAMES[level] || 'Unknown',
      badges,
      badgeList: parseBadges(badges),
      joinedAt: Number(result.joined_at),
      postCount: Number(result.post_count),
      commentCount: Number(result.comment_count),
      likesReceived: Number(result.likes_received),
      subscribers: Number(result.subscribers),
      featuredCount: Number(result.featured_count),
    };
  } catch (error) {
    console.error(`Error getting reputation for ${userAddress}:`, error);
    // Return default reputation for unregistered users
    return {
      user: userAddress,
      totalPoints: 0n,
      level: 1,
      levelName: LEVEL_NAMES[1],
      badges: 0n,
      badgeList: [],
      joinedAt: 0,
      postCount: 0,
      commentCount: 0,
      likesReceived: 0,
      subscribers: 0,
      featuredCount: 0,
    };
  }
}

/**
 * Get user's points
 */
export async function getUserPoints(userAddress: string): Promise<bigint> {
  const provider = getProvider();
  const address = getReputationAddress();

  try {
    const contract = new Contract(reputationAbi as any, address, provider);

    const result = await contract.get_points(userAddress);
    return BigInt(result.toString());
  } catch (error) {
    console.error('Error getting user points:', error);
    return 0n;
  }
}

/**
 * Get user's level
 */
export async function getUserLevel(userAddress: string): Promise<number> {
  const provider = getProvider();
  const address = getReputationAddress();

  try {
    const contract = new Contract(reputationAbi as any, address, provider);

    const result = await contract.get_level(userAddress);
    return Number(result);
  } catch (error) {
    console.error('Error getting user level:', error);
    return 1;
  }
}

/**
 * Get user's badges as bitmap
 */
export async function getUserBadges(userAddress: string): Promise<{ bitmap: bigint; list: string[] }> {
  const provider = getProvider();
  const address = getReputationAddress();

  try {
    const contract = new Contract(reputationAbi as any, address, provider);

    const result = await contract.get_badges(userAddress);
    const bitmap = BigInt(result.toString());

    return {
      bitmap,
      list: parseBadges(bitmap),
    };
  } catch (error) {
    console.error('Error getting user badges:', error);
    return { bitmap: 0n, list: [] };
  }
}

/**
 * Check if user has a specific badge
 */
export async function hasBadge(userAddress: string, badge: bigint): Promise<boolean> {
  const provider = getProvider();
  const address = getReputationAddress();

  try {
    const contract = new Contract(reputationAbi as any, address, provider);

    const result = await contract.has_badge(userAddress, badge);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking badge:', error);
    return false;
  }
}

/**
 * Get total platform stats
 */
export async function getReputationStats(): Promise<{ totalUsers: number; totalPointsDistributed: bigint }> {
  const provider = getProvider();
  const address = getReputationAddress();

  try {
    const contract = new Contract(reputationAbi as any, address, provider);

    const [totalUsers, totalPoints] = await Promise.all([
      contract.get_total_users(),
      contract.get_total_points_distributed(),
    ]);

    return {
      totalUsers: Number(totalUsers),
      totalPointsDistributed: BigInt(totalPoints.toString()),
    };
  } catch (error) {
    console.error('Error getting reputation stats:', error);
    return { totalUsers: 0, totalPointsDistributed: 0n };
  }
}
