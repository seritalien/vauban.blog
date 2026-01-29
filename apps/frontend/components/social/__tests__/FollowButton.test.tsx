import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ALICE, BOB } from '@/__tests__/helpers/test-users';
import { setupWalletMock } from '@/__tests__/helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: vi.fn(),
}));

const mockToggleFollow = vi.fn();

vi.mock('@/hooks/use-follow', () => ({
  useFollow: vi.fn(() => ({
    isFollowing: false,
    isActing: false,
    toggleFollow: mockToggleFollow,
    stats: { followerCount: 42, followingCount: 10 },
    error: null,
  })),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, whileTap: _whileTap, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { whileTap?: unknown }>) => (
      <button {...props}>{children}</button>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useWallet } from '@/providers/wallet-provider';
import { useFollow } from '@/hooks/use-follow';
import FollowButton from '../FollowButton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setConnectedAs(user: typeof ALICE | typeof BOB) {
  return setupWalletMock(useWallet as unknown as Mock, user);
}

function setDisconnected() {
  return setupWalletMock(useWallet as unknown as Mock, null);
}

function renderBtn(props: Partial<React.ComponentProps<typeof FollowButton>> = {}) {
  return render(
    <FollowButton targetAddress={BOB.address} {...props} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setConnectedAs(ALICE);
    mockToggleFollow.mockResolvedValue(true);
    (useFollow as Mock).mockReturnValue({
      isFollowing: false,
      isActing: false,
      toggleFollow: mockToggleFollow,
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });
  });

  // ===== Self-follow =====

  it('returns null when address === targetAddress (self-follow)', () => {
    setConnectedAs(ALICE);
    const { container } = render(
      <FollowButton targetAddress={ALICE.address} />,
    );
    expect(container.innerHTML).toBe('');
  });

  // ===== Not following =====

  it('shows "Follow" text with blue background when not following', () => {
    renderBtn();
    const btn = screen.getByRole('button');
    expect(screen.getByText('Follow')).toBeInTheDocument();
    expect(btn.className).toContain('bg-blue-600');
  });

  // ===== Following =====

  it('shows "Following" text with border style when following', () => {
    (useFollow as Mock).mockReturnValue({
      isFollowing: true,
      isActing: false,
      toggleFollow: mockToggleFollow,
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });

    renderBtn();
    expect(screen.getByText('Following')).toBeInTheDocument();
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border');
  });

  // ===== Hover when following =====

  it('shows "Unfollow" text with red background on hover when following', () => {
    (useFollow as Mock).mockReturnValue({
      isFollowing: true,
      isActing: false,
      toggleFollow: mockToggleFollow,
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });

    renderBtn();
    const btn = screen.getByRole('button');

    fireEvent.mouseEnter(btn);

    expect(screen.getByText('Unfollow')).toBeInTheDocument();
    expect(btn.className).toContain('bg-red-500');
  });

  // ===== isActing =====

  it('shows spinner and disables button when isActing', () => {
    (useFollow as Mock).mockReturnValue({
      isFollowing: false,
      isActing: true,
      toggleFollow: mockToggleFollow,
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });

    renderBtn();
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Spinner has animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
  });

  // ===== Click =====

  it('calls toggleFollow on click', async () => {
    renderBtn();
    const btn = screen.getByRole('button');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockToggleFollow).toHaveBeenCalledTimes(1);
  });

  it('calls onFollowChange callback on success', async () => {
    const onFollowChange = vi.fn();
    renderBtn({ onFollowChange });

    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(onFollowChange).toHaveBeenCalledWith(true);
  });

  // ===== Error =====

  it('shows error tooltip when error is set', () => {
    (useFollow as Mock).mockReturnValue({
      isFollowing: false,
      isActing: false,
      toggleFollow: mockToggleFollow,
      stats: { followerCount: 42, followingCount: 10 },
      error: 'Something went wrong',
    });

    renderBtn();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  // ===== Sizes =====

  it('sm/md/lg apply correct classes', () => {
    const { rerender } = render(
      <FollowButton targetAddress={BOB.address} size="sm" />,
    );
    let btn = screen.getByRole('button');
    expect(btn.className).toContain('px-3');
    expect(btn.className).toContain('text-xs');

    rerender(<FollowButton targetAddress={BOB.address} size="lg" />);
    btn = screen.getByRole('button');
    expect(btn.className).toContain('px-6');
    expect(btn.className).toContain('text-base');
  });

  // ===== showCount =====

  it('displays follower count when showCount=true', () => {
    renderBtn({ showCount: true });
    expect(screen.getByText(/42/)).toBeInTheDocument();
    expect(screen.getByText(/follower/i)).toBeInTheDocument();
  });

  // ===== Disconnected =====

  it('shows "Follow" but click does nothing when disconnected', async () => {
    setDisconnected();
    renderBtn();

    expect(screen.getByText('Follow')).toBeInTheDocument();

    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });

    // toggleFollow should not be called because the handler checks isConnected
    // Actually, the component calls handleClick which returns early if !isConnected
    // But toggleFollow IS still called in the component's handleClick...
    // Let's verify the behavior: handleClick checks isConnected, returns early if false
    expect(mockToggleFollow).not.toHaveBeenCalled();
  });
});
