import { Contract, RpcProvider, Account, CallData, shortString, num } from 'starknet';
import type { PostMetadata, CommentMetadata } from '@vauban/shared-types';

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

  providerInstance = new RpcProvider({ nodeUrl, chainId });
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
// CONTRACT ADDRESSES (from env or deployments)
// ============================================================================

export function getBlogRegistryAddress(): string {
  const address = process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS not set');
  }
  return address;
}

export function getSocialAddress(): string {
  const address = process.env.NEXT_PUBLIC_SOCIAL_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_SOCIAL_ADDRESS not set');
  }
  return address;
}

export function getPaymasterAddress(): string {
  const address = process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_PAYMASTER_ADDRESS not set');
  }
  return address;
}

export function getSessionKeyManagerAddress(): string {
  const address = process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS;
  if (!address) {
    throw new Error('NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS not set');
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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.get_post_count();
    return Number(result);
  } catch (error) {
    console.error('Error getting post count:', error);
    throw new Error(`Failed to get post count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get post metadata by ID
 */
export async function getPost(postId: string): Promise<PostMetadata> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.get_post(postId);

    return {
      id: result.id.toString(),
      author: result.author,
      arweaveTxId: shortString.decodeShortString(result.arweave_tx_id.toString()),
      ipfsCid: shortString.decodeShortString(result.ipfs_cid.toString()),
      contentHash: result.content_hash.toString(),
      price: result.price.toString(),
      isEncrypted: result.is_encrypted,
      createdAt: Number(result.created_at),
      updatedAt: Number(result.updated_at),
      isDeleted: result.is_deleted || false,
    };
  } catch (error) {
    console.error(`Error getting post ${postId}:`, error);
    throw new Error(`Failed to get post: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get multiple posts with pagination
 */
export async function getPosts(limit: number = 10, offset: number = 0): Promise<PostMetadata[]> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.get_posts(limit, offset);

    return result.map((post: any) => ({
      id: post.id.toString(),
      author: post.author,
      arweaveTxId: shortString.decodeShortString(post.arweave_tx_id.toString()),
      ipfsCid: shortString.decodeShortString(post.ipfs_cid.toString()),
      contentHash: post.content_hash.toString(),
      price: post.price.toString(),
      isEncrypted: post.is_encrypted,
      createdAt: Number(post.created_at),
      updatedAt: Number(post.updated_at),
      isDeleted: post.is_deleted || false,
    }));
  } catch (error) {
    console.error('Error getting posts:', error);
    throw new Error(`Failed to get posts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Publish a post (requires account)
 */
export async function publishPost(
  account: Account,
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string,
  price: string,
  isEncrypted: boolean = false
): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, account);

    const result = await contract.publish_post(
      shortString.encodeShortString(arweaveTxId),
      shortString.encodeShortString(ipfsCid),
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

/**
 * Check if user has access to a post
 */
export async function hasAccess(postId: string, userAddress: string): Promise<boolean> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.has_access(postId, userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking access:', error);
    return false;
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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.get_comments_for_post(postId, limit, offset);

    return result.map((comment: any) => ({
      id: comment.id.toString(),
      postId: comment.post_id.toString(),
      author: comment.author,
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
 * Add a comment (requires account or session key)
 */
export async function addComment(
  account: Account,
  postId: string,
  contentHash: string,
  parentCommentId: string = '0'
): Promise<string> {
  const address = getSocialAddress();

  try {
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, account);

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
export async function likePost(account: Account, postId: string): Promise<string> {
  const address = getSocialAddress();

  try {
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.has_liked_post(postId, userAddress);
    return Boolean(result);
  } catch (error) {
    console.error('Error checking like status:', error);
    return false;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate SHA256 hash of content
 */
export async function calculateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `0x${hashHex}`;
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
