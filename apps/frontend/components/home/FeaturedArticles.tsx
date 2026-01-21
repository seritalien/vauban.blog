'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { format } from 'date-fns';
import { VerifiedPost } from '@/hooks/use-posts';
import { formatAddress, toAddressString } from '@/lib/profiles';

interface FeaturedArticlesProps {
  posts: VerifiedPost[];
}

export default function FeaturedArticles({ posts }: FeaturedArticlesProps) {
  // Take top 3 posts (sorted by most recent or paid content priority)
  const featured = posts
    .sort((a, b) => {
      // Prioritize paid content, then by date
      if (a.isPaid !== b.isPaid) return a.isPaid ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })
    .slice(0, 3);

  if (featured.length === 0) return null;

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Featured Articles
          </h2>
          <Link
            href="#articles"
            className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all &rarr;
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {featured.map((post, index) => (
            <motion.article
              key={post.id}
              className="featured-card bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 card-hover"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {post.coverImage && (
                <Link href={`/articles/${post.id}`}>
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    {post.isPaid && (
                      <div className="absolute top-3 right-3 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded">
                        {post.price} STRK
                      </div>
                    )}
                    {post.isVerified && (
                      <div className="absolute top-3 left-3 p-1.5 bg-green-500 text-white rounded-full">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
              )}

              <div className="p-5">
                <div className="flex flex-wrap gap-2 mb-3">
                  {post.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <Link href={`/articles/${post.id}`}>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    {post.title}
                  </h3>
                </Link>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
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
                  <time dateTime={post.createdAt.toISOString()}>
                    {format(post.createdAt, 'MMM d, yyyy')}
                  </time>
                  {post.readingTimeMinutes && (
                    <span>{post.readingTimeMinutes} min read</span>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
