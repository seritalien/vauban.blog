'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

/**
 * Connect to the SSE endpoint and invalidate React Query caches
 * whenever the server emits real-time events (new post published,
 * comment added, etc.).
 *
 * Uses the native `EventSource` API which auto-reconnects on disconnect.
 */
export function useEventStream(): void {
  const queryClient = useQueryClient();
  // Keep a stable ref so the effect cleanup can always close the latest source
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/events/stream');
    esRef.current = es;

    es.addEventListener('post:published', () => {
      // Bust the RPC proxy cache, then invalidate React Query
      fetch('/api/rpc', { method: 'DELETE' }).catch(() => {
        // RPC cache clear is best-effort
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    });

    es.addEventListener('post:scheduled', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    });

    es.addEventListener('comment:added', (event: MessageEvent) => {
      try {
        const data: { postId?: string } = JSON.parse(event.data as string);
        if (data.postId) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.comments.forPost(data.postId),
          });
        }
      } catch {
        // Malformed payload — invalidate all comments as fallback
        queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
      }
    });

    es.addEventListener('post:approved', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pendingReview });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
    });

    es.addEventListener('post:rejected', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.pendingReview });
    });

    es.addEventListener('message:received', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.conversations });
      queryClient.invalidateQueries({ queryKey: queryKeys.messaging.unread });
    });

    es.addEventListener('user:banned', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.bannedUsers });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.moderationReports });
    });

    es.addEventListener('user:unbanned', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.bannedUsers });
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [queryClient]);
}
