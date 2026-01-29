import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateApiKey,
  checkRateLimit,
  getRateLimitRemaining,
  getRateLimitReset,
  generateApiKey,
} from '../api-keys';

describe('api-keys.ts', () => {
  const VALID_API_KEY = 'test-api-key-12345';

  beforeEach(() => {
    vi.stubEnv('M2M_API_KEY', VALID_API_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('validateApiKey', () => {
    it('returns true for a valid API key', () => {
      expect(validateApiKey(VALID_API_KEY)).toBe(true);
    });

    it('returns false for null', () => {
      expect(validateApiKey(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(validateApiKey('')).toBe(false);
    });

    it('returns false for incorrect API key', () => {
      expect(validateApiKey('wrong-key')).toBe(false);
    });

    it('returns false when key has different length', () => {
      expect(validateApiKey('short')).toBe(false);
    });

    it('returns false when M2M_API_KEY is not configured', () => {
      vi.stubEnv('M2M_API_KEY', '');
      // Need to delete the env var entirely
      delete process.env.M2M_API_KEY;
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(validateApiKey('some-key')).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('M2M_API_KEY not configured in environment');

      consoleSpy.mockRestore();
    });

    it('returns false for key with same length but different content', () => {
      const sameLength = 'x'.repeat(VALID_API_KEY.length);
      expect(validateApiKey(sameLength)).toBe(false);
    });

    it('uses constant-time comparison (same-length keys)', () => {
      // This mainly tests the logic path for same-length comparison
      const almostCorrect = VALID_API_KEY.slice(0, -1) + 'X';
      expect(validateApiKey(almostCorrect)).toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('allows the first request', () => {
      expect(checkRateLimit('key-1')).toBe(true);
    });

    it('allows up to 10 requests in a window', () => {
      for (let i = 0; i < 10; i++) {
        expect(checkRateLimit('key-2')).toBe(true);
      }
    });

    it('blocks the 11th request in a window', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('key-3');
      }
      expect(checkRateLimit('key-3')).toBe(false);
    });

    it('resets after the window expires', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('key-4');
      }
      expect(checkRateLimit('key-4')).toBe(false);

      // Advance past the 1-minute window
      vi.advanceTimersByTime(61 * 1000);

      expect(checkRateLimit('key-4')).toBe(true);
    });

    it('tracks different keys independently', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('key-A');
      }
      expect(checkRateLimit('key-A')).toBe(false);
      expect(checkRateLimit('key-B')).toBe(true);
    });
  });

  describe('getRateLimitRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns 10 for a new key', () => {
      expect(getRateLimitRemaining('new-key')).toBe(10);
    });

    it('returns correct remaining after some requests', () => {
      checkRateLimit('rl-key');
      checkRateLimit('rl-key');
      checkRateLimit('rl-key');
      expect(getRateLimitRemaining('rl-key')).toBe(7);
    });

    it('returns 0 when rate limit is exhausted', () => {
      for (let i = 0; i < 10; i++) {
        checkRateLimit('exhausted-key');
      }
      expect(getRateLimitRemaining('exhausted-key')).toBe(0);
    });

    it('returns 10 after window expires', () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit('expired-key');
      }
      vi.advanceTimersByTime(61 * 1000);
      expect(getRateLimitRemaining('expired-key')).toBe(10);
    });
  });

  describe('getRateLimitReset', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns future time for a new key', () => {
      const reset = getRateLimitReset('new-reset-key');
      expect(reset).toBeGreaterThan(Date.now());
    });

    it('returns the same reset time within a window', () => {
      checkRateLimit('reset-key');
      const reset1 = getRateLimitReset('reset-key');
      checkRateLimit('reset-key');
      const reset2 = getRateLimitReset('reset-key');
      expect(reset1).toBe(reset2);
    });

    it('returns a new reset time after window expires', () => {
      checkRateLimit('expire-reset-key');
      const reset1 = getRateLimitReset('expire-reset-key');

      vi.advanceTimersByTime(61 * 1000);

      const reset2 = getRateLimitReset('expire-reset-key');
      expect(reset2).toBeGreaterThan(reset1);
    });
  });

  describe('generateApiKey', () => {
    it('generates a key starting with vb_', () => {
      const key = generateApiKey();
      expect(key.startsWith('vb_')).toBe(true);
    });

    it('generates a key with correct length (vb_ + 32 chars = 35)', () => {
      const key = generateApiKey();
      expect(key.length).toBe(35);
    });

    it('generates different keys each time', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it('generates keys with only alphanumeric characters after prefix', () => {
      const key = generateApiKey();
      const body = key.slice(3); // Remove vb_ prefix
      expect(body).toMatch(/^[A-Za-z0-9]+$/);
    });
  });
});
