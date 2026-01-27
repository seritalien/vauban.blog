'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import EngagementBar from './EngagementBar';
import InlineComments from './InlineComments';
import { getProfile, getDisplayName, formatAddress, toAddressString } from '@/lib/profiles';

interface TweetCardProps {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  likesCount?: number;
  commentsCount?: number;
  replyCount?: number;
  isReply?: boolean;
  parentId?: string;
  imageUrl?: string;
  index?: number;
}

export default function TweetCard({
  id,
  author,
  content,
  createdAt,
  likesCount = 0,
  commentsCount = 0,
  replyCount = 0,
  isReply = false,
  imageUrl,
  index = 0,
}: TweetCardProps) {
  const [showComments, setShowComments] = useState(false);
  const authorAddress = toAddressString(author);
  const profile = getProfile(authorAddress);
  const displayName = getDisplayName(author, profile);

  const toggleComments = () => {
    setShowComments(!showComments);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        relative border-b border-gray-200 dark:border-gray-700
        ${isReply ? 'pl-12' : ''}
      `}
    >
      {/* Reply line connector */}
      {isReply && (
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
      )}

      <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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

            {/* Tweet content */}
            <Link href={`/articles/${id}`} className="block mt-1">
              <p className="text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                {content}
              </p>
            </Link>

            {/* Attached image */}
            {imageUrl && (
              <Link href={`/articles/${id}`} className="block mt-3">
                <img
                  src={imageUrl}
                  alt=""
                  className="rounded-xl max-h-80 w-auto border border-gray-200 dark:border-gray-700"
                  loading="lazy"
                />
              </Link>
            )}

            {/* Engagement bar */}
            <div className="mt-3">
              <EngagementBar
                postId={id}
                initialLikes={likesCount}
                initialComments={commentsCount + replyCount}
                onComment={toggleComments}
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
        initialCount={commentsCount + replyCount}
      />
    </motion.article>
  );
}
