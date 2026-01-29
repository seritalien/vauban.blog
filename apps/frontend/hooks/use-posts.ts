'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { PostOutput } from '@vauban/shared-types';
import { getPosts, getPost, getPostCount, initStarknetProvider, setContractAddresses, calculateContentHash } from '@vauban/web3-utils';
import { queryKeys } from '@/lib/query-keys';
import { getPublicEnv } from '@/lib/public-env';

// Extended post type with verification status
export interface VerifiedPost extends PostOutput {
  isVerified: boolean;
  verificationError?: string;
}

// Fetch from IPFS via local proxy (avoids CORS)
async function fetchFromIPFSProxy(cid: string): Promise<{ data: unknown; rawJson: string }> {
  const response = await fetch(`/api/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status}`);
  }
  const text = await response.text();
  return { data: JSON.parse(text), rawJson: text };
}

// Fetch from Arweave via proxy (handles CORS and multiple gateways)
async function fetchFromArweave(txId: string): Promise<{ data: unknown; rawJson: string }> {
  // Skip simulated Arweave IDs
  if (txId.startsWith('ar_')) {
    throw new Error('Simulated Arweave ID - no real content');
  }
  const response = await fetch(`/api/arweave/${txId}`);
  if (!response.ok) {
    throw new Error(`Arweave fetch failed: ${response.status}`);
  }
  const text = await response.text();
  return { data: JSON.parse(text), rawJson: text };
}

// Generate placeholder content for test posts
function generatePlaceholderContent(postId: string): { data: unknown; rawJson: string } {
  const placeholder = {
    title: `Test Post #${postId}`,
    slug: `test-post-${postId}`,
    excerpt: 'This is a test post with simulated storage. Publish a real article to see actual content.',
    content: '# Test Post\n\nThis post was created with simulated storage IDs for testing purposes.\n\nTo see real content:\n1. Go to the Admin page\n2. Write an article\n3. Publish it to IPFS/Arweave',
    tags: ['test', 'placeholder'],
    coverImage: null,
  };
  return { data: placeholder, rawJson: JSON.stringify(placeholder) };
}

// Verify content hash matches on-chain hash
async function verifyContentHash(content: unknown, onchainHash: string): Promise<boolean> {
  const contentJson = JSON.stringify(content);
  const computedHash = await calculateContentHash(contentJson);

  // Convert on-chain hash to comparable format
  const onchainHex = onchainHash.startsWith('0x')
    ? onchainHash.toLowerCase()
    : `0x${BigInt(onchainHash).toString(16)}`;

  return computedHash.toLowerCase() === onchainHex.toLowerCase();
}

// Content fetch cache to deduplicate in-flight requests for the same CID
const contentCache = new Map<string, Promise<{ data: unknown; rawJson: string }>>();

function fetchFromIPFSProxyCached(cid: string): Promise<{ data: unknown; rawJson: string }> {
  const existing = contentCache.get(cid);
  if (existing) return existing;
  const promise = fetchFromIPFSProxy(cid).finally(() => {
    // Remove from cache after completion so stale entries don't persist
    contentCache.delete(cid);
  });
  contentCache.set(cid, promise);
  return promise;
}

// Initialize provider and contract addresses with Next.js env vars
// (must be done in frontend context where env vars are available)
if (typeof window !== 'undefined') {
  // Use local proxy to avoid CORS issues with direct RPC calls
  initStarknetProvider({
    nodeUrl: '/api/rpc',
  });

  setContractAddresses({
    blogRegistry: getPublicEnv('NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS'),
    social: getPublicEnv('NEXT_PUBLIC_SOCIAL_ADDRESS'),
    paymaster: getPublicEnv('NEXT_PUBLIC_PAYMASTER_ADDRESS'),
    sessionKeyManager: getPublicEnv('NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS'),
  });
}

// Check if CID is from E2E tests (fake CID pattern)
function isTestCid(cid: string): boolean {
  return cid.startsWith('QmTest') || cid.startsWith('QmTweet');
}

export async function fetchPostContent(meta: { id: string; author: string | number; ipfsCid: string; arweaveTxId: string; contentHash: string; createdAt: number; updatedAt: number; postType?: number; parentId?: string; threadRootId?: string; isPinned?: boolean }): Promise<VerifiedPost> {
  let content: unknown;
  let isVerified = false;
  let verificationError: string | undefined;

  // Short-circuit for test posts - don't hit network for fake CIDs
  if (isTestCid(meta.ipfsCid)) {
    const { data } = generatePlaceholderContent(meta.id);
    content = data;
    isVerified = false;
    verificationError = 'Test post - content not stored';
  } else {
    // Try IPFS first (with dedup cache), then Arweave as fallback, then placeholder for test data
    try {
      const { data } = await fetchFromIPFSProxyCached(meta.ipfsCid);
      content = data;

      // Verify content hash
      isVerified = await verifyContentHash(data, meta.contentHash);
      if (!isVerified) {
        verificationError = 'Content hash mismatch';
      }
    } catch (ipfsErr) {
      console.warn(`IPFS failed for post ${meta.id}, trying Arweave...`);
      try {
        const { data } = await fetchFromArweave(meta.arweaveTxId);
        content = data;
        isVerified = await verifyContentHash(data, meta.contentHash);
        if (!isVerified) {
          verificationError = 'Content hash mismatch';
        }
      } catch {
        // Use placeholder content for posts with missing storage
        console.warn(`Using placeholder for post ${meta.id}`);
        const { data } = generatePlaceholderContent(meta.id);
        content = data;
        isVerified = false;
        verificationError = 'Content not found in storage';
      }
    }
  }

  return {
    ...content as object,
    id: meta.id,
    author: meta.author,
    arweaveTxId: meta.arweaveTxId,
    ipfsCid: meta.ipfsCid,
    contentHash: meta.contentHash,
    createdAt: new Date(meta.createdAt * 1000),
    updatedAt: new Date(meta.updatedAt * 1000),
    postType: meta.postType,
    parentId: meta.parentId,
    threadRootId: meta.threadRootId,
    isPinned: meta.isPinned,
    isVerified,
    verificationError,
  } as VerifiedPost;
}

/**
 * Fetch a page of posts with their content resolved.
 *
 * The contract returns posts in ascending order (oldest first with offset 0).
 * To display newest-first, we compute the offset from the end:
 *   offset = totalCount - page * limit
 * and reverse the result so each page is newest→oldest.
 */
async function fetchPostsPageReversed(limit: number, reverseOffset: number): Promise<{ posts: VerifiedPost[]; totalCount: number }> {
  const totalCount = await getPostCount();

  // reverseOffset = how many posts we've already loaded from the end
  // Compute the contract offset (from the start)
  const contractOffset = Math.max(0, totalCount - reverseOffset - limit);
  const actualLimit = Math.min(limit, totalCount - reverseOffset);

  if (actualLimit <= 0) {
    return { posts: [], totalCount };
  }

  const postMetadata = await getPosts(actualLimit, contractOffset);

  const postsWithContent = await Promise.all(
    postMetadata
      .filter(meta => !meta.isDeleted)
      .map(fetchPostContent)
  );

  // Reverse so newest is first within this page
  const filtered = postsWithContent.filter(Boolean) as VerifiedPost[];
  filtered.reverse();

  return { posts: filtered, totalCount };
}

export function usePosts(limit: number = 10, _offset: number = 0) {
  const {
    data,
    isLoading,
    isFetchingNextPage: isLoadingMore,
    hasNextPage: hasMore,
    error: queryError,
    refetch: rqRefetch,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.posts.infinite(limit),
    queryFn: async ({ pageParam = 0 }) => {
      // pageParam = number of posts already loaded from the end
      const { posts, totalCount } = await fetchPostsPageReversed(limit, pageParam);
      const nextReverseOffset = pageParam + limit;
      return {
        posts,
        nextReverseOffset,
        hasMore: nextReverseOffset < totalCount,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.nextReverseOffset : undefined,
    staleTime: 30 * 60 * 1000,
  });

  // Flatten pages into a single deduped array (already newest-first)
  const posts: VerifiedPost[] = [];
  const seenIds = new Set<string>();
  if (data) {
    for (const page of data.pages) {
      for (const post of page.posts) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id);
          posts.push(post);
        }
      }
    }
  }

  const refetch = () => {
    rqRefetch();
  };

  const loadMore = async () => {
    if (!isLoadingMore && hasMore) {
      await fetchNextPage();
    }
  };

  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  return { posts, isLoading, isLoadingMore, hasMore: hasMore ?? false, error, refetch, loadMore };
}

export function usePost(postId: string) {
  const { data: post = null, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.posts.detail(postId),
    queryFn: async () => {
      const meta = await getPost(postId);

      if (meta.isDeleted) {
        throw new Error('Post has been deleted');
      }

      return fetchPostContent(meta);
    },
    enabled: !!postId,
    staleTime: 30 * 60 * 1000,
  });

  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  return { post, isLoading, error };
}
