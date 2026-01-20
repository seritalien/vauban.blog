// Author profile management using localStorage
// In production, this could be stored on-chain or on IPFS

import { type AuthorProfile, type ProfileInput } from '@vauban/shared-types';

const PROFILES_STORAGE_KEY = 'vauban_profiles';

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

export function getProfile(address: string): AuthorProfile | null {
  const profiles = getProfiles();
  const normalizedAddress = address.toLowerCase();
  return profiles.find((p) => p.address.toLowerCase() === normalizedAddress) || null;
}

export function saveProfile(input: ProfileInput): AuthorProfile {
  const profiles = getProfiles();
  const now = new Date().toISOString();
  const normalizedAddress = input.address.toLowerCase();

  const existingIndex = profiles.findIndex(
    (p) => p.address.toLowerCase() === normalizedAddress
  );

  if (existingIndex !== -1) {
    // Update existing profile
    const updated: AuthorProfile = {
      ...profiles[existingIndex],
      ...input,
      address: normalizedAddress,
      updatedAt: now,
    };
    profiles[existingIndex] = updated;
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    return updated;
  }

  // Create new profile
  const newProfile: AuthorProfile = {
    ...input,
    address: normalizedAddress,
    createdAt: now,
    updatedAt: now,
  };

  profiles.push(newProfile);
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  return newProfile;
}

export function deleteProfile(address: string): boolean {
  const profiles = getProfiles();
  const normalizedAddress = address.toLowerCase();
  const filtered = profiles.filter(
    (p) => p.address.toLowerCase() !== normalizedAddress
  );

  if (filtered.length !== profiles.length) {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}

// Helper to format address for display
export function formatAddress(address: string | unknown): string {
  if (!address) return '';
  const addr = typeof address === 'string' ? address : String(address);
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

// Helper to safely convert address to string
export function toAddressString(address: unknown): string {
  if (!address) return '';
  if (typeof address === 'string') return address.toLowerCase();
  return String(address).toLowerCase();
}
