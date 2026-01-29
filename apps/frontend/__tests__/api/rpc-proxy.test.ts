import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Module-level state handling
//
// The RPC route module has an in-memory cache (Map) at module scope.
// We use vi.resetModules() + dynamic import to get a fresh module (and cache)
// for tests that need isolation. For tests that exercise cache behavior, we
// share the import within the describe block.
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRpcRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function rpcBody(
  method: string,
  params: unknown[] = []
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  };
}

function mockFetchResponse(
  data: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/rpc', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  // ===== Basic forwarding =====

  it('forwards POST request to Madara RPC', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0x1' };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_chainId');
    const request = createRpcRequest(body);
    const response = await POST(request);
    const data = await response.json();

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      expect.stringContaining('localhost:9944'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
    expect(data).toEqual(rpcResponse);
  });

  // ===== Caching read-only methods =====

  it('caches read-only method responses (starknet_call)', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xdeadbeef' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_call', [
      { contract_address: '0x1', entry_point_selector: '0x2', calldata: [] },
    ]);

    // First call — hits the RPC
    const request1 = createRpcRequest(body);
    const response1 = await POST(request1);
    const data1 = await response1.json();

    expect(data1).toEqual(rpcResponse);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('returns cached response on second call within TTL', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xcached' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_call', [{ contract_address: '0xabc' }]);

    // First call — populates cache
    const request1 = createRpcRequest(body);
    await POST(request1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    // Advance time by less than TTL (30s)
    vi.advanceTimersByTime(15_000);

    // Second call — should come from cache
    vi.mocked(globalThis.fetch).mockClear();
    const request2 = createRpcRequest(body);
    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(data2).toEqual(rpcResponse);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
  });

  it('fetches fresh data after cache TTL expires', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const firstResponse = { jsonrpc: '2.0', id: 1, result: '0xfirst' };
    const secondResponse = { jsonrpc: '2.0', id: 1, result: '0xsecond' };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(firstResponse)
    );

    const body = rpcBody('starknet_getBlockNumber');

    // First call — populates cache
    const request1 = createRpcRequest(body);
    const response1 = await POST(request1);
    const data1 = await response1.json();
    expect(data1).toEqual(firstResponse);

    // Advance time past TTL (30s)
    vi.advanceTimersByTime(31_000);

    // Second call — cache expired, fetches fresh
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(secondResponse)
    );
    const request2 = createRpcRequest(body);
    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(data2).toEqual(secondResponse);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  // ===== Write methods not cached =====

  it('does not cache write methods (starknet_addInvokeTransaction)', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xtxhash' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_addInvokeTransaction', [
      { type: 'INVOKE', sender_address: '0x1' },
    ]);

    // First call
    const request1 = createRpcRequest(body);
    await POST(request1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    // Second call — should NOT be cached, must fetch again
    const request2 = createRpcRequest(body);
    await POST(request2);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  it('does not cache starknet_addDeclareTransaction', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xdeclare' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_addDeclareTransaction', []);

    const request1 = createRpcRequest(body);
    await POST(request1);

    const request2 = createRpcRequest(body);
    await POST(request2);

    // Both calls should hit the RPC
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  // ===== Error responses not cached =====

  it('does not cache error responses', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const errorResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32601, message: 'Method not found' },
    };
    const successResponse = { jsonrpc: '2.0', id: 1, result: '0xok' };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(errorResponse)
    );

    const body = rpcBody('starknet_call', [{ contract_address: '0xfail' }]);

    // First call — returns error, should not cache
    const request1 = createRpcRequest(body);
    const response1 = await POST(request1);
    const data1 = await response1.json();
    expect(data1.error).toBeDefined();

    // Second call — should fetch again (not return cached error)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(successResponse)
    );
    const request2 = createRpcRequest(body);
    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(data2.result).toBe('0xok');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  // ===== Fetch failure =====

  it('returns 500 on fetch failure', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new Error('Connection refused')
    );

    const body = rpcBody('starknet_chainId');
    const request = createRpcRequest(body);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('RPC request failed');
  });

  it('returns 500 when RPC response is not valid JSON', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('not json', { status: 200 })
    );

    const body = rpcBody('starknet_chainId');
    const request = createRpcRequest(body);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('RPC request failed');
  });

  // ===== Cache eviction =====

  it('evicts oldest entry when cache exceeds MAX_CACHE_ENTRIES (1000)', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    // Fill the cache with 1000 entries using starknet_call with unique params
    for (let i = 0; i < 1000; i++) {
      const rpcResponse = { jsonrpc: '2.0', id: 1, result: `0x${i}` };
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        mockFetchResponse(rpcResponse)
      );

      const body = rpcBody('starknet_call', [{ index: i }]);
      const request = createRpcRequest(body);
      await POST(request);
    }

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1000);

    // Add entry #1001 — should evict entry #0 (the oldest/first key)
    const newResponse = { jsonrpc: '2.0', id: 1, result: '0xnew' };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(newResponse)
    );
    const body1001 = rpcBody('starknet_call', [{ index: 1000 }]);
    const request1001 = createRpcRequest(body1001);
    await POST(request1001);

    // Entry #0 should have been evicted — requesting it should require a fresh fetch
    vi.mocked(globalThis.fetch).mockClear();

    const evictedResponse = { jsonrpc: '2.0', id: 1, result: '0xre-fetched' };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(evictedResponse)
    );

    const bodyEvicted = rpcBody('starknet_call', [{ index: 0 }]);
    const requestEvicted = createRpcRequest(bodyEvicted);
    const response = await POST(requestEvicted);
    const data = await response.json();

    // The evicted entry had to be fetched again
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(data.result).toBe('0xre-fetched');

    // Entry #2 should still be cached — entry #1 was evicted when entry #0
    // was re-added (re-adding #0 pushes cache back to 1000, evicting the
    // new oldest key which is #1).
    vi.mocked(globalThis.fetch).mockClear();
    const bodyCached = rpcBody('starknet_call', [{ index: 2 }]);
    const requestCached = createRpcRequest(bodyCached);
    const responseCached = await POST(requestCached);
    const dataCached = await responseCached.json();

    // Should come from cache without fetching
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
    expect(dataCached.result).toBe('0x2');
  });

  // ===== Read-only method coverage =====

  it('caches starknet_getStorageAt responses', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xstorage' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_getStorageAt', ['0x1', '0x2', 'latest']);

    // First call
    const request1 = createRpcRequest(body);
    await POST(request1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    // Second call — from cache
    const request2 = createRpcRequest(body);
    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(data2.result).toBe('0xstorage');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('caches starknet_getTransactionByHash responses', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { transaction_hash: '0xabc' },
    };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_getTransactionByHash', ['0xabc']);

    const request1 = createRpcRequest(body);
    await POST(request1);

    const request2 = createRpcRequest(body);
    await POST(request2);

    // Only one fetch call — second was cached
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  // ===== Different params produce different cache keys =====

  it('does not return cached data for different params on same method', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const response1 = { jsonrpc: '2.0', id: 1, result: '0xfirst' };
    const response2 = { jsonrpc: '2.0', id: 1, result: '0xsecond' };

    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(response1)
    );

    // Call with params A
    const bodyA = rpcBody('starknet_call', [{ contract_address: '0xA' }]);
    const requestA = createRpcRequest(bodyA);
    const resA = await POST(requestA);
    const dataA = await resA.json();
    expect(dataA.result).toBe('0xfirst');

    // Call with params B — different cache key
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(response2)
    );
    const bodyB = rpcBody('starknet_call', [{ contract_address: '0xB' }]);
    const requestB = createRpcRequest(bodyB);
    const resB = await POST(requestB);
    const dataB = await resB.json();

    expect(dataB.result).toBe('0xsecond');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  // ===== DELETE clears cache =====

  it('DELETE /api/rpc clears the cache', async () => {
    vi.resetModules();
    const { POST, DELETE } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xcached_val' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = rpcBody('starknet_call', [{ contract_address: '0xDEL' }]);

    // Populate cache
    const request1 = createRpcRequest(body);
    await POST(request1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);

    // Clear cache via DELETE
    const delResponse = await DELETE();
    const delData = await delResponse.json();
    expect(delData).toEqual({ cleared: true });

    // Next call should miss cache and fetch fresh
    const freshResponse = { jsonrpc: '2.0', id: 1, result: '0xfresh' };
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockFetchResponse(freshResponse)
    );
    const request2 = createRpcRequest(body);
    const response2 = await POST(request2);
    const data2 = await response2.json();

    expect(data2.result).toBe('0xfresh');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });

  // ===== Request body without method =====

  it('forwards request without method field and does not cache', async () => {
    vi.resetModules();
    const { POST } = await import('@/app/api/rpc/route');

    const rpcResponse = { jsonrpc: '2.0', id: 1, result: '0xnomethod' };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockFetchResponse(rpcResponse)
    );

    const body = { jsonrpc: '2.0', id: 1 };
    const request1 = createRpcRequest(body);
    await POST(request1);

    const request2 = createRpcRequest(body);
    await POST(request2);

    // No caching for requests without method — both calls hit the RPC
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
  });
});
