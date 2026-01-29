/**
 * Starknet Utility Tests (from @vauban/web3-utils)
 *
 * Tests for calculateContentHash, isValidStarknetAddress, formatAddress,
 * and other utility functions exported from the web3-utils package.
 */
import { vi, describe, it, expect } from 'vitest';

// Mock starknet module to avoid RPC calls
vi.mock('starknet', () => ({
  Contract: vi.fn().mockImplementation(() => ({
    get_post_count: vi.fn().mockResolvedValue(5n),
    get_post: vi.fn().mockResolvedValue({
      id: { low: 1n, high: 0n },
      author: 1234n,
      arweave_tx_id: [0x6172n],
      ipfs_cid: [0x516dn],
      content_hash: 0xabn,
      price: 0n,
      is_encrypted: 0n,
      created_at: 1700000000n,
      updated_at: 1700000000n,
      is_deleted: 0n,
      post_type: 0n,
      parent_id: { low: 0n, high: 0n },
      thread_root_id: { low: 0n, high: 0n },
      is_pinned: 0n,
      version: 1n,
    }),
  })),
  Account: vi.fn(),
  RpcProvider: vi.fn().mockImplementation(() => ({
    getBlock: vi.fn().mockResolvedValue({ block_number: 100 }),
    callContract: vi.fn(),
  })),
  shortString: {
    decodeShortString: vi.fn((s: string) => s),
    encodeShortString: vi.fn((s: string) => s),
  },
  num: {
    toHex: vi.fn((n: unknown) => '0x' + BigInt(n as string).toString(16)),
  },
  hash: {
    computeHashOnElements: vi.fn().mockReturnValue('0xhash'),
  },
  CallData: {
    compile: vi.fn((args: unknown[]) => args),
  },
  cairo: {
    felt: vi.fn((v: unknown) => v),
    uint256: vi.fn((v: unknown) => ({ low: v, high: 0 })),
  },
}));

import {
  calculateContentHash,
  isValidStarknetAddress,
  formatAddress,
} from '@vauban/web3-utils';

// =============================================================================
// calculateContentHash
// =============================================================================

describe('calculateContentHash', () => {
  it('returns a hex string starting with 0x', async () => {
    const hash = await calculateContentHash('Hello world');
    expect(hash).toMatch(/^0x[a-f0-9]+$/i);
  });

  it('returns deterministic results for same input', async () => {
    const hash1 = await calculateContentHash('test content');
    const hash2 = await calculateContentHash('test content');
    expect(hash1).toBe(hash2);
  });

  it('returns different hashes for different input', async () => {
    const hash1 = await calculateContentHash('content A');
    const hash2 = await calculateContentHash('content B');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', async () => {
    const hash = await calculateContentHash('');
    expect(hash).toMatch(/^0x[a-f0-9]+$/i);
  });

  it('handles unicode content', async () => {
    const hash = await calculateContentHash('Hello 世界 🌍');
    expect(hash).toMatch(/^0x[a-f0-9]+$/i);
  });

  it('truncates to valid felt range', async () => {
    const hash = await calculateContentHash('some data');
    // Starknet felt is max 252 bits = 63 hex chars
    const hexPart = hash.slice(2);
    expect(hexPart.length).toBeLessThanOrEqual(64);
  });
});

// =============================================================================
// isValidStarknetAddress
// =============================================================================

describe('isValidStarknetAddress', () => {
  it('validates correct address with 0x prefix', () => {
    const addr = '0x' + 'a1'.repeat(32);
    expect(isValidStarknetAddress(addr)).toBe(true);
  });

  it('rejects address without 0x prefix', () => {
    const addr = 'a1'.repeat(32);
    expect(isValidStarknetAddress(addr)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidStarknetAddress('')).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidStarknetAddress('0xGGGG')).toBe(false);
  });

  it('accepts short addresses (zero-padded)', () => {
    expect(isValidStarknetAddress('0x1')).toBe(true);
  });

  it('accepts addresses up to 66 chars (0x + 64 hex)', () => {
    const addr = '0x' + 'f'.repeat(64);
    expect(isValidStarknetAddress(addr)).toBe(true);
  });

  it('rejects addresses longer than 66 chars', () => {
    const addr = '0x' + 'f'.repeat(65);
    expect(isValidStarknetAddress(addr)).toBe(false);
  });
});

// =============================================================================
// formatAddress
// =============================================================================

describe('formatAddress', () => {
  it('truncates long address to short form', () => {
    const addr = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
    const formatted = formatAddress(addr);
    expect(formatted.length).toBeLessThan(addr.length);
    expect(formatted).toContain('...');
  });

  it('preserves prefix and suffix', () => {
    const addr = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
    const formatted = formatAddress(addr);
    expect(formatted.startsWith('0x')).toBe(true);
    expect(formatted.endsWith('0001')).toBe(true);
  });

  it('handles short addresses', () => {
    const formatted = formatAddress('0x1');
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
