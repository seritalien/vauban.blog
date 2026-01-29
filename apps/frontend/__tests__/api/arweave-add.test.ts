import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/arweave/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/arweave/add', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/arweave/add/route');
    POST = mod.POST;
  });

  // ===== Happy path — Irys devnet success =====

  it('uploads JSON data to Irys devnet and returns txId', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'arweave_tx_abc123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const request = createPostRequest({ title: 'Test Article', content: 'Hello' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.txId).toBe('arweave_tx_abc123');
    expect(data.simulated).toBe(false);
    expect(data.message).toContain('Irys devnet');
  });

  it('sends correct headers to Irys devnet', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'tx123' }), { status: 200 })
    );

    await POST(createPostRequest({ data: 'test' }));

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('devnet.irys.xyz/tx'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/octet-stream',
        }),
      })
    );
  });

  it('includes Vauban-Blog app tags in the request', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'tx_tags' }), { status: 200 })
    );

    await POST(createPostRequest({ title: 'Tagged' }));

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const headers = fetchCall[1]?.headers as Record<string, string>;
    const tags = JSON.parse(headers['x-irys-tags']);

    expect(tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Content-Type', value: 'application/json' }),
        expect.objectContaining({ name: 'App-Name', value: 'Vauban-Blog' }),
        expect.objectContaining({ name: 'App-Version', value: '0.1.0' }),
      ])
    );
  });

  it('returns data size in the response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'tx_size' }), { status: 200 })
    );

    const body = { title: 'Size Test' };
    const request = createPostRequest(body);
    const response = await POST(request);
    const data = await response.json();

    const expectedSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    expect(data.size).toBe(expectedSize);
  });

  // ===== Fallback to simulation =====

  it('falls back to simulation when Irys devnet returns non-ok', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    const request = createPostRequest({ title: 'Simulated' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(data.txId).toMatch(/^ar_/);
    expect(data.message).toContain('simulated');
  });

  it('falls back to simulation on network error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Network unreachable')
    );

    const request = createPostRequest({ title: 'Network Error' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(data.txId).toMatch(/^ar_/);
    expect(data.error).toBe('Network unreachable');
  });

  it('simulated txId contains timestamp-like value', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Error', { status: 500 })
    );

    const before = Date.now();
    const request = createPostRequest({ title: 'Timestamp' });
    const response = await POST(request);
    const data = await response.json();
    const after = Date.now();

    // The simulated txId format is ar_{timestamp}_{random}
    const parts = data.txId.split('_');
    expect(parts[0]).toBe('ar');
    const ts = parseInt(parts[1], 10);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  // ===== JSON parse error =====

  it('falls back to simulation when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/arweave/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });

    const response = await POST(request);
    const data = await response.json();

    // The catch block returns simulated result
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
  });
});

describe('GET /api/arweave/add', () => {
  let GET: () => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/arweave/add/route');
    GET = mod.GET;
  });

  // ===== Health check =====

  it('returns connected status when Irys devnet is reachable', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ version: '1.0' }), { status: 200 })
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('connected');
    expect(data.mode).toBe('devnet');
    expect(data.endpoint).toContain('irys.xyz');
  });

  it('returns unavailable status when Irys devnet is unreachable', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Timeout')
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('unavailable');
    expect(data.mode).toBe('devnet');
  });

  it('returns unavailable when health check returns non-ok', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Error', { status: 500 })
    );

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('unavailable');
  });

  it('calls the Irys devnet /info endpoint', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('{}', { status: 200 })
    );

    await GET();

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('devnet.irys.xyz/info'),
      expect.objectContaining({
        signal: expect.anything(),
      })
    );
  });
});
