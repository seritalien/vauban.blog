'use client';

import { useState, useEffect, useMemo } from 'react';
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

// Simple in-memory cache for tags
let cachedTags: TagWithCount[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Hook to fetch all unique tags from existing posts with their usage counts.
 * Results are cached for 5 minutes to avoid redundant API calls.
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
  const [tags, setTags] = useState<TagWithCount[]>(cachedTags ?? []);
  const [isLoading, setIsLoading] = useState(!cachedTags);
  const [error, setError] = useState<string | null>(null);

  // Fetch a larger number of posts to get comprehensive tag data
  const { posts, isLoading: postsLoading, error: postsError } = usePosts(100, 0);

  useEffect(() => {
    // Check if cache is still valid
    const now = Date.now();
    if (cachedTags !== null && now - cacheTimestamp < CACHE_DURATION_MS) {
      setTags(cachedTags);
      setIsLoading(false);
      return;
    }

    if (postsLoading) {
      setIsLoading(true);
      return;
    }

    if (postsError) {
      setError(postsError);
      setIsLoading(false);
      return;
    }

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
    const sortedTags: TagWithCount[] = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      });

    // Update cache
    cachedTags = sortedTags;
    cacheTimestamp = now;

    setTags(sortedTags);
    setIsLoading(false);
    setError(null);
  }, [posts, postsLoading, postsError]);

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

/**
 * Clear the tags cache, forcing a refresh on next hook usage
 */
export function clearTagsCache(): void {
  cachedTags = null;
  cacheTimestamp = 0;
}
