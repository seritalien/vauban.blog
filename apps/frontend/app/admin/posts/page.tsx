'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { getPosts, deletePost, getPostVersionCount } from '@vauban/web3-utils';
import { PostMetadata } from '@vauban/shared-types';
import { format } from 'date-fns';
import Link from 'next/link';
import { normalizeAddress } from '@/lib/profiles';

interface PostWithVersions extends PostMetadata {
  versionCount: number;
}

export default function AdminPostsPage() {
  const { account, address, isConnected } = useWallet();
  const [posts, setPosts] = useState<PostWithVersions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!address) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const fetchedPosts = await getPosts(100, 0);

      // Filter posts by connected wallet address
      // Each user should only see their own posts
      const normalizedUserAddress = normalizeAddress(address);
      const userPosts = fetchedPosts.filter((post) => {
        const normalizedPostAuthor = normalizeAddress(post.author);
        return normalizedPostAuthor === normalizedUserAddress;
      });

      // Get version count for each post
      const postsWithVersions = await Promise.all(
        userPosts.map(async (post) => {
          const versionCount = await getPostVersionCount(post.id);
          return { ...post, versionCount };
        })
      );

      setPosts(postsWithVersions);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Reload posts when wallet address changes
  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  async function handleDelete(postId: string) {
    if (!account) return;

    try {
      setIsDeleting(true);
      await deletePost(account, postId);
      setDeleteConfirm(null);
      // Reload posts
      await loadPosts();
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Post Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Please connect your wallet to manage posts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Manage Posts</h1>
          <Link
            href="/admin"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            + New Post
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">No posts yet.</p>
            <Link href="/admin" className="text-blue-600 hover:underline mt-2 inline-block">
              Create your first post
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-4">
              {posts.map((post) => (
                <div
                  key={post.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${post.isDeleted ? 'opacity-50' : ''}`}
                >
                  {/* Header: Title and Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Post #{post.id}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px]">
                        IPFS: {post.ipfsCid.slice(0, 16)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        v{post.versionCount}
                      </span>
                      {post.isDeleted ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                          Deleted
                        </span>
                      ) : Number(post.price) > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                          Published
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Created: {format(new Date(post.createdAt * 1000), 'MMM d, yyyy')}
                  </p>

                  {/* Action Buttons */}
                  {!post.isDeleted && (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <Link
                        href={`/admin/posts/${post.id}/versions`}
                        className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        History
                      </Link>
                      {deleteConfirm === post.id ? (
                        <div className="flex gap-2 w-full mt-2">
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={isDeleting}
                            className="flex-1 min-h-[44px] px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="flex-1 min-h-[44px] px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(post.id)}
                          className="flex-1 min-h-[44px] flex items-center justify-center px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table Layout */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Post
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {posts.map((post) => (
                    <tr key={post.id} className={post.isDeleted ? 'opacity-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        #{post.id}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Post #{post.id}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-xs">
                          IPFS: {post.ipfsCid.slice(0, 20)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          v{post.versionCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(post.createdAt * 1000), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {post.isDeleted ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                            Deleted
                          </span>
                        ) : Number(post.price) > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            Published
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {!post.isDeleted && (
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/posts/${post.id}/edit`}
                              className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/admin/posts/${post.id}/versions`}
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              History
                            </Link>
                            {deleteConfirm === post.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(post.id)}
                                  disabled={isDeleting}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  {isDeleting ? '...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(post.id)}
                                className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
