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

function mockParams(cid: string): { params: Promise<{ cid: string }> } {
  return { params: Promise.resolve({ cid }) };
}

function createRequest(cid: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/ipfs/${cid}`, {
    method: 'GET',
  });
}

// PNG magic bytes
function pngBytes(): ArrayBuffer {
  return new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).buffer;
}

// JPEG magic bytes
function jpegBytes(): ArrayBuffer {
  return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]).buffer;
}

// GIF magic bytes
function gifBytes(): ArrayBuffer {
  return new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer;
}

// JSON content
function jsonBytes(): ArrayBuffer {
  return new TextEncoder().encode('{"title":"Hello"}').buffer;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/ipfs/[cid]', () => {
  let GET: (request: NextRequest, ctx: { params: Promise<{ cid: string }> }) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/ipfs/[cid]/route');
    GET = mod.GET;
  });

  // ===== Happy path — IPFS API direct =====

  it('returns content from IPFS API directly', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jsonBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmTest123'), mockParams('QmTest123'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('detects PNG content type from magic bytes', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(pngBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmPng'), mockParams('QmPng'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
  });

  it('detects JPEG content type from magic bytes', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jpegBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmJpeg'), mockParams('QmJpeg'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
  });

  it('detects GIF content type from magic bytes', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(gifBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmGif'), mockParams('QmGif'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/gif');
  });

  it('detects JSON content type from text content', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jsonBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmJson'), mockParams('QmJson'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('returns application/octet-stream for unknown binary data', async () => {
    const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(unknownBytes, { status: 200 })
    );

    const response = await GET(createRequest('QmUnknown'), mockParams('QmUnknown'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/octet-stream');
  });

  it('sets immutable cache headers on success', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jsonBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmCache'), mockParams('QmCache'));

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('calls IPFS API with POST method and cat endpoint', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jsonBytes(), { status: 200 })
    );

    await GET(createRequest('QmApiCall'), mockParams('QmApiCall'));

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/v0/cat?arg=QmApiCall'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ===== Gateway fallback =====

  it('falls back to gateway when IPFS API fails', async () => {
    // IPFS API fails
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Not found', { status: 404 })
    );
    // Gateway succeeds (no redirect)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jsonBytes(), { status: 200 })
    );

    await GET(createRequest('QmFallback'), mockParams('QmFallback'));

    // Gateway call should be made
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/ipfs/QmFallback'),
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('handles gateway 301 redirect with subdomain CID extraction', async () => {
    // IPFS API fails
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Not found', { status: 500 })
    );
    // Gateway returns 301 redirect
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 301,
        headers: { location: 'http://bafybeiabc123.ipfs.localhost:8005/' },
      })
    );
    // API cat with extracted CID succeeds
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(jsonBytes(), { status: 200 })
    );

    const response = await GET(createRequest('QmRedirect'), mockParams('QmRedirect'));

    expect(response.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(3);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/api/v0/cat?arg=bafybeiabc123'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('returns error status when API and gateway both fail (non-redirect)', async () => {
    // IPFS API returns 500
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('API error', { status: 500 })
    );
    // Gateway also returns 500 (no redirect)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Gateway error', { status: 500 })
    );

    const response = await GET(createRequest('QmBothFail'), mockParams('QmBothFail'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('IPFS fetch failed');
  });

  // ===== Network error handling =====

  it('returns 500 on network error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const response = await GET(createRequest('QmNetFail'), mockParams('QmNetFail'));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('IPFS gateway request failed');
  });

  // ===== SVG detection =====

  it('detects SVG content type from XML-like content', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const svgBuffer = new TextEncoder().encode(svgContent).buffer;

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(svgBuffer, { status: 200 })
    );

    const response = await GET(createRequest('QmSvg'), mockParams('QmSvg'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
  });
});
