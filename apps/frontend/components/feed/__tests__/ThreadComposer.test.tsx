import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ALICE } from '@/__tests__/helpers/test-users';
import { setupWalletMock } from '@/__tests__/helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: vi.fn(),
}));

const mockPostThread = vi.fn();
const mockClearError = vi.fn();

vi.mock('@/hooks/use-post-bastion', () => ({
  usePostBastion: vi.fn(() => ({
    postThread: mockPostThread,
    isPosting: false,
    error: null,
    clearError: mockClearError,
  })),
}));

const mockShowToast = vi.fn();

vi.mock('@/components/ui/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: mockShowToast,
  })),
}));

vi.mock('@vauban/web3-utils', () => ({
  initStarknetProvider: vi.fn(),
  getProvider: vi.fn(),
  followsAbi: [],
}));

vi.mock('@/lib/profiles', () => ({
  getProfile: vi.fn(() => null),
  getDisplayName: vi.fn((_addr: string) => 'Alice'),
  formatAddress: vi.fn((addr: string) => addr?.slice(0, 6) + '...' + addr?.slice(-4)),
  toAddressString: vi.fn((addr: unknown) => String(addr)),
}));

vi.mock('@/components/feed/EmojiPicker', () => ({
  default: () => <div data-testid="emoji-picker" />,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
    article: (props: React.HTMLAttributes<HTMLElement>) => <article {...props} />,
    button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
    span: (props: React.HTMLAttributes<HTMLSpanElement>) => <span {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useWallet } from '@/providers/wallet-provider';
import { usePostBastion } from '@/hooks/use-post-bastion';
import ThreadComposer from '../ThreadComposer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setConnected() {
  return setupWalletMock(useWallet as unknown as Mock, ALICE);
}

function setDisconnected() {
  return setupWalletMock(useWallet as unknown as Mock, null);
}

function renderThread(props: Partial<React.ComponentProps<typeof ThreadComposer>> = {}) {
  return render(<ThreadComposer {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ThreadComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostThread.mockResolvedValue('thread-root-1');
    (usePostBastion as Mock).mockReturnValue({
      postThread: mockPostThread,
      isPosting: false,
      error: null,
      clearError: mockClearError,
    });
  });

  // ===== Disconnected =====

  describe('disconnected', () => {
    it('shows connect wallet message', () => {
      setDisconnected();
      renderThread();
      expect(screen.getByText('Connect your wallet to create a thread')).toBeInTheDocument();
    });
  });

  // ===== Connected =====

  describe('connected', () => {
    beforeEach(() => setConnected());

    it('shows initial state with 1 post', () => {
      renderThread();
      expect(screen.getByText('1/1')).toBeInTheDocument();
    });

    it('shows textarea with "Start your thread..." placeholder', () => {
      renderThread();
      expect(screen.getByPlaceholderText('Start your thread...')).toBeInTheDocument();
    });
  });

  // ===== Add / remove posts =====

  describe('add and remove posts', () => {
    beforeEach(() => setConnected());

    it('addPost increases count', () => {
      renderThread();
      fireEvent.click(screen.getByText('Add another post'));
      expect(screen.getByText('1/2')).toBeInTheDocument();
      expect(screen.getByText('2/2')).toBeInTheDocument();
    });

    it('cannot add beyond maxPosts', () => {
      renderThread({ maxPosts: 2 });
      fireEvent.click(screen.getByText('Add another post'));
      // Should now be at max (2 posts) so button should disappear
      expect(screen.queryByText('Add another post')).not.toBeInTheDocument();
    });

    it('removePost decreases count', () => {
      renderThread();
      fireEvent.click(screen.getByText('Add another post'));
      expect(screen.getByText('2/2')).toBeInTheDocument();

      // Remove one post (there should be a remove button)
      // Find the trash icon button (the remove button has a trash SVG)
      const trashBtn = Array.from(document.querySelectorAll('button')).find(
        (btn) => btn.querySelector('path[d*="M19 7l"]'),
      );
      if (trashBtn) {
        fireEvent.click(trashBtn);
      }
      expect(screen.getByText('1/1')).toBeInTheDocument();
    });

    it("can't remove last post", () => {
      renderThread();
      // With only 1 post, no remove buttons should be visible
      const trashBtn = Array.from(document.querySelectorAll('button')).find(
        (btn) => btn.querySelector('path[d*="M19 7l"]'),
      );
      expect(trashBtn).toBeUndefined();
    });
  });

  // ===== Character limits =====

  describe('character limits', () => {
    beforeEach(() => setConnected());

    it('shows count per post', () => {
      renderThread({ maxLength: 280 });
      expect(screen.getByText('0/280')).toBeInTheDocument();
    });

    it('shows red color when over limit', () => {
      renderThread({ maxLength: 10 });
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(11) } });
      const counter = screen.getByText('11/10');
      expect(counter.className).toContain('text-red-500');
    });
  });

  // ===== canSubmit =====

  describe('canSubmit', () => {
    beforeEach(() => setConnected());

    it('submit disabled when all posts empty', () => {
      renderThread();
      const submitBtn = screen.getByText('Post thread (0)');
      expect(submitBtn).toBeDisabled();
    });

    it('submit disabled when any post over limit', () => {
      renderThread({ maxLength: 10 });
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(11) } });
      // Even though we have 1 valid post the content is over the limit
      const submitBtn = screen.getByRole('button', { name: /Post thread/ });
      expect(submitBtn).toBeDisabled();
    });

    it('submit enabled with valid content', () => {
      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'Hello thread' } });
      const submitBtn = screen.getByText('Post thread (1)');
      expect(submitBtn).not.toBeDisabled();
    });
  });

  // ===== Submission =====

  describe('submission', () => {
    beforeEach(() => setConnected());

    it('calls postThread with single post', async () => {
      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Post thread (1)'));
      });

      expect(mockPostThread).toHaveBeenCalledWith(['First post']);
    });

    it('calls postThread with multiple posts as array', async () => {
      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      fireEvent.click(screen.getByText('Add another post'));
      const secondTextarea = screen.getByPlaceholderText('Add to your thread...');
      fireEvent.change(secondTextarea, { target: { value: 'Second post' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Post thread (2)'));
      });

      expect(mockPostThread).toHaveBeenCalledWith(['First post', 'Second post']);
    });

    it('failure shows error toast', async () => {
      mockPostThread.mockResolvedValue(null);

      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Post thread (1)'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Failed to publish thread'),
        'error',
      );
    });

    it('success resets posts', async () => {
      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Post thread (1)'));
      });

      // Should be back to 1 empty post
      expect(screen.getByText('0/280')).toBeInTheDocument();
    });

    it('calls onSuccess with rootId', async () => {
      const onSuccess = vi.fn();
      renderThread({ onSuccess });

      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Post thread (1)'));
      });

      expect(onSuccess).toHaveBeenCalledWith('thread-root-1');
    });
  });

  // ===== Publishing state =====

  describe('publishing state', () => {
    beforeEach(() => setConnected());

    it('shows publishing state during submission', async () => {
      mockPostThread.mockImplementation(
        () => new Promise<string>(() => { /* never resolves – keeps publishing state active */ }),
      );

      // Mock isPosting state
      (usePostBastion as Mock).mockReturnValue({
        postThread: mockPostThread,
        isPosting: true,
        error: null,
        clearError: mockClearError,
      });

      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      // Should show publishing state since isPosting is true
      expect(screen.getByText('Publishing...')).toBeInTheDocument();
    });

    it('uses batch multicall for entire thread', async () => {
      renderThread();
      const textarea = screen.getByPlaceholderText('Start your thread...');
      fireEvent.change(textarea, { target: { value: 'First post' } });

      fireEvent.click(screen.getByText('Add another post'));
      const secondTextarea = screen.getByPlaceholderText('Add to your thread...');
      fireEvent.change(secondTextarea, { target: { value: 'Second post' } });

      fireEvent.click(screen.getByText('Add another post'));
      const thirdTextarea = screen.getAllByPlaceholderText('Add to your thread...')[1];
      fireEvent.change(thirdTextarea, { target: { value: 'Third post' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Post thread (3)'));
      });

      // All posts submitted in a single batch call
      expect(mockPostThread).toHaveBeenCalledTimes(1);
      expect(mockPostThread).toHaveBeenCalledWith(['First post', 'Second post', 'Third post']);
    });
  });
});
