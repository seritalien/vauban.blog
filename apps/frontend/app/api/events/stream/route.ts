import { eventBus, type EventName, type EventPayloads } from '@/lib/event-bus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * GET /api/events/stream
 *
 * Server-Sent Events endpoint.
 * Forwards in-process event-bus events to connected browser tabs so that
 * React Query caches can be invalidated in real time.
 */
export function GET(request: Request): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      /** Send an SSE-formatted message. */
      function send(event: string, data: unknown): void {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream already closed — ignore
        }
      }

      // --- Event listeners ---
      const eventNames: EventName[] = [
        'post:published',
        'post:scheduled',
        'comment:added',
        'post:approved',
        'post:rejected',
        'message:received',
        'user:banned',
        'user:unbanned',
      ];

      const handlers = eventNames.map(<K extends EventName>(name: K) => {
        const handler = (payload: EventPayloads[K]) => send(name, payload);
        eventBus.on(name, handler);
        return { name, handler } as { name: K; handler: typeof handler };
      });

      // --- Heartbeat keep-alive ---
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Stream closed
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);

      // --- Cleanup on client disconnect ---
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        for (const { name, handler } of handlers) {
          eventBus.off(name, handler);
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
