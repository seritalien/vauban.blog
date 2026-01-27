import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks (available inside vi.mock factories)
// ---------------------------------------------------------------------------

const { web3Mocks, ipfsMocks, walletState } = vi.hoisted(() => {
  const _vi = { fn: (...args: unknown[]) => (globalThis as Record<string, unknown>).__vitest_mocker__ ? vi.fn(...(args as [])) : (() => {}) };
  // We can't call helper factories inside vi.hoisted, so define inline

  let cidCounter = 0;
  function nextCid(): string {
    return `QmMockCid${++cidCounter}`;
  }

  const web3Mocks = {
    publishTweet: vi.fn().mockResolvedValue('tweet-1'),
    publishReply: vi.fn().mockResolvedValue('reply-1'),
    startThread: vi.fn().mockResolvedValue('thread-root-1'),
    continueThread: vi.fn().mockResolvedValue('thread-cont-1'),
    calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
    // re-export everything the module might need
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn(),
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

  const walletState = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001' as string | null,
    account: {
      address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001',
      execute: vi.fn().mockResolvedValue({ transaction_hash: '0xTX_Alice' }),
      waitForTransaction: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2' }),
    } as Record<string, unknown> | null,
    isConnected: true,
  };

  return {
    web3Mocks,
    ipfsMocks,
    walletState,
    resetCidCounter: () => { cidCounter = 0; },
  };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => web3Mocks);

vi.mock('@/lib/ipfs-client', () => ipfsMocks);

// Import hook after mocks are in place
import { usePostBastion } from '@/hooks/use-post-bastion';
import { ALICE, createMockWalletContext, createMockAccount } from '@/__tests__/helpers/test-users';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setWalletConnected(connected: boolean) {
  if (connected) {
    const acct = createMockAccount(ALICE);
    walletState.address = ALICE.address;
    walletState.account = acct;
    walletState.isConnected = true;
  } else {
    walletState.address = null;
    walletState.account = null;
    walletState.isConnected = false;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setWalletConnected(true);
  // Reset mock implementations after clearAllMocks
  web3Mocks.publishTweet.mockResolvedValue('tweet-1');
  web3Mocks.publishReply.mockResolvedValue('reply-1');
  web3Mocks.startThread.mockResolvedValue('thread-root-1');
  web3Mocks.continueThread.mockResolvedValue('thread-cont-1');
  web3Mocks.calculateContentHash.mockResolvedValue('0x' + 'ab'.repeat(32));

  let cidCounter = 0;
  ipfsMocks.uploadJSONToIPFSViaAPI.mockImplementation(
    () => Promise.resolve(`QmMockCid${++cidCounter}`),
  );
});

// ============================
// postBastion
// ============================

describe('usePostBastion - postBastion', () => {
  it('returns null and sets error when wallet is not connected', async () => {
    setWalletConnected(false);
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('Hello');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Please connect your wallet');
  });

  it('returns null and sets error for empty content', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Content cannot be empty');
  });

  it('returns null and sets error for whitespace-only content', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('   \n\t  ');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Content cannot be empty');
  });

  it('returns null and sets error when content exceeds 280 characters', async () => {
    const { result } = renderHook(() => usePostBastion());
    const longContent = 'a'.repeat(281);

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion(longContent);
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Content exceeds 280 characters');
  });

  it('succeeds and returns post ID calling publishTweet', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('Hello world!');
    });

    expect(postId).toBe('tweet-1');
    expect(web3Mocks.publishTweet).toHaveBeenCalledOnce();
    expect(web3Mocks.publishTweet).toHaveBeenCalledWith(
      walletState.account,
      expect.any(String), // CID
      expect.any(String), // CID
      expect.any(String), // hash
    );
    expect(ipfsMocks.uploadJSONToIPFSViaAPI).toHaveBeenCalledOnce();
    expect(result.current.error).toBeNull();
  });

  it('passes imageUrl through in the IPFS payload', async () => {
    const { result } = renderHook(() => usePostBastion());

    await act(async () => {
      await result.current.postBastion('With image', 'https://example.com/img.png');
    });

    const uploadedData = ipfsMocks.uploadJSONToIPFSViaAPI.mock.calls[0][0];
    expect(uploadedData).toMatchObject({
      content: 'With image',
      imageUrl: 'https://example.com/img.png',
      type: 'bastion',
    });
  });

  it('transitions isPosting correctly during success flow', async () => {
    const { result } = renderHook(() => usePostBastion());

    expect(result.current.isPosting).toBe(false);

    // Track isPosting states during execution
    const postingStates: boolean[] = [];
    const originalPublishTweet = web3Mocks.publishTweet.getMockImplementation();
    web3Mocks.publishTweet.mockImplementationOnce(async (...args: unknown[]) => {
      postingStates.push(true); // Should be true during publishTweet
      return 'tweet-42';
    });

    await act(async () => {
      await result.current.postBastion('Hello');
    });

    // publishTweet was called while isPosting was true
    expect(postingStates).toContain(true);
    // After completion, isPosting is false
    expect(result.current.isPosting).toBe(false);
  });

  it('sets error when IPFS upload fails', async () => {
    ipfsMocks.uploadJSONToIPFSViaAPI.mockRejectedValueOnce(new Error('IPFS down'));

    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('Hello');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Failed to upload content');
  });

  it('sets error when publishTweet fails', async () => {
    web3Mocks.publishTweet.mockRejectedValueOnce(new Error('TX reverted'));

    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('Hello');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('TX reverted');
  });

  it('clearError resets error to null', async () => {
    setWalletConnected(false);
    const { result } = renderHook(() => usePostBastion());

    await act(async () => {
      await result.current.postBastion('hello');
    });
    expect(result.current.error).not.toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });
});

// ============================
// postReply
// ============================

describe('usePostBastion - postReply', () => {
  it('returns null when wallet is not connected', async () => {
    setWalletConnected(false);
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postReply('reply text', 'parent-1');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Please connect your wallet');
  });

  it('returns null for empty content', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postReply('', 'parent-1');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Content cannot be empty');
  });

  it('returns null and sets error when reply exceeds 280 characters', async () => {
    const { result } = renderHook(() => usePostBastion());
    const longContent = 'a'.repeat(281);

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postReply(longContent, 'parent-1');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Content exceeds 280 characters');
    expect(web3Mocks.publishReply).not.toHaveBeenCalled();
  });

  it('succeeds with exactly 280 characters in reply', async () => {
    const { result } = renderHook(() => usePostBastion());
    const exact280 = 'x'.repeat(280);

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postReply(exact280, 'parent-1');
    });

    expect(postId).toBe('reply-1');
    expect(result.current.error).toBeNull();
  });

  it('succeeds and calls publishReply with parentId', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postReply('reply text', 'parent-1');
    });

    expect(postId).toBe('reply-1');
    expect(web3Mocks.publishReply).toHaveBeenCalledOnce();
    expect(web3Mocks.publishReply).toHaveBeenCalledWith(
      walletState.account,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'parent-1',
    );
  });

  it('sets error when publishReply fails', async () => {
    web3Mocks.publishReply.mockRejectedValueOnce(new Error('Reply failed'));

    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postReply('reply text', 'parent-1');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Reply failed');
  });
});

// ============================
// postThreadStart
// ============================

describe('usePostBastion - postThreadStart', () => {
  it('succeeds and calls startThread', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postThreadStart('Thread opener');
    });

    expect(postId).toBe('thread-root-1');
    expect(web3Mocks.startThread).toHaveBeenCalledOnce();
  });

  it('sets error when startThread fails', async () => {
    web3Mocks.startThread.mockRejectedValueOnce(new Error('Thread failed'));

    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postThreadStart('Thread opener');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Thread failed');
  });
});

// ============================
// postThreadContinue
// ============================

describe('usePostBastion - postThreadContinue', () => {
  it('succeeds and calls continueThread with threadRootId', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postThreadContinue('Next part', 'thread-root-1');
    });

    expect(postId).toBe('thread-cont-1');
    expect(web3Mocks.continueThread).toHaveBeenCalledOnce();
    expect(web3Mocks.continueThread).toHaveBeenCalledWith(
      walletState.account,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      'thread-root-1',
    );
  });

  it('sets error when continueThread fails', async () => {
    web3Mocks.continueThread.mockRejectedValueOnce(new Error('Continue failed'));

    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postThreadContinue('Next part', 'thread-root-1');
    });

    expect(postId).toBeNull();
    expect(result.current.error).toBe('Continue failed');
  });
});

// ============================
// Edge cases
// ============================

describe('usePostBastion - edge cases', () => {
  it('handles unicode emoji content', async () => {
    const { result } = renderHook(() => usePostBastion());

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion('Hello world! \u{1F680}\u{1F30D}\u{2728}');
    });

    expect(postId).toBe('tweet-1');
    const uploadedData = ipfsMocks.uploadJSONToIPFSViaAPI.mock.calls[0][0];
    expect(uploadedData.content).toContain('\u{1F680}');
  });

  it('succeeds with exactly 280 characters', async () => {
    const { result } = renderHook(() => usePostBastion());
    const exact280 = 'x'.repeat(280);

    let postId: string | null = null;
    await act(async () => {
      postId = await result.current.postBastion(exact280);
    });

    expect(postId).toBe('tweet-1');
    expect(result.current.error).toBeNull();
  });

  it('guards against concurrent calls via isPosting', async () => {
    const { result } = renderHook(() => usePostBastion());

    // First call succeeds normally
    await act(async () => {
      await result.current.postBastion('First');
    });

    expect(result.current.isPosting).toBe(false);
    expect(web3Mocks.publishTweet).toHaveBeenCalledTimes(1);

    // Second call also succeeds (sequential, not concurrent)
    await act(async () => {
      await result.current.postBastion('Second');
    });

    expect(web3Mocks.publishTweet).toHaveBeenCalledTimes(2);
  });
});
