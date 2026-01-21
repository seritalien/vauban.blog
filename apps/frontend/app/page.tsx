'use client';

import { useState, useMemo, useCallback, Suspense } from 'react';
import { usePosts, VerifiedPost } from '@/hooks/use-posts';
import Link from 'next/link';
import { format, subDays, subMonths, subYears, isAfter, isBefore } from 'date-fns';
import { ArticleCardSkeleton } from '@/components/ui/Skeleton';
import SearchFilterBar from '@/components/search/SearchFilterBar';
import { SearchFilters, DEFAULT_FILTERS } from '@/components/search/types';
import Pagination from '@/components/ui/Pagination';
import HeroSection from '@/components/home/HeroSection';
import TrustBadges from '@/components/ui/TrustBadges';
import FeaturedArticles from '@/components/home/FeaturedArticles';
import AuthorDisplay from '@/components/ui/AuthorDisplay';

// Disable static generation for this page (requires IPFS/Arweave client-side)
export const dynamic = 'force-dynamic';

const POSTS_PER_PAGE = 9;

/**
 * Calculates search relevance score for a post
 * Title matches are weighted higher than excerpt/content matches
 */
function calculateSearchRelevance(post: VerifiedPost, searchLower: string): number {
  let score = 0;

  const titleLower = post.title?.toLowerCase() ?? '';
  const excerptLower = post.excerpt?.toLowerCase() ?? '';
  const contentLower = post.content?.toLowerCase() ?? '';

  // Title match is weighted 10x (most important)
  if (titleLower.includes(searchLower)) {
    score += 100;
    // Bonus for title starting with search term
    if (titleLower.startsWith(searchLower)) {
      score += 50;
    }
    // Bonus for exact word match in title
    const titleWords = titleLower.split(/\s+/);
    if (titleWords.includes(searchLower)) {
      score += 30;
    }
  }

  // Excerpt match is weighted 5x
  if (excerptLower.includes(searchLower)) {
    score += 50;
  }

  // Content match is weighted 1x
  if (contentLower.includes(searchLower)) {
    score += 10;
    // Count occurrences in content (max bonus of 20)
    const occurrences = (contentLower.match(new RegExp(searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    score += Math.min(occurrences * 2, 20);
  }

  return score;
}

/**
 * Checks if a post matches the date range filter
 */
function matchesDateRange(post: VerifiedPost, filters: SearchFilters): boolean {
  const postDate = post.createdAt;
  const now = new Date();

  switch (filters.dateRange) {
    case 'all':
      return true;
    case 'last_week':
      return isAfter(postDate, subDays(now, 7));
    case 'last_month':
      return isAfter(postDate, subMonths(now, 1));
    case 'last_year':
      return isAfter(postDate, subYears(now, 1));
    case 'custom': {
      const { from, to } = filters.customDateRange;
      if (from && isBefore(postDate, from)) return false;
      if (to && isAfter(postDate, to)) return false;
      return true;
    }
    default:
      return true;
  }
}

/**
 * Applies all filters to a post
 */
function applyFilters(post: VerifiedPost, filters: SearchFilters): { matches: boolean; relevance: number } {
  // Search filter with relevance scoring
  let relevance = 0;
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    relevance = calculateSearchRelevance(post, searchLower);
    if (relevance === 0) {
      return { matches: false, relevance: 0 };
    }
  }

  // Tag filter (match ALL selected tags)
  if (filters.tags.length > 0) {
    const postTags = post.tags ?? [];
    if (!filters.tags.every((tag) => postTags.includes(tag))) {
      return { matches: false, relevance: 0 };
    }
  }

  // Date range filter
  if (!matchesDateRange(post, filters)) {
    return { matches: false, relevance: 0 };
  }

  // Price filter
  if (filters.priceFilter !== 'all') {
    const isPaid = post.isPaid === true && (post.price ?? 0) > 0;
    if (filters.priceFilter === 'free' && isPaid) {
      return { matches: false, relevance: 0 };
    }
    if (filters.priceFilter === 'paid' && !isPaid) {
      return { matches: false, relevance: 0 };
    }
  }

  // Verification filter
  if (filters.verificationFilter !== 'all') {
    if (filters.verificationFilter === 'verified' && !post.isVerified) {
      return { matches: false, relevance: 0 };
    }
  }

  // Author filter
  if (filters.author) {
    if (post.author?.toLowerCase() !== filters.author.toLowerCase()) {
      return { matches: false, relevance: 0 };
    }
  }

  return { matches: true, relevance };
}

/**
 * Sorts posts based on the selected sort option
 */
function sortPosts(
  posts: Array<{ post: VerifiedPost; relevance: number }>,
  sortBy: SearchFilters['sortBy'],
  hasSearchQuery: boolean
): VerifiedPost[] {
  const sorted = [...posts];

  switch (sortBy) {
    case 'newest':
      // If there's a search query, sort by relevance first, then by date
      if (hasSearchQuery) {
        sorted.sort((a, b) => {
          if (b.relevance !== a.relevance) return b.relevance - a.relevance;
          return b.post.createdAt.getTime() - a.post.createdAt.getTime();
        });
      } else {
        sorted.sort((a, b) => b.post.createdAt.getTime() - a.post.createdAt.getTime());
      }
      break;
    case 'oldest':
      sorted.sort((a, b) => a.post.createdAt.getTime() - b.post.createdAt.getTime());
      break;
    case 'most_liked':
      // Note: We don't have like counts in the current data model
      // For now, fall back to newest. This can be enhanced when social features are integrated.
      sorted.sort((a, b) => b.post.createdAt.getTime() - a.post.createdAt.getTime());
      break;
    case 'most_commented':
      // Note: We don't have comment counts in the current data model
      // For now, fall back to newest. This can be enhanced when social features are integrated.
      sorted.sort((a, b) => b.post.createdAt.getTime() - a.post.createdAt.getTime());
      break;
    default:
      sorted.sort((a, b) => b.post.createdAt.getTime() - a.post.createdAt.getTime());
  }

  return sorted.map((item) => item.post);
}

function HomeContent() {
  const { posts, isLoading, error } = usePosts(100, 0);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  // Collect all unique tags from posts
  const allTags = useMemo(() => {
    return posts.flatMap((post) => post.tags ?? []);
  }, [posts]);

  // Collect all unique authors from posts
  const allAuthors = useMemo(() => {
    const authors = new Set<string>();
    posts.forEach((post) => {
      if (post.author) {
        authors.add(post.author);
      }
    });
    return Array.from(authors);
  }, [posts]);

  // Calculate stats for hero section
  const stats = useMemo(() => {
    const uniqueAuthors = new Set(posts.map((post) => post.author));
    const verifiedCount = posts.filter((post) => post.isVerified).length;
    return {
      totalPosts: posts.length,
      verifiedPercent: posts.length > 0 ? Math.round((verifiedCount / posts.length) * 100) : 100,
      totalAuthors: uniqueAuthors.size,
    };
  }, [posts]);

  // Filter and sort posts based on all filters
  const filteredPosts = useMemo(() => {
    // Apply all filters and calculate relevance scores
    const filteredWithRelevance = posts
      .map((post) => {
        const { matches, relevance } = applyFilters(post, filters);
        return { post, matches, relevance };
      })
      .filter((item) => item.matches);

    // Sort based on selected option (relevance is considered for search queries)
    return sortPosts(
      filteredWithRelevance.map((item) => ({ post: item.post, relevance: item.relevance })),
      filters.sortBy,
      filters.search.length > 0
    );
  }, [posts, filters]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
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
      <>
        <HeroSection stats={{ totalPosts: 0, verifiedPercent: 100, totalAuthors: 0 }} />
        <TrustBadges />
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
      </>
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

  // Check if any filters are active (excluding default sort)
  const hasActiveFilters =
    filters.search.length > 0 ||
    filters.tags.length > 0 ||
    filters.dateRange !== 'all' ||
    filters.priceFilter !== 'all' ||
    filters.verificationFilter !== 'all' ||
    filters.author.length > 0;

  return (
    <>
      {/* Hero Section */}
      <HeroSection stats={stats} />

      {/* Trust Badges */}
      <TrustBadges />

      {/* Featured Articles - only show if no filters */}
      {!hasActiveFilters && posts.length > 0 && <FeaturedArticles posts={posts} />}

      <div id="articles" className="container mx-auto px-4 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 sm:mb-8">
          {hasActiveFilters ? 'Search Results' : 'All Articles'}
        </h1>

        {/* Search and Filter Bar */}
        <SearchFilterBar allTags={allTags} allAuthors={allAuthors} onFilterChange={handleFilterChange} />

        {filteredPosts.length === 0 && hasActiveFilters ? (
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
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-gray-800 transition-shadow bg-white dark:bg-gray-800 active:scale-[0.98] touch-manipulation card-hover"
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
                    {(post.tags ?? []).slice(0, 3).map((tag) => (
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

                  {/* Author */}
                  {post.author && (
                    <div className="mb-2">
                      <AuthorDisplay
                        address={post.author}
                        size="xs"
                        showAvatar={true}
                        linkToProfile={true}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <time dateTime={post.createdAt.toISOString()}>
                        {format(post.createdAt, 'MMM d, yyyy')}
                      </time>
                      {post.isVerified && (
                        <span className="inline-flex items-center text-green-600 dark:text-green-400" title="Content verified">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                    </div>

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
            Showing {(currentPage - 1) * POSTS_PER_PAGE + 1}-
            {Math.min(currentPage * POSTS_PER_PAGE, filteredPosts.length)} of {filteredPosts.length}{' '}
            articles
            {hasActiveFilters && ` (filtered from ${posts.length})`}
          </p>
        )}
      </div>
    </>
  );
}

// Wrap in Suspense for useSearchParams
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold mb-8">Latest Articles</h1>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
            <ArticleCardSkeleton />
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
