'use client';

import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { getPosts, getPost } from '@vauban/web3-utils';

const ARTICLES_PER_PAGE = 12;

/**
 * Fetch articles with pagination.
 */
export function useArticles(limit = ARTICLES_PER_PAGE) {
  return useInfiniteQuery({
    queryKey: ['articles', limit],
    queryFn: async ({ pageParam = 0 }) => {
      const posts = await getPosts(limit, pageParam);
      return {
        articles: posts,
        nextPage: posts.length === limit ? pageParam + limit : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single article by ID.
 */
export function useArticle(id: string | number) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: async () => {
      const post = await getPost(String(id));
      return post;
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Prefetch articles for better UX.
 */
export function usePrefetchArticles() {
  const queryClient = useQueryClient();

  return async (limit = ARTICLES_PER_PAGE) => {
    await queryClient.prefetchQuery({
      queryKey: ['articles', limit],
      queryFn: async () => {
        const posts = await getPosts(limit, 0);
        return {
          articles: posts,
          nextPage: posts.length === limit ? limit : undefined,
        };
      },
    });
  };
}

/**
 * Invalidate articles cache (after publishing, updating, etc.).
 */
export function useInvalidateArticles() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  };
}

/**
 * Get all articles from cache (flattened from infinite query pages).
 */
export function useAllArticles() {
  const { data, ...rest } = useArticles();

  const allArticles = data?.pages.flatMap((page) => page.articles) ?? [];

  return {
    articles: allArticles,
    ...rest,
  };
}
