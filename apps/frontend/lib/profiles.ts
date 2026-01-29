// Author profile management using localStorage + IPFS for cross-device discovery
// In production, the on-chain registry replaces IPFS as the source of truth.

import { type AuthorProfile, type ProfileInput } from '@vauban/shared-types';
import { uploadJSONToIPFSViaAPI, fetchJSONFromIPFSViaAPI } from '@/lib/ipfs-client';

const PROFILES_STORAGE_KEY = 'vauban_profiles';

// Helper to safely convert address to string (handles BigInt, hex strings, etc.)
export function toAddressString(address: unknown): string {
  if (!address) return '';

  // Handle BigInt - convert to hex with 0x prefix
  if (typeof address === 'bigint') {
    return `0x${address.toString(16)}`.toLowerCase();
  }

  // Handle string
  if (typeof address === 'string') {
    return address.toLowerCase();
  }

  // Handle object with toString (like BN.js)
  return String(address).toLowerCase();
}

// Normalize address for comparison (removes leading zeros after 0x)
export function normalizeAddress(address: unknown): string {
  const addrStr = toAddressString(address);
  if (!addrStr) return '';

  // Remove '0x' prefix, remove leading zeros, add back '0x'
  const withoutPrefix = addrStr.replace(/^0x/, '');
  const withoutLeadingZeros = withoutPrefix.replace(/^0+/, '') || '0';
  return `0x${withoutLeadingZeros}`;
}

// Helper to format address for display
export function formatAddress(address: string | unknown): string {
  if (!address) return '';
  const addr = toAddressString(address);
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// Get display name or formatted address
export function getDisplayName(address: string | unknown, profile?: AuthorProfile | null): string {
  if (profile?.displayName) {
    return profile.displayName;
  }
  return formatAddress(address);
}

export function getProfiles(): AuthorProfile[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getProfile(address: string | unknown): AuthorProfile | null {
  const profiles = getProfiles();
  const normalized = normalizeAddress(address);
  return profiles.find((p) => normalizeAddress(p.address) === normalized) || null;
}

export function saveProfile(input: ProfileInput): AuthorProfile {
  const profiles = getProfiles();
  const now = new Date().toISOString();
  const normalized = normalizeAddress(input.address);

  const existingIndex = profiles.findIndex(
    (p) => normalizeAddress(p.address) === normalized
  );

  if (existingIndex !== -1) {
    // Update existing profile
    const updated: AuthorProfile = {
      ...profiles[existingIndex],
      ...input,
      address: normalized,
      updatedAt: now,
    };
    profiles[existingIndex] = updated;
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    return updated;
  }

  // Create new profile
  const newProfile: AuthorProfile = {
    ...input,
    address: normalized,
    createdAt: now,
    updatedAt: now,
  };

  profiles.push(newProfile);
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  return newProfile;
}

export function deleteProfile(address: string): boolean {
  const profiles = getProfiles();
  const normalized = normalizeAddress(address);
  const filtered = profiles.filter(
    (p) => normalizeAddress(p.address) !== normalized
  );

  if (filtered.length !== profiles.length) {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}

// =============================================================================
// IPFS PROFILE DISCOVERY
// =============================================================================

const PROFILE_CID_PREFIX = 'vauban-profile-cid-';

/**
 * Publish a profile to IPFS for cross-device discovery.
 * Returns the IPFS CID of the published profile.
 */
export async function publishProfileToIPFS(profile: AuthorProfile): Promise<string> {
  const cid = await uploadJSONToIPFSViaAPI(profile);

  // Store the CID locally for fast retrieval
  if (typeof window !== 'undefined') {
    localStorage.setItem(
      `${PROFILE_CID_PREFIX}${normalizeAddress(profile.address)}`,
      cid,
    );
  }

  return cid;
}

/**
 * Fetch a profile from IPFS by CID.
 */
export async function fetchProfileFromIPFS(cid: string): Promise<AuthorProfile | null> {
  try {
    return await fetchJSONFromIPFSViaAPI<AuthorProfile>(cid);
  } catch {
    return null;
  }
}

/**
 * Get the locally stored IPFS CID for a profile.
 */
export function getProfileCid(address: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(
    `${PROFILE_CID_PREFIX}${normalizeAddress(address)}`,
  );
}
