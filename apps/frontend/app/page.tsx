'use client';

import { usePosts } from '@/hooks/use-posts';
import Link from 'next/link';
import { format } from 'date-fns';

export default function HomePage() {
  const { posts, isLoading, error } = usePosts(20, 0);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading articles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          <h2 className="font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8">Latest Articles</h1>

      {posts.length === 0 ? (
        <div className="text-center py-12 text-gray-600">
          <p className="text-xl">No articles published yet.</p>
          <p className="mt-2">Be the first to publish!</p>
        </div>
      ) : (
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <article
              key={post.id}
              className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
            >
              {post.coverImage && (
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <div className="flex gap-2 mb-3">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <Link href={`/articles/${post.slug}`}>
                  <h2 className="text-2xl font-bold mb-2 hover:text-blue-600">
                    {post.title}
                  </h2>
                </Link>

                <p className="text-gray-600 mb-4 line-clamp-3">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <time dateTime={post.createdAt.toISOString()}>
                    {format(post.createdAt, 'MMM d, yyyy')}
                  </time>

                  {post.isPaid && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                      {post.price} STRK
                    </span>
                  )}
                </div>

                {post.readingTimeMinutes && (
                  <p className="mt-2 text-sm text-gray-500">
                    {post.readingTimeMinutes} min read
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
