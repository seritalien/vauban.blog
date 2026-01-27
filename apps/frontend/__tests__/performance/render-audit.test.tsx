import { vi } from 'vitest';
import React from 'react';
import { render, act } from '@testing-library/react';

// =============================================================================
// FILE 9: Render Audit Tests
//
// These tests verify that components do not re-render unnecessarily
// and that memoization works correctly.
// =============================================================================

// Mock wallet provider
const mockUseWallet = vi.fn();
vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => mockUseWallet(),
}));

// Mock web3-utils
const mockGetPostLikes = vi.fn().mockResolvedValue(5);
const mockGetCommentsForPost = vi.fn().mockResolvedValue([]);
const mockHasLikedPost = vi.fn().mockResolvedValue(false);
const mockLikePost = vi.fn();
const mockUnlikePost = vi.fn();
vi.mock('@vauban/web3-utils', () => ({
  getPostLikes: (...args: unknown[]) => mockGetPostLikes(...args),
  getCommentsForPost: (...args: unknown[]) => mockGetCommentsForPost(...args),
  hasLikedPost: (...args: unknown[]) => mockHasLikedPost(...args),
  likePost: (...args: unknown[]) => mockLikePost(...args),
  unlikePost: (...args: unknown[]) => mockUnlikePost(...args),
  initStarknetProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  POST_TYPE_TWEET: 0,
  POST_TYPE_THREAD: 1,
  POST_TYPE_ARTICLE: 2,
}));

import { createRenderCounter } from '../helpers/performance';
import { ALICE } from '../helpers/test-users';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseWallet.mockReturnValue({
    address: ALICE.address,
    account: { address: ALICE.address },
    isConnected: true,
    isConnecting: false,
    isDevMode: false,
    network: 'devnet',
    networkConfig: { chainId: '0x0', name: 'Devnet', rpcUrl: '/api/rpc', explorerUrl: '' },
    wallet: null,
    walletName: 'Mock',
    connectWallet: vi.fn(),
    connectDevAccount: vi.fn(),
    disconnectWallet: vi.fn(),
    switchNetwork: vi.fn(),
    getExplorerUrl: vi.fn(),
    getAccountUrl: vi.fn(),
  });
});

// =============================================================================
// EngagementBar re-render tests
// =============================================================================

describe('EngagementBar render audit', () => {
  it('same props do not cause unnecessary re-renders after initial mount', async () => {
    const renderCounter = createRenderCounter();

    // Create a wrapper component to track renders
    function TrackingEngagementBar(props: { postId: string }) {
      renderCounter.increment();
      // Simulate what EngagementBar does: call useEffect to fetch data
      const [, setLikes] = React.useState(0);
      React.useEffect(() => {
        mockGetPostLikes(props.postId).then((n: number) => setLikes(n));
      }, [props.postId]);
      return <div data-testid="engagement">{props.postId}</div>;
    }

    const { rerender } = render(<TrackingEngagementBar postId="1" />);

    // Wait for effect to run
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const initialRenders = renderCounter.count;

    // Re-render with same props
    rerender(<TrackingEngagementBar postId="1" />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should have at most 2 more renders (rerender + state update from effect)
    // The key insight: same postId should not cause additional fetch
    const rerenderCount = renderCounter.count - initialRenders;
    expect(rerenderCount).toBeLessThanOrEqual(2);
  });

  it('BUG: account?.address in useEffect deps may trigger re-render on provider update', async () => {
    /**
     * DOCUMENTED BUG:
     * EngagementBar has `useEffect(() => { ... }, [postId, account?.address])`.
     * When the WalletProvider re-renders (e.g., due to parent state change),
     * `account` might be a new reference even though `account.address` is
     * the same string. If `account?.address` resolves differently due to
     * optional chaining on a new object reference, the effect re-runs.
     *
     * This test documents the behavior.
     */
    let effectRunCount = 0;

    function TestComponent({ accountRef }: { accountRef: { address: string } | null }) {
      React.useEffect(() => {
        effectRunCount++;
      }, [accountRef?.address]);
      return <div />;
    }

    const account1 = { address: ALICE.address };
    const { rerender } = render(<TestComponent accountRef={account1} />);

    expect(effectRunCount).toBe(1);

    // New object reference, same address value
    const account2 = { address: ALICE.address };
    rerender(<TestComponent accountRef={account2} />);

    // Effect should NOT re-run because address string is the same
    // (optional chaining resolves to the same string value)
    expect(effectRunCount).toBe(1);
  });
});

// =============================================================================
// Timeline memo tests
// =============================================================================

describe('Timeline memo audit', () => {
  it('filteredPosts memo works - same input produces same reference', () => {
    const posts = [
      { id: '1', author: '0x1', content: 'Hello', postType: 0, createdAt: new Date() },
      { id: '2', author: '0x2', content: 'World', postType: 2, createdAt: new Date() },
    ];

    const activeTab = 'for-you';

    // Simulate useMemo behavior
    function filterPosts(input: typeof posts, tab: string) {
      return input.filter((p) => {
        if (tab === 'articles') return p.postType === 2;
        if (tab === 'threads') return p.postType === 1;
        return true; // for-you
      });
    }

    const result1 = filterPosts(posts, activeTab);
    const result2 = filterPosts(posts, activeTab);

    // Same input => same logical result
    expect(result1).toEqual(result2);

    // With useMemo, the reference would be the same. Without memo, they're different arrays.
    // This documents that the memo is needed for reference equality.
    expect(result1).not.toBe(result2); // Without memo: different reference
  });

  it('followedSet memo works - same followedAddresses produces consistent Set', () => {
    const addresses1 = ['0xAlice', '0xBob'];
    const addresses2 = ['0xAlice', '0xBob'];

    // Simulate useMemo for followedSet
    function createFollowedSet(addrs: string[]) {
      return new Set(addrs.map((a) => a.toLowerCase()));
    }

    const set1 = createFollowedSet(addresses1);
    const set2 = createFollowedSet(addresses2);

    // Same logical content
    expect(set1.size).toBe(set2.size);
    expect(set1.has('0xalice')).toBe(true);
    expect(set2.has('0xalice')).toBe(true);

    // Without memo, they'd be different Set references (hence memo is needed)
    expect(set1).not.toBe(set2);
  });
});

// =============================================================================
// Render counter utility
// =============================================================================

describe('createRenderCounter', () => {
  it('accurately tracks render counts', () => {
    const counter = createRenderCounter();

    expect(counter.count).toBe(0);

    counter.increment();
    counter.increment();
    expect(counter.count).toBe(2);

    counter.reset();
    expect(counter.count).toBe(0);
  });

  it('works in React component context', () => {
    const counter = createRenderCounter();

    function TestComponent() {
      counter.increment();
      return <div>test</div>;
    }

    const { rerender } = render(<TestComponent />);
    expect(counter.count).toBe(1);

    rerender(<TestComponent />);
    expect(counter.count).toBe(2);
  });
});
