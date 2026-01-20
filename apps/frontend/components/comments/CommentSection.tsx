'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useSessionKey } from '@/hooks/use-session-key';
import { useToast } from '@/components/ui/Toast';
import { getCommentsForPost, addComment, calculateContentHash } from '@vauban/web3-utils';
import { CommentMetadata } from '@vauban/shared-types';
import { format } from 'date-fns';
import { storeCommentContent, getCommentContent } from '@/lib/comment-storage';
import LikeButton from '@/components/social/LikeButton';
import { CommentSkeleton } from '@/components/ui/Skeleton';
import { ec, hash } from 'starknet';

// Extended comment type with resolved content
interface CommentWithContent extends CommentMetadata {
  content: string | null;
}

export default function CommentSection({ postId }: { postId: string }) {
  const { account, address, isConnected } = useWallet();
  const { hasActiveSessionKey, sessionKey, createSessionKey, isCreating: isCreatingSessionKey, getSessionKeyNonce } = useSessionKey();
  const { showToast } = useToast();
  const [comments, setComments] = useState<CommentWithContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convert BigInt/number to hex string for hash lookup
  function toHexHash(value: unknown): string {
    const str = String(value);
    // If already hex, return as-is
    if (str.startsWith('0x')) return str;
    // Convert decimal BigInt to hex
    try {
      return '0x' + BigInt(str).toString(16);
    } catch {
      return str;
    }
  }

  // Resolve comment content from local storage
  function resolveCommentContent(metadata: CommentMetadata[]): CommentWithContent[] {
    return metadata.map(comment => ({
      ...comment,
      content: getCommentContent(toHexHash(comment.contentHash)),
    }));
  }

  useEffect(() => {
    async function loadComments() {
      try {
        setIsLoading(true);
        const fetchedComments = await getCommentsForPost(postId, 50, 0);
        const activeComments = fetchedComments.filter(c => !c.isDeleted);
        setComments(resolveCommentContent(activeComments));
      } catch (error) {
        console.error('Failed to load comments:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadComments();
  }, [postId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account || !newComment.trim() || !address) return;

    try {
      setIsSubmitting(true);

      const commentText = newComment.trim();

      // Calculate content hash
      const contentHash = await calculateContentHash(commentText);

      // Store content locally BEFORE blockchain submission
      storeCommentContent(contentHash, commentText);

      let txHash: string;

      // Use gasless relay if session key is active
      if (hasActiveSessionKey && sessionKey?.isOnChain) {
        showToast('Posting comment (gasless)...', 'info');

        // Get current nonce
        const nonce = await getSessionKeyNonce();

        // Sign the message with session private key
        const messageHash = hash.computeHashOnElements([
          postId,
          contentHash,
          '0', // parentCommentId
          address,
          nonce.toString(),
        ]);

        const privateKeyBytes = sessionKey.privateKey.startsWith('0x')
          ? sessionKey.privateKey.slice(2)
          : sessionKey.privateKey;
        const signature = ec.starkCurve.sign(messageHash, privateKeyBytes);
        const signatureStr = JSON.stringify({
          r: '0x' + signature.r.toString(16),
          s: '0x' + signature.s.toString(16),
        });

        // Call relay API
        const response = await fetch('/api/relay/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId,
            contentHash,
            parentCommentId: '0',
            sessionPublicKey: sessionKey.publicKey,
            userAddress: address,
            signature: signatureStr,
            nonce,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Relay failed');
        }

        txHash = result.transactionHash;
        console.log('Comment relayed (gasless):', txHash);
        showToast('Comment posted (gasless)!', 'success');
      } else {
        // Regular submission - user pays gas
        txHash = await addComment(account, postId, contentHash, '0');
        console.log('Comment added:', txHash);
        showToast('Comment posted successfully!', 'success');
      }

      // Clear form
      setNewComment('');

      // Reload comments and resolve content
      const updatedComments = await getCommentsForPost(postId, 50, 0);
      const activeComments = updatedComments.filter(c => !c.isDeleted);
      setComments(resolveCommentContent(activeComments));
    } catch (error) {
      console.error('Failed to add comment:', error);
      showToast('Failed to add comment. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-12">
      <h2 className="text-3xl font-bold mb-8">
        Comments ({comments.length})
      </h2>

      {/* Add Comment Form */}
      {isConnected ? (
        <form onSubmit={handleSubmitComment} className="mb-8 sm:mb-12">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 min-h-24 sm:min-h-32 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
            disabled={isSubmitting}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim()}
              className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium touch-manipulation"
            >
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>

            {/* Session Key Status */}
            <div className="flex items-center justify-center sm:justify-end gap-2">
              {hasActiveSessionKey ? (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Session Active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => createSessionKey()}
                  disabled={isCreatingSessionKey}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors touch-manipulation"
                  title="Enable session key for faster commenting"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  {isCreatingSessionKey ? 'Creating...' : 'Enable Session'}
                </button>
              )}
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 sm:mb-12 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
          <p className="text-gray-600 dark:text-gray-400">Connect your wallet to comment</p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-6">
          <CommentSkeleton />
          <CommentSkeleton />
          <CommentSkeleton />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => {
            // Convert author to string (may be BigInt from starknet.js)
            const authorStr = String(comment.author);
            return (
              <div key={comment.id} className="border-l-2 border-gray-200 dark:border-gray-600 pl-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {authorStr.slice(0, 8)}...{authorStr.slice(-6)}
                  </span>
                  <time className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(comment.createdAt * 1000), 'MMM d, yyyy HH:mm')}
                  </time>
                </div>

                <p className="text-gray-800 dark:text-gray-200 mb-2 whitespace-pre-wrap">
                  {comment.content || (
                    <span className="text-gray-400 dark:text-gray-500 italic">
                      [Comment content unavailable - posted from another device]
                    </span>
                  )}
                </p>

                <LikeButton
                  targetId={comment.id}
                  targetType="comment"
                  initialLikeCount={comment.likeCount}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
