'use client';

import { useEventStream } from '@/hooks/use-event-stream';

/**
 * Invisible component that opens an SSE connection to receive
 * real-time events from the server and invalidate React Query caches.
 *
 * Must be rendered inside `<QueryProvider>`.
 */
export function EventStreamListener(): null {
  useEventStream();
  return null;
}
