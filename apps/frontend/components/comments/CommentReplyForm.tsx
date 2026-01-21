'use client';

import { useState, type FC, type FormEvent } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useSessionKey } from '@/hooks/use-session-key';
import { useToast } from '@/components/ui/Toast';
import { addComment, calculateContentHash } from '@vauban/web3-utils';
import { storeCommentContent } from '@/lib/comment-storage';
import { ec, hash } from 'starknet';

interface CommentReplyFormProps {
  postId: string;
  parentCommentId: string;
  replyingToUsername: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Inline form for replying to a specific comment.
 * Shows "Replying to @username" indicator and supports gasless transactions via session keys.
 */
const CommentReplyForm: FC<CommentReplyFormProps> = ({
  postId,
  parentCommentId,
  replyingToUsername,
  onSuccess,
  onCancel,
}) => {
  const { account, address } = useWallet();
  const {
    hasActiveSessionKey,
    sessionKey,
    createSessionKey,
    isCreating: isCreatingSessionKey,
    getSessionKeyNonce,
  } = useSessionKey();
  const { showToast } = useToast();
  const [replyContent, setReplyContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!account || !replyContent.trim() || !address) return;

    try {
      setIsSubmitting(true);

      const commentText = replyContent.trim();

      // Calculate content hash
      const contentHash = await calculateContentHash(commentText);

      // Store content locally BEFORE blockchain submission
      storeCommentContent(contentHash, commentText);

      // Use gasless relay if session key is active
      if (hasActiveSessionKey && sessionKey?.isOnChain) {
        showToast('Posting reply (gasless)...', 'info');

        // Get current nonce
        const nonce = await getSessionKeyNonce();

        // Sign the message with session private key
        const messageHash = hash.computeHashOnElements([
          postId,
          contentHash,
          parentCommentId,
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
            parentCommentId,
            sessionPublicKey: sessionKey.publicKey,
            userAddress: address,
            signature: signatureStr,
            nonce,
          }),
        });

        const result = await response.json() as { error?: string; transactionHash?: string };

        if (!response.ok) {
          throw new Error(result.error ?? 'Relay failed');
        }

        // Transaction hash available in result.transactionHash if needed for tracking
        showToast('Reply posted (gasless)!', 'success');
      } else {
        // Regular submission - user pays gas
        await addComment(account, postId, contentHash, parentCommentId);
        showToast('Reply posted successfully!', 'success');
      }

      // Clear form and notify parent
      setReplyContent('');
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(`Failed to post reply: ${errorMessage}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      {/* Replying to indicator */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-gray-500 dark:text-gray-400">Replying to</span>
        <span className="font-medium text-blue-600 dark:text-blue-400">
          @{replyingToUsername}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={replyContent}
          onChange={(e) => setReplyContent(e.target.value)}
          placeholder="Write your reply..."
          className="w-full border border-gray-300 dark:border-gray-600 rounded-lg p-3 mb-3 min-h-20 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
          disabled={isSubmitting}
          autoFocus
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isSubmitting || !replyContent.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {isSubmitting ? 'Posting...' : 'Reply'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Session key indicator for replies */}
          {hasActiveSessionKey ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded-full">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Gasless
            </span>
          ) : (
            <button
              type="button"
              onClick={() => createSessionKey()}
              disabled={isCreatingSessionKey}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Enable session key for gasless replies"
            >
              {isCreatingSessionKey ? 'Enabling...' : 'Enable gasless'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default CommentReplyForm;
