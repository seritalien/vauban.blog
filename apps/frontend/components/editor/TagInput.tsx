'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type FC,
} from 'react';
import { useAvailableTags, type TagWithCount } from '@/hooks/use-tags';

interface TagInputProps {
  /** Currently selected tags */
  value: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Maximum number of tags allowed */
  maxTags?: number;
  /** Custom class name for the container */
  className?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * A tag input component with autocomplete functionality.
 *
 * Features:
 * - Autocomplete dropdown showing existing tags as user types
 * - Pill/chip display for selected tags
 * - Remove tag by clicking X
 * - Prevents duplicate tags (case-insensitive)
 * - Keyboard navigation (arrow keys, enter to select, escape to close, backspace to remove)
 *
 * @example
 * ```tsx
 * const [tags, setTags] = useState<string[]>([]);
 *
 * <TagInput
 *   value={tags}
 *   onChange={setTags}
 *   placeholder="Add tags..."
 *   maxTags={10}
 * />
 * ```
 */
const TagInput: FC<TagInputProps> = ({
  value,
  onChange,
  placeholder = 'Add tags...',
  maxTags = 10,
  className = '',
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { tags: availableTags, isLoading, getSuggestions } = useAvailableTags();

  // Get filtered suggestions based on input and already selected tags
  const suggestions = useCallback((): TagWithCount[] => {
    const rawSuggestions = getSuggestions(inputValue);

    // Filter out already selected tags (case-insensitive)
    const selectedLower = new Set(value.map((t) => t.toLowerCase()));

    return rawSuggestions.filter(
      (tag) => !selectedLower.has(tag.name.toLowerCase())
    );
  }, [inputValue, getSuggestions, value]);

  const currentSuggestions = suggestions();

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-suggestion]');
      const highlightedItem = items[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  /**
   * Check if a tag already exists (case-insensitive)
   */
  const tagExists = useCallback(
    (tagName: string): boolean => {
      const normalizedNew = tagName.toLowerCase().trim();
      return value.some((t) => t.toLowerCase() === normalizedNew);
    },
    [value]
  );

  /**
   * Add a new tag if it's valid and not a duplicate
   */
  const addTag = useCallback(
    (tagName: string) => {
      const trimmedTag = tagName.trim();

      if (!trimmedTag) {
        return;
      }

      if (value.length >= maxTags) {
        return;
      }

      if (tagExists(trimmedTag)) {
        // Tag already exists - clear input but don't add
        setInputValue('');
        return;
      }

      // Check if this tag exists in available tags (use the original casing)
      const existingTag = availableTags.find(
        (t) => t.name.toLowerCase() === trimmedTag.toLowerCase()
      );

      // Use the existing tag's casing if found, otherwise use as-is
      const finalTag = existingTag ? existingTag.name : trimmedTag;

      onChange([...value, finalTag]);
      setInputValue('');
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [value, onChange, maxTags, tagExists, availableTags]
  );

  /**
   * Remove a tag by index
   */
  const removeTag = useCallback(
    (index: number) => {
      const newTags = [...value];
      newTags.splice(index, 1);
      onChange(newTags);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen && inputValue.trim()) {
            setIsOpen(true);
          }
          setHighlightedIndex((prev) =>
            prev < currentSuggestions.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;

        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && currentSuggestions[highlightedIndex]) {
            addTag(currentSuggestions[highlightedIndex].name);
          } else if (inputValue.trim()) {
            addTag(inputValue);
          }
          break;

        case 'Escape':
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case 'Backspace':
          if (inputValue === '' && value.length > 0) {
            removeTag(value.length - 1);
          }
          break;

        case 'Tab':
          // Allow tab to add the current input if there's text
          if (inputValue.trim()) {
            e.preventDefault();
            addTag(inputValue);
          }
          break;

        case ',':
          // Comma acts as a separator
          e.preventDefault();
          if (inputValue.trim()) {
            addTag(inputValue);
          }
          break;
      }
    },
    [
      isOpen,
      inputValue,
      highlightedIndex,
      currentSuggestions,
      addTag,
      value,
      removeTag,
    ]
  );

  /**
   * Handle input change
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setIsOpen(newValue.trim().length > 0);
    },
    []
  );

  /**
   * Handle clicking on a suggestion
   */
  const handleSuggestionClick = useCallback(
    (tagName: string) => {
      addTag(tagName);
    },
    [addTag]
  );

  /**
   * Focus the input when clicking on the container
   */
  const handleContainerClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const canAddMore = value.length < maxTags;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Tag pills and input container */}
      <div
        onClick={handleContainerClick}
        className={`
          flex flex-wrap gap-2 p-2 border rounded-lg
          bg-white dark:bg-gray-900
          ${disabled
            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-600 cursor-text focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'
          }
        `}
      >
        {/* Selected tag pills */}
        {value.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                className="inline-flex items-center justify-center w-4 h-4 ml-0.5 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}

        {/* Input field */}
        {canAddMore && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (inputValue.trim()) {
                setIsOpen(true);
              }
            }}
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[120px] py-1 px-1 text-sm bg-transparent border-0 outline-none placeholder-gray-400 dark:placeholder-gray-500 disabled:cursor-not-allowed"
            aria-label="Add tag"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            aria-controls="tag-suggestions"
            role="combobox"
          />
        )}
      </div>

      {/* Helper text */}
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          {value.length} / {maxTags} tags
        </span>
        {isLoading && <span>Loading suggestions...</span>}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && currentSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          id="tag-suggestions"
          role="listbox"
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {currentSuggestions.slice(0, 10).map((suggestion, index) => (
            <div
              key={suggestion.name}
              data-suggestion
              role="option"
              aria-selected={highlightedIndex === index}
              onClick={() => handleSuggestionClick(suggestion.name)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={`
                px-3 py-2 cursor-pointer flex items-center justify-between
                ${
                  highlightedIndex === index
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <span className="font-medium">{suggestion.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {suggestion.count} {suggestion.count === 1 ? 'post' : 'posts'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Show "create new tag" option when input doesn't match any existing tag */}
      {isOpen &&
        inputValue.trim() &&
        currentSuggestions.length === 0 &&
        !tagExists(inputValue) && (
          <div
            ref={dropdownRef}
            id="tag-suggestions"
            role="listbox"
            className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
          >
            <div
              role="option"
              aria-selected={true}
              onClick={() => addTag(inputValue)}
              className="px-3 py-2 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <span className="font-medium">Create &quot;{inputValue.trim()}&quot;</span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                (new tag)
              </span>
            </div>
          </div>
        )}
    </div>
  );
};

export default TagInput;
