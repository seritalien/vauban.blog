import { NextRequest, NextResponse } from 'next/server';

const MADARA_RPC = process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944';

// In-memory cache for read-only RPC methods
const CACHE_TTL_MS = 15_000;
const MAX_CACHE_ENTRIES = 1000;

const READ_ONLY_METHODS = new Set([
  'starknet_call',
  'starknet_getStorageAt',
  'starknet_getBlockWithTxHashes',
  'starknet_getBlockWithTxs',
  'starknet_getTransactionByHash',
  'starknet_getTransactionReceipt',
  'starknet_getClass',
  'starknet_getClassAt',
  'starknet_getClassHashAt',
  'starknet_getBlockNumber',
  'starknet_chainId',
  'starknet_getNonce',
  'starknet_blockNumber',
  'starknet_blockHashAndNumber',
]);

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(body: { method?: string; params?: unknown }): string | null {
  if (!body.method || !READ_ONLY_METHODS.has(body.method)) return null;
  return `${body.method}:${JSON.stringify(body.params ?? [])}`;
}

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check cache for read-only methods
    const cacheKey = getCacheKey(body);
    if (cacheKey) {
      const cached = getCached(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    const response = await fetch(MADARA_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // Cache read-only responses
    if (cacheKey && !data.error) {
      setCache(cacheKey, data);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('RPC Proxy error:', error);
    return NextResponse.json(
      { error: 'RPC request failed' },
      { status: 500 }
    );
  }
}
