'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { getThreadPosts, getPost } from '@vauban/web3-utils';
import { usePostBastion } from '@/hooks/use-post-bastion';
import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import { getProfile, getDisplayName, formatAddress } from '@/lib/profiles';
import { EngagementBar } from '@/components/feed';
import { FollowButton } from '@/components/social';

export const dynamic = 'force-dynamic';

interface ThreadPost {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  parentId?: string;
  threadRootId?: string;
  likesCount: number;
  commentsCount: number;
  isRootPost: boolean;
  imageUrl?: string;
  postType?: number;
}

function ThreadPostCard({
  post,
  isRoot,
  isLast,
  showConnector = true,
  position,
  total,
}: {
  post: ThreadPost;
  isRoot: boolean;
  isLast: boolean;
  showConnector?: boolean;
  position: number;
  total: number;
}) {
  const profile = getProfile(post.author);
  const displayName = getDisplayName(post.author, profile);

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {showConnector && !isLast && (
        <div className={`absolute ${isRoot ? 'left-5' : 'left-9'} top-12 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700`} />
      )}

      <article className={`flex gap-3 p-4 ${!isRoot ? 'pl-8' : ''}`}>
        {/* Position indicator for continuations */}
        {!isRoot && (
          <div className="flex-shrink-0 flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
              {position}
            </div>
          </div>
        )}

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Link href={`/authors/${post.author}`}>
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </Link>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/authors/${post.author}`}
              className="font-bold text-gray-900 dark:text-white hover:underline"
            >
              {displayName}
            </Link>
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              @{formatAddress(post.author)}
            </span>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <time className="text-gray-500 dark:text-gray-400 text-sm">
              {formatDistanceToNow(post.createdAt, { addSuffix: true })}
            </time>
            {isRoot && (
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                Thread
              </span>
            )}
            {!isRoot && (
              <span className="text-gray-400 dark:text-gray-500 text-xs">
                {position}/{total}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="mt-2 text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
            {post.content}
          </div>

          {/* Image */}
          {post.imageUrl && (
            <div className="mt-3">
              <img
                src={post.imageUrl}
                alt=""
                className="rounded-xl max-h-80 w-auto border border-gray-200 dark:border-gray-700"
                loading="lazy"
              />
            </div>
          )}

          {/* Engagement */}
          <div className="mt-3">
            <EngagementBar
              postId={post.id}
              initialLikes={post.likesCount}
              initialComments={post.commentsCount}
            />
          </div>
        </div>
      </article>
    </div>
  );
}

function ReplyComposer({
  onReplySubmit,
  isSubmitting: externalIsSubmitting = false
}: {
  threadId?: string;
  onReplySubmit?: (content: string) => Promise<void>;
  isSubmitting?: boolean;
}) {
  const { isConnected, address } = useWallet();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use external state if provided
  const isActuallySubmitting = externalIsSubmitting || isSubmitting;

  const profile = address ? getProfile(address) : null;
  const displayName = address ? getDisplayName(address, profile) : '';

  const handleSubmit = async () => {
    if (!content.trim() || !isConnected || isActuallySubmitting) return;

    setIsSubmitting(true);
    try {
      if (onReplySubmit) {
        await onReplySubmit(content);
        setContent(''); // Clear only on success
      }
    } catch (error) {
      console.error('Failed to submit reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-center text-gray-500 dark:text-gray-400">
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Connect your wallet
          </Link>{' '}
          to reply
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex gap-3">
        {/* Avatar */}
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Input */}
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Post your reply..."
            rows={3}
            className="w-full px-3 py-2 bg-transparent border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-400">
              {content.length}/280
            </span>
            <button
              onClick={handleSubmit}
              disabled={!content.trim() || content.length > 280 || isActuallySubmitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-full transition-colors disabled:cursor-not-allowed"
            >
              {isActuallySubmitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreadPage() {
  const params = useParams();
  const threadId = params.id as string;
  const { postThreadContinue, isPosting, error: postError, clearError } = usePostBastion();
  const { showToast } = useToast();

  const [threadPosts, setThreadPosts] = useState<ThreadPost[]>([]);
  const [rootPost, setRootPost] = useState<ThreadPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load thread posts from the contract
  const loadThread = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { fetchPostContent } = await import('@/hooks/use-posts');

      // Load the root post
      const rootMeta = await getPost(threadId);
      const rootContent = await fetchPostContent(rootMeta);

      const root: ThreadPost = {
        id: rootContent.id,
        author: typeof rootContent.author === 'string' ? rootContent.author : String(rootContent.author),
        content: rootContent.content || rootContent.excerpt || '',
        createdAt: rootContent.createdAt,
        likesCount: 0,
        commentsCount: 0,
        isRootPost: true,
        imageUrl: (rootContent as unknown as Record<string, unknown>).imageUrl as string | undefined,
        postType: rootContent.postType,
      };

      // Load continuation posts from contract.
      // Note: getThreadPosts() includes the root post (contract adds root to its own thread index),
      // so we filter it out to avoid duplicate keys with the separately-loaded root.
      // We also try loading each post individually via getPost() as a fallback,
      // since getThreadPosts() filters by status==PUBLISHED which may miss recently-created posts.
      const continuationMetas = await getThreadPosts(threadId, 50, 0);
      const filteredMetas = continuationMetas.filter(meta => !meta.isDeleted && meta.id !== threadId);

      // Use Promise.allSettled so one failed post doesn't kill the whole thread
      const continuationResults = await Promise.allSettled(
        filteredMetas.map(async (meta) => {
          try {
            return await fetchPostContent(meta);
          } catch {
            // Fallback: try loading the post individually via getPost() (no status filter)
            const freshMeta = await getPost(meta.id);
            return await fetchPostContent(freshMeta);
          }
        })
      );

      const continuations: ThreadPost[] = continuationResults
        .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof fetchPostContent>>> => r.status === 'fulfilled')
        .map(r => r.value)
        .map(p => ({
          id: p.id,
          author: typeof p.author === 'string' ? p.author : String(p.author),
          content: p.content || p.excerpt || '',
          createdAt: p.createdAt,
          threadRootId: threadId,
          likesCount: 0,
          commentsCount: 0,
          isRootPost: false,
          imageUrl: (p as unknown as Record<string, unknown>).imageUrl as string | undefined,
          postType: p.postType,
        }));

      // Combine and sort chronologically
      const allPosts = [root, ...continuations];
      allPosts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      setRootPost(allPosts[0] || null);
      setThreadPosts(allPosts);
    } catch (err) {
      console.error('Error loading thread:', err);
      setError(err instanceof Error ? err.message : 'Failed to load thread');
    } finally {
      setIsLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  // Handle reply submission
  const handleReplySubmit = useCallback(async (content: string) => {
    if (postError) {
      clearError();
    }

    const postId = await postThreadContinue(content, threadId);

    if (postId) {
      showToast('Reponse publiee !', 'success');
      // Reload thread to show the new reply
      await loadThread();
    } else if (postError) {
      showToast(postError, 'error');
    }
  }, [threadId, postThreadContinue, postError, clearError, showToast, loadThread]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 min-h-screen border-x border-gray-200 dark:border-gray-700">
          {/* Header */}
          <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 px-4 py-3">
              <Link
                href="/feed"
                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold">Thread</h1>
            </div>
          </header>

          {/* Loading skeleton */}
          <div className="animate-pulse p-4">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2" />
                <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !rootPost) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 min-h-screen border-x border-gray-200 dark:border-gray-700">
          <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-4 px-4 py-3">
              <Link
                href="/feed"
                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold">Thread</h1>
            </div>
          </header>

          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Thread not found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              This thread may have been deleted or doesn&apos;t exist.
            </p>
            <Link
              href="/feed"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
            >
              Back to Feed
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const authorProfile = getProfile(rootPost.author);
  const authorDisplayName = getDisplayName(rootPost.author, authorProfile);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 min-h-screen border-x border-gray-200 dark:border-gray-700">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <Link
                href="/feed"
                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold">Thread</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  by {authorDisplayName}
                </p>
              </div>
            </div>
            <FollowButton targetAddress={rootPost.author} size="sm" />
          </div>
        </header>

        {/* Thread posts */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {threadPosts.map((post, index) => {
            // Continuation position (1-based, excluding root)
            const continuationIndex = threadPosts.filter((p, i) => i < index && !p.isRootPost).length;
            const totalContinuations = threadPosts.filter(p => !p.isRootPost).length;

            return (
              <ThreadPostCard
                key={post.id}
                post={post}
                isRoot={post.isRootPost}
                isLast={index === threadPosts.length - 1}
                showConnector={threadPosts.length > 1}
                position={continuationIndex + 1}
                total={totalContinuations}
              />
            );
          })}
        </div>

        {/* Reply composer */}
        <ReplyComposer
          threadId={threadId}
          onReplySubmit={handleReplySubmit}
          isSubmitting={isPosting}
        />

        {/* Thread info */}
        {threadPosts.length > 1 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {threadPosts.length} posts in this thread
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
