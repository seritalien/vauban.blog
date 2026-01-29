import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn().mockReturnValue('5 minutes ago'),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { SaveStatusIndicator, type SaveStatus } from '../SaveStatusIndicator';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderIndicator(
  props: Partial<React.ComponentProps<typeof SaveStatusIndicator>> = {}
) {
  const defaultProps = {
    status: 'idle' as SaveStatus,
    lastSavedAt: null as Date | null,
    ...props,
  };
  return render(<SaveStatusIndicator {...defaultProps} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveStatusIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (formatDistanceToNow as ReturnType<typeof vi.fn>).mockReturnValue('5 minutes ago');
  });

  // ===== Idle state =====

  describe('idle state', () => {
    it('shows "Not saved" when no lastSavedAt', () => {
      renderIndicator({ status: 'idle', lastSavedAt: null });
      expect(screen.getByText('Not saved')).toBeInTheDocument();
    });

    it('shows "Saved X ago" when lastSavedAt is provided', () => {
      renderIndicator({
        status: 'idle',
        lastSavedAt: new Date(),
      });
      expect(screen.getByText('Saved 5 minutes ago')).toBeInTheDocument();
    });

    it('applies gray text styling', () => {
      renderIndicator({ status: 'idle', lastSavedAt: null });
      const statusText = screen.getByText('Not saved').parentElement;
      expect(statusText?.className).toContain('text-gray-500');
    });
  });

  // ===== Saving state =====

  describe('saving state', () => {
    it('shows "Saving..." text', () => {
      renderIndicator({ status: 'saving' });
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows spinner animation', () => {
      renderIndicator({ status: 'saving' });
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeNull();
    });

    it('applies blue text styling', () => {
      renderIndicator({ status: 'saving' });
      const statusText = screen.getByText('Saving...').parentElement;
      expect(statusText?.className).toContain('text-blue-600');
    });
  });

  // ===== Saved state =====

  describe('saved state', () => {
    it('shows "Saved X ago" text', () => {
      renderIndicator({
        status: 'saved',
        lastSavedAt: new Date(),
      });
      expect(screen.getByText('Saved 5 minutes ago')).toBeInTheDocument();
    });

    it('applies green text styling', () => {
      renderIndicator({
        status: 'saved',
        lastSavedAt: new Date(),
      });
      const statusText = screen.getByText('Saved 5 minutes ago').parentElement;
      expect(statusText?.className).toContain('text-green-600');
    });

    it('shows checkmark icon', () => {
      renderIndicator({
        status: 'saved',
        lastSavedAt: new Date(),
      });
      // The check icon SVG uses a specific path with fillRule="evenodd"
      const svgs = document.querySelectorAll('svg');
      const hasCheckIcon = Array.from(svgs).some(svg =>
        svg.innerHTML.includes('fillRule') || svg.innerHTML.includes('fill-rule')
      );
      expect(hasCheckIcon).toBe(true);
    });
  });

  // ===== Error state =====

  describe('error state', () => {
    it('shows default "Save failed" text', () => {
      renderIndicator({ status: 'error' });
      expect(screen.getByText('Save failed')).toBeInTheDocument();
    });

    it('shows custom error message', () => {
      renderIndicator({
        status: 'error',
        errorMessage: 'Network timeout',
      });
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });

    it('applies red text styling', () => {
      renderIndicator({ status: 'error' });
      const statusText = screen.getByText('Save failed').parentElement;
      expect(statusText?.className).toContain('text-red-600');
    });
  });

  // ===== Conflict state =====

  describe('conflict state', () => {
    it('shows "Conflict detected" text', () => {
      renderIndicator({ status: 'conflict' });
      expect(screen.getByText('Conflict detected')).toBeInTheDocument();
    });

    it('applies yellow text styling', () => {
      renderIndicator({ status: 'conflict' });
      const statusText = screen.getByText('Conflict detected').parentElement;
      expect(statusText?.className).toContain('text-yellow-600');
    });
  });

  // ===== Snapshots / History button =====

  describe('history button', () => {
    it('shows History button when hasSnapshots and onViewSnapshots', () => {
      const onViewSnapshots = vi.fn();
      renderIndicator({
        status: 'idle',
        lastSavedAt: null,
        hasSnapshots: true,
        onViewSnapshots,
      });
      expect(screen.getByTitle('View backup history')).toBeInTheDocument();
    });

    it('does not show History button when no snapshots', () => {
      renderIndicator({
        status: 'idle',
        lastSavedAt: null,
        hasSnapshots: false,
      });
      expect(screen.queryByTitle('View backup history')).not.toBeInTheDocument();
    });

    it('does not show History button when no onViewSnapshots callback', () => {
      renderIndicator({
        status: 'idle',
        lastSavedAt: null,
        hasSnapshots: true,
      });
      expect(screen.queryByTitle('View backup history')).not.toBeInTheDocument();
    });

    it('calls onViewSnapshots when History button is clicked', () => {
      const onViewSnapshots = vi.fn();
      renderIndicator({
        status: 'idle',
        lastSavedAt: null,
        hasSnapshots: true,
        onViewSnapshots,
      });
      fireEvent.click(screen.getByTitle('View backup history'));
      expect(onViewSnapshots).toHaveBeenCalledTimes(1);
    });

    it('contains "History" text in sr-only span', () => {
      const onViewSnapshots = vi.fn();
      renderIndicator({
        status: 'idle',
        lastSavedAt: null,
        hasSnapshots: true,
        onViewSnapshots,
      });
      expect(screen.getByText('History')).toBeInTheDocument();
    });
  });

  // ===== Time ago updates =====

  describe('time formatting', () => {
    it('calls formatDistanceToNow with lastSavedAt and addSuffix option', () => {
      const now = new Date(2025, 0, 1, 12, 0, 0);
      renderIndicator({
        status: 'idle',
        lastSavedAt: now,
      });
      expect(formatDistanceToNow).toHaveBeenCalledWith(now, { addSuffix: true });
    });

    it('does not call formatDistanceToNow when lastSavedAt is null', () => {
      renderIndicator({
        status: 'idle',
        lastSavedAt: null,
      });
      expect(formatDistanceToNow).not.toHaveBeenCalled();
    });
  });
});
