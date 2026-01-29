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

function createJsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/ipfs/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createTextRequest(text: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/ipfs/add', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: text,
  });
}

function mockIpfsSuccess(hash = 'QmTestHash123', size = '42', name = 'file'): void {
  vi.mocked(globalThis.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ Hash: hash, Size: size, Name: name }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function mockIpfsError(status = 500, text = 'IPFS daemon error'): void {
  vi.mocked(globalThis.fetch).mockResolvedValueOnce(
    new Response(text, { status })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ipfs/add', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/ipfs/add/route');
    POST = mod.POST;
  });

  // ===== Happy paths =====

  it('uploads JSON content and returns normalized response', async () => {
    mockIpfsSuccess('QmJsonHash', '256', 'data.json');

    const request = createJsonRequest({ title: 'Test', content: 'Hello' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      cid: 'QmJsonHash',
      size: '256',
      name: 'data.json',
    });
  });

  it('uploads raw text content and returns CID', async () => {
    mockIpfsSuccess('QmTextHash', '100', 'text.txt');

    const request = createTextRequest('Hello, world!');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cid).toBe('QmTextHash');
  });

  it('returns 400 when multipart form data file value is not a Blob', async () => {
    // When the FormData "file" entry is not recognized as a Blob,
    // the route returns a 400 error with "No file provided".
    const formData = new FormData();
    formData.append('file', 'string-value-not-blob');
    const request = new NextRequest('http://localhost:3000/api/ipfs/add', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No file provided');
  });

  it('sends POST to IPFS API with pin=true', async () => {
    mockIpfsSuccess();

    const request = createJsonRequest({ test: true });
    await POST(request);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/v0/add?pin=true'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uses default IPFS API URL when env not set', async () => {
    mockIpfsSuccess();

    const request = createJsonRequest({ key: 'value' });
    await POST(request);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('localhost:5001'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  // ===== Multipart form data edge cases =====

  it('returns 400 when multipart form data has no file', async () => {
    const formData = new FormData();
    // Do not append a file
    const request = new NextRequest('http://localhost:3000/api/ipfs/add', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No file provided');
  });

  // ===== IPFS API error handling =====

  it('returns 500 when IPFS API returns non-ok status', async () => {
    mockIpfsError(503, 'IPFS node unavailable');

    const request = createJsonRequest({ data: 'test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('IPFS upload failed');
    expect(data.details).toBe('IPFS node unavailable');
  });

  it('returns 500 when IPFS API returns 400', async () => {
    mockIpfsError(400, 'Bad request to IPFS');

    const request = createJsonRequest({ data: 'test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('IPFS upload failed');
  });

  // ===== Network failures =====

  it('returns 500 when fetch throws network error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const request = createJsonRequest({ data: 'test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('IPFS request failed');
    expect(data.message).toBe('Connection refused');
  });

  it('returns 500 with "Unknown error" for non-Error exceptions', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce('string error');

    const request = createJsonRequest({ data: 'test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe('Unknown error');
  });

  // ===== Content type handling =====

  it('handles content type without charset specification', async () => {
    mockIpfsSuccess('QmPlain', '10', 'plain');

    const request = new NextRequest('http://localhost:3000/api/ipfs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'raw bytes',
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cid).toBe('QmPlain');
  });

  it('sends FormData body to IPFS API endpoint', async () => {
    mockIpfsSuccess();

    const request = createJsonRequest({ hello: 'world' });
    await POST(request);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(fetchCall).toBeDefined();
    expect(fetchCall[1]?.body).toBeInstanceOf(FormData);
  });
});
