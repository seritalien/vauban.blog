import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  globalThis.fetch = vi.fn();
  // Clear all AI-related env vars
  delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
  delete process.env.HUGGINGFACE_API_KEY;
  delete process.env.PIXAZO_API_KEY;
  delete process.env.DEEPAI_API_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockImageResponse(imageBytes?: ArrayBuffer): Response {
  const bytes = imageBytes ?? new Uint8Array([0x89, 0x50, 0x4E, 0x47]).buffer;
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': 'image/png' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/ai/image', () => {
  let POST: (request: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;
  });

  // ===== Validation =====

  it('returns 400 when prompt is missing', async () => {
    const request = createRequest({});
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Prompt is required');
  });

  it('returns 400 when prompt is empty string', async () => {
    const request = createRequest({ prompt: '' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Prompt is required');
  });

  // ===== HuggingFace provider =====

  it('generates image via HuggingFace when API key is set', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    const request = createRequest({ prompt: 'A beautiful sunset' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^data:image\/png;base64,/);
  });

  it('sends correct headers to HuggingFace API', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    await POST(createRequest({ prompt: 'Test prompt' }));

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('huggingface.co'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer hf_test_key',
        }),
      })
    );
  });

  it('uses default dimensions 1024x768 when not specified', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    await POST(createRequest({ prompt: 'Test' }));

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.parameters.width).toBe(1024);
    expect(body.parameters.height).toBe(768);
  });

  it('uses custom dimensions when specified', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    await POST(createRequest({ prompt: 'Test', width: 512, height: 512 }));

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.parameters.width).toBe(512);
    expect(body.parameters.height).toBe(512);
  });

  // ===== Fallback chain =====

  it('falls through to Pollinations when no API keys are set', async () => {
    // No API keys set, Pollinations should be tried
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    const request = createRequest({ prompt: 'Fallback test' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toMatch(/^data:image\//);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('pollinations.ai'),
      expect.anything()
    );
  });

  it('tries Pollinations after HuggingFace fails', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_test_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    // HuggingFace fails
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 })
    );
    // Pollinations succeeds
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    const request = createRequest({ prompt: 'Fallback chain' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.url).toBeDefined();
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  // ===== All providers fail =====

  it('returns 500 when all providers fail', async () => {
    // No API keys for HF/Pixazo/DeepAI, only Pollinations
    // Pollinations fails
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Service unavailable', { status: 503 })
    );

    const request = createRequest({ prompt: 'All fail' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('All providers failed');
  });

  it('collects errors from all failed providers', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    // HF fails
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('HF error', { status: 500 })
    );
    // Pollinations fails
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Poll error', { status: 500 })
    );

    const request = createRequest({ prompt: 'Both fail' });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('All providers failed');
  });

  // ===== Error handling =====

  it('returns 500 when request body is invalid JSON', async () => {
    const request = new NextRequest('http://localhost:3000/api/ai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  // ===== HuggingFace model loading =====

  it('handles HuggingFace 503 model loading and continues fallback', async () => {
    process.env.HUGGINGFACE_API_KEY = 'hf_key';
    vi.resetModules();
    const mod = await import('@/app/api/ai/image/route');
    POST = mod.POST;

    // HF returns 503 (model loading) which is not .ok
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Model loading', { status: 503 })
    );
    // Pollinations succeeds
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockImageResponse());

    const request = createRequest({ prompt: 'Model loading' });
    const response = await POST(request);
    const data = await response.json();

    // The HF 503 returns a NextResponse.json which has .ok = true (status 503)
    // But the code checks result.ok which is false for 503, so it falls through
    // Actually the generateWithHuggingFace function returns NextResponse.json with status 503
    // which has .ok = false, so fallback chain continues
    expect(response.status).toBe(200);
    expect(data.url).toBeDefined();
  });
});
