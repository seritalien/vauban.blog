import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted() so variables are available inside vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockVerify,
  mockAddCommentWithSessionKey,
  mockWaitForTransaction,
  mockComputeHashOnElements,
  mockEventBusEmit,
} = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockAddCommentWithSessionKey: vi.fn(),
  mockWaitForTransaction: vi.fn(),
  mockComputeHashOnElements: vi.fn().mockReturnValue('0xmessagehash'),
  mockEventBusEmit: vi.fn(),
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
    ec: { starkCurve: { verify: mockVerify } },
    hash: { computeHashOnElements: mockComputeHashOnElements },
  };
});

vi.mock('@/abis/social.json', () => ({
  default: { abi: [] },
}));

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: mockEventBusEmit },
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

async function importRoute(envOverrides: Record<string, string | undefined> = {}) {
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
    }
    return {
      Account: MockAccount,
      RpcProvider: MockRpcProvider,
      Contract: MockContract,
      ec: { starkCurve: { verify: mockVerify } },
      hash: { computeHashOnElements: mockComputeHashOnElements },
    };
  });

  vi.doMock('@/abis/social.json', () => ({
    default: { abi: [] },
  }));

  vi.doMock('@/lib/event-bus', () => ({
    eventBus: { emit: mockEventBusEmit },
  }));

  return await import('@/app/api/relay/comment/route');
}

// ---------------------------------------------------------------------------
// Tests — eventBus emission
// ---------------------------------------------------------------------------

describe('POST /api/relay/comment — eventBus integration', () => {
  it('emits comment:added event after successful transaction', async () => {
    const { POST } = await importRoute();
    const body = validBody();

    const response = await POST(createRequest(body));
    expect(response.status).toBe(200);

    expect(mockEventBusEmit).toHaveBeenCalledTimes(1);
    expect(mockEventBusEmit).toHaveBeenCalledWith('comment:added', {
      postId: '1',
      author: '0xuser123',
    });
  });

  it('does not emit event when signature is invalid (production)', async () => {
    const { POST } = await importRoute({ NODE_ENV: 'production' });
    mockVerify.mockReturnValue(false);

    const response = await POST(createRequest(validBody()));
    expect(response.status).toBe(401);

    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('does not emit event when contract call fails', async () => {
    const { POST } = await importRoute();
    mockAddCommentWithSessionKey.mockRejectedValueOnce(
      new Error('Execution reverted')
    );

    const response = await POST(createRequest(validBody()));
    expect(response.status).toBe(500);

    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('does not emit event when waitForTransaction fails', async () => {
    const { POST } = await importRoute();
    mockWaitForTransaction.mockRejectedValueOnce(
      new Error('Transaction rejected')
    );

    const response = await POST(createRequest(validBody()));
    expect(response.status).toBe(500);

    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('does not emit event when validation fails (missing fields)', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    delete body.postId;

    const response = await POST(createRequest(body));
    expect(response.status).toBe(400);

    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('emits event with correct postId for different posts', async () => {
    const { POST } = await importRoute();
    const body = validBody();
    body.postId = '42';
    body.userAddress = '0xother';

    const response = await POST(createRequest(body));
    expect(response.status).toBe(200);

    expect(mockEventBusEmit).toHaveBeenCalledWith('comment:added', {
      postId: '42',
      author: '0xother',
    });
  });
});
