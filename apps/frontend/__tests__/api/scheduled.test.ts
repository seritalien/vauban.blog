import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockReadFile, mockWriteFile, mockMkdir } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockMkdir: vi.fn(),
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
        mkdir: mockMkdir,
      },
    },
    promises: {
      ...actual.promises,
      readFile: mockReadFile,
      writeFile: mockWriteFile,
      mkdir: mockMkdir,
    },
  };
});

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    default: {
      ...actual,
      randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
    },
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
  };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { GET, POST, DELETE } from '@/app/api/scheduled/route';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockReadFile.mockResolvedValue(JSON.stringify([]));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/scheduled');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString(), { method: 'GET' });
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/scheduled', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createDeleteRequest(id?: string): NextRequest {
  const url = new URL('http://localhost:3000/api/scheduled');
  if (id) url.searchParams.set('id', id);
  return new NextRequest(url.toString(), { method: 'DELETE' });
}

function validPostBody(): Record<string, unknown> {
  return {
    scheduledAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour in the future
    authorAddress: '0xauthor123',
    postData: {
      title: 'Test Post',
      slug: 'test-post',
      content: 'Test content for the blog post.',
      excerpt: 'Test excerpt',
      tags: ['test'],
      isPaid: false,
      price: 0,
      isEncrypted: false,
    },
  };
}

function existingPost(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'existing-1',
    scheduledAt: new Date(Date.now() + 3600000).toISOString(),
    createdAt: new Date().toISOString(),
    authorAddress: '0xauthor123',
    postData: {
      title: 'Existing Post',
      slug: 'existing-post',
      content: 'Content',
      excerpt: 'Excerpt',
      tags: ['test'],
      isPaid: false,
      price: 0,
      isEncrypted: false,
    },
    status: 'pending',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe('GET /api/scheduled', () => {
  it('returns empty array when no posts exist', async () => {
    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posts).toEqual([]);
  });

  it('returns all scheduled posts', async () => {
    const posts = [existingPost({ id: 'a' }), existingPost({ id: 'b' })];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.posts).toHaveLength(2);
  });

  it('filters posts by author address', async () => {
    const posts = [
      existingPost({ id: 'a', authorAddress: '0xAuthor1' }),
      existingPost({ id: 'b', authorAddress: '0xAuthor2' }),
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await GET(createGetRequest({ author: '0xauthor1' }));
    const data = await response.json();

    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe('a');
  });

  it('filters posts by status', async () => {
    const posts = [
      existingPost({ id: 'pending-1', status: 'pending' }),
      existingPost({ id: 'published-1', status: 'published' }),
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await GET(createGetRequest({ status: 'pending' }));
    const data = await response.json();

    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe('pending-1');
  });

  it('sorts posts by scheduledAt ascending', async () => {
    const laterDate = new Date(Date.now() + 7200000).toISOString();
    const earlierDate = new Date(Date.now() + 3600000).toISOString();
    const posts = [
      existingPost({ id: 'later', scheduledAt: laterDate }),
      existingPost({ id: 'earlier', scheduledAt: earlierDate }),
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(data.posts[0].id).toBe('earlier');
    expect(data.posts[1].id).toBe('later');
  });

  it('returns empty array when file does not exist', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

    const response = await GET(createGetRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.posts).toEqual([]);
  });

  it('combines author and status filters', async () => {
    const posts = [
      existingPost({ id: 'a', authorAddress: '0xA', status: 'pending' }),
      existingPost({ id: 'b', authorAddress: '0xA', status: 'published' }),
      existingPost({ id: 'c', authorAddress: '0xB', status: 'pending' }),
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await GET(createGetRequest({ author: '0xa', status: 'pending' }));
    const data = await response.json();

    expect(data.posts).toHaveLength(1);
    expect(data.posts[0].id).toBe('a');
  });
});

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe('POST /api/scheduled', () => {
  it('schedules a new post and returns it', async () => {
    const response = await POST(createPostRequest(validPostBody()));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.post).toBeDefined();
    expect(data.post.id).toBe('test-uuid-1234');
    expect(data.post.status).toBe('pending');
  });

  it('returns 400 when scheduledAt is missing', async () => {
    const body = validPostBody();
    delete body.scheduledAt;

    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('returns 400 when authorAddress is missing', async () => {
    const body = validPostBody();
    delete body.authorAddress;

    const response = await POST(createPostRequest(body));

    expect(response.status).toBe(400);
  });

  it('returns 400 when postData is missing', async () => {
    const body = validPostBody();
    delete body.postData;

    const response = await POST(createPostRequest(body));

    expect(response.status).toBe(400);
  });

  it('returns 400 when scheduledAt is in the past', async () => {
    const body = validPostBody();
    body.scheduledAt = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

    const response = await POST(createPostRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('future');
  });

  it('persists the new post to the file', async () => {
    await POST(createPostRequest(validPostBody()));

    expect(mockWriteFile).toHaveBeenCalled();
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written).toHaveLength(1);
    expect(written[0].id).toBe('test-uuid-1234');
  });

  it('appends to existing posts', async () => {
    const existing = [existingPost()];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(existing));

    await POST(createPostRequest(validPostBody()));

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written).toHaveLength(2);
  });

  it('returns 500 when file write fails', async () => {
    mockWriteFile.mockRejectedValueOnce(new Error('Disk full'));

    const response = await POST(createPostRequest(validPostBody()));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to schedule');
  });

  it('includes formatted schedule message', async () => {
    const response = await POST(createPostRequest(validPostBody()));
    const data = await response.json();

    expect(data.message).toContain('Post scheduled for');
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE
// ---------------------------------------------------------------------------

describe('DELETE /api/scheduled', () => {
  it('returns 400 when id is missing', async () => {
    const response = await DELETE(createDeleteRequest());
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing post id');
  });

  it('returns 404 when post is not found', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify([]));

    const response = await DELETE(createDeleteRequest('nonexistent'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('returns 400 when trying to cancel a non-pending post', async () => {
    const posts = [existingPost({ id: 'pub-1', status: 'published' })];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await DELETE(createDeleteRequest('pub-1'));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('pending');
  });

  it('deletes a pending post successfully', async () => {
    const posts = [existingPost({ id: 'del-1', status: 'pending' })];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    const response = await DELETE(createDeleteRequest('del-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('cancelled');
  });

  it('removes the post from the file', async () => {
    const posts = [
      existingPost({ id: 'keep-1' }),
      existingPost({ id: 'del-1' }),
    ];
    mockReadFile.mockResolvedValueOnce(JSON.stringify(posts));

    await DELETE(createDeleteRequest('del-1'));

    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(written).toHaveLength(1);
    expect(written[0].id).toBe('keep-1');
  });

  it('returns 404 when file read fails (no posts loaded)', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('Permission denied'));

    const response = await DELETE(createDeleteRequest('some-id'));
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });
});
