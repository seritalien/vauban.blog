import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockValidateApiKey = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockGetRateLimitRemaining = vi.fn();
const mockGetRateLimitReset = vi.fn();

vi.mock('@/lib/api-keys', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getRateLimitRemaining: (...args: unknown[]) => mockGetRateLimitRemaining(...args),
  getRateLimitReset: (...args: unknown[]) => mockGetRateLimitReset(...args),
}));

const mockRelayPublishPost = vi.fn();
const mockIsRelayerConfigured = vi.fn();

vi.mock('@/lib/relayer', () => ({
  relayPublishPost: (...args: unknown[]) => mockRelayPublishPost(...args),
  isRelayerConfigured: () => mockIsRelayerConfigured(),
}));

const mockCalculateContentHash = vi.fn();

vi.mock('@vauban/web3-utils', () => ({
  calculateContentHash: (...args: unknown[]) => mockCalculateContentHash(...args),
  initStarknetProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  publishPost: vi.fn(),
  getPostLikes: vi.fn(),
  getCommentCountForPost: vi.fn(),
  getPosts: vi.fn(),
  getPost: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { POST, GET } from '@/app/api/m2m/publish/route';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();

  mockIsRelayerConfigured.mockReturnValue(true);
  mockValidateApiKey.mockReturnValue(true);
  mockCheckRateLimit.mockReturnValue(true);
  mockGetRateLimitRemaining.mockReturnValue(9);
  mockGetRateLimitReset.mockReturnValue(Date.now() + 60000);
  mockCalculateContentHash.mockResolvedValue('0x' + 'ab'.repeat(32));
  mockRelayPublishPost.mockResolvedValue({ txHash: '0xtxhash123' });

  // Mock IPFS upload
  vi.mocked(globalThis.fetch).mockImplementation(async (url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    if (urlStr.includes('/api/ipfs/add')) {
      return new Response(JSON.stringify({ cid: 'QmTestCid' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (urlStr.includes('/api/arweave/add')) {
      return new Response(JSON.stringify({ txId: 'ar_test_tx' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not found', { status: 404 });
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>, apiKey = 'vb_testkey'): NextRequest {
  return new NextRequest('http://localhost:3000/api/m2m/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'host': 'localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

function createGetRequest(apiKey = 'vb_testkey'): NextRequest {
  return new NextRequest('http://localhost:3000/api/m2m/publish', {
    method: 'GET',
    headers: {
      'X-API-Key': apiKey,
    },
  });
}

function validBody(): Record<string, unknown> {
  return {
    title: 'Test Article Title',
    slug: 'test-article-title',
    content: 'A'.repeat(100), // min 100 characters
    excerpt: 'This is a test excerpt with enough length.',
    tags: ['technology', 'web3'],
    isPaid: false,
    price: 0,
    isEncrypted: false,
  };
}

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe('POST /api/m2m/publish', () => {
  // ===== Relayer not configured =====

  it('returns 503 when relayer is not configured', async () => {
    mockIsRelayerConfigured.mockReturnValue(false);

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain('not configured');
  });

  // ===== Authentication =====

  it('returns 401 when API key is missing', async () => {
    mockValidateApiKey.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/m2m/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when API key is invalid', async () => {
    mockValidateApiKey.mockReturnValue(false);

    const response = await POST(createRequest(validBody(), 'invalid_key'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  // ===== Rate limiting =====

  it('returns 429 when rate limit is exceeded', async () => {
    mockCheckRateLimit.mockReturnValue(false);
    mockGetRateLimitReset.mockReturnValue(Date.now() + 30000);

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Rate limit');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  // ===== Validation =====

  it('returns 400 when title is too short', async () => {
    const body = validBody();
    body.title = 'ab';

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('returns 400 when slug is invalid format', async () => {
    const body = validBody();
    body.slug = 'INVALID SLUG!';

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('returns 400 when content is too short', async () => {
    const body = validBody();
    body.content = 'Too short';

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('returns 400 when excerpt is too short', async () => {
    const body = validBody();
    body.excerpt = 'short';

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('returns 400 when tags array is empty', async () => {
    const body = validBody();
    body.tags = [];

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation error');
  });

  it('returns 400 with validation details', async () => {
    const body = validBody();
    body.title = '';
    body.tags = [];

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.details).toBeDefined();
    expect(Array.isArray(data.details)).toBe(true);
  });

  // ===== Happy path =====

  it('publishes article and returns 201 with data', async () => {
    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.txHash).toBe('0xtxhash123');
    expect(data.data.ipfsCid).toBe('QmTestCid');
    expect(data.data.arweaveTxId).toBe('ar_test_tx');
    expect(data.data.contentHash).toBe('0x' + 'ab'.repeat(32));
    expect(data.data.title).toBe('Test Article Title');
    expect(data.data.slug).toBe('test-article-title');
  });

  it('includes rate limit headers in success response', async () => {
    const response = await POST(createRequest(validBody()));

    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });

  // ===== IPFS upload failure =====

  it('returns 500 when IPFS upload fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/api/ipfs/add')) {
        return new Response('IPFS error', { status: 500 });
      }
      return new Response('{}', { status: 200 });
    });

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Storage error');
    expect(data.message).toContain('IPFS');
  });

  // ===== Arweave failure (graceful) =====

  it('uses simulated Arweave TX ID when upload fails', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/api/ipfs/add')) {
        return new Response(JSON.stringify({ cid: 'QmTestCid' }), { status: 200 });
      }
      if (urlStr.includes('/api/arweave/add')) {
        return new Response('Arweave error', { status: 500 });
      }
      return new Response('Not found', { status: 404 });
    });

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.arweaveTxId).toMatch(/^ar_/);
  });

  // ===== Relayer failure =====

  it('returns 500 when relayer publish fails', async () => {
    mockRelayPublishPost.mockRejectedValueOnce(new Error('Transaction failed'));

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });

  // ===== Optional fields =====

  it('accepts optional coverImage URL', async () => {
    const body = validBody();
    body.coverImage = 'https://example.com/image.png';

    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });

  it('defaults isPaid to false', async () => {
    const body = validBody();
    delete body.isPaid;

    const response = await POST(createRequest(body));

    expect(response.status).toBe(201);
  });

  // ===== Price conversion =====

  it('passes correct price in wei for paid articles', async () => {
    const body = validBody();
    body.isPaid = true;
    body.price = 10;

    await POST(createRequest(body));

    expect(mockRelayPublishPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      (BigInt(10) * BigInt(10 ** 18)).toString(),
      false
    );
  });

  it('passes "0" price for free articles', async () => {
    const body = validBody();
    body.isPaid = false;
    body.price = 0;

    await POST(createRequest(body));

    expect(mockRelayPublishPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      '0',
      false
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe('GET /api/m2m/publish', () => {
  it('returns 401 without valid API key', async () => {
    mockValidateApiKey.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/m2m/publish', {
      method: 'GET',
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns API info with valid API key', async () => {
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.configured).toBe(true);
    expect(data.rateLimit).toBeDefined();
    expect(data.endpoints).toBeDefined();
  });

  it('returns remaining rate limit info', async () => {
    mockGetRateLimitRemaining.mockReturnValue(7);

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.rateLimit.remaining).toBe(7);
  });
});
