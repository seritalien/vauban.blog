import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockShowToast = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: mockShowToast,
    dismissToast: vi.fn(),
    toasts: [],
  })),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import ShareButtons from '../ShareButtons';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderShareButtons(
  props: Partial<React.ComponentProps<typeof ShareButtons>> = {}
) {
  const defaultProps = {
    url: 'https://blog.vauban.tech/articles/test-article',
    title: 'Test Article',
    ...props,
  };
  return render(<ShareButtons {...defaultProps} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShareButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== Rendering =====

  describe('rendering', () => {
    it('renders the "Share:" label', () => {
      renderShareButtons();
      expect(screen.getByText('Share:')).toBeInTheDocument();
    });

    it('renders Twitter/X share link', () => {
      renderShareButtons();
      const twitterLink = screen.getByTitle('Share on X (Twitter)');
      expect(twitterLink).toBeInTheDocument();
      expect(twitterLink).toHaveAttribute('href');
      expect(twitterLink).toHaveAttribute('target', '_blank');
      expect(twitterLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders Farcaster share link', () => {
      renderShareButtons();
      const farcasterLink = screen.getByTitle('Share on Farcaster');
      expect(farcasterLink).toBeInTheDocument();
      expect(farcasterLink).toHaveAttribute('href');
      expect(farcasterLink).toHaveAttribute('target', '_blank');
      expect(farcasterLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders copy link button', () => {
      renderShareButtons();
      expect(screen.getByTitle('Copy link')).toBeInTheDocument();
    });
  });

  // ===== Share URLs =====

  describe('share URLs', () => {
    it('constructs correct Twitter URL with title', () => {
      renderShareButtons({
        url: 'https://example.com/post',
        title: 'My Post',
      });
      const twitterLink = screen.getByTitle('Share on X (Twitter)');
      const href = twitterLink.getAttribute('href')!;
      expect(href).toContain('https://twitter.com/intent/tweet');
      expect(href).toContain(encodeURIComponent('https://example.com/post'));
      expect(href).toContain(encodeURIComponent('My Post'));
    });

    it('uses excerpt over title for share text when provided', () => {
      renderShareButtons({
        url: 'https://example.com/post',
        title: 'Title',
        excerpt: 'This is a custom excerpt',
      });
      const twitterLink = screen.getByTitle('Share on X (Twitter)');
      const href = twitterLink.getAttribute('href')!;
      expect(href).toContain(encodeURIComponent('This is a custom excerpt'));
    });

    it('falls back to title when no excerpt is provided', () => {
      renderShareButtons({
        url: 'https://example.com/post',
        title: 'Fallback Title',
      });
      const twitterLink = screen.getByTitle('Share on X (Twitter)');
      const href = twitterLink.getAttribute('href')!;
      expect(href).toContain(encodeURIComponent('Fallback Title'));
    });

    it('constructs correct Farcaster URL', () => {
      renderShareButtons({
        url: 'https://example.com/post',
        title: 'My Post',
      });
      const farcasterLink = screen.getByTitle('Share on Farcaster');
      const href = farcasterLink.getAttribute('href')!;
      expect(href).toContain('https://warpcast.com/~/compose');
      expect(href).toContain(encodeURIComponent('https://example.com/post'));
    });
  });

  // ===== Copy to clipboard =====

  describe('copy to clipboard', () => {
    it('copies URL to clipboard on click', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        configurable: true,
        writable: true,
      });

      renderShareButtons({
        url: 'https://blog.vauban.tech/articles/my-article',
      });

      await act(async () => {
        fireEvent.click(screen.getByTitle('Copy link'));
      });

      expect(writeTextMock).toHaveBeenCalledWith(
        'https://blog.vauban.tech/articles/my-article'
      );
    });

    it('shows success toast after copying', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });

      renderShareButtons();

      await act(async () => {
        fireEvent.click(screen.getByTitle('Copy link'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Link copied to clipboard!',
        'success'
      );
    });

    it('shows error toast when clipboard write fails', async () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockRejectedValue(new Error('Clipboard denied')) },
        configurable: true,
        writable: true,
      });

      renderShareButtons();

      await act(async () => {
        fireEvent.click(screen.getByTitle('Copy link'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        'Failed to copy link',
        'error'
      );
    });

    it('resets copied state after 2 seconds', async () => {
      vi.useFakeTimers();

      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn().mockResolvedValue(undefined) },
        configurable: true,
        writable: true,
      });

      renderShareButtons();

      await act(async () => {
        fireEvent.click(screen.getByTitle('Copy link'));
      });

      // After copy, a checkmark icon should appear (the SVG path with "M5 13l4 4L19 7")
      // We can verify by checking the button still works after timeout
      act(() => {
        vi.advanceTimersByTime(2100);
      });

      // The button should be back to the copy icon state (not in "copied" state)
      // Clicking again should work
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copy link'));
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  // ===== URL encoding =====

  describe('URL encoding', () => {
    it('properly encodes special characters in URL', () => {
      renderShareButtons({
        url: 'https://example.com/post?foo=bar&baz=qux',
        title: 'Test',
      });
      const twitterLink = screen.getByTitle('Share on X (Twitter)');
      const href = twitterLink.getAttribute('href')!;
      expect(href).toContain(encodeURIComponent('https://example.com/post?foo=bar&baz=qux'));
    });

    it('properly encodes special characters in title', () => {
      renderShareButtons({
        url: 'https://example.com/post',
        title: 'Title with "quotes" & special <chars>',
      });
      const twitterLink = screen.getByTitle('Share on X (Twitter)');
      const href = twitterLink.getAttribute('href')!;
      expect(href).toContain(encodeURIComponent('Title with "quotes" & special <chars>'));
    });
  });
});
