'use client';

import { useState, useEffect } from 'react';
import { PostOutput } from '@vauban/shared-types';
import { getPosts, getPost, fetchJSONFromIPFS, fetchJSONFromArweave } from '@vauban/web3-utils';

export function usePosts(limit: number = 10, offset: number = 0) {
  const [posts, setPosts] = useState<PostOutput[]>([]);
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
              try {
                // Try IPFS first (fast cache)
                let content;
                try {
                  content = await fetchJSONFromIPFS(meta.ipfsCid);
                } catch {
                  // Fallback to Arweave (permanent storage)
                  content = await fetchJSONFromArweave(meta.arweaveTxId);
                }

                return {
                  ...content,
                  id: meta.id,
                  author: meta.author,
                  arweaveTxId: meta.arweaveTxId,
                  ipfsCid: meta.ipfsCid,
                  contentHash: meta.contentHash,
                  createdAt: new Date(meta.createdAt * 1000),
                  updatedAt: new Date(meta.updatedAt * 1000),
                } as PostOutput;
              } catch (err) {
                console.error(`Failed to load content for post ${meta.id}:`, err);
                return null;
              }
            })
        );

        setPosts(postsWithContent.filter(Boolean) as PostOutput[]);
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
  const [post, setPost] = useState<PostOutput | null>(null);
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

        // Try IPFS first (fast cache)
        let content;
        try {
          content = await fetchJSONFromIPFS(meta.ipfsCid);
        } catch {
          // Fallback to Arweave (permanent storage)
          content = await fetchJSONFromArweave(meta.arweaveTxId);
        }

        setPost({
          ...content,
          id: meta.id,
          author: meta.author,
          arweaveTxId: meta.arweaveTxId,
          ipfsCid: meta.ipfsCid,
          contentHash: meta.contentHash,
          createdAt: new Date(meta.createdAt * 1000),
          updatedAt: new Date(meta.updatedAt * 1000),
        } as PostOutput);
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
