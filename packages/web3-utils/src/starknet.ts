import { Contract, RpcProvider, Account, AccountInterface, shortString } from 'starknet';

// Use AccountInterface to support both Account and wallet-provided accounts
type AccountLike = Account | AccountInterface;
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
} = {};

/**
 * Set contract addresses (call this from your frontend with Next.js env vars)
 */
export function setContractAddresses(addresses: {
  blogRegistry?: string;
  social?: string;
  paymaster?: string;
  sessionKeyManager?: string;
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
 */
export async function getPost(postId: string): Promise<PostMetadata> {
  const provider = getProvider();
  const address = getBlogRegistryAddress();

  try {
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

    const result = await contract.get_post(postId);

    // Decode and join split felt252 fields
    const arweave1 = safeDecodeShortString(result.arweave_tx_id_1);
    const arweave2 = safeDecodeShortString(result.arweave_tx_id_2);
    const ipfs1 = safeDecodeShortString(result.ipfs_cid_1);
    const ipfs2 = safeDecodeShortString(result.ipfs_cid_2);

    return {
      id: result.id.toString(),
      author: result.author,
      arweaveTxId: joinFelt252Parts(arweave1, arweave2),
      ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
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

    return result.map((post: any) => {
      // Decode and join split felt252 fields
      const arweave1 = safeDecodeShortString(post.arweave_tx_id_1);
      const arweave2 = safeDecodeShortString(post.arweave_tx_id_2);
      const ipfs1 = safeDecodeShortString(post.ipfs_cid_1);
      const ipfs2 = safeDecodeShortString(post.ipfs_cid_2);

      return {
        id: post.id.toString(),
        author: post.author,
        arweaveTxId: joinFelt252Parts(arweave1, arweave2),
        ipfsCid: joinFelt252Parts(ipfs1, ipfs2),
        contentHash: post.content_hash.toString(),
        price: post.price.toString(),
        isEncrypted: post.is_encrypted,
        createdAt: Number(post.created_at),
        updatedAt: Number(post.updated_at),
        isDeleted: post.is_deleted || false,
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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, account);

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

/**
 * Purchase access to a paid post
 */
export async function purchasePost(account: AccountLike, postId: string): Promise<string> {
  const address = getBlogRegistryAddress();

  try {
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/blog_registry.json');
    const contract = new Contract(abi, address, provider);

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
  account: AccountLike,
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
export async function likePost(account: AccountLike, postId: string): Promise<string> {
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

/**
 * Get post like count
 */
export async function getPostLikes(postId: string): Promise<number> {
  const provider = getProvider();
  const address = getSocialAddress();

  try {
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, account);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, relayerAccount);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, provider);

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
    const { abi } = await import('./abis/social.json');
    const contract = new Contract(abi, address, account);

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
