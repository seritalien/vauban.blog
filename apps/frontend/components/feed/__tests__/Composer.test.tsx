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

const mockPostBastion = vi.fn();
const mockPostReply = vi.fn();
const mockClearError = vi.fn();

vi.mock('@/hooks/use-post-bastion', () => ({
  usePostBastion: vi.fn(() => ({
    postBastion: mockPostBastion,
    postReply: mockPostReply,
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

vi.mock('@/lib/profiles', () => ({
  getProfile: vi.fn(() => null),
  getDisplayName: vi.fn((_addr: string) => 'Alice'),
  formatAddress: vi.fn((addr: string) => addr?.slice(0, 6) + '...' + addr?.slice(-4)),
  toAddressString: vi.fn((addr: unknown) => String(addr)),
}));

vi.mock('@/lib/ipfs-client', () => ({
  uploadFileToIPFSViaAPI: vi.fn().mockResolvedValue('QmTestCid123'),
}));

vi.mock('@/components/feed/EmojiPicker', () => ({
  default: () => <div data-testid="emoji-picker" />,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string;[key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useWallet } from '@/providers/wallet-provider';
import { usePostBastion } from '@/hooks/use-post-bastion';
import { uploadFileToIPFSViaAPI } from '@/lib/ipfs-client';
import Composer from '../Composer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setConnected() {
  return setupWalletMock(useWallet as unknown as Mock, ALICE);
}

function setDisconnected() {
  return setupWalletMock(useWallet as unknown as Mock, null);
}

function renderComposer(props: Partial<React.ComponentProps<typeof Composer>> = {}) {
  return render(<Composer {...props} />);
}

function createFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Composer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostBastion.mockResolvedValue('post-1');
    mockPostReply.mockResolvedValue('reply-1');
    (usePostBastion as Mock).mockReturnValue({
      postBastion: mockPostBastion,
      postReply: mockPostReply,
      isPosting: false,
      error: null,
      clearError: mockClearError,
    });
  });

  // ===== Disconnected =====

  describe('disconnected', () => {
    it('shows sign-in prompt when not connected', () => {
      setDisconnected();
      renderComposer();
      expect(screen.getByText('Connectez-vous')).toBeInTheDocument();
    });

    it('does not show a textarea when not connected', () => {
      setDisconnected();
      renderComposer();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  // ===== Connected =====

  describe('connected', () => {
    beforeEach(() => setConnected());

    it('shows textarea', () => {
      renderComposer();
      expect(screen.getByPlaceholderText('Quoi de neuf ?')).toBeInTheDocument();
    });

    it('shows avatar placeholder', () => {
      renderComposer();
      // Avatar shows first letter of display name
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('shows post button', () => {
      renderComposer();
      expect(screen.getByText('Bastionne !')).toBeInTheDocument();
    });

    it('char counter is hidden when content is empty', () => {
      renderComposer();
      // The circular progress ring only shows when content.length > 0
      const svgs = document.querySelectorAll('svg.w-8');
      expect(svgs.length).toBe(0);
    });
  });

  // ===== Post button state =====

  describe('post button', () => {
    beforeEach(() => setConnected());

    it('disabled when empty', () => {
      renderComposer();
      const btn = screen.getByText('Bastionne !');
      expect(btn).toBeDisabled();
    });

    it('disabled when over limit', () => {
      renderComposer({ maxLength: 10 });
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(11) } });
      const btn = screen.getByText('Bastionne !');
      expect(btn).toBeDisabled();
    });

    it('enabled with valid content', () => {
      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      const btn = screen.getByText('Bastionne !');
      expect(btn).not.toBeDisabled();
    });
  });

  // ===== Character counter =====

  describe('character counter', () => {
    beforeEach(() => setConnected());

    it('shows progress ring when content exists', () => {
      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'Hello' } });
      // There should be an SVG circle for the progress ring
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('shows remaining chars when >80% used', () => {
      renderComposer({ maxLength: 100 });
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'a'.repeat(85) } });
      // Should show 15 remaining
      expect(screen.getByText('15')).toBeInTheDocument();
    });
  });

  // ===== Posting =====

  describe('posting', () => {
    beforeEach(() => setConnected());

    it('calls postBastion with content', async () => {
      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'My post' } });

      const btn = screen.getByText('Bastionne !');
      await act(async () => {
        fireEvent.click(btn);
      });

      expect(mockPostBastion).toHaveBeenCalledWith('My post', undefined);
    });

    it('calls postReply when replyToId provided', async () => {
      renderComposer({ replyToId: 'parent-42' });
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'My reply' } });

      const btn = screen.getByText('Répondre');
      await act(async () => {
        fireEvent.click(btn);
      });

      expect(mockPostReply).toHaveBeenCalledWith('My reply', 'parent-42');
    });

    it('clears content on success', async () => {
      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'content' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Bastionne !'));
      });

      expect(textarea.value).toBe('');
    });

    it('calls onPostSuccess callback', async () => {
      const onSuccess = vi.fn();
      renderComposer({ onPostSuccess: onSuccess });
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'content' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Bastionne !'));
      });

      expect(onSuccess).toHaveBeenCalledWith('post-1');
    });

    it('shows toast on success', async () => {
      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'content' } });

      await act(async () => {
        fireEvent.click(screen.getByText('Bastionne !'));
      });

      expect(mockShowToast).toHaveBeenCalledWith('Bastion posé !', 'success');
    });

    it('button is disabled during posting', () => {
      (usePostBastion as Mock).mockReturnValue({
        postBastion: mockPostBastion,
        postReply: mockPostReply,
        isPosting: true,
        error: null,
        clearError: mockClearError,
      });

      renderComposer();
      // When isPosting, the submit button text changes to include "Publication..."
      expect(screen.getByText('Publication...')).toBeInTheDocument();
    });
  });

  // ===== Image upload =====

  describe('image upload', () => {
    beforeEach(() => setConnected());

    it('shows preview after selecting an image', async () => {
      renderComposer();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = createFile('test.png', 1024, 'image/png');

      // Mock FileReader
      const originalFileReader = global.FileReader;
      const mockReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,abc',
      };
      global.FileReader = class MockFileReader { readAsDataURL() { mockReader.readAsDataURL(); } set onload(fn: ((ev: ProgressEvent<FileReader>) => void) | null) { mockReader.onload = fn; } get onload() { return mockReader.onload; } } as unknown as typeof FileReader;

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Trigger the onload callback
      await act(async () => {
        mockReader.onload?.({ target: { result: 'data:image/png;base64,abc' } } as unknown as ProgressEvent<FileReader>);
      });

      expect(screen.getByAltText('Preview')).toBeInTheDocument();

      global.FileReader = originalFileReader;
    });

    it('rejects non-image files with error toast', async () => {
      renderComposer();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = createFile('test.pdf', 1024, 'application/pdf');
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(mockShowToast).toHaveBeenCalledWith('Veuillez choisir un fichier image', 'error');
    });

    it('rejects >5MB files with error toast', async () => {
      renderComposer();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const file = createFile('big.png', 6 * 1024 * 1024, 'image/png');
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(mockShowToast).toHaveBeenCalledWith('Image trop volumineuse (max 5 Mo)', 'error');
    });

    it('calls uploadFileToIPFSViaAPI when submitting with image', async () => {
      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'Post with image' } });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('photo.jpg', 1024, 'image/jpeg');

      // Mock FileReader
      const originalFileReader = global.FileReader;
      const mockReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,abc',
      };
      global.FileReader = class MockFileReader { readAsDataURL() { mockReader.readAsDataURL(); } set onload(fn: ((ev: ProgressEvent<FileReader>) => void) | null) { mockReader.onload = fn; } get onload() { return mockReader.onload; } } as unknown as typeof FileReader;

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
        mockReader.onload?.({ target: { result: 'data:image/jpeg;base64,abc' } } as unknown as ProgressEvent<FileReader>);
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Bastionne !'));
      });

      expect(uploadFileToIPFSViaAPI).toHaveBeenCalledWith(file);
      expect(mockPostBastion).toHaveBeenCalledWith('Post with image', '/api/ipfs/QmTestCid123');

      global.FileReader = originalFileReader;
    });

    it('remove button clears image preview', async () => {
      renderComposer();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('test.png', 1024, 'image/png');

      const originalFileReader = global.FileReader;
      const mockReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/png;base64,abc',
      };
      global.FileReader = class MockFileReader { readAsDataURL() { mockReader.readAsDataURL(); } set onload(fn: ((ev: ProgressEvent<FileReader>) => void) | null) { mockReader.onload = fn; } get onload() { return mockReader.onload; } } as unknown as typeof FileReader;

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
        mockReader.onload?.({ target: { result: 'data:image/png;base64,abc' } } as unknown as ProgressEvent<FileReader>);
      });

      expect(screen.getByAltText('Preview')).toBeInTheDocument();

      const removeBtn = screen.getByTitle("Supprimer l'image");
      await act(async () => {
        fireEvent.click(removeBtn);
      });

      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();

      global.FileReader = originalFileReader;
    });

    it('upload error shows toast', async () => {
      (uploadFileToIPFSViaAPI as Mock).mockRejectedValue(new Error('upload failed'));

      renderComposer();
      const textarea = screen.getByPlaceholderText('Quoi de neuf ?');
      fireEvent.change(textarea, { target: { value: 'Post with image' } });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = createFile('photo.jpg', 1024, 'image/jpeg');

      const originalFileReader = global.FileReader;
      const mockReader = {
        readAsDataURL: vi.fn(),
        onload: null as ((ev: ProgressEvent<FileReader>) => void) | null,
        result: 'data:image/jpeg;base64,abc',
      };
      global.FileReader = class MockFileReader { readAsDataURL() { mockReader.readAsDataURL(); } set onload(fn: ((ev: ProgressEvent<FileReader>) => void) | null) { mockReader.onload = fn; } get onload() { return mockReader.onload; } } as unknown as typeof FileReader;

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
        mockReader.onload?.({ target: { result: 'data:image/jpeg;base64,abc' } } as unknown as ProgressEvent<FileReader>);
      });

      await act(async () => {
        fireEvent.click(screen.getByText('Bastionne !'));
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("Échec du téléchargement de l'image"),
        'error',
      );

      global.FileReader = originalFileReader;
    });
  });
});
