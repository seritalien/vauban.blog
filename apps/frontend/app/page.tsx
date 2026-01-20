'use client';

import { useState, useMemo, useCallback, Suspense } from 'react';
import { usePosts } from '@/hooks/use-posts';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArticleCardSkeleton } from '@/components/ui/Skeleton';
import SearchFilterBar from '@/components/search/SearchFilterBar';
import Pagination from '@/components/ui/Pagination';

// Disable static generation for this page (requires IPFS/Arweave client-side)
export const dynamic = 'force-dynamic';

const POSTS_PER_PAGE = 9;

function HomeContent() {
  const { posts, isLoading, error } = usePosts(100, 0);
  const [filters, setFilters] = useState({ search: '', tags: [] as string[] });
  const [currentPage, setCurrentPage] = useState(1);

  // Collect all unique tags from posts
  const allTags = useMemo(() => {
    return posts.flatMap((post) => post.tags || []);
  }, [posts]);

  // Filter posts based on search and tags
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // Search filter (title, excerpt, content)
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const titleMatch = post.title?.toLowerCase().includes(searchLower);
        const excerptMatch = post.excerpt?.toLowerCase().includes(searchLower);
        const contentMatch = post.content?.toLowerCase().includes(searchLower);
        if (!titleMatch && !excerptMatch && !contentMatch) {
          return false;
        }
      }

      // Tag filter (match ALL selected tags)
      if (filters.tags.length > 0) {
        const postTags = post.tags || [];
        if (!filters.tags.every((tag) => postTags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }, [posts, filters]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  const handleFilterChange = useCallback((newFilters: { search: string; tags: string[] }) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Scroll to top of articles section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Latest Articles</h1>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
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

  const hasFilters = filters.search || filters.tags.length > 0;

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">
        {hasFilters ? 'Search Results' : 'Latest Articles'}
      </h1>

      {/* Search and Filter Bar */}
      <SearchFilterBar allTags={allTags} onFilterChange={handleFilterChange} />

      {filteredPosts.length === 0 && hasFilters ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p className="text-lg sm:text-xl">No articles match your search.</p>
          <p className="mt-2">Try different keywords or clear the filters.</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p className="text-lg sm:text-xl">No articles published yet.</p>
          <p className="mt-2">Be the first to publish!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 lg:gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedPosts.map((post) => (
            <article
              key={post.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-gray-800 transition-shadow bg-white dark:bg-gray-800 active:scale-[0.98] touch-manipulation"
            >
              {post.coverImage && (
                <img
                  src={post.coverImage}
                  alt={post.title}
                  className="w-full h-40 sm:h-48 object-cover"
                />
              )}
              <div className="p-4 sm:p-6">
                <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 sm:py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <Link href={`/articles/${post.id}`}>
                  <h2 className="text-xl sm:text-2xl font-bold mb-2 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">
                    {post.title}
                  </h2>
                </Link>

                <p className="text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base">
                  {post.excerpt}
                </p>

                <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  <time dateTime={post.createdAt.toISOString()}>
                    {format(post.createdAt, 'MMM d, yyyy')}
                  </time>

                  {post.isPaid && (
                    <span className="px-2 py-0.5 sm:py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded text-xs">
                      {post.price} STRK
                    </span>
                  )}
                </div>

                {post.readingTimeMinutes && (
                  <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {post.readingTimeMinutes} min read
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {filteredPosts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}

      {/* Results count */}
      {filteredPosts.length > 0 && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
          Showing {(currentPage - 1) * POSTS_PER_PAGE + 1}-{Math.min(currentPage * POSTS_PER_PAGE, filteredPosts.length)} of {filteredPosts.length} articles
          {hasFilters && ` (filtered from ${posts.length})`}
        </p>
      )}
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Latest Articles</h1>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
          <ArticleCardSkeleton />
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
