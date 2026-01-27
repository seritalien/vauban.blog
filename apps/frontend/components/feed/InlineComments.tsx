'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import { getProfile, getDisplayName } from '@/lib/profiles';
import { getCommentsForPost, addComment, calculateContentHash } from '@vauban/web3-utils';
import { uploadJSONToIPFSViaAPI } from '@/lib/ipfs-client';
import { storeCommentContent, getCommentContent } from '@/lib/comment-storage';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface Comment {
  id: string;
  author: string;
  content: string | null;
  createdAt: Date;
  parentCommentId?: string;
}

interface InlineCommentsProps {
  postId: string;
  isExpanded: boolean;
  onClose: () => void;
  initialCount?: number;
}

export default function InlineComments({
  postId,
  isExpanded,
  onClose,
  initialCount: _initialCount = 0,
}: InlineCommentsProps) {
  const { account, address, isConnected } = useWallet();
  const { showToast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const profile = address ? getProfile(address) : null;
  const displayName = address ? getDisplayName(address, profile) : '';

  // Load comments when expanded
  useEffect(() => {
    if (isExpanded) {
      loadComments();
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isExpanded, postId]);

  const toHexHash = (hash: string): string => {
    if (hash.startsWith('0x')) return hash.toLowerCase();
    try {
      return `0x${BigInt(hash).toString(16)}`;
    } catch {
      return hash;
    }
  };

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const rawComments = await getCommentsForPost(postId, 10, 0);

      // Resolve content: localStorage first (same device), then IPFS fallback
      const commentsWithContent = await Promise.all(
        rawComments.map(async (comment) => {
          const hexHash = toHexHash(comment.contentHash);

          // Try localStorage first (works for comments posted from this browser)
          const localContent = getCommentContent(hexHash);
          if (localContent) {
            return {
              id: comment.id,
              author: comment.author,
              content: localContent,
              createdAt: new Date(comment.createdAt * 1000),
              parentCommentId: comment.parentCommentId,
            };
          }

          // Try IPFS fallback (for comments posted from other devices)
          try {
            const response = await fetch(`/api/ipfs/${comment.contentHash}`);
            if (response.ok) {
              const data = await response.json();
              const content = data.content || data.text;
              if (content) {
                // Cache in localStorage for future reads
                storeCommentContent(hexHash, content);
                return {
                  id: comment.id,
                  author: comment.author,
                  content,
                  createdAt: new Date(comment.createdAt * 1000),
                  parentCommentId: comment.parentCommentId,
                };
              }
            }
          } catch (e) {
            console.warn('Failed to load comment content from IPFS:', e);
          }

          return {
            id: comment.id,
            author: comment.author,
            content: null,
            createdAt: new Date(comment.createdAt * 1000),
            parentCommentId: comment.parentCommentId,
          };
        })
      );

      setComments(commentsWithContent);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !account || isPosting) return;

    setIsPosting(true);
    try {
      // Prepare comment data
      const commentData = {
        content: newComment.trim(),
        author: address,
        postId,
        createdAt: Date.now(),
      };

      // Upload to IPFS for off-chain storage
      await uploadJSONToIPFSViaAPI(commentData);

      // Calculate content hash for on-chain storage (felt252-compatible)
      const contentHash = await calculateContentHash(JSON.stringify(commentData));

      // Store content in localStorage indexed by hash (for cross-component reads)
      storeCommentContent(contentHash, newComment.trim());

      // Add comment on-chain with hash
      await addComment(account, postId, contentHash);

      // Add to local state immediately
      const newCommentObj: Comment = {
        id: `temp-${Date.now()}`,
        author: address || '',
        content: newComment.trim(),
        createdAt: new Date(),
      };
      setComments(prev => [newCommentObj, ...prev]);
      setNewComment('');
      showToast('Commentaire ajouté !', 'success');
    } catch (error) {
      console.error('Error posting comment:', error);
      showToast('Échec de l\'ajout du commentaire', 'error');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <AnimatePresence>
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-t border-gray-100 dark:border-gray-800"
        >
          <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30">
            {/* Comment input */}
            {isConnected ? (
              <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
                <div className="flex-shrink-0">
                  {profile?.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={displayName}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      {displayName[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  disabled={isPosting}
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isPosting}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-full transition-colors disabled:cursor-not-allowed"
                >
                  {isPosting ? '...' : 'Envoyer'}
                </button>
              </form>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                <Link href="/auth/signin" className="text-blue-500 hover:underline">
                  Connectez-vous
                </Link>{' '}
                pour commenter
              </p>
            )}

            {/* Comments list */}
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : comments.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {comments.map((comment) => (
                  <CommentItem key={comment.id} comment={comment} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                Aucun commentaire. Soyez le premier !
              </p>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full mt-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Fermer les commentaires
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommentItem({ comment }: { comment: Comment }) {
  const profile = getProfile(comment.author);
  const displayName = getDisplayName(comment.author, profile);

  return (
    <div className="flex gap-2">
      <Link href={`/authors/${comment.author}`} className="flex-shrink-0">
        {profile?.avatar ? (
          <img
            src={profile.avatar}
            alt={displayName}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold">
            {displayName[0]?.toUpperCase() || '?'}
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <Link
              href={`/authors/${comment.author}`}
              className="text-sm font-medium text-gray-900 dark:text-white hover:underline"
            >
              {displayName}
            </Link>
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {comment.content ?? (
              <span className="text-gray-400 dark:text-gray-500 italic">
                [Commentaire posté depuis un autre appareil]
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
