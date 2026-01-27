import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/components/feed/EngagementBar', () => ({
  default: (props: { postId: string; onComment?: () => void }) => (
    <div data-testid="engagement-bar" data-post-id={props.postId}>
      <button data-testid="engagement-comment-btn" onClick={() => props.onComment?.()}>
        Comment
      </button>
    </div>
  ),
}));

vi.mock('@/components/feed/InlineComments', () => ({
  default: (props: { postId: string; isExpanded: boolean; onClose: () => void; initialCount: number }) => (
    props.isExpanded ? (
      <div data-testid="inline-comments" data-post-id={props.postId}>
        <button data-testid="close-comments" onClick={props.onClose}>Close</button>
      </div>
    ) : null
  ),
}));

vi.mock('@/lib/profiles', () => ({
  getProfile: vi.fn(() => null),
  getDisplayName: vi.fn((_author: string) => 'TestUser'),
  formatAddress: vi.fn((addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`),
  toAddressString: vi.fn((addr: unknown) => String(addr).toLowerCase()),
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '5 minutes ago'),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    article: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLElement>>) => (
      <article {...props}>{children}</article>
    ),
    button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    span: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import TweetCard from '../TweetCard';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  id: 'post-1',
  author: '0x1234567890abcdef',
  content: 'Hello world from TweetCard!',
  createdAt: new Date('2025-01-15T12:00:00Z'),
};

function renderCard(props: Partial<React.ComponentProps<typeof TweetCard>> = {}) {
  return render(<TweetCard {...defaultProps} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TweetCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders author info (display name and formatted address)', () => {
    renderCard();
    expect(screen.getByText('TestUser')).toBeInTheDocument();
    // formatAddress should be called and rendered starting with @
    expect(screen.getByText(/@0x1234/)).toBeInTheDocument();
  });

  it('renders content text', () => {
    renderCard();
    expect(screen.getByText('Hello world from TweetCard!')).toBeInTheDocument();
  });

  it('shows image with lazy loading when imageUrl provided', () => {
    renderCard({ imageUrl: '/test-image.jpg' });
    const img = document.querySelector('img[src="/test-image.jpg"]') as HTMLImageElement;
    expect(img).not.toBeNull();
    // jsdom doesn't reflect `loading` as a property; check the attribute
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('renders EngagementBar with correct props', () => {
    renderCard({ likesCount: 5, commentsCount: 3 });
    const bar = screen.getByTestId('engagement-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute('data-post-id')).toBe('post-1');
  });

  it('shows reply styling (connector line) when isReply=true', () => {
    const { container } = renderCard({ isReply: true });
    // Reply adds pl-12 class to article
    const article = container.querySelector('article');
    expect(article?.className).toContain('pl-12');
    // Connector line div
    const connector = container.querySelector('.absolute.left-8');
    expect(connector).not.toBeNull();
  });

  it('shows timestamp via formatDistanceToNow', () => {
    renderCard();
    expect(formatDistanceToNow).toHaveBeenCalledWith(
      defaultProps.createdAt,
      { addSuffix: true },
    );
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('InlineComments toggle on comment click', () => {
    renderCard();
    // Initially no inline comments
    expect(screen.queryByTestId('inline-comments')).not.toBeInTheDocument();

    // Click the comment button in the engagement bar
    fireEvent.click(screen.getByTestId('engagement-comment-btn'));

    // Now inline comments should be expanded
    expect(screen.getByTestId('inline-comments')).toBeInTheDocument();
  });

  it('InlineComments closes when close button clicked', () => {
    renderCard();
    // Open comments
    fireEvent.click(screen.getByTestId('engagement-comment-btn'));
    expect(screen.getByTestId('inline-comments')).toBeInTheDocument();

    // Close comments
    fireEvent.click(screen.getByTestId('close-comments'));
    expect(screen.queryByTestId('inline-comments')).not.toBeInTheDocument();
  });

  it('links to author profile', () => {
    renderCard();
    const authorLinks = document.querySelectorAll(`a[href*="/authors/"]`);
    expect(authorLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('links to article page', () => {
    renderCard();
    const articleLinks = document.querySelectorAll(`a[href="/articles/post-1"]`);
    expect(articleLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('does not show image when imageUrl is not provided', () => {
    renderCard();
    const imgs = document.querySelectorAll('img');
    // No images at all (no avatar either since profile is null)
    expect(imgs.length).toBe(0);
  });
});
