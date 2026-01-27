/**
 * Mock IPFS Client
 *
 * Provides vi.fn() mocks for all IPFS client functions.
 */
import { vi } from 'vitest';

let cidCounter = 0;

function nextCid(): string {
  return `QmMockCid${++cidCounter}`;
}

export function resetCidCounter(): void {
  cidCounter = 0;
}

export function mockIPFSClient() {
  return {
    uploadJSONToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(nextCid())),
    uploadFileToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(nextCid())),
    uploadTextToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(nextCid())),
    fetchJSONFromIPFSViaAPI: vi.fn().mockResolvedValue({ content: 'test content' }),
    fetchTextFromIPFSViaAPI: vi.fn().mockResolvedValue('test content'),
    getIPFSGatewayUrl: vi.fn((cid: string) => `/api/ipfs/${cid}`),
    checkIPFSAvailable: vi.fn().mockResolvedValue(true),
  };
}

/**
 * In-memory IPFS content store for integration tests
 */
export function createMockIPFSStore() {
  const store = new Map<string, unknown>();

  return {
    store,
    upload(data: unknown): string {
      const cid = nextCid();
      store.set(cid, data);
      return cid;
    },
    fetch<T>(cid: string): T | undefined {
      return store.get(cid) as T | undefined;
    },
    has(cid: string): boolean {
      return store.has(cid);
    },
    clear() {
      store.clear();
    },
  };
}
