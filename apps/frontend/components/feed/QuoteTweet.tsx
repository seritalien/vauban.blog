'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import EngagementBar from './EngagementBar';
import InlineComments from './InlineComments';
import { getProfile, getDisplayName, formatAddress, toAddressString } from '@/lib/profiles';

// =============================================================================
// TYPES
// =============================================================================

interface QuotedPost {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
}

interface QuoteTweetProps {
  /** The quoting post */
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  /** The original post being quoted */
  quotedPost: QuotedPost;
  likesCount?: number;
  commentsCount?: number;
  index?: number;
}

// =============================================================================
// EMBEDDED QUOTE CARD (inner)
// =============================================================================

function EmbeddedQuote({ post }: { post: QuotedPost }) {
  const authorAddress = toAddressString(post.author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(post.author, profile);

  return (
    <Link
      href={`/articles/${post.id}`}
      className="block mt-2 border border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-1">
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={displayName}
            className="w-5 h-5 rounded-full object-cover"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
            {displayName[0].toUpperCase()}
          </div>
        )}
        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">
          {displayName}
        </span>
        <span className="text-gray-500 dark:text-gray-400 text-xs truncate">
          @{formatAddress(authorAddress)}
        </span>
        <span className="text-gray-400 dark:text-gray-500 text-xs">·</span>
        <span className="text-gray-500 dark:text-gray-400 text-xs">
          {formatDistanceToNow(post.createdAt, { addSuffix: true })}
        </span>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words line-clamp-4">
        {post.content}
      </p>
    </Link>
  );
}

// =============================================================================
// QUOTE TWEET COMPONENT
// =============================================================================

export default function QuoteTweet({
  id,
  author,
  content,
  createdAt,
  quotedPost,
  likesCount = 0,
  commentsCount = 0,
  index = 0,
}: QuoteTweetProps) {
  const [showComments, setShowComments] = useState(false);
  const authorAddress = toAddressString(author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(author, profile);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="border-b border-gray-200 dark:border-gray-700"
    >
      <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
        {/* Repost indicator */}
        <div className="flex items-center gap-2 ml-10 mb-1 text-xs text-gray-500 dark:text-gray-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Quoted</span>
        </div>

        <div className="flex gap-3">
          {/* Avatar */}
          <Link href={`/authors/${authorAddress}`} className="flex-shrink-0">
            {profile?.avatar ? (
              <img
                src={profile.avatar}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm hover:opacity-80 transition-opacity">
                {displayName[0].toUpperCase()}
              </div>
            )}
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/authors/${authorAddress}`}
                className="font-semibold text-gray-900 dark:text-white hover:underline truncate"
              >
                {displayName}
              </Link>
              <Link
                href={`/authors/${authorAddress}`}
                className="text-gray-500 dark:text-gray-400 text-sm truncate"
              >
                @{formatAddress(authorAddress)}
              </Link>
              <span className="text-gray-400 dark:text-gray-500">·</span>
              <Link
                href={`/articles/${id}`}
                className="text-gray-500 dark:text-gray-400 text-sm hover:underline"
              >
                {formatDistanceToNow(createdAt, { addSuffix: true })}
              </Link>
            </div>

            {/* User's commentary */}
            <p className="mt-1 text-gray-900 dark:text-white whitespace-pre-wrap break-words">
              {content}
            </p>

            {/* Embedded quoted post */}
            <EmbeddedQuote post={quotedPost} />

            {/* Engagement bar */}
            <div className="mt-3">
              <EngagementBar
                postId={id}
                initialLikes={likesCount}
                initialComments={commentsCount}
                onComment={() => setShowComments(!showComments)}
              />
            </div>
          </div>

          {/* More options menu */}
          <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors self-start">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Inline comments */}
      <InlineComments
        postId={id}
        isExpanded={showComments}
        onClose={() => setShowComments(false)}
        initialCount={commentsCount}
      />
    </motion.article>
  );
}
