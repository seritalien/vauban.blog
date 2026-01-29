import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted() so variables are available inside vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockVerify,
  mockAddCommentWithSessionKey,
  mockWaitForTransaction,
  mockComputeHashOnElements,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockAddCommentWithSessionKey: vi.fn(),
  mockWaitForTransaction: vi.fn(),
  mockComputeHashOnElements: vi.fn().mockReturnValue('0xmessagehash'),
}));

vi.mock('starknet', () => {
  class MockAccount {}
  class MockRpcProvider {
    waitForTransaction = mockWaitForTransaction;
  }
  class MockContract {
    add_comment_with_session_key = mockAddCommentWithSessionKey;
  }
  return {
    Account: MockAccount,
    RpcProvider: MockRpcProvider,
    Contract: MockContract,
    ec: {
      starkCurve: {
        verify: mockVerify,
      },
    },
    hash: {
      computeHashOnElements: mockComputeHashOnElements,
    },
  };
});

vi.mock('@/abis/social.json', () => ({
  default: { abi: [] },
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockReturnValue(true);
  mockAddCommentWithSessionKey.mockResolvedValue({
    transaction_hash: '0xtxhash123',
  });
  mockWaitForTransaction.mockResolvedValue({});
});

afterEach(() => {
  process.env = { ...originalEnv };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/relay/comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function validBody(): Record<string, unknown> {
  return {
    postId: '1',
    contentHash: '0xabcdef',
    sessionPublicKey: '0xpubkey',
    userAddress: '0xuser123',
    signature: '0xsig123',
    nonce: 1,
  };
}

/**
 * Import the route module with SOCIAL_ADDRESS set.
 * Since SOCIAL_ADDRESS is captured at module level, we need to
 * set env before importing.
 */
async function importRoute(envOverrides: Record<string, string | undefined> = {}) {
  // Set default SOCIAL_ADDRESS unless overridden
  if (!('NEXT_PUBLIC_SOCIAL_ADDRESS' in envOverrides)) {
    process.env.NEXT_PUBLIC_SOCIAL_ADDRESS = '0xsocial123';
  }
  if (!('NODE_ENV' in envOverrides)) {
    vi.stubEnv('NODE_ENV', 'test');
  }

  for (const [k, v] of Object.entries(envOverrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  vi.resetModules();

  vi.doMock('starknet', () => {
    class MockAccount {}
    class MockRpcProvider {
      waitForTransaction = mockWaitForTransaction;
    }
    class MockContract {
      add_comment_with_session_key = mockAddCommentWithSessionKey;
      constructor(_abi: unknown, _addr: unknown, _account: unknown) {
        // Store the constructor params if needed
      }
    }
    return {
      Account: MockAccount,
      RpcProvider: MockRpcProvider,
      Contract: MockContract,
      ec: {
        starkCurve: {
          verify: mockVerify,
        },
      },
      hash: {
        computeHashOnElements: mockComputeHashOnElements,
      },
    };
  });

  vi.doMock('@/abis/social.json', () => ({
    default: { abi: [] },
  }));

  return await import('@/app/api/relay/comment/route');
}

// ---------------------------------------------------------------------------
// Tests — POST
// ---------------------------------------------------------------------------

describe('POST /api/relay/comment', () => {
  // ===== Validation =====

  it('returns 400 when postId is missing', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    delete body.postId;
    const response = await POST(createRequest(body));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required fields');
  });

  it('returns 400 when contentHash is missing', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    delete body.contentHash;
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
  });

  it('returns 400 when sessionPublicKey is missing', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    delete body.sessionPublicKey;
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
  });

  it('returns 400 when userAddress is missing', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    delete body.userAddress;
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
  });

  it('returns 400 when signature is missing', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    delete body.signature;
    const response = await POST(createRequest(body));

    expect(response.status).toBe(400);
  });

  // ===== Social contract not configured =====

  it('returns 500 when social contract address is not set', async () => {
    const { POST } = await importRoute({
      NEXT_PUBLIC_SOCIAL_ADDRESS: undefined,
    });

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Social contract address not configured');
  });

  // ===== Signature validation =====

  it('returns 401 when signature is invalid in production', async () => {
    const { POST } = await importRoute({ NODE_ENV: 'production' });
    mockVerify.mockReturnValue(false);

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Invalid signature');
  });

  it('allows invalid signature in non-production mode (dev/test)', async () => {
    const { POST } = await importRoute({ NODE_ENV: 'test' });
    mockVerify.mockImplementation(() => {
      throw new Error('verification error');
    });

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 401 when signature verification throws in production', async () => {
    const { POST } = await importRoute({ NODE_ENV: 'production' });
    mockVerify.mockImplementation(() => {
      throw new Error('Crypto error');
    });

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain('Signature verification failed');
  });

  // ===== Happy path =====

  it('relays comment and returns transaction hash', async () => {
    const { POST } = await importRoute();

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.transactionHash).toBe('0xtxhash123');
    expect(data.message).toContain('gasless');
  });

  it('passes correct arguments to contract call', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    body.parentCommentId = '42';
    await POST(createRequest(body));

    expect(mockAddCommentWithSessionKey).toHaveBeenCalledWith(
      '1',
      '0xabcdef',
      '42',
      '0xpubkey',
      '0xuser123',
      1
    );
  });

  it('uses "0" as default parentCommentId when not provided', async () => {
    const { POST } = await importRoute();
    await POST(createRequest(validBody()));

    expect(mockAddCommentWithSessionKey).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      '0',
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });

  it('waits for transaction confirmation', async () => {
    const { POST } = await importRoute();
    await POST(createRequest(validBody()));

    expect(mockWaitForTransaction).toHaveBeenCalledWith('0xtxhash123');
  });

  // ===== Contract execution failure =====

  it('returns 500 when contract call fails', async () => {
    const { POST } = await importRoute();
    mockAddCommentWithSessionKey.mockRejectedValueOnce(
      new Error('Execution reverted')
    );

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to relay comment');
    expect(data.message).toBe('Execution reverted');
  });

  it('returns 500 when waitForTransaction fails', async () => {
    const { POST } = await importRoute();
    mockWaitForTransaction.mockRejectedValueOnce(
      new Error('Transaction rejected')
    );

    const response = await POST(createRequest(validBody()));
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to relay comment');
  });
});

// ---------------------------------------------------------------------------
// Tests — GET
// ---------------------------------------------------------------------------

describe('GET /api/relay/comment', () => {
  it('returns health check with status ok', async () => {
    const { GET } = await importRoute();
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('returns truncated relayer address', async () => {
    const { GET } = await importRoute();
    const response = await GET();
    const data = await response.json();

    expect(data.relayer).toContain('...');
  });

  it('returns truncated social contract address', async () => {
    const { GET } = await importRoute();
    const response = await GET();
    const data = await response.json();

    expect(data.socialContract).toContain('...');
  });
});
