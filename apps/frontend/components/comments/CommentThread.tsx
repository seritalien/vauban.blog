'use client';

import { useState, type FC } from 'react';
import { format } from 'date-fns';
import type { CommentMetadata } from '@vauban/shared-types';
import LikeButton from '@/components/social/LikeButton';
import CommentReplyForm from './CommentReplyForm';

// Extended comment type with resolved content and nested replies
export interface CommentWithContent extends CommentMetadata {
  content: string | null;
  replies?: CommentWithContent[];
}

interface CommentThreadProps {
  comment: CommentWithContent;
  depth: number;
  maxDepth: number;
  postId: string;
  activeReplyTo: string | null;
  onSetActiveReplyTo: (commentId: string | null) => void;
  onReplySubmitted: () => void;
  isConnected: boolean;
}

const MAX_COLLAPSED_REPLIES = 3;

/**
 * Recursive component for rendering a single comment and its nested replies.
 * Supports max 3 levels of nesting, collapse/expand for long threads.
 */
const CommentThread: FC<CommentThreadProps> = ({
  comment,
  depth,
  maxDepth,
  postId,
  activeReplyTo,
  onSetActiveReplyTo,
  onReplySubmitted,
  isConnected,
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const [showAllReplies, setShowAllReplies] = useState(false);

  const authorStr = String(comment.author);
  const hasReplies = comment.replies && comment.replies.length > 0;
  const canReply = depth < maxDepth;
  const isReplyFormActive = activeReplyTo === comment.id;

  // Calculate indentation based on depth
  const indentClass = depth === 0 ? '' : depth === 1 ? 'ml-6' : depth === 2 ? 'ml-12' : 'ml-16';

  // Determine which replies to show
  const visibleReplies = showAllReplies
    ? comment.replies
    : comment.replies?.slice(0, MAX_COLLAPSED_REPLIES);
  const hiddenRepliesCount = (comment.replies?.length ?? 0) - MAX_COLLAPSED_REPLIES;

  const handleReplyClick = () => {
    if (isReplyFormActive) {
      onSetActiveReplyTo(null);
    } else {
      onSetActiveReplyTo(comment.id);
    }
  };

  const handleReplySuccess = () => {
    onSetActiveReplyTo(null);
    onReplySubmitted();
  };

  return (
    <div className={`${indentClass}`}>
      {/* Comment container with visual hierarchy */}
      <div
        className={`relative ${
          depth > 0
            ? 'border-l-2 border-gray-200 dark:border-gray-700 pl-4'
            : 'border-l-2 border-blue-400 dark:border-blue-500 pl-4'
        }`}
      >
        {/* Connector line for nested comments */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 w-4 h-4 -ml-px border-l-2 border-t-2 border-gray-200 dark:border-gray-700 rounded-tl-lg" />
        )}

        {/* Comment header */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {authorStr.slice(0, 8)}...{authorStr.slice(-6)}
          </span>
          <time className="text-xs text-gray-500 dark:text-gray-400">
            {format(new Date(comment.createdAt * 1000), 'MMM d, yyyy HH:mm')}
          </time>
          {depth > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              (reply)
            </span>
          )}
        </div>

        {/* Comment content */}
        <p className="text-gray-800 dark:text-gray-200 mb-3 whitespace-pre-wrap">
          {comment.content ?? (
            <span className="text-gray-400 dark:text-gray-500 italic">
              [Comment content unavailable - posted from another device]
            </span>
          )}
        </p>

        {/* Comment actions */}
        <div className="flex items-center gap-4 mb-3">
          <LikeButton
            targetId={comment.id}
            targetType="comment"
            initialLikeCount={comment.likeCount}
            size="sm"
          />

          {canReply && isConnected && (
            <button
              type="button"
              onClick={handleReplyClick}
              className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                isReplyFormActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              {isReplyFormActive ? 'Cancel' : 'Reply'}
            </button>
          )}

          {hasReplies && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              {isExpanded
                ? `Hide ${comment.replies?.length} ${comment.replies?.length === 1 ? 'reply' : 'replies'}`
                : `Show ${comment.replies?.length} ${comment.replies?.length === 1 ? 'reply' : 'replies'}`}
            </button>
          )}
        </div>

        {/* Inline reply form */}
        {isReplyFormActive && (
          <div className="mb-4">
            <CommentReplyForm
              postId={postId}
              parentCommentId={comment.id}
              replyingToUsername={`${authorStr.slice(0, 8)}...${authorStr.slice(-6)}`}
              onSuccess={handleReplySuccess}
              onCancel={() => onSetActiveReplyTo(null)}
            />
          </div>
        )}
      </div>

      {/* Nested replies */}
      {hasReplies && isExpanded && (
        <div className="mt-3 space-y-3">
          {visibleReplies?.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              maxDepth={maxDepth}
              postId={postId}
              activeReplyTo={activeReplyTo}
              onSetActiveReplyTo={onSetActiveReplyTo}
              onReplySubmitted={onReplySubmitted}
              isConnected={isConnected}
            />
          ))}

          {/* Show more replies button */}
          {!showAllReplies && hiddenRepliesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllReplies(true)}
              className={`${indentClass} ml-6 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline`}
            >
              Show {hiddenRepliesCount} more {hiddenRepliesCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentThread;
