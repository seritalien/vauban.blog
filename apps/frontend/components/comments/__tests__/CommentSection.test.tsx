import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ALICE } from '@/__tests__/helpers/test-users';
import { setupWalletMock } from '@/__tests__/helpers/render-with-providers';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the component under test
// ---------------------------------------------------------------------------

const mockShowToast = vi.fn();

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: vi.fn(() => ({
    showToast: mockShowToast,
    dismissToast: vi.fn(),
    toasts: [],
  })),
}));

vi.mock('@/hooks/use-session-key', () => ({
  useSessionKey: vi.fn(() => ({
    hasActiveSessionKey: false,
    sessionKey: null,
    createSessionKey: vi.fn(),
    isCreating: false,
    getSessionKeyNonce: vi.fn(),
  })),
}));

const mockGetCommentsForPost = vi.fn().mockResolvedValue([]);
const mockAddComment = vi.fn().mockResolvedValue(undefined);
const mockCalculateContentHash = vi.fn().mockResolvedValue('0xabc123');

vi.mock('@vauban/web3-utils', () => ({
  getCommentsForPost: (...args: unknown[]) => mockGetCommentsForPost(...args),
  addComment: (...args: unknown[]) => mockAddComment(...args),
  calculateContentHash: (...args: unknown[]) => mockCalculateContentHash(...args),
}));

vi.mock('@/lib/comment-storage', () => ({
  storeCommentContent: vi.fn(),
  getCommentContent: vi.fn().mockReturnValue('Mock comment content'),
}));

vi.mock('@/components/ui/Skeleton', () => ({
  CommentSkeleton: () => <div data-testid="comment-skeleton">Loading...</div>,
}));

vi.mock('../CommentThread', () => ({
  __esModule: true,
  default: ({ comment }: { comment: { id: string; content: string | null } }) => (
    <div data-testid={`comment-thread-${comment.id}`}>
      <span>{comment.content ?? 'No content'}</span>
    </div>
  ),
}));

vi.mock('starknet', () => ({
  ec: {
    starkCurve: {
      sign: vi.fn().mockReturnValue({ r: BigInt(1), s: BigInt(2) }),
    },
  },
  hash: {
    computeHashOnElements: vi.fn().mockReturnValue('0xhash'),
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useWallet } from '@/providers/wallet-provider';
import { useSessionKey } from '@/hooks/use-session-key';
import CommentSection from '../CommentSection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setConnected() {
  return setupWalletMock(useWallet as unknown as Mock, ALICE);
}

function setDisconnected() {
  return setupWalletMock(useWallet as unknown as Mock, null);
}

function renderCommentSection(postId = 'post-1') {
  return render(<CommentSection postId={postId} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommentSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDisconnected();
    mockGetCommentsForPost.mockResolvedValue([]);
  });

  // ===== Loading state =====

  describe('loading state', () => {
    it('shows skeleton loaders while loading comments', () => {
      // Keep the promise pending to simulate loading
      mockGetCommentsForPost.mockReturnValue(new Promise(() => {}));
      renderCommentSection();
      expect(screen.getAllByTestId('comment-skeleton')).toHaveLength(3);
    });

    it('hides skeletons after comments load', async () => {
      mockGetCommentsForPost.mockResolvedValue([]);
      renderCommentSection();

      await waitFor(() => {
        expect(screen.queryByTestId('comment-skeleton')).not.toBeInTheDocument();
      });
    });
  });

  // ===== Empty state =====

  describe('empty state', () => {
    it('shows empty message when no comments exist', async () => {
      mockGetCommentsForPost.mockResolvedValue([]);
      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
      });
    });

    it('shows comment count as 0', async () => {
      mockGetCommentsForPost.mockResolvedValue([]);
      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('Comments (0)')).toBeInTheDocument();
      });
    });
  });

  // ===== Comment list =====

  describe('comment list', () => {
    it('renders comments when data is loaded', async () => {
      mockGetCommentsForPost.mockResolvedValue([
        {
          id: 'comment-1',
          postId: 'post-1',
          author: '0x123',
          contentHash: '0xabc',
          createdAt: 1000,
          isDeleted: false,
          parentCommentId: '0',
          likeCount: 0,
        },
        {
          id: 'comment-2',
          postId: 'post-1',
          author: '0x456',
          contentHash: '0xdef',
          createdAt: 2000,
          isDeleted: false,
          parentCommentId: '0',
          likeCount: 0,
        },
      ]);

      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByTestId('comment-thread-comment-1')).toBeInTheDocument();
        expect(screen.getByTestId('comment-thread-comment-2')).toBeInTheDocument();
      });
    });

    it('shows correct total comment count', async () => {
      mockGetCommentsForPost.mockResolvedValue([
        {
          id: 'comment-1',
          postId: 'post-1',
          author: '0x123',
          contentHash: '0xabc',
          createdAt: 1000,
          isDeleted: false,
          parentCommentId: '0',
          likeCount: 0,
        },
        {
          id: 'comment-2',
          postId: 'post-1',
          author: '0x456',
          contentHash: '0xdef',
          createdAt: 2000,
          isDeleted: false,
          parentCommentId: '0',
          likeCount: 0,
        },
      ]);

      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('Comments (2)')).toBeInTheDocument();
      });
    });

    it('filters out deleted comments', async () => {
      mockGetCommentsForPost.mockResolvedValue([
        {
          id: 'comment-1',
          postId: 'post-1',
          author: '0x123',
          contentHash: '0xabc',
          createdAt: 1000,
          isDeleted: false,
          parentCommentId: '0',
          likeCount: 0,
        },
        {
          id: 'comment-deleted',
          postId: 'post-1',
          author: '0x789',
          contentHash: '0xghi',
          createdAt: 1500,
          isDeleted: true,
          parentCommentId: '0',
          likeCount: 0,
        },
      ]);

      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByTestId('comment-thread-comment-1')).toBeInTheDocument();
        expect(screen.queryByTestId('comment-thread-comment-deleted')).not.toBeInTheDocument();
      });
    });
  });

  // ===== Wallet disconnected state =====

  describe('wallet disconnected', () => {
    it('shows connect wallet message when not connected', async () => {
      setDisconnected();
      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('Connect your wallet to comment')).toBeInTheDocument();
      });
    });

    it('does not show the comment form when disconnected', async () => {
      setDisconnected();
      renderCommentSection();

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Share your thoughts...')).not.toBeInTheDocument();
      });
    });
  });

  // ===== Wallet connected state =====

  describe('wallet connected', () => {
    it('shows comment form when connected', async () => {
      setConnected();
      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Share your thoughts...')).toBeInTheDocument();
      });
    });

    it('shows Post Comment button when connected', async () => {
      setConnected();
      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Post Comment' })).toBeInTheDocument();
      });
    });

    it('disables submit button when textarea is empty', async () => {
      setConnected();
      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Post Comment' })).toBeDisabled();
      });
    });

    it('enables submit button when textarea has content', async () => {
      setConnected();
      renderCommentSection();

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText('Share your thoughts...');
        fireEvent.change(textarea, { target: { value: 'My new comment' } });
        expect(screen.getByRole('button', { name: 'Post Comment' })).not.toBeDisabled();
      });
    });
  });

  // ===== Session key =====

  describe('session key', () => {
    it('shows Enable Session button when no active session key', async () => {
      setConnected();
      (useSessionKey as Mock).mockReturnValue({
        hasActiveSessionKey: false,
        sessionKey: null,
        createSessionKey: vi.fn(),
        isCreating: false,
        getSessionKeyNonce: vi.fn(),
      });

      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('Enable Session')).toBeInTheDocument();
      });
    });

    it('shows Session Active badge when session key is active', async () => {
      setConnected();
      (useSessionKey as Mock).mockReturnValue({
        hasActiveSessionKey: true,
        sessionKey: { publicKey: '0xpub', privateKey: '0xpriv', isOnChain: true },
        createSessionKey: vi.fn(),
        isCreating: false,
        getSessionKeyNonce: vi.fn(),
      });

      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('Session Active')).toBeInTheDocument();
      });
    });

    it('shows Creating... text when session key is being created', async () => {
      setConnected();
      (useSessionKey as Mock).mockReturnValue({
        hasActiveSessionKey: false,
        sessionKey: null,
        createSessionKey: vi.fn(),
        isCreating: true,
        getSessionKeyNonce: vi.fn(),
      });

      renderCommentSection();

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });
    });
  });

  // ===== Error handling =====

  describe('error handling', () => {
    it('shows error toast when loading comments fails', async () => {
      mockGetCommentsForPost.mockRejectedValue(new Error('Network error'));
      renderCommentSection();

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith(
          'Failed to load comments: Network error',
          'error'
        );
      });
    });
  });

  // ===== Section heading =====

  describe('section structure', () => {
    it('renders as a section element', async () => {
      renderCommentSection();
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /comments/i })).toBeInTheDocument();
      });
    });
  });
});
