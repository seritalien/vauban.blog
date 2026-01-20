'use client';

import { useState, useEffect } from 'react';
import { PostOutput } from '@vauban/shared-types';
import { getPosts, getPost, initStarknetProvider, setContractAddresses, calculateContentHash } from '@vauban/web3-utils';

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

// Initialize provider and contract addresses with Next.js env vars
// (must be done in frontend context where env vars are available)
if (typeof window !== 'undefined') {
  // Use local proxy to avoid CORS issues with direct RPC calls
  initStarknetProvider({
    nodeUrl: '/api/rpc',
  });

  setContractAddresses({
    blogRegistry: process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS,
    social: process.env.NEXT_PUBLIC_SOCIAL_ADDRESS,
    paymaster: process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS,
    sessionKeyManager: process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS,
  });
}

export function usePosts(limit: number = 10, offset: number = 0) {
  const [posts, setPosts] = useState<VerifiedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPosts() {
      try {
        setIsLoading(true);
        setError(null);

        const postMetadata = await getPosts(limit, offset);

        const postsWithContent = await Promise.all(
          postMetadata
            .filter(meta => !meta.isDeleted)
            .map(async (meta) => {
              let content: unknown;
              let isVerified = false;
              let verificationError: string | undefined;

              // Try IPFS first, then Arweave as fallback, then placeholder for test data
              try {
                const { data } = await fetchFromIPFSProxy(meta.ipfsCid);
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
                } catch (arweaveErr) {
                  // Use placeholder content for test posts
                  console.warn(`Using placeholder for test post ${meta.id}`);
                  const { data } = generatePlaceholderContent(meta.id);
                  content = data;
                  isVerified = false;
                  verificationError = 'Test post - content not stored';
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
                isVerified,
                verificationError,
              } as VerifiedPost;
            })
        );

        setPosts(postsWithContent.filter(Boolean) as VerifiedPost[]);
      } catch (err) {
        console.error('Error loading posts:', err);
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setIsLoading(false);
      }
    }

    loadPosts();
  }, [limit, offset]);

  return { posts, isLoading, error };
}

export function usePost(postId: string) {
  const [post, setPost] = useState<VerifiedPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPost() {
      try {
        setIsLoading(true);
        setError(null);

        const meta = await getPost(postId);

        if (meta.isDeleted) {
          setError('Post has been deleted');
          return;
        }

        let content: unknown;
        let isVerified = false;
        let verificationError: string | undefined;

        // Try IPFS first, then Arweave as fallback, then placeholder for test data
        try {
          const { data } = await fetchFromIPFSProxy(meta.ipfsCid);
          content = data;

          // Verify content hash
          isVerified = await verifyContentHash(data, meta.contentHash);
          if (!isVerified) {
            verificationError = 'Content hash mismatch - content may have been tampered with';
          }
        } catch (ipfsErr) {
          console.warn(`IPFS failed for post ${postId}, trying Arweave...`);
          try {
            const { data } = await fetchFromArweave(meta.arweaveTxId);
            content = data;
            isVerified = await verifyContentHash(data, meta.contentHash);
            if (!isVerified) {
              verificationError = 'Content hash mismatch - content may have been tampered with';
            }
          } catch (arweaveErr) {
            // Use placeholder content for test posts
            console.warn(`Using placeholder for test post ${postId}`);
            const { data } = generatePlaceholderContent(postId);
            content = data;
            isVerified = false;
            verificationError = 'Test post - content not stored';
          }
        }

        setPost({
          ...content as object,
          id: meta.id,
          author: meta.author,
          arweaveTxId: meta.arweaveTxId,
          ipfsCid: meta.ipfsCid,
          contentHash: meta.contentHash,
          createdAt: new Date(meta.createdAt * 1000),
          updatedAt: new Date(meta.updatedAt * 1000),
          isVerified,
          verificationError,
        } as VerifiedPost);
      } catch (err) {
        console.error('Error loading post:', err);
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setIsLoading(false);
      }
    }

    if (postId) {
      loadPost();
    }
  }, [postId]);

  return { post, isLoading, error };
}
