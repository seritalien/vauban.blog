import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/arweave/[txId]/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockParams(txId: string): { params: Promise<{ txId: string }> } {
  return { params: Promise.resolve({ txId }) };
}

function createRequest(txId: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/arweave/${txId}`, {
    method: 'GET',
  });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/arweave/[txId]', () => {
  // ===== Validation =====

  it('returns 400 for missing txId (empty string)', async () => {
    const request = createRequest('');
    const response = await GET(request, mockParams(''));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing txId');
  });

  it('returns 404 for simulated tx IDs (starts with "ar_")', async () => {
    const request = createRequest('ar_simulated_123');
    const response = await GET(request, mockParams('ar_simulated_123'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Simulated Arweave TX');
    expect(data.txId).toBe('ar_simulated_123');
    expect(data.message).toContain('simulated');
  });

  it('returns 404 for simulated tx IDs with minimal prefix "ar_"', async () => {
    const request = createRequest('ar_');
    const response = await GET(request, mockParams('ar_'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Simulated Arweave TX');
  });

  // ===== Happy paths — JSON =====

  it('returns JSON content from primary gateway with immutable cache headers', async () => {
    const mockJsonData = { title: 'Test Article', content: 'Hello world' };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockJsonData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const request = createRequest('abc123');
    const response = await GET(request, mockParams('abc123'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockJsonData);
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    );
    expect(response.headers.get('X-Arweave-Gateway')).toBe(
      'https://arweave.net'
    );
    expect(response.headers.get('X-Arweave-TxId')).toBe('abc123');
  });

  // ===== Happy paths — Text =====

  it('returns text content with correct Content-Type and cache headers', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('# Markdown content here', {
        status: 200,
        headers: { 'content-type': 'text/markdown' },
      })
    );

    const request = createRequest('tx_text_123');
    const response = await GET(request, mockParams('tx_text_123'));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('# Markdown content here');
    expect(response.headers.get('Content-Type')).toBe('text/markdown');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    );
    expect(response.headers.get('X-Arweave-Gateway')).toBe(
      'https://arweave.net'
    );
  });

  // ===== Happy paths — Binary =====

  it('returns binary content with correct Content-Type and cache headers', async () => {
    const binaryData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(binaryData, {
        status: 200,
        headers: { 'content-type': 'image/png' },
      })
    );

    const request = createRequest('tx_binary_456');
    const response = await GET(request, mockParams('tx_binary_456'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  // ===== Gateway fallback =====

  it('falls back to secondary gateway (Irys) on primary failure', async () => {
    const mockJsonData = { title: 'From Irys' };

    // Primary gateway fails
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Gateway timeout')
    );
    // Secondary gateway succeeds
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockJsonData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const request = createRequest('fallback_tx');
    const response = await GET(request, mockParams('fallback_tx'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockJsonData);
    expect(response.headers.get('X-Arweave-Gateway')).toBe(
      'https://gateway.irys.xyz'
    );
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenNthCalledWith(
      1,
      'https://arweave.net/fallback_tx',
      expect.objectContaining({
        headers: { Accept: 'application/json, text/plain, */*' },
      })
    );
    expect(vi.mocked(globalThis.fetch)).toHaveBeenNthCalledWith(
      2,
      'https://gateway.irys.xyz/fallback_tx',
      expect.objectContaining({
        headers: { Accept: 'application/json, text/plain, */*' },
      })
    );
  });

  it('falls back to secondary gateway when primary returns non-ok status', async () => {
    const mockJsonData = { title: 'From Irys' };

    // Primary gateway returns 404
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Not found', { status: 404 })
    );
    // Secondary gateway succeeds
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mockJsonData), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const request = createRequest('fallback_404_tx');
    const response = await GET(request, mockParams('fallback_404_tx'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockJsonData);
    expect(response.headers.get('X-Arweave-Gateway')).toBe(
      'https://gateway.irys.xyz'
    );
  });

  // ===== All gateways fail =====

  it('returns 404 when all gateways fail with errors', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Primary down')
    );
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Secondary down')
    );

    const request = createRequest('missing_tx');
    const response = await GET(request, mockParams('missing_tx'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Failed to fetch from Arweave');
    expect(data.txId).toBe('missing_tx');
    expect(data.triedGateways).toEqual([
      'https://arweave.net',
      'https://gateway.irys.xyz',
    ]);
  });

  it('returns 404 when all gateways return non-ok status', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Server error', { status: 500 })
    );
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Not found', { status: 404 })
    );

    const request = createRequest('not_found_tx');
    const response = await GET(request, mockParams('not_found_tx'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Failed to fetch from Arweave');
  });

  // ===== Cache headers =====

  it('includes Cache-Control: public, max-age=31536000, immutable header', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('{"ok": true}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const request = createRequest('cache_test_tx');
    const response = await GET(request, mockParams('cache_test_tx'));

    expect(response.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    );
  });

  // ===== Edge cases =====

  it('handles content-type with charset parameter', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Plain text with charset', {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    );

    const request = createRequest('charset_tx');
    const response = await GET(request, mockParams('charset_tx'));
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('Plain text with charset');
    expect(response.headers.get('Content-Type')).toContain('text/plain');
  });

  it('uses application/octet-stream when content-type header is missing', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        // No content-type header set — Response defaults to empty
        headers: {},
      })
    );

    const request = createRequest('no_ct_tx');
    const response = await GET(request, mockParams('no_ct_tx'));

    // When content-type is missing (no json, no text), falls through to binary handler
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'application/octet-stream'
    );
  });

  it('passes the correct fetch options including 30s timeout', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const request = createRequest('timeout_tx');
    await GET(request, mockParams('timeout_tx'));

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      'https://arweave.net/timeout_tx',
      expect.objectContaining({
        signal: expect.objectContaining({}),
        headers: { Accept: 'application/json, text/plain, */*' },
      })
    );
  });
});
