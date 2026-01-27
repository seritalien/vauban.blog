'use client';

import { type FC, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { getPost } from '@vauban/web3-utils';
import { queryKeys } from '@/lib/query-keys';
import { fetchPostContent } from '@/hooks/use-posts';

export interface ArticleCardData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  tags: string[];
  author: {
    address: string;
    displayName?: string;
    avatar?: string;
  };
  createdAt: number;
  readTime?: number;
  likes?: number;
  isPaid?: boolean;
  price?: number;
}

export interface EnhancedArticleCardProps {
  article: ArticleCardData;
  index?: number;
  variant?: 'default' | 'featured' | 'compact';
}

/**
 * Enhanced article card with animations and hover effects.
 */
export const EnhancedArticleCard: FC<EnhancedArticleCardProps> = ({
  article,
  index = 0,
  variant = 'default',
}) => {
  const queryClient = useQueryClient();
  const {
    slug,
    title,
    excerpt,
    coverImage,
    tags,
    author,
    createdAt,
    readTime,
    likes,
    isPaid,
    price,
  } = article;

  const articleUrl = `/articles/${slug}`;
  const formattedDate = formatDistanceToNow(new Date(createdAt * 1000), {
    addSuffix: true,
  });

  // Prefetch article data on hover for instant navigation
  const handleMouseEnter = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.posts.detail(slug),
      queryFn: async () => {
        const meta = await getPost(slug);
        return fetchPostContent(meta);
      },
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient, slug]);

  if (variant === 'compact') {
    return (
      <motion.article
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="group flex gap-4 p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onMouseEnter={handleMouseEnter}
      >
        {coverImage && (
          <Link href={articleUrl} className="flex-shrink-0 relative w-20 h-20">
            <Image
              src={coverImage}
              alt={title}
              width={80}
              height={80}
              className="rounded-lg object-cover"
              loading="lazy"
            />
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <Link href={articleUrl}>
            <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
              {title}
            </h3>
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formattedDate} {readTime && `· ${readTime} min read`}
          </p>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-xl transition-shadow duration-300"
      onMouseEnter={handleMouseEnter}
    >
      {/* Cover image with overlay */}
      <Link href={articleUrl} className="block relative h-48 overflow-hidden">
        {coverImage ? (
          <>
            <motion.div
              className="w-full h-full"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.4 }}
            >
              <Image
                src={coverImage}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                loading="lazy"
              />
            </motion.div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
            <span className="text-6xl opacity-50">📝</span>
          </div>
        )}

        {/* Tags overlay */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-white/20 backdrop-blur-sm rounded-full text-white"
            >
              {tag}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="px-2 py-0.5 text-xs bg-white/20 backdrop-blur-sm rounded-full text-white">
              +{tags.length - 2}
            </span>
          )}
        </div>

        {/* Paid badge */}
        {isPaid && (
          <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-yellow-500 text-black rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                clipRule="evenodd"
              />
            </svg>
            {price && <span>{price} STRK</span>}
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="p-4">
        <Link href={articleUrl}>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {title}
          </h3>
        </Link>
        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-4">
          {excerpt}
        </p>

        {/* Footer with author and meta */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            {author.avatar ? (
              <Image
                src={author.avatar}
                alt={author.displayName || 'Author'}
                width={24}
                height={24}
                className="rounded-full"
                loading="lazy"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-xs font-medium">
                {(author.displayName || author.address)?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="truncate max-w-[100px]">
              {author.displayName || `${author.address.slice(0, 6)}...`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {readTime && <span>{readTime} min</span>}
            {likes !== undefined && likes > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                    clipRule="evenodd"
                  />
                </svg>
                {likes}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Hover border effect */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-purple-500/30 rounded-xl transition-colors pointer-events-none" />
    </motion.article>
  );
};

export default EnhancedArticleCard;
