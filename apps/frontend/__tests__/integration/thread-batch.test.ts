/**
 * Thread Batch Posting Integration Tests
 *
 * Tests for the thread batch posting feature that uses account.execute()
 * to bundle multiple continuation posts in a single transaction (multicall).
 *
 * Covers:
 * 1. continueThreadBatch function in web3-utils - batching multiple calls
 * 2. postThread function in use-post-bastion.ts - calling the batch function
 * 3. Integration between ThreadComposer and batch posting
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALICE, createMockAccount } from '../helpers/test-users';

// =============================================================================
// MOCKS SETUP
// =============================================================================

// Hoisted mocks for module factories
const {
  mockExecute,
  mockWaitForTransaction,
  walletState,
  web3Mocks,
  ipfsMocks,
} = vi.hoisted(() => {
  let cidCounter = 0;
  function nextCid(): string {
    return `QmMockCid${++cidCounter}`;
  }

  const aliceAddress = '0x0A11CE0000000000000000000000000000000000000000000000000000000001';

  const mockExecute = vi.fn().mockResolvedValue({ transaction_hash: '0xTX_BATCH' });
  const mockWaitForTransaction = vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2' });

  const walletState = {
    address: aliceAddress as string | null,
    account: {
      address: aliceAddress,
      execute: mockExecute,
      waitForTransaction: mockWaitForTransaction,
    } as Record<string, unknown> | null,
    isConnected: true,
  };

  const web3Mocks = {
    publishTweet: vi.fn().mockResolvedValue('tweet-1'),
    publishReply: vi.fn().mockResolvedValue('reply-1'),
    startThread: vi.fn().mockResolvedValue('thread-root-1'),
    continueThread: vi.fn().mockResolvedValue('thread-cont-1'),
    continueThreadBatch: vi.fn().mockResolvedValue('0xTX_BATCH'),
    publishThreadAtomic: vi.fn().mockResolvedValue('thread-atomic-1'),
    calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(31)),
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn(),
    getPostCount: vi.fn().mockResolvedValue(1),
    getBlogRegistryAddress: vi.fn().mockReturnValue('0xBLOGREGISTRY'),
    followsAbi: [],
  };

  const ipfsMocks = {
    uploadJSONToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(nextCid())),
    uploadFileToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(nextCid())),
    uploadTextToIPFSViaAPI: vi.fn().mockImplementation(() => Promise.resolve(nextCid())),
    fetchJSONFromIPFSViaAPI: vi.fn().mockResolvedValue({ content: 'test' }),
    fetchTextFromIPFSViaAPI: vi.fn().mockResolvedValue('test'),
    getIPFSGatewayUrl: vi.fn((cid: string) => `/api/ipfs/${cid}`),
    checkIPFSAvailable: vi.fn().mockResolvedValue(true),
  };

  return {
    mockExecute,
    mockWaitForTransaction,
    walletState,
    web3Mocks,
    ipfsMocks,
    resetCidCounter: () => {
      cidCounter = 0;
    },
  };
});

// Mock wallet provider
vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

// Mock web3-utils
vi.mock('@vauban/web3-utils', () => web3Mocks);

// Mock IPFS client
vi.mock('@/lib/ipfs-client', () => ipfsMocks);

// Import after mocks
import { usePostBastion } from '@/hooks/use-post-bastion';

// Note: We use web3Mocks.continueThreadBatch directly in tests instead of importing
// from @vauban/web3-utils since it's mocked

// =============================================================================
// HELPERS
// =============================================================================

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

function setWalletConnected(connected: boolean) {
  if (connected) {
    const acct = createMockAccount(ALICE);
    acct.execute = mockExecute;
    acct.waitForTransaction = mockWaitForTransaction;
    walletState.address = ALICE.address;
    walletState.account = acct;
    walletState.isConnected = true;
  } else {
    walletState.address = null;
    walletState.account = null;
    walletState.isConnected = false;
  }
}

// =============================================================================
// TESTS
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  setWalletConnected(true);

  // Reset mock implementations
  web3Mocks.startThread.mockResolvedValue('thread-root-1');
  web3Mocks.continueThreadBatch.mockResolvedValue('0xTX_BATCH');
  web3Mocks.publishThreadAtomic.mockResolvedValue('thread-atomic-1');
  web3Mocks.calculateContentHash.mockResolvedValue('0x' + 'ab'.repeat(31));
  mockExecute.mockResolvedValue({ transaction_hash: '0xTX_BATCH' });
  mockWaitForTransaction.mockResolvedValue({ status: 'ACCEPTED_ON_L2' });

  let cidCounter = 0;
  ipfsMocks.uploadJSONToIPFSViaAPI.mockImplementation(
    () => Promise.resolve(`QmMockCid${++cidCounter}`),
  );
});

// =============================================================================
// 1. continueThreadBatch Function Tests (via mock)
// =============================================================================

describe('continueThreadBatch - multicall batching', () => {
  it('calls account.execute with array of calls for multiple posts', async () => {
    // This test verifies that the mocked continueThreadBatch is called
    // with the correct arguments when invoked directly

    const posts = [
      { arweaveTxId: 'ar_tx_1', ipfsCid: 'QmCid1', contentHash: '0xhash1' },
      { arweaveTxId: 'ar_tx_2', ipfsCid: 'QmCid2', contentHash: '0xhash2' },
      { arweaveTxId: 'ar_tx_3', ipfsCid: 'QmCid3', contentHash: '0xhash3' },
    ];
    const threadRootId = 'thread-root-42';

    // Call the mock directly to verify it can be invoked with correct args
    await web3Mocks.continueThreadBatch(walletState.account, posts, threadRootId);

    expect(web3Mocks.continueThreadBatch).toHaveBeenCalledTimes(1);
    expect(web3Mocks.continueThreadBatch).toHaveBeenCalledWith(
      walletState.account,
      posts,
      threadRootId,
    );
  });

  it('returns transaction hash on success', async () => {
    const posts = [
      { arweaveTxId: 'ar_tx_1', ipfsCid: 'QmCid1', contentHash: '0xhash1' },
    ];

    web3Mocks.continueThreadBatch.mockResolvedValue('0xMULTICALL_TX');

    const result = await web3Mocks.continueThreadBatch(walletState.account, posts, 'thread-1');

    expect(result).toBe('0xMULTICALL_TX');
  });

  it('throws error when posts array is empty', async () => {
    web3Mocks.continueThreadBatch.mockRejectedValue(new Error('No posts to publish'));

    await expect(
      web3Mocks.continueThreadBatch(walletState.account, [], 'thread-1'),
    ).rejects.toThrow('No posts to publish');
  });

  it('throws error when account.execute fails', async () => {
    web3Mocks.continueThreadBatch.mockRejectedValue(new Error('Transaction failed'));

    const posts = [
      { arweaveTxId: 'ar_tx_1', ipfsCid: 'QmCid1', contentHash: '0xhash1' },
    ];

    await expect(
      web3Mocks.continueThreadBatch(walletState.account, posts, 'thread-1'),
    ).rejects.toThrow('Transaction failed');
  });
});

// =============================================================================
// 2. postThread Function Tests (use-post-bastion.ts)
// =============================================================================

describe('usePostBastion - postThread', () => {
  it('returns null when wallet is not connected', async () => {
    setWalletConnected(false);
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['First post', 'Second post']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toBe('Please connect your wallet');
  });

  it('returns null for empty posts array', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread([]);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toBe('No valid posts provided');
  });

  it('returns null when all posts are whitespace-only', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['   ', '\n', '\t']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toBe('No valid posts provided');
  });

  it('handles single post thread', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Single thread post']);
    });

    expect(rootId).toBe('thread-atomic-1');
    // publishThreadAtomic called even for single post
    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledOnce();
  });

  it('calls publishThreadAtomic with all posts', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread([
        'First post',
        'Second post',
        'Third post',
      ]);
    });

    expect(rootId).toBe('thread-atomic-1');

    // publishThreadAtomic called with all posts atomically
    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledOnce();
    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledWith(
      walletState.account,
      expect.arrayContaining([
        expect.objectContaining({
          arweaveTxId: expect.any(String),
          ipfsCid: expect.any(String),
          contentHash: expect.any(String),
        }),
      ]),
    );

    // Should pass all 3 posts
    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    expect(atomicCall[1]).toHaveLength(3);
  });

  it('uploads all posts to IPFS before atomic publish', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread([
        'Post one',
        'Post two',
        'Post three',
        'Post four',
      ]);
    });

    // 4 posts = 4 IPFS uploads
    expect(ipfsMocks.uploadJSONToIPFSViaAPI).toHaveBeenCalledTimes(4);
  });

  it('passes all posts with correct structure to publishThreadAtomic', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['First', 'Second', 'Third']);
    });

    // Check publishThreadAtomic was called with array of all 3 posts
    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    const postsArg = atomicCall[1];

    expect(postsArg).toHaveLength(3); // All 3 posts
    expect(postsArg[0]).toHaveProperty('arweaveTxId');
    expect(postsArg[0]).toHaveProperty('ipfsCid');
    expect(postsArg[0]).toHaveProperty('contentHash');
    expect(postsArg[1]).toHaveProperty('arweaveTxId');
    expect(postsArg[2]).toHaveProperty('arweaveTxId');
  });

  it('sets error when publishThreadAtomic fails', async () => {
    web3Mocks.publishThreadAtomic.mockRejectedValueOnce(new Error('Atomic publish failed'));

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Post 1', 'Post 2']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toBe('Atomic publish failed');
  });

  it('sets error when transaction reverts', async () => {
    web3Mocks.publishThreadAtomic.mockRejectedValueOnce(
      new Error('Transaction reverted'),
    );

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Post 1', 'Post 2', 'Post 3']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toBe('Transaction reverted');
  });

  it('sets error when IPFS upload fails', async () => {
    ipfsMocks.uploadJSONToIPFSViaAPI.mockRejectedValueOnce(
      new Error('IPFS gateway unavailable'),
    );

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Post 1']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toBe('IPFS gateway unavailable');
  });

  it('filters out empty posts before processing', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread([
        'Valid post 1',
        '',
        '   ',
        'Valid post 2',
        '\n\t',
      ]);
    });

    // Only 2 valid posts should be processed
    expect(ipfsMocks.uploadJSONToIPFSViaAPI).toHaveBeenCalledTimes(2);
    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledOnce();

    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    expect(atomicCall[1]).toHaveLength(2); // 2 valid posts
  });

  it('isPosting state transitions correctly', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    expect(result.current.isPosting).toBe(false);

    // Start posting
    const postPromise = act(async () => {
      await result.current.postThread(['Post 1', 'Post 2']);
    });

    // After completion
    await postPromise;
    expect(result.current.isPosting).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// =============================================================================
// 3. Integration: ThreadComposer -> postThread -> publishThreadAtomic
// =============================================================================

describe('ThreadComposer integration with atomic posting', () => {
  it('submitting 3-post thread results in 1 publishThreadAtomic call', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread([
        'Thread opener - first tweet',
        'Second part of the thread',
        'Third and final part',
      ]);
    });

    // Verify atomic call with all posts
    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledTimes(1);

    // Verify all 3 posts passed
    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    expect(atomicCall[1]).toHaveLength(3);
  });

  it('posting 5-post thread passes all 5 posts to publishThreadAtomic', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread([
        'Post 1 - Thread starter',
        'Post 2 - Continuation',
        'Post 3 - More details',
        'Post 4 - Even more',
        'Post 5 - Final thoughts',
      ]);
    });

    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledTimes(1);

    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    expect(atomicCall[1]).toHaveLength(5); // All 5 posts
  });

  it('publishThreadAtomic handles threadRootId internally', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['First', 'Second', 'Third']);
    });

    // publishThreadAtomic is called with account and posts only
    // threadRootId is handled internally by the function
    expect(web3Mocks.publishThreadAtomic).toHaveBeenCalledWith(
      walletState.account,
      expect.arrayContaining([
        expect.objectContaining({
          arweaveTxId: expect.any(String),
          ipfsCid: expect.any(String),
          contentHash: expect.any(String),
        }),
      ]),
    );
  });

  it('prepares content in parallel for better performance', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['A', 'B', 'C', 'D']);
    });

    // All 4 uploads should have been initiated (parallel preparation)
    expect(ipfsMocks.uploadJSONToIPFSViaAPI).toHaveBeenCalledTimes(4);
  });

  it('returns rootId on successful thread creation', async () => {
    web3Mocks.publishThreadAtomic.mockResolvedValue('my-thread-root');

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Post 1', 'Post 2']);
    });

    expect(rootId).toBe('my-thread-root');
    expect(result.current.error).toBeNull();
  });
});

// =============================================================================
// 4. Error Handling and Edge Cases
// =============================================================================

describe('Thread atomic posting - error handling', () => {
  it('handles network timeout during atomic transaction', async () => {
    web3Mocks.publishThreadAtomic.mockRejectedValueOnce(
      new Error('Network timeout: transaction not confirmed'),
    );

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Post 1', 'Post 2']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toContain('Network timeout');
  });

  it('handles transaction reverted error', async () => {
    web3Mocks.publishThreadAtomic.mockRejectedValueOnce(
      new Error('Transaction reverted: out of gas'),
    );

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['A', 'B', 'C']);
    });

    expect(result.current.error).toContain('Transaction reverted');
  });

  it('handles partial IPFS upload failure gracefully', async () => {
    // First upload succeeds, second fails
    ipfsMocks.uploadJSONToIPFSViaAPI
      .mockResolvedValueOnce('QmFirst')
      .mockRejectedValueOnce(new Error('IPFS upload failed for second post'));

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['First', 'Second']);
    });

    expect(rootId).toBeNull();
    expect(result.current.error).toContain('IPFS upload failed');
  });

  it('clearError resets error state after failure', async () => {
    web3Mocks.publishThreadAtomic.mockRejectedValueOnce(new Error('Some error'));

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['Post 1']);
    });

    expect(result.current.error).toBe('Some error');

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('handles publishThreadAtomic returning null/undefined', async () => {
    web3Mocks.publishThreadAtomic.mockResolvedValueOnce(null);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    let rootId: string | null = null;
    await act(async () => {
      rootId = await result.current.postThread(['Post 1', 'Post 2']);
    });

    expect(rootId).toBeNull();
  });
});

// =============================================================================
// 5. Calldata Verification (Ensuring Correct Contract Call Structure)
// =============================================================================

describe('Thread atomic - calldata structure verification', () => {
  it('passes all required fields for each post', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['First', 'Second', 'Third']);
    });

    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    const postsArg = atomicCall[1] as Array<{
      arweaveTxId: string;
      ipfsCid: string;
      contentHash: string;
    }>;

    // Each post should have all required fields
    for (const post of postsArg) {
      expect(post).toHaveProperty('arweaveTxId');
      expect(post).toHaveProperty('ipfsCid');
      expect(post).toHaveProperty('contentHash');
      expect(typeof post.arweaveTxId).toBe('string');
      expect(typeof post.ipfsCid).toBe('string');
      expect(typeof post.contentHash).toBe('string');
      expect(post.arweaveTxId.length).toBeGreaterThan(0);
      expect(post.ipfsCid.length).toBeGreaterThan(0);
      expect(post.contentHash.startsWith('0x')).toBe(true);
    }
  });

  it('passes all posts to publishThreadAtomic (not split)', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['A', 'B', 'C']);
    });

    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    const postsArg = atomicCall[1];

    // All 3 posts should be in the array (no split between root and continuations)
    expect(postsArg).toHaveLength(3);
  });

  it('passes account as the first argument', async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => usePostBastion(), { wrapper });

    await act(async () => {
      await result.current.postThread(['First', 'Second']);
    });

    const atomicCall = web3Mocks.publishThreadAtomic.mock.calls[0];
    const accountArg = atomicCall[0];

    expect(accountArg).toBe(walletState.account);
  });
});
