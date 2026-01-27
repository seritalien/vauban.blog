import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALICE } from '@/__tests__/helpers/test-users';
import { setupWalletMock } from '@/__tests__/helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the component under test
// ---------------------------------------------------------------------------

const { mockLikeMutateAsync } = vi.hoisted(() => {
  return { mockLikeMutateAsync: vi.fn().mockResolvedValue('like') };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/hooks/use-engagement', () => ({
  usePostEngagement: vi.fn().mockReturnValue({ data: { likes: 0, comments: 0 } }),
  useUserLikeStatus: vi.fn().mockReturnValue({ data: false, isLoading: false }),
  useLikeMutation: vi.fn().mockReturnValue({
    mutateAsync: mockLikeMutateAsync,
    isPending: false,
  }),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useWallet } from '@/providers/wallet-provider';
import {
  usePostEngagement,
  useUserLikeStatus,
  useLikeMutation,
} from '@/hooks/use-engagement';
import EngagementBar from '../EngagementBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

function renderBar(props: Partial<React.ComponentProps<typeof EngagementBar>> = {}) {
  return render(
    <EngagementBar
      postId="post-1"
      {...props}
    />,
    { wrapper: createQueryWrapper() },
  );
}

function setConnected() {
  return setupWalletMock(useWallet as unknown as Mock, ALICE);
}

function setDisconnected() {
  return setupWalletMock(useWallet as unknown as Mock, null);
}

function mockEngagement(likes: number, comments: number) {
  (usePostEngagement as Mock).mockReturnValue({ data: { likes, comments } });
}

function mockUserLiked(liked: boolean, isLoading = false) {
  (useUserLikeStatus as Mock).mockReturnValue({ data: liked, isLoading });
}

function mockMutation(overrides: Record<string, unknown> = {}) {
  (useLikeMutation as Mock).mockReturnValue({
    mutateAsync: mockLikeMutateAsync,
    isPending: false,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EngagementBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisconnected();
    mockEngagement(0, 0);
    mockUserLiked(false);
    mockMutation();
  });

  // ===== Rendering =====

  describe('rendering', () => {
    it('renders all 4 buttons (comment, quote, like, share)', () => {
      renderBar();
      expect(screen.getByTitle('Comment')).toBeInTheDocument();
      expect(screen.getByTitle('Quote')).toBeInTheDocument();
      expect(screen.getByTitle('Like')).toBeInTheDocument();
      expect(screen.getByTitle('Share')).toBeInTheDocument();
    });

    it('shows formatted count 1000 -> "1.0K"', () => {
      mockEngagement(1000, 0);
      renderBar();
      expect(screen.getByText('1.0K')).toBeInTheDocument();
    });

    it('shows formatted count 1000000 -> "1.0M"', () => {
      mockEngagement(1000000, 0);
      renderBar();
      expect(screen.getByText('1.0M')).toBeInTheDocument();
    });

    it('compact mode hides counts', () => {
      mockEngagement(5, 3);
      renderBar({ compact: true });
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  // ===== Like =====

  describe('like', () => {
    it('like button is disabled when not connected', () => {
      setDisconnected();
      renderBar();
      const likeBtn = screen.getByTitle('Like');
      expect(likeBtn).toBeDisabled();
    });

    it('calls mutateAsync with action "like" on click when connected and not already liked', async () => {
      setConnected();
      mockUserLiked(false);
      mockEngagement(0, 0);

      renderBar();
      const likeBtn = screen.getByTitle('Like');
      await act(async () => {
        fireEvent.click(likeBtn);
      });

      expect(mockLikeMutateAsync).toHaveBeenCalledWith({ action: 'like' });
    });

    it('calls mutateAsync with action "unlike" when already liked', async () => {
      setConnected();
      mockUserLiked(true);
      mockEngagement(5, 0);

      renderBar();
      const likeBtn = screen.getByTitle('Unlike');
      await act(async () => {
        fireEvent.click(likeBtn);
      });

      expect(mockLikeMutateAsync).toHaveBeenCalledWith({ action: 'unlike' });
    });

    it('shows correct like count from engagement hook', () => {
      mockEngagement(10, 3);
      renderBar();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('shows initial likes when engagement data not yet loaded', () => {
      (usePostEngagement as Mock).mockReturnValue({ data: undefined });
      renderBar({ initialLikes: 42 });
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('prevents click while mutation is pending', async () => {
      setConnected();
      mockUserLiked(false);
      mockMutation({ isPending: true });

      renderBar();
      const likeBtn = screen.getByTitle('Like');
      expect(likeBtn).toBeDisabled();
    });

    it('stops event propagation on like click', async () => {
      setConnected();
      mockUserLiked(false);
      mockEngagement(0, 0);

      const parentHandler = vi.fn();
      render(
        <div onClick={parentHandler}>
          <EngagementBar postId="post-1" />
        </div>,
        { wrapper: createQueryWrapper() },
      );

      const likeBtn = screen.getByTitle('Like');
      await act(async () => {
        fireEvent.click(likeBtn);
      });

      expect(parentHandler).not.toHaveBeenCalled();
    });
  });

  // ===== Data source =====

  describe('data source', () => {
    it('uses engagement hook data when available', () => {
      mockEngagement(15, 7);
      renderBar();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('falls back to initialLikes/initialComments when hook returns undefined', () => {
      (usePostEngagement as Mock).mockReturnValue({ data: undefined });
      renderBar({ initialLikes: 3, initialComments: 2 });
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  // ===== Comment / Share =====

  describe('comment and share', () => {
    it('comment button calls onComment', () => {
      const onComment = vi.fn();
      renderBar({ onComment });
      fireEvent.click(screen.getByTitle('Comment'));
      expect(onComment).toHaveBeenCalledTimes(1);
    });

    it('share button calls navigator.share when available', () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true, writable: true });

      renderBar();
      fireEvent.click(screen.getByTitle('Share'));
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Check out this post' }),
      );

      // Cleanup
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
    });

    it('share button falls back to clipboard when navigator.share is unavailable', () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true,
      });

      renderBar();
      fireEvent.click(screen.getByTitle('Share'));
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('/articles/post-1'));
    });
  });

  // ===== Performance =====

  describe('performance', () => {
    it('uses React Query hooks instead of direct RPC calls', () => {
      setDisconnected();
      renderBar();
      // The component should call hooks, not direct web3 functions
      expect(usePostEngagement).toHaveBeenCalledWith('post-1');
      expect(useUserLikeStatus).toHaveBeenCalledWith('post-1');
      expect(useLikeMutation).toHaveBeenCalledWith('post-1');
    });

    it('connected user: hooks are called with post ID', () => {
      setConnected();
      renderBar();
      expect(usePostEngagement).toHaveBeenCalledWith('post-1');
      expect(useUserLikeStatus).toHaveBeenCalledWith('post-1');
    });
  });
});
