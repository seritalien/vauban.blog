/**
 * Public Key Registry
 *
 * Manages encryption public keys for E2E messaging.
 * Keys are stored on IPFS and cached locally in localStorage.
 *
 * Flow:
 * 1. User initializes keys -> public key uploaded to IPFS -> CID stored locally
 * 2. Sender wants to message user -> fetch their public key CID -> fetch key from IPFS
 * 3. Local cache avoids repeated IPFS lookups
 */

import { type ExportedPublicKey } from '@/lib/crypto';
import { uploadJSONToIPFSViaAPI, fetchJSONFromIPFSViaAPI } from '@/lib/ipfs-client';
import { getProfile } from '@/lib/profiles';

// =============================================================================
// TYPES
// =============================================================================

interface PublicKeyRecord {
  address: string;
  publicKey: ExportedPublicKey;
  publishedAt: number;
  version: number;
}

interface CacheEntry {
  publicKey: ExportedPublicKey;
  cid: string;
  fetchedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REGISTRY_CACHE_KEY = 'vauban-pubkey-cache';
const OWN_KEY_CID_PREFIX = 'vauban-pubkey-cid-';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// LOCAL CACHE
// =============================================================================

function getCache(): Record<string, CacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(REGISTRY_CACHE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setCache(cache: Record<string, CacheEntry>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REGISTRY_CACHE_KEY, JSON.stringify(cache));
}

function getCachedKey(address: string): CacheEntry | null {
  const cache = getCache();
  const normalized = address.toLowerCase();
  const entry = cache[normalized];

  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    // Expired - remove from cache
    delete cache[normalized];
    setCache(cache);
    return null;
  }

  return entry;
}

function setCachedKey(address: string, publicKey: ExportedPublicKey, cid: string): void {
  const cache = getCache();
  cache[address.toLowerCase()] = {
    publicKey,
    cid,
    fetchedAt: Date.now(),
  };
  setCache(cache);
}

// =============================================================================
// OWN KEY CID STORAGE
// =============================================================================

/**
 * Get the IPFS CID where our own public key is stored
 */
export function getOwnKeyCid(address: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(`${OWN_KEY_CID_PREFIX}${address.toLowerCase()}`);
}

/**
 * Store the IPFS CID of our own public key
 */
function setOwnKeyCid(address: string, cid: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${OWN_KEY_CID_PREFIX}${address.toLowerCase()}`, cid);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Publish our public key to IPFS and cache it
 *
 * Called once when the user first initializes their encryption keys.
 * Returns the IPFS CID where the key is stored.
 */
export async function publishPublicKey(
  address: string,
  publicKey: ExportedPublicKey
): Promise<string> {
  // Check if already published
  const existingCid = getOwnKeyCid(address);
  if (existingCid) {
    return existingCid;
  }

  const record: PublicKeyRecord = {
    address: address.toLowerCase(),
    publicKey,
    publishedAt: Date.now(),
    version: 1,
  };

  const cid = await uploadJSONToIPFSViaAPI(record);

  // Cache locally
  setOwnKeyCid(address, cid);
  setCachedKey(address, publicKey, cid);

  return cid;
}

/**
 * Fetch a user's public key from IPFS
 *
 * Checks local cache first, then fetches from IPFS.
 * Returns null if the user hasn't published their key.
 *
 * @param address - The user's wallet address
 * @param keyCid - Optional known CID of the key record (e.g., from their profile)
 */
export async function fetchPublicKey(
  address: string,
  keyCid?: string
): Promise<ExportedPublicKey | null> {
  // Check cache first
  const cached = getCachedKey(address);
  if (cached) {
    return cached.publicKey;
  }

  // If we have a CID, fetch directly
  if (keyCid) {
    try {
      const record = await fetchJSONFromIPFSViaAPI<PublicKeyRecord>(keyCid);
      if (record?.publicKey) {
        setCachedKey(address, record.publicKey, keyCid);
        return record.publicKey;
      }
    } catch (err) {
      console.error('Failed to fetch public key from IPFS:', err);
    }
  }

  // No CID provided and not in cache - key is unknown
  // In the future, this could query an on-chain registry
  return null;
}

/**
 * Check if we have a cached public key for an address
 */
export function hasCachedPublicKey(address: string): boolean {
  return getCachedKey(address) !== null;
}

/**
 * Get the CID of a cached public key (for sharing)
 */
export function getCachedKeyCid(address: string): string | null {
  const cached = getCachedKey(address);
  return cached?.cid || null;
}

/**
 * Look up a user's public key by their address.
 *
 * Resolution order:
 * 1. Local cache (instant)
 * 2. Profile's publicKeyCid → IPFS fetch
 * 3. null (key not discoverable)
 */
export async function lookupPublicKeyByAddress(
  address: string,
): Promise<ExportedPublicKey | null> {
  // 1. Check cache
  const cached = getCachedKey(address);
  if (cached) {
    return cached.publicKey;
  }

  // 2. Look up the user's profile for a publicKeyCid
  const profile = getProfile(address);
  if (profile?.publicKeyCid) {
    return fetchPublicKey(address, profile.publicKeyCid);
  }

  // 3. Not discoverable
  return null;
}

/**
 * Clear the entire public key cache
 */
export function clearPublicKeyCache(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REGISTRY_CACHE_KEY);
}
