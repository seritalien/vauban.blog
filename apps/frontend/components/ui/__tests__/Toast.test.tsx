import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(function MotionDiv(
      { children, initial: _i, animate: _a, exit: _e, layout: _l, transition: _t, ...props }: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<HTMLDivElement>
    ) {
      void _i; void _a; void _e; void _l; void _t; // Suppress unused warnings
      return <div ref={ref} {...props}>{children}</div>;
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { ToastProvider, useToast } from '../Toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A test consumer that exposes toast actions via buttons */
function ToastConsumer() {
  const { showToast, dismissToast, toasts } = useToast();
  return (
    <div>
      <button onClick={() => showToast('Success message', 'success')}>Show Success</button>
      <button onClick={() => showToast('Error message', 'error')}>Show Error</button>
      <button onClick={() => showToast('Warning message', 'warning')}>Show Warning</button>
      <button onClick={() => showToast('Info message', 'info')}>Show Info</button>
      <button onClick={() => showToast('No auto-dismiss', 'info', 0)}>Show Persistent</button>
      <button onClick={() => showToast('Short toast', 'info', 100)}>Show Short</button>
      {toasts.length > 0 && (
        <button onClick={() => dismissToast(toasts[0].id)}>Dismiss First</button>
      )}
      <span data-testid="toast-count">{toasts.length}</span>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <ToastConsumer />
    </ToastProvider>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===== Rendering =====

  describe('rendering', () => {
    it('renders children without any toasts initially', () => {
      renderWithProvider();
      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });

    it('renders a success toast with correct message', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Success'));
      });
      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders an error toast with correct message', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Error'));
      });
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('renders a warning toast with correct message', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Warning'));
      });
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('renders an info toast with correct message', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Info'));
      });
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });
  });

  // ===== Multiple toasts =====

  describe('multiple toasts', () => {
    it('can show multiple toasts at once', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Success'));
        fireEvent.click(screen.getByText('Show Error'));
      });
      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
      expect(screen.getByTestId('toast-count')).toHaveTextContent('2');
    });
  });

  // ===== Auto-dismiss =====

  describe('auto-dismiss', () => {
    it('automatically dismisses a toast after the duration', async () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Short'));
      });
      expect(screen.getByText('Short toast')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(screen.queryByText('Short toast')).not.toBeInTheDocument();
    });

    it('does not auto-dismiss a persistent toast (duration = 0)', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Persistent'));
      });
      expect(screen.getByText('No auto-dismiss')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(screen.getByText('No auto-dismiss')).toBeInTheDocument();
    });
  });

  // ===== Manual dismiss =====

  describe('manual dismiss', () => {
    it('dismisses toast when clicking dismiss button on the toast', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Success'));
      });
      expect(screen.getByText('Success message')).toBeInTheDocument();

      const dismissBtn = screen.getByRole('button', { name: 'Dismiss' });
      act(() => {
        fireEvent.click(dismissBtn);
      });

      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    });

    it('dismisses toast via context dismissToast function', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Success'));
      });
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      act(() => {
        fireEvent.click(screen.getByText('Dismiss First'));
      });

      expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
    });
  });

  // ===== Toast types styling =====

  describe('toast types', () => {
    it('success toast has green background', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Success'));
      });
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('bg-green-600');
    });

    it('error toast has red background', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Error'));
      });
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('bg-red-600');
    });

    it('warning toast has yellow background', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Warning'));
      });
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('bg-yellow-500');
    });

    it('info toast has blue background', () => {
      renderWithProvider();
      act(() => {
        fireEvent.click(screen.getByText('Show Info'));
      });
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('bg-blue-600');
    });
  });

  // ===== useToast outside provider =====

  describe('useToast outside provider', () => {
    it('throws error when used outside ToastProvider', () => {
      // Suppress console.error from React's error boundary
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ToastConsumer />);
      }).toThrow('useToast must be used within ToastProvider');

      spy.mockRestore();
    });
  });
});
