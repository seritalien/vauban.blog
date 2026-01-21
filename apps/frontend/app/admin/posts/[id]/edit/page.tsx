'use client';

import { useState, useEffect, use } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { PostInputSchema, PostMetadata } from '@vauban/shared-types';
import {
  getPost,
  updatePost,
  calculateContentHash,
} from '@vauban/web3-utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Upload to IPFS via local proxy
async function uploadJSONToIPFSProxy(data: unknown): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  formData.append('file', blob, 'data.json');

  const response = await fetch('/api/ipfs/add', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.Hash;
}

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

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    tags: '',
    coverImage: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [originalPost, setOriginalPost] = useState<PostMetadata | null>(null);

  // Load existing post data
  useEffect(() => {
    async function loadPost() {
      try {
        setIsLoading(true);

        // Get post metadata from blockchain
        const postMeta = await getPost(postId);
        setOriginalPost(postMeta);

        // Fetch content from IPFS
        try {
          const content = await fetchFromIPFS(postMeta.ipfsCid);
          setFormData({
            title: content.title || '',
            slug: content.slug || '',
            content: content.content || '',
            excerpt: content.excerpt || '',
            tags: Array.isArray(content.tags) ? content.tags.join(', ') : '',
            coverImage: content.coverImage || '',
          });
        } catch (ipfsError) {
          console.warn('Could not load content from IPFS:', ipfsError);
          setUpdateStatus('Warning: Could not load existing content. Starting fresh.');
        }
      } catch (error) {
        console.error('Failed to load post:', error);
        setUpdateStatus('Error loading post: ' + (error instanceof Error ? error.message : 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }

    loadPost();
  }, [postId]);

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account || !originalPost) return;

    try {
      setIsUpdating(true);
      setUpdateStatus('Validating...');

      // Parse and validate with Zod
      const postData = PostInputSchema.parse({
        ...formData,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        coverImage: formData.coverImage?.trim() || undefined,
      });

      // Step 1: Upload to IPFS
      setUpdateStatus('Uploading to IPFS...');
      const ipfsCid = await uploadJSONToIPFSProxy(postData);
      console.log('New IPFS CID:', ipfsCid);

      // Step 2: Calculate new content hash
      setUpdateStatus('Calculating content hash...');
      const contentHash = await calculateContentHash(JSON.stringify(postData));

      // Step 3: Simulate Arweave (in real app, would upload new version)
      const arweaveTxId = `ar_edit_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Step 4: Update on blockchain
      setUpdateStatus('Updating on blockchain...');
      const txHash = await updatePost(
        account,
        postId,
        arweaveTxId,
        ipfsCid,
        contentHash
      );

      setUpdateStatus('Updated successfully! Redirecting...');
      console.log('Update transaction hash:', txHash);

      // Redirect to posts list
      setTimeout(() => {
        router.push('/admin/posts');
      }, 2000);
    } catch (error) {
      console.error('Update failed:', error);
      setUpdateStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

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

        {originalPost && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Current Version:</span> This will create a new version.
              Previous versions are preserved in history.
            </p>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Slug (URL)</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="my-article-slug"
              required
            />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Excerpt</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={3}
              required
            />
          </div>

          {/* Content (MDX) */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Content (Markdown)</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 font-mono bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              rows={20}
              required
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="web3, blockchain, tutorial"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Cover Image URL</label>
            <input
              type="text"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              className="w-full border border-gray-300 dark:border-gray-600 rounded px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="https://... or /api/ipfs/..."
            />
          </div>

          {/* Update Status */}
          {updateStatus && (
            <div className={`p-4 rounded ${updateStatus.includes('Error') ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200' : updateStatus.includes('Warning') ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200'}`}>
              {updateStatus}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={isUpdating}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isUpdating ? 'Updating...' : 'Update Post (Create New Version)'}
            </button>
            <Link
              href="/admin/posts"
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
