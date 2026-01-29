import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALICE } from '@/__tests__/helpers/test-users';
import { setupWalletMock } from '@/__tests__/helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the component under test
// ---------------------------------------------------------------------------

const { mockLikeMutateAsync } = vi.hoisted(() => {
  return { mockLikeMutateAsync: vi.fn().mockResolvedValue('like') };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
    dismissToast: vi.fn(),
    toasts: [],
  })),
}));

vi.mock('@/hooks/use-engagement', () => ({
  usePostEngagement: vi.fn().mockReturnValue({ data: { likes: 0, comments: 0 } }),
  useUserLikeStatus: vi.fn().mockReturnValue({ data: false, isLoading: false }),
  useLikeMutation: vi.fn().mockReturnValue({
    mutateAsync: mockLikeMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@vauban/web3-utils', () => ({
  likeComment: vi.fn().mockResolvedValue(undefined),
  unlikeComment: vi.fn().mockResolvedValue(undefined),
  hasLikedComment: vi.fn().mockResolvedValue(false),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import {
  usePostEngagement,
  useUserLikeStatus,
  useLikeMutation,
} from '@/hooks/use-engagement';
import LikeButton from '../LikeButton';

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

function renderLikeButton(
  props: Partial<React.ComponentProps<typeof LikeButton>> = {}
) {
  const defaultProps = {
    targetId: 'post-1',
    targetType: 'post' as const,
    ...props,
  };
  return render(<LikeButton {...defaultProps} />, {
    wrapper: createQueryWrapper(),
  });
}

function setConnected() {
  return setupWalletMock(useWallet as unknown as Mock, ALICE);
}

function setDisconnected() {
  return setupWalletMock(useWallet as unknown as Mock, null);
}

function mockEngagement(likes: number) {
  (usePostEngagement as Mock).mockReturnValue({ data: { likes, comments: 0 } });
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

describe('LikeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisconnected();
    mockEngagement(0);
    mockUserLiked(false);
    mockMutation();
  });

  // ===== Rendering =====

  describe('rendering', () => {
    it('renders a button element', () => {
      renderLikeButton();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('displays like count from engagement data', () => {
      mockEngagement(42);
      renderLikeButton();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('displays initial like count when no engagement data', () => {
      (usePostEngagement as Mock).mockReturnValue({ data: undefined });
      renderLikeButton({ initialLikeCount: 7 });
      expect(screen.getByText('7')).toBeInTheDocument();
    });

    it('displays 0 as default like count', () => {
      renderLikeButton();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  // ===== Size variants =====

  describe('size variants', () => {
    it('applies sm size classes', () => {
      renderLikeButton({ size: 'sm' });
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-sm');
    });

    it('applies md size classes by default', () => {
      renderLikeButton();
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-base');
    });

    it('applies lg size classes', () => {
      renderLikeButton({ size: 'lg' });
      const button = screen.getByRole('button');
      expect(button.className).toContain('text-lg');
    });
  });

  // ===== Disabled states =====

  describe('disabled states', () => {
    it('is disabled when wallet is not connected', () => {
      setDisconnected();
      renderLikeButton();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('shows "Connect wallet to like" title when disconnected', () => {
      setDisconnected();
      renderLikeButton();
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Connect wallet to like');
    });

    it('is disabled when mutation is pending', () => {
      setConnected();
      mockMutation({ isPending: true });
      renderLikeButton();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('is disabled when checking like status', () => {
      setConnected();
      mockUserLiked(false, true);
      renderLikeButton();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('is enabled when connected and not loading', () => {
      setConnected();
      renderLikeButton();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  // ===== Like toggling =====

  describe('like toggling', () => {
    it('calls mutateAsync with "like" action when not liked', async () => {
      setConnected();
      mockUserLiked(false);

      renderLikeButton();

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockLikeMutateAsync).toHaveBeenCalledWith({ action: 'like' });
    });

    it('calls mutateAsync with "unlike" action when already liked', async () => {
      setConnected();
      mockUserLiked(true);

      renderLikeButton();

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockLikeMutateAsync).toHaveBeenCalledWith({ action: 'unlike' });
    });

    it('shows "Unlike" title when liked', () => {
      setConnected();
      mockUserLiked(true);
      renderLikeButton();
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Unlike');
    });

    it('shows "Like" title when not liked', () => {
      setConnected();
      mockUserLiked(false);
      renderLikeButton();
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Like');
    });
  });

  // ===== Visual states =====

  describe('visual states', () => {
    it('applies red styling when liked', () => {
      setConnected();
      mockUserLiked(true);
      renderLikeButton();
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-red-100');
      expect(button.className).toContain('text-red-600');
    });

    it('applies gray styling when not liked', () => {
      setConnected();
      mockUserLiked(false);
      renderLikeButton();
      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-gray-100');
      expect(button.className).toContain('text-gray-600');
    });

    it('applies opacity when disabled', () => {
      setDisconnected();
      renderLikeButton();
      const button = screen.getByRole('button');
      expect(button.className).toContain('opacity-50');
    });
  });

  // ===== Error handling =====

  describe('error handling', () => {
    it('shows error toast on mutation failure', async () => {
      setConnected();
      mockUserLiked(false);
      mockLikeMutateAsync.mockRejectedValueOnce(new Error('Network error'));

      const mockShowToast = vi.fn();
      (useToast as Mock).mockReturnValue({
        showToast: mockShowToast,
        dismissToast: vi.fn(),
        toasts: [],
      });

      renderLikeButton();

      await act(async () => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Failed to like. Please try again.',
        'error'
      );
    });
  });

  // ===== Loading state =====

  describe('loading state', () => {
    it('shows spinner when mutation is pending', () => {
      setConnected();
      mockMutation({ isPending: true });
      renderLikeButton();
      // The spinner has animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeNull();
    });

    it('does not show spinner when not loading', () => {
      setConnected();
      renderLikeButton();
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeNull();
    });
  });
});
