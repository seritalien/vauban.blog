import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-follow', () => ({
  useFollowCounts: vi.fn(() => ({
    followerCount: 0,
    followingCount: 0,
    isLoading: false,
  })),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useFollowCounts } from '@/hooks/use-follow';
import FollowStats from '../FollowStats';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FollowStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== Loading =====

  it('shows skeleton animation when loading', () => {
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 0,
      followingCount: 0,
      isLoading: true,
    });

    const { container } = render(<FollowStats address="0x123" />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).not.toBeNull();
  });

  // ===== Displays correct counts =====

  it('displays correct follower and following counts', () => {
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 150,
      followingCount: 42,
      isLoading: false,
    });

    render(<FollowStats address="0x123" />);
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByText('Followers')).toBeInTheDocument();
  });

  // ===== Large number formatting =====

  it('formats large numbers (1000 -> "1.0K", 1000000 -> "1.0M")', () => {
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 1000000,
      followingCount: 1000,
      isLoading: false,
    });

    render(<FollowStats address="0x123" />);
    expect(screen.getByText('1.0M')).toBeInTheDocument();
    expect(screen.getByText('1.0K')).toBeInTheDocument();
  });

  // ===== Singular / plural =====

  it('uses singular "Follower" for count of 1 and plural "Followers" otherwise', () => {
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 1,
      followingCount: 5,
      isLoading: false,
    });

    render(<FollowStats address="0x123" />);
    expect(screen.getByText('Follower')).toBeInTheDocument();
    expect(screen.queryByText('Followers')).not.toBeInTheDocument();

    // Update to 2 followers
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 2,
      followingCount: 5,
      isLoading: false,
    });

    const { unmount } = render(<FollowStats address="0x456" />);
    expect(screen.getByText('Followers')).toBeInTheDocument();
    unmount();
  });

  // ===== Clickable mode =====

  it('renders links to follower/following pages when clickable=true', () => {
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 10,
      followingCount: 20,
      isLoading: false,
    });

    render(<FollowStats address="0xABC" clickable />);
    const links = document.querySelectorAll('a');
    expect(links.length).toBe(2);

    const hrefs = Array.from(links).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/authors/0xABC?tab=following');
    expect(hrefs).toContain('/authors/0xABC?tab=followers');
  });

  // ===== Size variants =====

  it('sm/md/lg apply correct classes', () => {
    (useFollowCounts as Mock).mockReturnValue({
      followerCount: 5,
      followingCount: 3,
      isLoading: false,
    });

    const { container, rerender } = render(
      <FollowStats address="0x123" size="sm" />,
    );
    let wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('text-xs');
    expect(wrapper.className).toContain('gap-3');

    rerender(<FollowStats address="0x123" size="lg" />);
    wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('text-base');
    expect(wrapper.className).toContain('gap-6');
  });
});
