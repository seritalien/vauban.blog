import { vi, describe, it, expect, beforeEach } from 'vitest';

// =============================================================================
// FILE 1: IPFS Client Tests
// =============================================================================

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  uploadJSONToIPFSViaAPI,
  uploadFileToIPFSViaAPI,
  uploadTextToIPFSViaAPI,
  fetchJSONFromIPFSViaAPI,
  fetchTextFromIPFSViaAPI,
  checkIPFSAvailable,
  getIPFSGatewayUrl,
} from '../ipfs-client';

beforeEach(() => {
  mockFetch.mockReset();
});

// =============================================================================
// uploadJSONToIPFSViaAPI
// =============================================================================

describe('uploadJSONToIPFSViaAPI', () => {
  it('calls POST /api/ipfs/add with JSON body and returns CID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cid: 'QmTestCid123' }),
    });

    const result = await uploadJSONToIPFSViaAPI({ title: 'Hello', tags: ['test'] });

    expect(result).toBe('QmTestCid123');
    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hello', tags: ['test'] }),
    });
  });

  it('throws on HTTP error with error message from response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'IPFS daemon unreachable' }),
    });

    await expect(uploadJSONToIPFSViaAPI({ data: 'test' })).rejects.toThrow(
      'IPFS upload failed: IPFS daemon unreachable'
    );
  });

  it('throws when no CID in response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ size: 100 }), // no cid field
    });

    await expect(uploadJSONToIPFSViaAPI({ data: 'test' })).rejects.toThrow(
      'IPFS upload failed: No CID returned'
    );
  });

  it('falls back to statusText when response.json() fails on error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new Error('parse error')),
    });

    await expect(uploadJSONToIPFSViaAPI({ data: 'test' })).rejects.toThrow(
      'IPFS upload failed: Unknown error'
    );
  });
});

// =============================================================================
// uploadFileToIPFSViaAPI
// =============================================================================

describe('uploadFileToIPFSViaAPI', () => {
  it('calls POST with FormData and returns CID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cid: 'QmFileCid456' }),
    });

    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const result = await uploadFileToIPFSViaAPI(file);

    expect(result).toBe('QmFileCid456');
    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/add', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Payload Too Large',
      json: () => Promise.resolve({ error: 'File too large' }),
    });

    const file = new File(['x'.repeat(10000)], 'big.txt');
    await expect(uploadFileToIPFSViaAPI(file)).rejects.toThrow(
      'IPFS file upload failed: File too large'
    );
  });
});

// =============================================================================
// uploadTextToIPFSViaAPI
// =============================================================================

describe('uploadTextToIPFSViaAPI', () => {
  it('calls POST with text/plain content type and returns CID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cid: 'QmTextCid789' }),
    });

    const result = await uploadTextToIPFSViaAPI('Hello, IPFS!');

    expect(result).toBe('QmTextCid789');
    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'Hello, IPFS!',
    });
  });
});

// =============================================================================
// fetchJSONFromIPFSViaAPI
// =============================================================================

describe('fetchJSONFromIPFSViaAPI', () => {
  it('calls GET /api/ipfs/{cid} and returns parsed JSON', async () => {
    const data = { title: 'Test', content: 'Hello' };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await fetchJSONFromIPFSViaAPI<{ title: string; content: string }>('QmTest123');

    expect(result).toEqual(data);
    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/QmTest123', {
      headers: { Accept: 'application/json' },
    });
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(fetchJSONFromIPFSViaAPI('QmBadCid')).rejects.toThrow(
      'IPFS fetch failed: Not Found'
    );
  });
});

// =============================================================================
// fetchTextFromIPFSViaAPI
// =============================================================================

describe('fetchTextFromIPFSViaAPI', () => {
  it('calls GET and returns text content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('# Hello World\n\nSome markdown content'),
    });

    const result = await fetchTextFromIPFSViaAPI('QmTextContent');

    expect(result).toBe('# Hello World\n\nSome markdown content');
    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/QmTextContent');
  });
});

// =============================================================================
// checkIPFSAvailable
// =============================================================================

describe('checkIPFSAvailable', () => {
  it('returns true when IPFS API is reachable', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const result = await checkIPFSAvailable();

    expect(result).toBe(true);
  });

  it('returns false when IPFS API is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await checkIPFSAvailable();

    expect(result).toBe(false);
  });
});

// =============================================================================
// getIPFSGatewayUrl
// =============================================================================

describe('getIPFSGatewayUrl', () => {
  it('returns /api/ipfs/{cid}', () => {
    expect(getIPFSGatewayUrl('QmTestCid')).toBe('/api/ipfs/QmTestCid');
    expect(getIPFSGatewayUrl('bafyExample')).toBe('/api/ipfs/bafyExample');
  });
});
