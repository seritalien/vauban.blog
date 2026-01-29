import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies using vi.hoisted for shared mock state
const mockUploadJSON = vi.hoisted(() => vi.fn());
const mockFetchJSON = vi.hoisted(() => vi.fn());

const mockGetProfile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/crypto', () => ({
  // Just re-export the type - no actual implementation needed
}));

vi.mock('@/lib/ipfs-client', () => ({
  uploadJSONToIPFSViaAPI: mockUploadJSON,
  fetchJSONFromIPFSViaAPI: mockFetchJSON,
}));

vi.mock('@/lib/profiles', () => ({
  getProfile: mockGetProfile,
}));

import {
  publishPublicKey,
  fetchPublicKey,
  hasCachedPublicKey,
  getCachedKeyCid,
  clearPublicKeyCache,
  getOwnKeyCid,
  lookupPublicKeyByAddress,
} from '../public-key-registry';

import type { ExportedPublicKey } from '@/lib/crypto';

describe('public-key-registry.ts', () => {
  const testAddress = '0x1234567890abcdef';
  const testPublicKey: ExportedPublicKey = {
    x: 'test-x-coordinate-base64',
    y: 'test-y-coordinate-base64',
  };
  const testCid = 'QmTestCid12345';

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOwnKeyCid', () => {
    it('returns null when no key CID is stored', () => {
      expect(getOwnKeyCid(testAddress)).toBeNull();
    });

    it('returns the stored CID for the address', () => {
      localStorage.setItem(`vauban-pubkey-cid-${testAddress.toLowerCase()}`, testCid);
      expect(getOwnKeyCid(testAddress)).toBe(testCid);
    });

    it('normalizes address to lowercase', () => {
      localStorage.setItem('vauban-pubkey-cid-0xabcdef', testCid);
      expect(getOwnKeyCid('0xABCDEF')).toBe(testCid);
    });
  });

  describe('publishPublicKey', () => {
    it('uploads key to IPFS and returns CID', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);

      const cid = await publishPublicKey(testAddress, testPublicKey);

      expect(cid).toBe(testCid);
      expect(mockUploadJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          address: testAddress.toLowerCase(),
          publicKey: testPublicKey,
          version: 1,
        })
      );
    });

    it('returns existing CID if already published', async () => {
      localStorage.setItem(`vauban-pubkey-cid-${testAddress.toLowerCase()}`, testCid);

      const cid = await publishPublicKey(testAddress, testPublicKey);

      expect(cid).toBe(testCid);
      expect(mockUploadJSON).not.toHaveBeenCalled();
    });

    it('caches the key locally after publishing', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);

      await publishPublicKey(testAddress, testPublicKey);

      expect(getOwnKeyCid(testAddress)).toBe(testCid);
      expect(hasCachedPublicKey(testAddress)).toBe(true);
    });

    it('propagates errors from IPFS upload', async () => {
      mockUploadJSON.mockRejectedValueOnce(new Error('IPFS upload failed'));

      await expect(publishPublicKey(testAddress, testPublicKey)).rejects.toThrow('IPFS upload failed');
    });
  });

  describe('fetchPublicKey', () => {
    it('returns cached key if available', async () => {
      // First publish to populate cache
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey(testAddress, testPublicKey);

      mockFetchJSON.mockClear();

      const key = await fetchPublicKey(testAddress, testCid);

      expect(key).toEqual(testPublicKey);
      expect(mockFetchJSON).not.toHaveBeenCalled();
    });

    it('fetches from IPFS when not cached', async () => {
      mockFetchJSON.mockResolvedValueOnce({
        address: testAddress.toLowerCase(),
        publicKey: testPublicKey,
        publishedAt: Date.now(),
        version: 1,
      });

      const key = await fetchPublicKey(testAddress, testCid);

      expect(key).toEqual(testPublicKey);
      expect(mockFetchJSON).toHaveBeenCalledWith(testCid);
    });

    it('caches key after fetching from IPFS', async () => {
      mockFetchJSON.mockResolvedValueOnce({
        address: testAddress.toLowerCase(),
        publicKey: testPublicKey,
        publishedAt: Date.now(),
        version: 1,
      });

      await fetchPublicKey(testAddress, testCid);

      expect(hasCachedPublicKey(testAddress)).toBe(true);
    });

    it('returns null when no CID provided and not cached', async () => {
      const key = await fetchPublicKey(testAddress);

      expect(key).toBeNull();
    });

    it('returns null when IPFS fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetchJSON.mockRejectedValueOnce(new Error('IPFS error'));

      const key = await fetchPublicKey(testAddress, testCid);

      expect(key).toBeNull();
      consoleSpy.mockRestore();
    });

    it('returns null when IPFS returns invalid record', async () => {
      mockFetchJSON.mockResolvedValueOnce({ invalid: 'data' });

      const key = await fetchPublicKey(testAddress, testCid);

      expect(key).toBeNull();
    });

    it('returns null when IPFS returns null', async () => {
      mockFetchJSON.mockResolvedValueOnce(null);

      const key = await fetchPublicKey(testAddress, testCid);

      expect(key).toBeNull();
    });
  });

  describe('hasCachedPublicKey', () => {
    it('returns false when no key is cached', () => {
      expect(hasCachedPublicKey(testAddress)).toBe(false);
    });

    it('returns true when key is cached', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey(testAddress, testPublicKey);

      expect(hasCachedPublicKey(testAddress)).toBe(true);
    });

    it('returns false for expired cache entries', () => {
      vi.useFakeTimers();

      // Manually set a cache entry with old timestamp
      const cache = {
        [testAddress.toLowerCase()]: {
          publicKey: testPublicKey,
          cid: testCid,
          fetchedAt: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        },
      };
      localStorage.setItem('vauban-pubkey-cache', JSON.stringify(cache));

      expect(hasCachedPublicKey(testAddress)).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('getCachedKeyCid', () => {
    it('returns null when no key is cached', () => {
      expect(getCachedKeyCid(testAddress)).toBeNull();
    });

    it('returns CID of cached key', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey(testAddress, testPublicKey);

      expect(getCachedKeyCid(testAddress)).toBe(testCid);
    });
  });

  describe('clearPublicKeyCache', () => {
    it('clears the entire cache', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey(testAddress, testPublicKey);

      expect(hasCachedPublicKey(testAddress)).toBe(true);

      clearPublicKeyCache();

      expect(hasCachedPublicKey(testAddress)).toBe(false);
    });

    it('does not clear own key CIDs', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey(testAddress, testPublicKey);

      clearPublicKeyCache();

      // Own key CID should still be stored
      expect(getOwnKeyCid(testAddress)).toBe(testCid);
    });
  });

  describe('cache TTL behavior', () => {
    it('serves cached key within TTL', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      // Set cache entry
      const cache = {
        [testAddress.toLowerCase()]: {
          publicKey: testPublicKey,
          cid: testCid,
          fetchedAt: Date.now(),
        },
      };
      localStorage.setItem('vauban-pubkey-cache', JSON.stringify(cache));

      // Advance 23 hours (within 24h TTL)
      vi.advanceTimersByTime(23 * 60 * 60 * 1000);

      expect(hasCachedPublicKey(testAddress)).toBe(true);

      vi.useRealTimers();
    });

    it('expires cached key after TTL', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      const cache = {
        [testAddress.toLowerCase()]: {
          publicKey: testPublicKey,
          cid: testCid,
          fetchedAt: Date.now(),
        },
      };
      localStorage.setItem('vauban-pubkey-cache', JSON.stringify(cache));

      // Advance past 24h TTL
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      expect(hasCachedPublicKey(testAddress)).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('address normalization', () => {
    it('treats different cases of same address as identical', async () => {
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey('0xABCDEF', testPublicKey);

      expect(hasCachedPublicKey('0xabcdef')).toBe(true);
      expect(hasCachedPublicKey('0xABCDEF')).toBe(true);
    });
  });

  describe('localStorage error handling', () => {
    it('returns empty cache on corrupted localStorage', () => {
      localStorage.setItem('vauban-pubkey-cache', 'not-valid-json');

      expect(hasCachedPublicKey(testAddress)).toBe(false);
    });
  });

  describe('lookupPublicKeyByAddress', () => {
    it('returns cached key when available (no profile lookup)', async () => {
      // Populate cache via publish
      mockUploadJSON.mockResolvedValueOnce(testCid);
      await publishPublicKey(testAddress, testPublicKey);

      mockGetProfile.mockClear();
      mockFetchJSON.mockClear();

      const key = await lookupPublicKeyByAddress(testAddress);

      expect(key).toEqual(testPublicKey);
      // Should not even check profile since cache hit
      expect(mockGetProfile).not.toHaveBeenCalled();
      expect(mockFetchJSON).not.toHaveBeenCalled();
    });

    it('falls back to profile publicKeyCid when not cached', async () => {
      mockGetProfile.mockReturnValue({
        address: testAddress,
        publicKeyCid: testCid,
      });
      mockFetchJSON.mockResolvedValueOnce({
        address: testAddress.toLowerCase(),
        publicKey: testPublicKey,
        publishedAt: Date.now(),
        version: 1,
      });

      const key = await lookupPublicKeyByAddress(testAddress);

      expect(key).toEqual(testPublicKey);
      expect(mockGetProfile).toHaveBeenCalledWith(testAddress);
      expect(mockFetchJSON).toHaveBeenCalledWith(testCid);
    });

    it('returns null when profile has no publicKeyCid', async () => {
      mockGetProfile.mockReturnValue({
        address: testAddress,
        displayName: 'Alice',
      });

      const key = await lookupPublicKeyByAddress(testAddress);

      expect(key).toBeNull();
    });

    it('returns null when profile is null', async () => {
      mockGetProfile.mockReturnValue(null);

      const key = await lookupPublicKeyByAddress(testAddress);

      expect(key).toBeNull();
    });

    it('returns null when IPFS fetch from profile CID fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetProfile.mockReturnValue({
        address: testAddress,
        publicKeyCid: testCid,
      });
      mockFetchJSON.mockRejectedValueOnce(new Error('IPFS error'));

      const key = await lookupPublicKeyByAddress(testAddress);

      expect(key).toBeNull();
      consoleSpy.mockRestore();
    });
  });
});
