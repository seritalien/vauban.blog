'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import EngagementBar from './EngagementBar';
import InlineComments from './InlineComments';
import InlineThread from './InlineThread';
import { getProfile, getDisplayName, formatAddress, toAddressString } from '@/lib/profiles';

interface ThreadPreviewProps {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  threadLength?: number;
  likesCount?: number;
  commentsCount?: number;
  replyCount?: number;
  index?: number;
}

export default function ThreadPreview({
  id,
  author,
  content,
  createdAt,
  threadLength = 1,
  likesCount = 0,
  commentsCount = 0,
  replyCount = 0,
  index = 0,
}: ThreadPreviewProps) {
  const [showComments, setShowComments] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const authorAddress = toAddressString(author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(author, profile);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    >
      <div className="flex gap-3">
        {/* Avatar with thread indicator */}
        <div className="flex-shrink-0 relative">
          <Link href={`/authors/${authorAddress}`}>
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
          {/* Thread connector line */}
          <div className="absolute left-1/2 top-12 bottom-0 w-0.5 bg-gradient-to-b from-gray-300 to-transparent dark:from-gray-600 -translate-x-1/2 h-8" />
        </div>

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
            <span className="text-gray-500 dark:text-gray-400 text-sm">
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>

          {/* Thread badge */}
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              THREAD ({threadLength})
            </span>
          </div>

          {/* First post of thread */}
          <div className="mt-2">
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap break-words">
              {content}
            </p>
          </div>

          {/* Expand thread / navigate to full page */}
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setShowThread(!showThread)}
              className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 text-sm font-medium hover:underline"
            >
              {showThread ? 'Réduire le thread' : 'Déplier le thread'}
              <svg className={`w-4 h-4 transition-transform ${showThread ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <Link
              href={`/thread/${id}`}
              className="text-gray-400 dark:text-gray-500 text-xs hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            >
              Page complète
            </Link>
          </div>

          {/* Engagement bar */}
          <div className="mt-3">
            <EngagementBar
              postId={id}
              initialLikes={likesCount}
              initialComments={commentsCount + replyCount}
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

      {/* Inline thread expansion */}
      <InlineThread
        threadRootId={id}
        isExpanded={showThread}
        onClose={() => setShowThread(false)}
      />

      {/* Inline comments */}
      <InlineComments
        postId={id}
        isExpanded={showComments}
        onClose={() => setShowComments(false)}
        initialCount={commentsCount + replyCount}
      />
    </motion.article>
  );
}
