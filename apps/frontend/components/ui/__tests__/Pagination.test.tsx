import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../Pagination';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPagination(
  props: Partial<React.ComponentProps<typeof Pagination>> = {}
) {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    onPageChange: vi.fn(),
    ...props,
  };
  return { ...render(<Pagination {...defaultProps} />), onPageChange: defaultProps.onPageChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Pagination', () => {
  // ===== Rendering =====

  describe('rendering', () => {
    it('renders nothing when totalPages is 1', () => {
      const { container } = renderPagination({ totalPages: 1 });
      expect(container.innerHTML).toBe('');
    });

    it('renders nothing when totalPages is 0', () => {
      const { container } = renderPagination({ totalPages: 0 });
      expect(container.innerHTML).toBe('');
    });

    it('renders pagination nav with aria-label', () => {
      renderPagination();
      expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    });

    it('renders previous and next buttons', () => {
      renderPagination();
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    });

    it('renders page number buttons for small page count', () => {
      renderPagination({ totalPages: 3, currentPage: 1 });
      expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();
    });

    it('marks current page with aria-current', () => {
      renderPagination({ currentPage: 2, totalPages: 5 });
      const page2 = screen.getByRole('button', { name: 'Page 2' });
      expect(page2).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark non-current pages with aria-current', () => {
      renderPagination({ currentPage: 2, totalPages: 5 });
      const page1 = screen.getByRole('button', { name: 'Page 1' });
      expect(page1).not.toHaveAttribute('aria-current');
    });
  });

  // ===== Boundary conditions =====

  describe('boundary conditions', () => {
    it('disables previous button on first page', () => {
      renderPagination({ currentPage: 1, totalPages: 5 });
      expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    });

    it('enables previous button when not on first page', () => {
      renderPagination({ currentPage: 3, totalPages: 5 });
      expect(screen.getByRole('button', { name: 'Previous page' })).not.toBeDisabled();
    });

    it('disables next button on last page', () => {
      renderPagination({ currentPage: 5, totalPages: 5 });
      expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    });

    it('enables next button when not on last page', () => {
      renderPagination({ currentPage: 3, totalPages: 5 });
      expect(screen.getByRole('button', { name: 'Next page' })).not.toBeDisabled();
    });
  });

  // ===== Ellipsis =====

  describe('ellipsis', () => {
    it('shows ellipsis when there are many pages', () => {
      renderPagination({ currentPage: 5, totalPages: 10 });
      const ellipses = screen.getAllByText('...');
      expect(ellipses.length).toBeGreaterThanOrEqual(1);
    });

    it('always shows first and last page', () => {
      renderPagination({ currentPage: 5, totalPages: 10 });
      expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Page 10' })).toBeInTheDocument();
    });

    it('shows pages around current page', () => {
      renderPagination({ currentPage: 5, totalPages: 10 });
      expect(screen.getByRole('button', { name: 'Page 4' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Page 5' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Page 6' })).toBeInTheDocument();
    });
  });

  // ===== Navigation =====

  describe('navigation', () => {
    it('calls onPageChange with previous page when clicking previous', () => {
      const { onPageChange } = renderPagination({ currentPage: 3, totalPages: 5 });
      fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
      expect(onPageChange).toHaveBeenCalledWith(2);
    });

    it('calls onPageChange with next page when clicking next', () => {
      const { onPageChange } = renderPagination({ currentPage: 3, totalPages: 5 });
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('calls onPageChange with clicked page number', () => {
      const { onPageChange } = renderPagination({ currentPage: 3, totalPages: 5 });
      fireEvent.click(screen.getByRole('button', { name: 'Page 4' }));
      expect(onPageChange).toHaveBeenCalledWith(4);
    });

    it('calls onPageChange with page 1 when clicking first page', () => {
      const { onPageChange } = renderPagination({ currentPage: 5, totalPages: 10 });
      fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));
      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  // ===== Two pages =====

  describe('two pages', () => {
    it('renders exactly two page buttons for 2 pages', () => {
      renderPagination({ currentPage: 1, totalPages: 2 });
      expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();
    });
  });
});
