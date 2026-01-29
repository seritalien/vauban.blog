'use client';

import { useMemo } from 'react';
import { POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE } from '@vauban/shared-types';
import TweetCard from './TweetCard';
import ArticlePreview from './ArticlePreview';
import ThreadPreview from './ThreadPreview';
import QuoteTweet from './QuoteTweet';
import { type FeedTab } from './FeedTabs';

export interface TimelinePost {
  id: string;
  author: string;
  contentType?: 'tweet' | 'thread' | 'article';
  postType?: number;
  title?: string;
  content: string;
  preview?: string;
  excerpt?: string;
  coverImage?: string;
  tags?: string[];
  createdAt: Date;
  readingTimeMinutes?: number;
  likesCount?: number;
  commentsCount?: number;
  replyCount?: number;
  isPaid?: boolean;
  price?: number;
  parentId?: string;
  threadRootId?: string;
  threadLength?: number;
  imageUrl?: string;
  /** If this is a quote post, the original post being quoted */
  quotedPost?: {
    id: string;
    author: string;
    content: string;
    createdAt: Date;
  };
}

interface TimelineProps {
  posts: TimelinePost[];
  activeTab: FeedTab;
  isLoading?: boolean;
  /** Addresses of users the current user is following (for "following" tab) */
  followedAddresses?: string[];
}

function PostSkeleton() {
  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
          <div className="mt-4 flex gap-8">
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: FeedTab }) {
  const messages: Record<FeedTab, { title: string; description: string }> = {
    'for-you': {
      title: 'Welcome to Vauban!',
      description: 'Posts from the community will appear here. Be the first to share something!',
    },
    following: {
      title: 'Follow some authors',
      description: 'When you follow people, their posts will show up here.',
    },
    articles: {
      title: 'No articles yet',
      description: 'Long-form articles from the community will appear here.',
    },
    threads: {
      title: 'No threads yet',
      description: 'Thread discussions will appear here.',
    },
  };

  const { title, description } = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
    </div>
  );
}

export default function Timeline({ posts, activeTab, isLoading = false, followedAddresses }: TimelineProps) {
  // Normalize followed addresses to lowercase Set for fast lookup
  const followedSet = useMemo(() => {
    if (!followedAddresses) return new Set<string>();
    return new Set(followedAddresses.map((a) => a.toLowerCase()));
  }, [followedAddresses]);

  // Filter and sort posts based on active tab (newest first)
  const filteredPosts = useMemo(() => {
    let filtered: TimelinePost[];

    if (activeTab === 'following') {
      if (followedSet.size === 0) return [];
      filtered = posts.filter(
        (post) =>
          !post.parentId &&
          // Skip thread continuations: threadRootId is set and different from post.id
          // Note: "0" means not a thread continuation, so check for truthy non-zero value
          !(post.threadRootId && post.threadRootId !== '0' && post.threadRootId !== post.id) &&
          followedSet.has(String(post.author).toLowerCase())
      );
    } else {
      filtered = posts.filter((post) => {
        // Skip thread continuations — only show thread roots in the feed
        // Note: threadRootId of "0" means not a thread continuation
        if (post.threadRootId && post.threadRootId !== '0' && post.threadRootId !== post.id) return false;

        // Determine post type from postType number or contentType string
        const postTypeNum = post.postType ?? POST_TYPE_ARTICLE;
        const isThread = postTypeNum === POST_TYPE_THREAD || post.contentType === 'thread';
        const isArticle = postTypeNum === POST_TYPE_ARTICLE || post.contentType === 'article';

        // Filter by tab
        if (activeTab === 'articles') return isArticle;
        if (activeTab === 'threads') return isThread;

        // "for-you" shows everything (excluding replies for cleaner feed)
        return !post.parentId;
      });
    }

    // Sort by creation date descending (newest first)
    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [posts, activeTab, followedSet]);

  if (isLoading) {
    return (
      <div>
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </div>
    );
  }

  if (filteredPosts.length === 0) {
    return <EmptyState tab={activeTab} />;
  }

  return (
    <div>
      {filteredPosts.map((post, index) => {
        // If this is a quote post, render QuoteTweet
        if (post.quotedPost) {
          return (
            <QuoteTweet
              key={post.id}
              id={post.id}
              author={post.author}
              content={post.preview || post.content}
              createdAt={post.createdAt}
              quotedPost={post.quotedPost}
              likesCount={post.likesCount}
              commentsCount={post.commentsCount}
              index={index}
            />
          );
        }

        // Determine how to render based on post type
        const postTypeNum = post.postType ?? POST_TYPE_ARTICLE;
        const isPostTweet = postTypeNum === POST_TYPE_TWEET || post.contentType === 'tweet';
        const isThread = postTypeNum === POST_TYPE_THREAD || post.contentType === 'thread';

        // For tweets (short content)
        if (isPostTweet) {
          return (
            <TweetCard
              key={post.id}
              id={post.id}
              author={post.author}
              content={post.preview || post.content}
              createdAt={post.createdAt}
              likesCount={post.likesCount}
              commentsCount={post.commentsCount}
              replyCount={post.replyCount}
              isReply={!!post.parentId}
              parentId={post.parentId}
              imageUrl={post.imageUrl}
              index={index}
            />
          );
        }

        // For threads
        if (isThread) {
          return (
            <ThreadPreview
              key={post.id}
              id={post.id}
              author={post.author}
              content={post.preview || post.content}
              createdAt={post.createdAt}
              threadLength={post.threadLength}
              likesCount={post.likesCount}
              commentsCount={post.commentsCount}
              replyCount={post.replyCount}
              index={index}
            />
          );
        }

        // Default: articles
        return (
          <ArticlePreview
            key={post.id}
            id={post.id}
            author={post.author}
            title={post.title || 'Untitled'}
            excerpt={post.excerpt || post.preview}
            coverImage={post.coverImage}
            tags={post.tags}
            createdAt={post.createdAt}
            readingTimeMinutes={post.readingTimeMinutes}
            likesCount={post.likesCount}
            commentsCount={post.commentsCount}
            isPaid={post.isPaid}
            price={post.price}
            index={index}
          />
        );
      })}
    </div>
  );
}
