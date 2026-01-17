'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { getCommentsForPost, addComment, calculateContentHash } from '@vauban/web3-utils';
import { CommentMetadata } from '@vauban/shared-types';
import { format } from 'date-fns';

export default function CommentSection({ postId }: { postId: string }) {
  const { account, isConnected } = useWallet();
  const [comments, setComments] = useState<CommentMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadComments() {
      try {
        setIsLoading(true);
        const fetchedComments = await getCommentsForPost(postId, 50, 0);
        setComments(fetchedComments.filter(c => !c.isDeleted));
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

    if (!account || !newComment.trim()) return;

    try {
      setIsSubmitting(true);

      // Calculate content hash
      const contentHash = await calculateContentHash(newComment);

      // Submit comment (with Session Keys support - Phase 5)
      const txHash = await addComment(account, postId, contentHash, '0');

      console.log('Comment added:', txHash);

      // Clear form
      setNewComment('');

      // Reload comments
      const updatedComments = await getCommentsForPost(postId, 50, 0);
      setComments(updatedComments.filter(c => !c.isDeleted));
    } catch (error) {
      console.error('Failed to add comment:', error);
      alert('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="border-t pt-12">
      <h2 className="text-3xl font-bold mb-8">
        Comments ({comments.length})
      </h2>

      {/* Add Comment Form */}
      {isConnected ? (
        <form onSubmit={handleSubmitComment} className="mb-12">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full border rounded p-4 mb-4 min-h-32"
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !newComment.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </form>
      ) : (
        <div className="mb-12 p-4 bg-gray-50 border rounded text-center">
          <p className="text-gray-600">Connect your wallet to comment</p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="border-l-2 border-gray-200 pl-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-gray-700">
                  {comment.author.slice(0, 8)}...{comment.author.slice(-6)}
                </span>
                <time className="text-xs text-gray-500">
                  {format(new Date(comment.createdAt * 1000), 'MMM d, yyyy HH:mm')}
                </time>
              </div>

              <p className="text-gray-800 mb-2">
                {/* In real app, fetch content from hash */}
                Content hash: {comment.contentHash.slice(0, 20)}...
              </p>

              {comment.likeCount > 0 && (
                <div className="text-sm text-gray-500">
                  {comment.likeCount} likes
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
