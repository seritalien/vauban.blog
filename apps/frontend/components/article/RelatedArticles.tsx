'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { usePosts, VerifiedPost } from '@/hooks/use-posts';
import { formatAddress, toAddressString } from '@/lib/profiles';

interface RelatedArticlesProps {
  currentPostId: string;
  tags: string[];
  maxArticles?: number;
}

export default function RelatedArticles({ currentPostId, tags, maxArticles = 3 }: RelatedArticlesProps) {
  const { posts, isLoading } = usePosts(50, 0);

  const relatedPosts = useMemo(() => {
    if (!posts.length || !tags.length) return [];

    // Score posts by number of matching tags
    const scoredPosts = posts
      .filter((post) => post.id !== currentPostId) // Exclude current post
      .map((post) => {
        const postTags = post.tags || [];
        const matchingTags = tags.filter((tag) => postTags.includes(tag));
        return {
          post,
          score: matchingTags.length,
          matchingTags,
        };
      })
      .filter((item) => item.score > 0) // Only posts with at least one matching tag
      .sort((a, b) => b.score - a.score); // Sort by score descending

    return scoredPosts.slice(0, maxArticles);
  }, [posts, currentPostId, tags, maxArticles]);

  if (isLoading || relatedPosts.length === 0) return null;

  return (
    <section className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
      <h2 className="text-2xl font-bold mb-6">Related Articles</h2>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {relatedPosts.map(({ post, matchingTags }) => (
          <RelatedArticleCard key={post.id} post={post} matchingTags={matchingTags} />
        ))}
      </div>
    </section>
  );
}

function RelatedArticleCard({ post, matchingTags }: { post: VerifiedPost; matchingTags: string[] }) {
  return (
    <article className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-gray-800 transition-shadow bg-white dark:bg-gray-800">
      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-32 object-cover"
        />
      )}
      <div className="p-4">
        {/* Matching tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {matchingTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded"
            >
              {tag}
            </span>
          ))}
        </div>

        <Link href={`/articles/${post.id}`}>
          <h3 className="text-lg font-semibold mb-2 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">
            {post.title}
          </h3>
        </Link>

        <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
          {post.excerpt}
        </p>

        {/* Author link */}
        {post.author && (
          <Link
            href={`/authors/${toAddressString(post.author)}`}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-mono mb-2 block"
          >
            by {formatAddress(post.author)}
          </Link>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <time dateTime={post.createdAt?.toISOString()}>
            {post.createdAt ? format(post.createdAt, 'MMM d, yyyy') : 'Unknown'}
          </time>

          {post.isPaid && (
            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
              {post.price} STRK
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
