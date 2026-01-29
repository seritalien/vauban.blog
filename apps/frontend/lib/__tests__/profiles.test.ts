import { describe, it, expect } from 'vitest';
import {
  toAddressString,
  normalizeAddress,
  formatAddress,
  getDisplayName,
  getProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
} from '../profiles';

// =============================================================================
// toAddressString
// =============================================================================

describe('toAddressString', () => {
  it('handles string address', () => {
    expect(toAddressString('0xABC123')).toBe('0xabc123');
  });

  it('handles BigInt address', () => {
    const result = toAddressString(BigInt(255));
    expect(result).toBe('0xff');
  });

  it('handles null', () => {
    expect(toAddressString(null)).toBe('');
  });

  it('handles undefined', () => {
    expect(toAddressString(undefined)).toBe('');
  });

  it('lowercases strings', () => {
    expect(toAddressString('0xABCDEF')).toBe('0xabcdef');
  });

  it('handles zero BigInt (falsy) as empty string', () => {
    // BigInt(0) is falsy, so the guard `if (!address) return ''` triggers
    expect(toAddressString(BigInt(0))).toBe('');
  });
});

// =============================================================================
// normalizeAddress
// =============================================================================

describe('normalizeAddress', () => {
  it('removes leading zeros after 0x', () => {
    expect(normalizeAddress('0x000abc')).toBe('0xabc');
  });

  it('handles empty string', () => {
    expect(normalizeAddress('')).toBe('');
  });

  it('handles null', () => {
    expect(normalizeAddress(null)).toBe('');
  });

  it('preserves 0x prefix', () => {
    const result = normalizeAddress('0x1234');
    expect(result.startsWith('0x')).toBe(true);
    expect(result).toBe('0x1234');
  });

  it('normalizes to 0x0 for zero address', () => {
    expect(normalizeAddress('0x0000')).toBe('0x0');
  });

  it('handles BigInt input', () => {
    const result = normalizeAddress(BigInt(16) as unknown);
    expect(result).toBe('0x10');
  });
});

// =============================================================================
// formatAddress
// =============================================================================

describe('formatAddress', () => {
  it('truncates long address with ellipsis', () => {
    const addr = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
    const formatted = formatAddress(addr);
    expect(formatted).toContain('...');
    expect(formatted.length).toBeLessThan(addr.length);
  });

  it('returns short address as-is', () => {
    const addr = '0x1234';
    const formatted = formatAddress(addr);
    // Length <= 10, so returned as-is
    expect(formatted).toBe('0x1234');
  });

  it('handles empty string', () => {
    expect(formatAddress('')).toBe('');
  });

  it('preserves prefix and suffix for long addresses', () => {
    const addr = '0x0a11ce0000000000000000000000000000000000000000000000000000000001';
    const formatted = formatAddress(addr);
    expect(formatted.startsWith('0x')).toBe(true);
    expect(formatted.endsWith('0001')).toBe(true);
  });
});

// =============================================================================
// getDisplayName
// =============================================================================

describe('getDisplayName', () => {
  it('returns profile displayName if available', () => {
    const profile = {
      address: '0xabc',
      displayName: 'Fabien',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    expect(getDisplayName('0xabc', profile)).toBe('Fabien');
  });

  it('falls back to formatAddress if no profile', () => {
    const addr = '0x0a11ce0000000000000000000000000000000000000000000000000000000001';
    const result = getDisplayName(addr, null);
    expect(result).toContain('...');
  });

  it('falls back to formatAddress if profile has no displayName', () => {
    const profile = {
      address: '0xabc',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };
    expect(getDisplayName('0xabc', profile)).toBe('0xabc');
  });

  it('falls back to formatAddress if profile is undefined', () => {
    const addr = '0x1234';
    expect(getDisplayName(addr)).toBe('0x1234');
  });
});

// =============================================================================
// getProfiles
// =============================================================================

describe('getProfiles', () => {
  it('returns empty array when no data in localStorage', () => {
    expect(getProfiles()).toEqual([]);
  });

  it('returns stored profiles', () => {
    const profiles = [
      {
        address: '0xabc',
        displayName: 'Fabien',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    localStorage.setItem('vauban_profiles', JSON.stringify(profiles));

    expect(getProfiles()).toEqual(profiles);
  });

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem('vauban_profiles', 'invalid json');
    expect(getProfiles()).toEqual([]);
  });
});

// =============================================================================
// saveProfile
// =============================================================================

describe('saveProfile', () => {
  it('creates a new profile', () => {
    const input = { address: '0x00abc', displayName: 'Fabien' };
    const saved = saveProfile(input);

    expect(saved.address).toBe('0xabc');
    expect(saved.displayName).toBe('Fabien');
    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
  });

  it('updates existing profile', () => {
    // Create initial profile
    saveProfile({ address: '0x00abc', displayName: 'Fabien' });

    // Update the profile
    const updated = saveProfile({ address: '0x00abc', displayName: 'Fabien V2' });

    expect(updated.displayName).toBe('Fabien V2');

    // Should still be just one profile
    const profiles = getProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].displayName).toBe('Fabien V2');
  });

  it('normalizes address when saving', () => {
    const saved = saveProfile({ address: '0x000DEF' });

    expect(saved.address).toBe('0xdef');
  });

  it('stores the profile in localStorage', () => {
    saveProfile({ address: '0xabc', displayName: 'Test' });

    const stored = JSON.parse(
      localStorage.getItem('vauban_profiles') as string
    );
    expect(stored).toHaveLength(1);
    expect(stored[0].displayName).toBe('Test');
  });
});

// =============================================================================
// getProfile
// =============================================================================

describe('getProfile', () => {
  it('finds profile by normalized address', () => {
    saveProfile({ address: '0x00abc', displayName: 'Fabien' });

    const profile = getProfile('0x000abc');
    expect(profile).not.toBeNull();
    expect(profile?.displayName).toBe('Fabien');
  });

  it('returns null when profile not found', () => {
    expect(getProfile('0xnonexistent')).toBeNull();
  });

  it('returns null when store is empty', () => {
    expect(getProfile('0xabc')).toBeNull();
  });
});

// =============================================================================
// deleteProfile
// =============================================================================

describe('deleteProfile', () => {
  it('removes profile and returns true', () => {
    saveProfile({ address: '0x00abc', displayName: 'Fabien' });

    const result = deleteProfile('0x000abc');

    expect(result).toBe(true);
    expect(getProfiles()).toHaveLength(0);
  });

  it('returns false if profile not found', () => {
    const result = deleteProfile('0xnonexistent');

    expect(result).toBe(false);
  });

  it('only removes the specified profile', () => {
    saveProfile({ address: '0xabc', displayName: 'First' });
    saveProfile({ address: '0xdef', displayName: 'Second' });

    deleteProfile('0xabc');

    const profiles = getProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].displayName).toBe('Second');
  });
});
