'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/providers/wallet-provider';
import { usePostBastion } from '@/hooks/use-post-bastion';
import { useToast } from '@/components/ui/Toast';
import { getProfile, getDisplayName } from '@/lib/profiles';
import EmojiPicker from './EmojiPicker';

interface ThreadPost {
  id: string;
  content: string;
}

interface ThreadComposerProps {
  /** Called after successful thread creation with the root post ID */
  onSuccess?: (threadRootId: string) => void;
  onCancel?: () => void;
  maxPosts?: number;
  maxLength?: number;
}

/**
 * Composer for creating multi-post threads.
 *
 * Uses usePostBastion to publish the first post via postThreadStart,
 * then chains subsequent posts via postThreadContinue.
 */
export default function ThreadComposer({
  onSuccess,
  onCancel,
  maxPosts = 25,
  maxLength = 280,
}: ThreadComposerProps) {
  const { isConnected, address } = useWallet();
  const { postThread, isPosting, error: postError, clearError } = usePostBastion();
  const { showToast } = useToast();
  const [posts, setPosts] = useState<ThreadPost[]>([
    { id: '1', content: '' },
  ]);

  const profile = address ? getProfile(address) : null;
  const displayName = address ? getDisplayName(address, profile) : '';

  const addPost = useCallback(() => {
    if (posts.length >= maxPosts) return;
    setPosts((prev) => [...prev, { id: Date.now().toString(), content: '' }]);
  }, [posts.length, maxPosts]);

  const removePost = useCallback((id: string) => {
    if (posts.length <= 1) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, [posts.length]);

  const updatePost = useCallback((id: string, content: string) => {
    clearError();
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, content } : p))
    );
  }, [clearError]);

  /**
   * Submit thread using batch multicall (just 2 transactions total!)
   */
  const handleSubmit = async () => {
    const validPostContents = posts.filter((p) => p.content.trim()).map((p) => p.content);
    if (validPostContents.length === 0 || !isConnected) return;

    try {
      const rootId = await postThread(validPostContents);
      if (!rootId) {
        showToast(postError ?? 'Failed to publish thread', 'error');
        return;
      }

      setPosts([{ id: '1', content: '' }]);
      showToast(`Thread published (${validPostContents.length} posts)`, 'success');
      onSuccess?.(rootId);
    } catch (error) {
      console.error('Failed to submit thread:', error);
      showToast('Failed to publish thread', 'error');
    }
  };

  const totalChars = posts.reduce((sum, p) => sum + p.content.length, 0);
  const validPostCount = posts.filter((p) => p.content.trim()).length;
  const canSubmit = validPostCount > 0 && posts.every((p) => p.content.length <= maxLength);

  if (!isConnected) {
    return (
      <div className="p-6 text-center border-b border-gray-200 dark:border-gray-700">
        <p className="text-gray-500 dark:text-gray-400">
          Connect your wallet to create a thread
        </p>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 dark:text-white">
            Create Thread
          </span>
          <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
            {validPostCount} {validPostCount === 1 ? 'post' : 'posts'}
          </span>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Posts */}
      <div className="max-h-[60vh] overflow-y-auto">
        <AnimatePresence>
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative"
            >
              {/* Connector line */}
              {index < posts.length - 1 && (
                <div className="absolute left-9 top-14 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
              )}

              <div className="flex gap-3 p-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
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
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {index + 1}/{posts.length}
                    </span>
                    {posts.length > 1 && (
                      <button
                        onClick={() => removePost(post.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <textarea
                    value={post.content}
                    onChange={(e) => updatePost(post.id, e.target.value)}
                    placeholder={index === 0 ? "Start your thread..." : "Add to your thread..."}
                    rows={3}
                    className="w-full bg-transparent border-0 resize-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400 text-base"
                  />

                  <div className="flex items-center justify-between">
                    <EmojiPicker
                      onSelect={(emoji) => updatePost(post.id, post.content + emoji)}
                    />
                    <span
                      className={`text-xs ${
                        post.content.length > maxLength
                          ? 'text-red-500'
                          : 'text-gray-400'
                      }`}
                    >
                      {post.content.length}/{maxLength}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add post button */}
      {posts.length < maxPosts && (
        <button
          onClick={addPost}
          className="w-full p-3 flex items-center justify-center gap-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border-t border-gray-100 dark:border-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add another post
        </button>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {totalChars} total characters
          </span>
          {postError && (
            <span className="text-xs text-red-500">{postError}</span>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isPosting}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-full transition-colors disabled:cursor-not-allowed"
        >
          {isPosting
            ? 'Publishing...'
            : `Post thread (${validPostCount})`}
        </button>
      </div>
    </div>
  );
}
