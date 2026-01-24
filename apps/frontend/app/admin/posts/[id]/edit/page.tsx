'use client';

import { useState, useEffect, use } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { PostMetadata } from '@vauban/shared-types';
import { getPost, updatePost } from '@vauban/web3-utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PostEditor from '@/components/editor/PostEditor';

// Content fetched from IPFS for editing
interface PostContent {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  tags?: string[];
  coverImage?: string;
}

// Fetch content from IPFS
async function fetchFromIPFS(cid: string): Promise<PostContent> {
  const response = await fetch(`/api/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status}`);
  }
  return response.json() as Promise<PostContent>;
}

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = use(params);
  const { account, isConnected } = useWallet();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<PostContent | null>(null);
  const [originalPost, setOriginalPost] = useState<PostMetadata | null>(null);

  // Load existing post data
  useEffect(() => {
    async function loadPost() {
      try {
        setIsLoading(true);
        setLoadError(null);

        // Get post metadata from blockchain
        const postMeta = await getPost(postId);
        setOriginalPost(postMeta);

        // Fetch content from IPFS
        try {
          const content = await fetchFromIPFS(postMeta.ipfsCid);
          setInitialData({
            title: content.title || '',
            slug: content.slug || '',
            content: content.content || '',
            excerpt: content.excerpt || '',
            tags: Array.isArray(content.tags) ? content.tags : [],
            coverImage: content.coverImage || '',
          });
        } catch (ipfsError) {
          console.warn('Could not load content from IPFS:', ipfsError);
          setLoadError('Warning: Could not load existing content. Starting fresh.');
          // Set empty initial data to allow editing
          setInitialData({
            title: '',
            slug: '',
            content: '',
            excerpt: '',
            tags: [],
            coverImage: '',
          });
        }
      } catch (error) {
        console.error('Failed to load post:', error);
        setLoadError('Error loading post: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [postId]);

  // Handle post update via blockchain
  const handleSubmit = async (data: {
    postData: unknown;
    ipfsCid: string;
    arweaveTxId: string;
    contentHash: string;
  }) => {
    if (!account || !originalPost) {
      throw new Error('Wallet not connected or post not loaded');
    }

    // Update on blockchain
    await updatePost(
      account,
      postId,
      data.arweaveTxId,
      data.ipfsCid,
      data.contentHash
    );
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Edit Post</h1>
          <p className="text-gray-600 dark:text-gray-400">Please connect your wallet to edit posts.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading post...</p>
        </div>
      </div>
    );
  }

  if (loadError && !initialData) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
            {loadError}
          </div>
          <Link
            href="/admin/posts"
            className="mt-4 inline-block text-blue-600 hover:underline"
          >
            Back to Posts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Edit Post #{postId}</h1>
          <Link
            href="/admin/posts"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Back to Posts
          </Link>
        </div>

        {loadError && (
          <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded-lg">
            {loadError}
          </div>
        )}

        {initialData && (
          <PostEditor
            mode="edit"
            postId={postId}
            initialData={{
              title: initialData.title || '',
              slug: initialData.slug || '',
              content: initialData.content || '',
              excerpt: initialData.excerpt || '',
              tags: initialData.tags || [],
              coverImage: initialData.coverImage || '',
            }}
            onSubmit={handleSubmit}
            onSuccess={() => router.push('/admin/posts')}
          />
        )}
      </div>
    </div>
  );
}
