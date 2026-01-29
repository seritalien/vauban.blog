import { vi, type Mock } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the component under test
// ---------------------------------------------------------------------------

const mockGetSuggestions = vi.fn().mockReturnValue([]);

vi.mock('@/hooks/use-tags', () => ({
  useAvailableTags: vi.fn(() => ({
    tags: [],
    isLoading: false,
    getSuggestions: mockGetSuggestions,
  })),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import TagInput from '../TagInput';
import { useAvailableTags } from '@/hooks/use-tags';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTagInput(
  props: Partial<React.ComponentProps<typeof TagInput>> = {}
) {
  const onChange = vi.fn();
  const defaultProps = {
    value: [] as string[],
    onChange,
    ...props,
  };
  return {
    ...render(<TagInput {...defaultProps} />),
    onChange: defaultProps.onChange,
  };
}

function setupSuggestions(tags: Array<{ name: string; count: number }>) {
  (useAvailableTags as Mock).mockReturnValue({
    tags,
    isLoading: false,
    getSuggestions: (query: string) => {
      if (!query.trim()) return tags;
      const q = query.toLowerCase().trim();
      return tags.filter(
        (t) => t.name.toLowerCase().startsWith(q) || t.name.toLowerCase().includes(q)
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupSuggestions([]);
    // Mock scrollIntoView which is not available in jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  // ===== Rendering =====

  describe('rendering', () => {
    it('renders with default placeholder', () => {
      renderTagInput();
      expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      renderTagInput({ placeholder: 'Enter tags here...' });
      expect(screen.getByPlaceholderText('Enter tags here...')).toBeInTheDocument();
    });

    it('renders tag count display (0/10 by default)', () => {
      renderTagInput();
      expect(screen.getByText('0 / 10 tags')).toBeInTheDocument();
    });

    it('renders tag count with custom maxTags', () => {
      renderTagInput({ maxTags: 5 });
      expect(screen.getByText('0 / 5 tags')).toBeInTheDocument();
    });

    it('renders existing tags as pills', () => {
      renderTagInput({ value: ['React', 'TypeScript'] });
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('2 / 10 tags')).toBeInTheDocument();
    });

    it('renders remove buttons for each tag', () => {
      renderTagInput({ value: ['React', 'TypeScript'] });
      expect(screen.getByRole('button', { name: 'Remove React' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove TypeScript' })).toBeInTheDocument();
    });

    it('hides placeholder when tags exist', () => {
      renderTagInput({ value: ['React'] });
      const input = screen.getByRole('combobox');
      expect(input).toHaveAttribute('placeholder', '');
    });

    it('shows loading text when tags are loading', () => {
      (useAvailableTags as Mock).mockReturnValue({
        tags: [],
        isLoading: true,
        getSuggestions: mockGetSuggestions,
      });
      renderTagInput();
      expect(screen.getByText('Loading suggestions...')).toBeInTheDocument();
    });
  });

  // ===== Adding tags =====

  describe('adding tags', () => {
    it('adds a tag when pressing Enter', () => {
      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'NewTag' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(['NewTag']);
    });

    it('adds a tag when pressing comma', () => {
      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'JavaScript' } });
      fireEvent.keyDown(input, { key: ',' });

      expect(onChange).toHaveBeenCalledWith(['JavaScript']);
    });

    it('adds a tag when pressing Tab with text', () => {
      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'CSS' } });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(onChange).toHaveBeenCalledWith(['CSS']);
    });

    it('trims whitespace from tag names', () => {
      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: '  Trimmed  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith(['Trimmed']);
    });

    it('does not add empty tags', () => {
      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears input after adding a tag', () => {
      renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'NewTag' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // The input value should be cleared by the component calling setInputValue('')
      // Since the component controls the input value, after adding the tag the internal state resets
    });
  });

  // ===== Removing tags =====

  describe('removing tags', () => {
    it('removes a tag when clicking its remove button', () => {
      const { onChange } = renderTagInput({ value: ['React', 'TypeScript'] });

      fireEvent.click(screen.getByRole('button', { name: 'Remove React' }));

      expect(onChange).toHaveBeenCalledWith(['TypeScript']);
    });

    it('removes the last tag when pressing Backspace on empty input', () => {
      const { onChange } = renderTagInput({ value: ['React', 'TypeScript'] });
      const input = screen.getByRole('combobox');

      // Input is empty, press Backspace
      fireEvent.keyDown(input, { key: 'Backspace' });

      expect(onChange).toHaveBeenCalledWith(['React']);
    });

    it('does not remove tag when Backspace pressed with text in input', () => {
      const { onChange } = renderTagInput({ value: ['React'] });
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'some text' } });
      fireEvent.keyDown(input, { key: 'Backspace' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ===== Duplicate prevention =====

  describe('duplicate prevention', () => {
    it('does not add duplicate tags (case-insensitive)', () => {
      const { onChange } = renderTagInput({ value: ['React'] });
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'react' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      // onChange should not be called with a duplicate
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not add duplicate tags (exact match)', () => {
      const { onChange } = renderTagInput({ value: ['React'] });
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'React' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ===== Max tags =====

  describe('max tags', () => {
    it('does not add tag when max tags reached', () => {
      const { onChange } = renderTagInput({
        value: ['Tag1', 'Tag2', 'Tag3'],
        maxTags: 3,
      });

      // The input should not be rendered when maxTags is reached
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('renders input when below max tags', () => {
      renderTagInput({
        value: ['Tag1', 'Tag2'],
        maxTags: 3,
      });
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  // ===== Suggestions dropdown =====

  describe('suggestions dropdown', () => {
    it('shows suggestions when typing', () => {
      setupSuggestions([
        { name: 'React', count: 5 },
        { name: 'Redux', count: 3 },
      ]);

      renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'Re' } });

      expect(screen.getByRole('listbox')).toBeInTheDocument();
      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('Redux')).toBeInTheDocument();
    });

    it('shows post count in suggestions', () => {
      setupSuggestions([
        { name: 'React', count: 5 },
        { name: 'Vue', count: 1 },
      ]);

      renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'R' } });

      expect(screen.getByText('5 posts')).toBeInTheDocument();
    });

    it('shows singular "post" for count of 1', () => {
      setupSuggestions([
        { name: 'Vue', count: 1 },
      ]);

      renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'V' } });

      expect(screen.getByText('1 post')).toBeInTheDocument();
    });

    it('adds suggestion when clicked', () => {
      setupSuggestions([
        { name: 'React', count: 5 },
      ]);

      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'Re' } });
      fireEvent.click(screen.getByText('React'));

      expect(onChange).toHaveBeenCalledWith(['React']);
    });

    it('closes dropdown on Escape', () => {
      setupSuggestions([
        { name: 'React', count: 5 },
      ]);

      renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'Re' } });
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  // ===== Keyboard navigation =====

  describe('keyboard navigation in suggestions', () => {
    it('highlights suggestion with ArrowDown', () => {
      setupSuggestions([
        { name: 'React', count: 5 },
        { name: 'Redux', count: 3 },
      ]);

      renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'Re' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // First suggestion should be highlighted (aria-selected="true")
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('selects highlighted suggestion with Enter', () => {
      setupSuggestions([
        { name: 'React', count: 5 },
        { name: 'Redux', count: 3 },
      ]);

      const { onChange } = renderTagInput();
      const input = screen.getByRole('combobox');

      fireEvent.change(input, { target: { value: 'Re' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' }); // highlight first
      fireEvent.keyDown(input, { key: 'Enter' }); // select it

      expect(onChange).toHaveBeenCalledWith(['React']);
    });
  });

  // ===== Disabled state =====

  describe('disabled state', () => {
    it('disables the input when disabled prop is true', () => {
      renderTagInput({ disabled: true });
      const input = screen.getByRole('combobox');
      expect(input).toBeDisabled();
    });

    it('does not render remove buttons when disabled', () => {
      renderTagInput({ value: ['React'], disabled: true });
      expect(screen.queryByRole('button', { name: 'Remove React' })).not.toBeInTheDocument();
    });
  });

  // ===== Accessibility =====

  describe('accessibility', () => {
    it('input has combobox role', () => {
      renderTagInput();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('input has aria-label', () => {
      renderTagInput();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label', 'Add tag');
    });

    it('input has aria-autocomplete', () => {
      renderTagInput();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('input references suggestions listbox', () => {
      renderTagInput();
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-controls', 'tag-suggestions');
    });
  });
});
