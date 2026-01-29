import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — hoisted for use inside vi.mock factories
// ---------------------------------------------------------------------------

const { mockReadFile, mockWriteFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...actual.promises,
        readFile: mockReadFile,
        writeFile: mockWriteFile,
      },
    },
    promises: {
      ...actual.promises,
      readFile: mockReadFile,
      writeFile: mockWriteFile,
    },
  };
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = vi.fn();
  mockWriteFile.mockResolvedValue(undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/cron/publish-scheduled', {
    method: 'GET',
    headers,
  });
}

interface PostOverrides {
  id?: string;
  scheduledAt?: string;
  status?: string;
  title?: string;
}

function makeScheduledPost(overrides: PostOverrides = {}): Record<string, unknown> {
  return {
    id: overrides.id ?? 'post-1',
    scheduledAt: overrides.scheduledAt ?? new Date(Date.now() - 60000).toISOString(),
    createdAt: new Date().toISOString(),
    authorAddress: '0xauthor123',
    postData: {
      title: overrides.title ?? 'Test Post',
      slug: 'test-post',
      content: 'This is test content that is long enough for validation.',
      excerpt: 'This is a test excerpt with enough length.',
      tags: ['test'],
      coverImage: '',
      isPaid: false,
      price: 0,
      isEncrypted: false,
    },
    status: overrides.status ?? 'pending',
  };
}

function mockM2MPublishSuccess(): void {
  vi.mocked(globalThis.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ success: true, txHash: '0xtxhash' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

function mockM2MPublishFailure(status = 500, error = 'Publish failed'): void {
  vi.mocked(globalThis.fetch).mockResolvedValueOnce(
    new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

/**
 * Helper to import the route module with specific env vars set.
 * Since CRON_SECRET and M2M_API_KEY are read at module load time,
 * we must set them before importing.
 */
async function importRoute(envOverrides: Record<string, string | undefined> = {}) {
  // Apply env overrides
  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
  // Default: set M2M_API_KEY if not overridden
  if (!('M2M_API_KEY' in envOverrides)) {
    process.env.M2M_API_KEY = 'test_m2m_key';
  }
  if (!('CRON_SECRET' in envOverrides)) {
    delete process.env.CRON_SECRET;
  }
  if (!('NODE_ENV' in envOverrides)) {
    vi.stubEnv('NODE_ENV', 'test');
  }

  vi.resetModules();
  // Re-register fs mock after resetModules
  vi.doMock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
      ...actual,
      default: {
        ...actual,
        promises: {
          ...actual.promises,
          readFile: mockReadFile,
          writeFile: mockWriteFile,
        },
      },
      promises: {
        ...actual.promises,
        readFile: mockReadFile,
        writeFile: mockWriteFile,
      },
    };
  });

  const mod = await import('@/app/api/cron/publish-scheduled/route');
  return mod;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/publish-scheduled', () => {
  // ===== Authentication =====

  it('returns 401 in production without correct cron secret', async () => {
    const { GET } = await importRoute({
      NODE_ENV: 'production',
      CRON_SECRET: 'my-secret',
    });

    const request = createRequest({ authorization: 'Bearer wrong-secret' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('allows access in production with correct cron secret', async () => {
    const { GET } = await importRoute({
      NODE_ENV: 'production',
      CRON_SECRET: 'my-secret',
    });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([]));

    const request = createRequest({ authorization: 'Bearer my-secret' });
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it('skips auth check in development mode', async () => {
    const { GET } = await importRoute({ NODE_ENV: 'test' });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([]));

    const request = createRequest();
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  // ===== M2M_API_KEY not configured =====

  it('returns 500 when M2M_API_KEY is not set', async () => {
    const { GET } = await importRoute({ M2M_API_KEY: undefined });

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('M2M_API_KEY');
  });

  // ===== No scheduled posts =====

  it('returns success with 0 processed when no posts exist', async () => {
    const { GET } = await importRoute();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([]));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.processed).toBe(0);
    expect(data.published).toBe(0);
    expect(data.failed).toBe(0);
  });

  it('returns success when file does not exist', async () => {
    const { GET } = await importRoute();
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.processed).toBe(0);
  });

  // ===== Publishing pending posts =====

  it('publishes a pending post whose scheduled time has passed', async () => {
    const { GET } = await importRoute();
    const post = makeScheduledPost();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post]));
    mockM2MPublishSuccess();

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.published).toBe(1);
    expect(data.results[0].status).toBe('published');
  });

  it('does not publish posts scheduled in the future', async () => {
    const { GET } = await importRoute();
    const futurePost = makeScheduledPost({
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([futurePost]));

    const request = createRequest();
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.processed).toBe(0);
    expect(data.pendingRemaining).toBe(1);
  });

  it('skips already-published posts', async () => {
    const { GET } = await importRoute();
    const publishedPost = makeScheduledPost({ status: 'published' });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([publishedPost]));

    const response = await GET(createRequest());
    const data = await response.json();

    expect(data.processed).toBe(0);
  });

  it('skips already-failed posts', async () => {
    const { GET } = await importRoute();
    const failedPost = makeScheduledPost({ status: 'failed' });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([failedPost]));

    const response = await GET(createRequest());
    const data = await response.json();

    expect(data.processed).toBe(0);
  });

  // ===== Publish failure =====

  it('marks post as failed when M2M API returns error', async () => {
    const { GET } = await importRoute();
    const post = makeScheduledPost();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post]));
    mockM2MPublishFailure(500, 'Internal error');

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.failed).toBe(1);
    expect(data.results[0].status).toBe('failed');
    expect(data.results[0].error).toBeDefined();
  });

  // ===== Multiple posts =====

  it('publishes multiple pending posts in order', async () => {
    const { GET } = await importRoute();
    const post1 = makeScheduledPost({ id: 'post-1', title: 'First' });
    const post2 = makeScheduledPost({ id: 'post-2', title: 'Second' });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post1, post2]));
    mockM2MPublishSuccess();
    mockM2MPublishSuccess();

    const response = await GET(createRequest());
    const data = await response.json();

    expect(data.published).toBe(2);
    expect(data.results).toHaveLength(2);
  });

  it('handles mix of success and failure', async () => {
    const { GET } = await importRoute();
    const post1 = makeScheduledPost({ id: 'success-post' });
    const post2 = makeScheduledPost({ id: 'fail-post' });
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post1, post2]));
    mockM2MPublishSuccess();
    mockM2MPublishFailure();

    const response = await GET(createRequest());
    const data = await response.json();

    expect(data.published).toBe(1);
    expect(data.failed).toBe(1);
    expect(data.processed).toBe(2);
  });

  // ===== File write =====

  it('saves updated posts after publishing', async () => {
    const { GET } = await importRoute();
    const post = makeScheduledPost();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post]));
    mockM2MPublishSuccess();

    await GET(createRequest());

    expect(mockWriteFile).toHaveBeenCalled();
    const writtenData = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(writtenData[0].status).toBe('published');
    expect(writtenData[0].publishedAt).toBeDefined();
  });

  it('does not write file when no posts were processed', async () => {
    const { GET } = await importRoute();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([]));

    await GET(createRequest());

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  // ===== File system errors =====

  it('returns 500 when file write fails', async () => {
    const { GET } = await importRoute();
    const post = makeScheduledPost();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post]));
    mockM2MPublishSuccess();
    mockWriteFile.mockRejectedValueOnce(new Error('Disk full'));

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to process');
  });

  // ===== Calls M2M API with correct params =====

  it('sends publish request to M2M API with correct headers', async () => {
    const { GET } = await importRoute();
    const post = makeScheduledPost();
    mockReadFile.mockResolvedValueOnce(JSON.stringify([post]));
    mockM2MPublishSuccess();

    await GET(createRequest());

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('/api/m2m/publish'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-API-Key': 'test_m2m_key',
        }),
      })
    );
  });
});
