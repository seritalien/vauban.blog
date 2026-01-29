'use client';

import { useMemo } from 'react';
import { usePosts } from './use-posts';

/**
 * Represents a tag with its usage count across posts
 */
export interface TagWithCount {
  name: string;
  count: number;
}

/**
 * Result type for the useAvailableTags hook
 */
interface UseAvailableTagsResult {
  /** List of all unique tags with their usage counts, sorted by count (descending) */
  tags: TagWithCount[];
  /** Whether tags are currently being loaded */
  isLoading: boolean;
  /** Error message if tag fetching failed */
  error: string | null;
  /** Get suggestions for a query (case-insensitive prefix match) */
  getSuggestions: (query: string) => TagWithCount[];
}

/**
 * Hook to fetch all unique tags from existing posts with their usage counts.
 * Derives tags purely from the posts data cached by React Query (5min staleTime),
 * so no manual cache is needed.
 *
 * @returns Object containing tags with counts, loading state, error state, and suggestion helper
 *
 * @example
 * ```tsx
 * const { tags, isLoading, getSuggestions } = useAvailableTags();
 *
 * // Get suggestions for user input
 * const suggestions = getSuggestions('web'); // Returns tags starting with "web" (case-insensitive)
 * ```
 */
export function useAvailableTags(): UseAvailableTagsResult {
  const { posts, isLoading, error } = usePosts(100, 0);

  const tags = useMemo(() => {
    if (!posts || posts.length === 0) return [];

    // Extract and count tags from all posts
    const tagCounts = new Map<string, number>();

    for (const post of posts) {
      if (post.tags && Array.isArray(post.tags)) {
        for (const tag of post.tags) {
          const normalizedTag = tag.trim();
          if (normalizedTag) {
            tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) ?? 0) + 1);
          }
        }
      }
    }

    // Convert to array and sort by count (descending), then alphabetically for ties
    return Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      });
  }, [posts]);

  /**
   * Get tag suggestions based on a query string.
   * Performs case-insensitive matching, prioritizing:
   * 1. Tags that start with the query
   * 2. Tags that contain the query elsewhere
   *
   * @param query - The search query
   * @returns Matching tags sorted by relevance and usage count
   */
  const getSuggestions = useMemo(() => {
    return (query: string): TagWithCount[] => {
      if (!query.trim()) {
        return tags;
      }

      const normalizedQuery = query.toLowerCase().trim();

      // Separate into "starts with" and "contains" matches
      const startsWithMatches: TagWithCount[] = [];
      const containsMatches: TagWithCount[] = [];

      for (const tag of tags) {
        const normalizedName = tag.name.toLowerCase();
        if (normalizedName.startsWith(normalizedQuery)) {
          startsWithMatches.push(tag);
        } else if (normalizedName.includes(normalizedQuery)) {
          containsMatches.push(tag);
        }
      }

      // Return starts-with matches first, then contains matches
      return [...startsWithMatches, ...containsMatches];
    };
  }, [tags]);

  return {
    tags,
    isLoading,
    error,
    getSuggestions,
  };
}
