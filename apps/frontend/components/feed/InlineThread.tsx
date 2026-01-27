'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getThreadPosts, getPost } from '@vauban/web3-utils';
import { fetchPostContent } from '@/hooks/use-posts';
import { getProfile, getDisplayName, formatAddress } from '@/lib/profiles';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import EngagementBar from './EngagementBar';

interface ThreadPostItem {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
  imageUrl?: string;
}

interface InlineThreadProps {
  threadRootId: string;
  isExpanded: boolean;
  onClose: () => void;
}

export default function InlineThread({
  threadRootId,
  isExpanded,
  onClose,
}: InlineThreadProps) {
  const [posts, setPosts] = useState<ThreadPostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && posts.length === 0) {
      loadThreadPosts();
    }
  }, [isExpanded, threadRootId]);

  const loadThreadPosts = async () => {
    setIsLoading(true);
    try {
      const metas = await getThreadPosts(threadRootId, 50, 0);

      // Filter out the root post — it's already displayed in ThreadPreview above.
      // The contract includes the root in getThreadPosts() results.
      const loaded = await Promise.all(
        metas
          .filter(meta => !meta.isDeleted && meta.id !== threadRootId)
          .map(async (meta) => {
            try {
              const full = await fetchPostContent(meta);
              return {
                id: full.id,
                author: typeof full.author === 'string' ? full.author : String(full.author),
                content: full.content || full.excerpt || '',
                createdAt: full.createdAt,
                imageUrl: (full as unknown as Record<string, unknown>).imageUrl as string | undefined,
              };
            } catch {
              // Fallback: try loading the post individually via getPost() (no status filter)
              try {
                const freshMeta = await getPost(meta.id);
                const full = await fetchPostContent(freshMeta);
                return {
                  id: full.id,
                  author: typeof full.author === 'string' ? full.author : String(full.author),
                  content: full.content || full.excerpt || '',
                  createdAt: full.createdAt,
                  imageUrl: (full as unknown as Record<string, unknown>).imageUrl as string | undefined,
                };
              } catch {
                return {
                  id: meta.id,
                  author: typeof meta.author === 'string' ? meta.author : String(meta.author),
                  content: '[Contenu indisponible]',
                  createdAt: new Date(meta.createdAt * 1000),
                };
              }
            }
          })
      );

      // Sort chronologically
      loaded.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      setPosts(loaded);
    } catch (error) {
      console.error('Error loading thread posts:', error);
    } finally {
      setIsLoading(false);
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
          <div className="bg-gray-50/50 dark:bg-gray-800/30">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent" />
              </div>
            ) : posts.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {posts.map((post, index) => (
                  <ThreadPostInline key={post.id} post={post} index={index} total={posts.length} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Aucune suite dans ce thread.
              </p>
            )}

            {/* Footer with link to full page and close */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 dark:border-gray-800">
              <Link
                href={`/thread/${threadRootId}`}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Voir le thread complet
              </Link>
              <button
                onClick={onClose}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ThreadPostInline({ post, index, total }: { post: ThreadPostItem; index: number; total: number }) {
  const profile = getProfile(post.author);
  const displayName = getDisplayName(post.author, profile);
  const isLast = index === total - 1;

  return (
    <div className="flex gap-3 px-4 py-3">
      {/* Position indicator */}
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
          {index + 1}
        </div>
        {/* Connector line */}
        {!isLast && (
          <div className="w-0.5 flex-1 bg-purple-200 dark:bg-purple-800 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/authors/${post.author}`}
            className="text-sm font-medium text-gray-900 dark:text-white hover:underline"
          >
            {displayName}
          </Link>
          <span className="text-xs text-gray-400">
            @{formatAddress(post.author)}
          </span>
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(post.createdAt, { addSuffix: true })}
          </span>
          <span className="text-xs text-gray-400">
            {index + 1}/{total}
          </span>
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
          {post.content}
        </p>

        {/* Image */}
        {post.imageUrl && (
          <div className="mt-2">
            <img
              src={post.imageUrl}
              alt=""
              className="rounded-lg max-h-60 w-auto border border-gray-200 dark:border-gray-700"
              loading="lazy"
            />
          </div>
        )}

        {/* Engagement */}
        <div className="mt-2">
          <EngagementBar postId={post.id} compact />
        </div>
      </div>
    </div>
  );
}
