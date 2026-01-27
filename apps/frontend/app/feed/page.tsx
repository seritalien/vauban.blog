'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePosts, VerifiedPost } from '@/hooks/use-posts';
import { FeedTabs, Timeline, Composer, ThreadComposer, type FeedTab, type TimelinePost } from '@/components/feed';
import { POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE } from '@vauban/shared-types';
import { useWallet } from '@/providers/wallet-provider';
import { useFollowStats } from '@/hooks/use-follow';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Convert VerifiedPost to TimelinePost format
 */
function toTimelinePost(post: VerifiedPost): TimelinePost {
  // Determine content type from postType or infer from content length
  const postType = post.postType ?? POST_TYPE_ARTICLE;
  let contentType: 'tweet' | 'thread' | 'article' = 'article';

  if (postType === POST_TYPE_TWEET) {
    contentType = 'tweet';
  } else if (postType === POST_TYPE_THREAD) {
    contentType = 'thread';
  } else if (!post.title && post.content.length <= 280) {
    // Infer tweet type for short posts without title
    contentType = 'tweet';
  }

  return {
    id: post.id,
    author: String(post.author),
    contentType,
    postType,
    title: post.title,
    content: post.content,
    preview: post.preview || (post.content.length > 280 ? post.content.slice(0, 280) + '...' : post.content),
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    tags: post.tags,
    createdAt: post.createdAt,
    readingTimeMinutes: post.readingTimeMinutes,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    replyCount: post.replyCount,
    isPaid: post.isPaid,
    price: post.price,
    parentId: post.parentId,
    threadRootId: post.threadRootId,
    imageUrl: (post as unknown as Record<string, unknown>).imageUrl as string | undefined,
  };
}

export default function FeedPage() {
  const { posts, isLoading, isLoadingMore, hasMore, error, refetch, loadMore } = usePosts(20, 0);
  const { address } = useWallet();
  const { following: followedAddresses } = useFollowStats(address);
  const [activeTab, setActiveTab] = useState<FeedTab>('for-you');
  const [showThreadComposer, setShowThreadComposer] = useState(false);

  // Handle post success - refresh the feed
  const handlePostSuccess = useCallback((postId: string) => {
    console.log('New bastion posted:', postId);
    setShowThreadComposer(false);
    // Small delay to allow blockchain to process
    setTimeout(() => {
      refetch();
    }, 2000);
  }, [refetch]);

  // Convert posts to timeline format
  const timelinePosts = useMemo(() => {
    return posts.map(toTimelinePost);
  }, [posts]);

  // Calculate counts per tab
  const followedSet = useMemo(() => {
    return new Set(followedAddresses.map((a) => a.toLowerCase()));
  }, [followedAddresses]);

  const counts = useMemo(() => {
    const articles = posts.filter(
      (p) => (p.postType ?? POST_TYPE_ARTICLE) === POST_TYPE_ARTICLE
    ).length;
    const threads = posts.filter(
      (p) => p.postType === POST_TYPE_THREAD
    ).length;
    const followingPosts = posts.filter(
      (p) => !p.parentId && followedSet.has(String(p.author).toLowerCase())
    ).length;

    return {
      forYou: posts.filter((p) => !p.parentId).length,
      following: followingPosts,
      articles,
      threads,
    };
  }, [posts, followedSet]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
            <h2 className="font-bold mb-2">Error loading feed</h2>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 min-h-screen border-x border-gray-200 dark:border-gray-700">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Home</h1>
            <Link
              href="/"
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              title="Blog view"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </Link>
          </div>
        </header>

        {/* Tabs */}
        <FeedTabs activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

        {/* Composer */}
        {showThreadComposer ? (
          <ThreadComposer
            onSuccess={handlePostSuccess}
            onCancel={() => setShowThreadComposer(false)}
          />
        ) : (
          <div>
            <Composer onPostSuccess={handlePostSuccess} />
            <div className="flex justify-center pb-2 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowThreadComposer(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Create a thread
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <Timeline posts={timelinePosts} activeTab={activeTab} isLoading={isLoading} followedAddresses={followedAddresses} />

        {/* Load more */}
        {!isLoading && timelinePosts.length > 0 && hasMore && (
          <div className="p-4 text-center">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="text-blue-500 hover:text-blue-600 font-medium disabled:opacity-50"
            >
              {isLoadingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Chargement...
                </span>
              ) : (
                'Charger plus'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
