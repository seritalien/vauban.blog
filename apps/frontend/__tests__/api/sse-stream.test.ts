import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eventBus } from '@/lib/event-bus';

// The route handler is a plain function — import it directly.
// We use dynamic import so mocks are set up first.
let GET: typeof import('@/app/api/events/stream/route').GET;

beforeEach(async () => {
  eventBus.destroy();
  const mod = await import('@/app/api/events/stream/route');
  GET = mod.GET;
});

afterEach(() => {
  eventBus.destroy();
});

/** Helper: read chunks from a ReadableStream until `n` chunks or timeout. */
async function readChunks(
  stream: ReadableStream<Uint8Array>,
  n: number,
  timeoutMs = 2000,
): Promise<string[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('readChunks timeout')), timeoutMs),
  );

  try {
    for (let i = 0; i < n; i++) {
      const { value, done } = (await Promise.race([reader.read(), timeout])) as ReadableStreamReadResult<Uint8Array>;
      if (done) break;
      if (value) chunks.push(decoder.decode(value));
    }
  } finally {
    reader.releaseLock();
  }

  return chunks;
}

describe('GET /api/events/stream', () => {
  it('returns SSE headers', () => {
    const controller = new AbortController();
    const request = new Request('http://localhost:3005/api/events/stream', {
      signal: controller.signal,
    });

    const response = GET(request);

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    // Cleanup
    controller.abort();
  });

  it('streams post:published events as SSE', async () => {
    const controller = new AbortController();
    const request = new Request('http://localhost:3005/api/events/stream', {
      signal: controller.signal,
    });

    const response = GET(request);
    const body = response.body;
    expect(body).not.toBeNull();

    // Emit an event after a small delay so the stream has time to set up
    const payload = { postId: '42', slug: 'test', title: 'Test', txHash: '0x1' };
    setTimeout(() => eventBus.emit('post:published', payload), 50);

    const chunks = await readChunks(body!, 1);
    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const text = chunks.join('');
    expect(text).toContain('event: post:published');
    expect(text).toContain('"postId":"42"');

    controller.abort();
  });

  it('streams comment:added events as SSE', async () => {
    const controller = new AbortController();
    const request = new Request('http://localhost:3005/api/events/stream', {
      signal: controller.signal,
    });

    const response = GET(request);
    const body = response.body;
    expect(body).not.toBeNull();

    const payload = { postId: '10', commentId: 'c1', author: '0x999' };
    setTimeout(() => eventBus.emit('comment:added', payload), 50);

    const chunks = await readChunks(body!, 1);
    const text = chunks.join('');
    expect(text).toContain('event: comment:added');
    expect(text).toContain('"postId":"10"');

    controller.abort();
  });

  it('cleans up listeners on abort', async () => {
    const controller = new AbortController();
    const request = new Request('http://localhost:3005/api/events/stream', {
      signal: controller.signal,
    });

    GET(request);

    // Abort — listeners should be removed
    controller.abort();

    // Allow microtask queue to process
    await new Promise(r => setTimeout(r, 50));

    // After abort, emitting should not throw (no dangling listeners)
    expect(() => {
      eventBus.emit('post:published', { postId: '1' });
    }).not.toThrow();
  });

  it('streams multiple event types to the same connection', async () => {
    const controller = new AbortController();
    const request = new Request('http://localhost:3005/api/events/stream', {
      signal: controller.signal,
    });

    const response = GET(request);
    const body = response.body;
    expect(body).not.toBeNull();

    setTimeout(() => {
      eventBus.emit('post:published', { postId: '1' });
      eventBus.emit('comment:added', { postId: '2' });
    }, 50);

    const chunks = await readChunks(body!, 2);
    const text = chunks.join('');
    expect(text).toContain('event: post:published');
    expect(text).toContain('event: comment:added');

    controller.abort();
  });
});
