import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  globalThis.fetch = vi.fn();
  delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
  delete process.env.HUGGINGFACE_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAudioResponse(size = 4096): Response {
  const audioBytes = new Uint8Array(size);
  return new Response(audioBytes.buffer, {
    status: 200,
    headers: { 'Content-Type': 'audio/flac' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/tts', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    const mod = await import('@/app/api/ai/tts/route');
    POST = mod.POST;
  });

  // ===== Validation =====

  it('returns 400 when text is missing', async () => {
    const request = createRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Text is required');
  });

  it('returns 400 when text is empty string', async () => {
    const request = createRequest({ text: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Text is required');
  });

  it('returns 400 when text is only whitespace', async () => {
    const request = createRequest({ text: '   ' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Text is required');
  });

  // ===== API key missing =====

  it('returns 503 when no HuggingFace API key is configured', async () => {
    delete process.env.HUGGINGFACE_API_KEY;
    delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
    vi.resetModules();
    const mod = await import('@/app/api/ai/tts/route');
    POST = mod.POST;

    const request = createRequest({ text: 'Hello' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe('NO_API_KEY');
  });

  // ===== Happy path =====

  it('returns audio data for French text', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse());

    const request = createRequest({ text: 'Bonjour le monde', lang: 'fr' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('audio/flac');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('returns audio data for English text', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse());

    const request = createRequest({ text: 'Hello world', lang: 'en' });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('mms-tts-eng'),
      expect.anything()
    );
  });

  it('uses French model by default when no lang specified', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse());

    const request = createRequest({ text: 'Default language test' });
    await POST(request);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('mms-tts-fra'),
      expect.anything()
    );
  });

  it('uses French model for unknown language codes', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse());

    const request = createRequest({ text: 'Unknown lang', lang: 'zz' });
    await POST(request);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('mms-tts-fra'),
      expect.anything()
    );
  });

  it('sends correct Authorization header', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse());

    const request = createRequest({ text: 'Auth test' });
    await POST(request);

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer hf_test_key',
        }),
      })
    );
  });

  it('truncates text to 500 characters', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse());

    const longText = 'A'.repeat(1000);
    const request = createRequest({ text: longText });
    await POST(request);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.inputs.length).toBe(500);
  });

  it('returns Content-Length header', async () => {
    const audioSize = 2048;
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockAudioResponse(audioSize));

    const request = createRequest({ text: 'Content length test' });
    const response = await POST(request);

    expect(response.headers.get('Content-Length')).toBe(audioSize.toString());
  });

  // ===== Model loading (503) =====

  it('returns 503 with retry info when model is loading', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ estimated_time: 15 }), { status: 503 })
    );

    const request = createRequest({ text: 'Loading test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe('MODEL_LOADING');
    expect(data.retryAfter).toBe(15);
  });

  it('returns 503 with default retry when model loading response is not JSON', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 })
    );

    const request = createRequest({ text: 'Loading test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.code).toBe('MODEL_LOADING');
    expect(data.retryAfter).toBe(20);
  });

  // ===== Rate limiting (429) =====

  it('returns 429 on rate limit', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 })
    );

    const request = createRequest({ text: 'Rate limit test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.code).toBe('RATE_LIMIT');
  });

  // ===== Other API errors =====

  it('returns error status from HuggingFace API', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Bad request', { status: 400 })
    );

    const request = createRequest({ text: 'Error test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe('API_ERROR');
  });

  // ===== Network error =====

  it('returns 500 on network failure', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const request = createRequest({ text: 'Network error test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Connection refused');
  });

  // ===== Invalid JSON body =====

  it('returns 500 when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
