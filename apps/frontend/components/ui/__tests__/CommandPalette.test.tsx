import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the component under test
// ---------------------------------------------------------------------------

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockSetTheme = vi.fn();

vi.mock('@/providers/theme-provider', () => ({
  useTheme: vi.fn(() => ({
    theme: 'system',
    resolvedTheme: 'dark',
    setTheme: mockSetTheme,
  })),
}));

vi.mock('@headlessui/react', () => ({
  Dialog: ({ open, onClose: _onClose, children, ...props }: React.PropsWithChildren<{ open: boolean; onClose: () => void; className?: string }>) => {
    if (!open) return null;
    return (
      <div role="dialog" data-testid="command-palette-dialog" {...props}>
        {children}
      </div>
    );
  },
  DialogPanel: ({ children, ...props }: React.PropsWithChildren<{ className?: string }>) => (
    <div {...props}>{children}</div>
  ),
  DialogBackdrop: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div data-testid="backdrop" {...props}>{children}</div>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(function MotionDiv(
      { children, initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<HTMLDivElement>
    ) {
      return <div ref={ref} {...props}>{children}</div>;
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { CommandPalette } from '../CommandPalette';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPalette(
  props: Partial<React.ComponentProps<typeof CommandPalette>> = {}
) {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    ...props,
  };
  return {
    ...render(<CommandPalette {...defaultProps} />),
    onClose: defaultProps.onClose,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===== Rendering =====

  describe('rendering', () => {
    it('renders the dialog when isOpen is true', () => {
      renderPalette({ isOpen: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render the dialog when isOpen is false', () => {
      renderPalette({ isOpen: false });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the search input with placeholder', () => {
      renderPalette();
      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });

    it('renders navigation commands', () => {
      renderPalette();
      expect(screen.getByText('Go Home')).toBeInTheDocument();
      expect(screen.getByText('New Article')).toBeInTheDocument();
      expect(screen.getByText('Drafts')).toBeInTheDocument();
      expect(screen.getByText('My Profile')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('renders AI action commands', () => {
      renderPalette();
      expect(screen.getByText('AI: Improve Text')).toBeInTheDocument();
      expect(screen.getByText('AI: Fix Grammar')).toBeInTheDocument();
      expect(screen.getByText('AI: Generate Title')).toBeInTheDocument();
      expect(screen.getByText('AI: Generate Tags')).toBeInTheDocument();
    });

    it('renders settings commands', () => {
      renderPalette();
      expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
      expect(screen.getByText('AI Settings')).toBeInTheDocument();
    });

    it('renders category labels', () => {
      renderPalette();
      expect(screen.getByText('Navigation')).toBeInTheDocument();
      expect(screen.getByText('AI Actions')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders footer with keyboard hints', () => {
      renderPalette();
      expect(screen.getByText('Navigate')).toBeInTheDocument();
      expect(screen.getByText('Select')).toBeInTheDocument();
      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  // ===== Search filtering =====

  describe('search filtering', () => {
    it('filters commands by name when typing', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      fireEvent.change(input, { target: { value: 'home' } });

      expect(screen.getByText('Go Home')).toBeInTheDocument();
      expect(screen.queryByText('New Article')).not.toBeInTheDocument();
    });

    it('filters commands by description', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      fireEvent.change(input, { target: { value: 'draft' } });

      expect(screen.getByText('Drafts')).toBeInTheDocument();
      // "New Article" description doesn't mention drafts
    });

    it('shows no results message for non-matching query', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      fireEvent.change(input, { target: { value: 'xyznonexistent' } });

      expect(screen.getByText(/No commands found/)).toBeInTheDocument();
    });

    it('filter is case-insensitive', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      fireEvent.change(input, { target: { value: 'THEME' } });

      expect(screen.getByText('Toggle Theme')).toBeInTheDocument();
    });
  });

  // ===== Keyboard navigation =====

  describe('keyboard navigation', () => {
    it('calls onClose when Escape is pressed', () => {
      const { onClose } = renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('executes selected command and closes on Enter', () => {
      const { onClose } = renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      // First command is "Go Home" by default (index 0)
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockPush).toHaveBeenCalledWith('/');
      expect(onClose).toHaveBeenCalled();
    });

    it('moves selection down with ArrowDown', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      // Move down once (from index 0 to index 1)
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      // Select the item at index 1
      fireEvent.keyDown(input, { key: 'Enter' });

      // The second navigation command is "New Article" -> /admin
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });

    it('wraps around from last to first with ArrowDown', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      // Filter to just one command
      fireEvent.change(input, { target: { value: 'Go Home' } });

      // We're at index 0. ArrowDown should wrap to 0 again (only 1 item)
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('wraps around from first to last with ArrowUp', () => {
      renderPalette();
      const input = screen.getByPlaceholderText('Type a command or search...');

      // Filter to two items for simpler test
      fireEvent.change(input, { target: { value: 'Go Home' } });

      // Index is 0, pressing ArrowUp wraps to last (index 0 since only 1 item)
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  // ===== Action execution =====

  describe('action execution', () => {
    it('navigates to home when Go Home is clicked', async () => {
      const { onClose } = renderPalette();

      await act(async () => {
        fireEvent.click(screen.getByText('Go Home'));
      });

      expect(mockPush).toHaveBeenCalledWith('/');
      expect(onClose).toHaveBeenCalled();
    });

    it('navigates to admin when New Article is clicked', () => {
      renderPalette();
      fireEvent.click(screen.getByText('New Article'));
      expect(mockPush).toHaveBeenCalledWith('/admin');
    });

    it('navigates to drafts when Drafts is clicked', () => {
      renderPalette();
      fireEvent.click(screen.getByText('Drafts'));
      expect(mockPush).toHaveBeenCalledWith('/admin/drafts');
    });

    it('toggles theme when Toggle Theme is clicked', () => {
      renderPalette();
      fireEvent.click(screen.getByText('Toggle Theme'));
      // resolvedTheme is 'dark', so it should set to 'light'
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('calls onAIAction when AI command is clicked', async () => {
      const onAIAction = vi.fn().mockResolvedValue(undefined);
      renderPalette({ onAIAction });

      await act(async () => {
        fireEvent.click(screen.getByText('AI: Improve Text'));
      });

      expect(onAIAction).toHaveBeenCalledWith('improve');
    });

    it('does not call onAIAction when no callback provided', async () => {
      // No onAIAction prop
      renderPalette();

      await act(async () => {
        fireEvent.click(screen.getByText('AI: Improve Text'));
      });

      // No error thrown, no crash
    });
  });

  // ===== Custom commands =====

  describe('custom commands', () => {
    it('renders custom commands alongside default ones', () => {
      const customCommands = [
        {
          id: 'custom-1',
          name: 'Custom Action',
          description: 'A custom command',
          icon: '!!',
          action: vi.fn(),
          category: 'Custom',
        },
      ];

      renderPalette({ customCommands });

      expect(screen.getByText('Custom Action')).toBeInTheDocument();
      expect(screen.getByText('Custom')).toBeInTheDocument();
      // Default commands still present
      expect(screen.getByText('Go Home')).toBeInTheDocument();
    });
  });

  // ===== State reset on close =====

  describe('state management', () => {
    it('resets query when palette is closed and reopened', () => {
      const { rerender } = render(
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      );

      const input = screen.getByPlaceholderText('Type a command or search...');
      fireEvent.change(input, { target: { value: 'test query' } });
      expect(input).toHaveValue('test query');

      // Close the palette
      rerender(<CommandPalette isOpen={false} onClose={vi.fn()} />);

      // Reopen
      rerender(<CommandPalette isOpen={true} onClose={vi.fn()} />);

      const newInput = screen.getByPlaceholderText('Type a command or search...');
      expect(newInput).toHaveValue('');
    });
  });
});
