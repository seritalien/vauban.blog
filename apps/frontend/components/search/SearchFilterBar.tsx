'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SearchFilters,
  SearchFilterBarProps,
  ActiveFilter,
  DateRangeOption,
  PriceFilter,
  VerificationFilter,
  SortOption,
  DEFAULT_FILTERS,
  DATE_RANGE_LABELS,
  PRICE_FILTER_LABELS,
  VERIFICATION_FILTER_LABELS,
  SORT_OPTION_LABELS,
} from './types';

// SVG Icons as components for better reusability
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Dropdown component for reusable select-like functionality
interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

interface DropdownProps<T extends string> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

function Dropdown<T extends string>({ value, options, onChange, label, className = '' }: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span>{selectedOption?.label ?? 'Select...'}</span>
        <ChevronDownIcon className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-20 w-full mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                value === option.value
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {value === option.value && <CheckIcon className="w-4 h-4 mr-2" />}
              <span className={value === option.value ? '' : 'ml-6'}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Author autocomplete component
interface AuthorAutocompleteProps {
  value: string;
  authors: string[];
  onChange: (value: string) => void;
}

function AuthorAutocomplete({ value, authors, onChange }: AuthorAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAuthors = useMemo(() => {
    if (!inputValue) return authors.slice(0, 10);
    const searchLower = inputValue.toLowerCase();
    return authors.filter((author) => author.toLowerCase().includes(searchLower)).slice(0, 10);
  }, [authors, inputValue]);

  const formatAuthorAddress = (address: string) => {
    if (address.length > 12) {
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    return address;
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Author</label>
      <input
        type="text"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Filter by author..."
        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
      {inputValue && (
        <button
          type="button"
          onClick={() => {
            setInputValue('');
            onChange('');
          }}
          className="absolute right-2 top-[26px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
      {isOpen && filteredAuthors.length > 0 && (
        <div className="absolute z-20 w-full mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-auto">
          {filteredAuthors.map((author) => (
            <button
              key={author}
              type="button"
              onClick={() => {
                setInputValue(author);
                onChange(author);
                setIsOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                value === author
                  ? 'text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="font-mono text-xs">{formatAuthorAddress(author)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Custom date range picker component
interface DateRangePickerProps {
  fromDate: Date | null;
  toDate: Date | null;
  onFromChange: (date: Date | null) => void;
  onToChange: (date: Date | null) => void;
}

function DateRangePicker({ fromDate, toDate, onFromChange, onToChange }: DateRangePickerProps) {
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const parseDateFromInput = (value: string): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
        <input
          type="date"
          value={formatDateForInput(fromDate)}
          onChange={(e) => onFromChange(parseDateFromInput(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
        <input
          type="date"
          value={formatDateForInput(toDate)}
          onChange={(e) => onToChange(parseDateFromInput(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>
    </div>
  );
}

// Filter chip component
interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
      >
        <CloseIcon className="w-3 h-3" />
      </button>
    </span>
  );
}

// Parse URL params to filters
function parseFiltersFromUrl(searchParams: URLSearchParams): Partial<SearchFilters> {
  const filters: Partial<SearchFilters> = {};

  const q = searchParams.get('q');
  if (q) filters.search = q;

  const tags = searchParams.get('tags');
  if (tags) filters.tags = tags.split(',').filter(Boolean);

  const dateRange = searchParams.get('dateRange') as DateRangeOption | null;
  if (dateRange && Object.keys(DATE_RANGE_LABELS).includes(dateRange)) {
    filters.dateRange = dateRange;
  }

  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  if (fromDate || toDate) {
    filters.customDateRange = {
      from: fromDate ? new Date(fromDate) : null,
      to: toDate ? new Date(toDate) : null,
    };
  }

  const price = searchParams.get('price') as PriceFilter | null;
  if (price && Object.keys(PRICE_FILTER_LABELS).includes(price)) {
    filters.priceFilter = price;
  }

  const verification = searchParams.get('verification') as VerificationFilter | null;
  if (verification && Object.keys(VERIFICATION_FILTER_LABELS).includes(verification)) {
    filters.verificationFilter = verification;
  }

  const author = searchParams.get('author');
  if (author) filters.author = author;

  const sortBy = searchParams.get('sortBy') as SortOption | null;
  if (sortBy && Object.keys(SORT_OPTION_LABELS).includes(sortBy)) {
    filters.sortBy = sortBy;
  }

  return filters;
}

// Build URL params from filters
function buildUrlParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search) params.set('q', filters.search);
  if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
  if (filters.dateRange !== 'all') params.set('dateRange', filters.dateRange);
  if (filters.dateRange === 'custom') {
    if (filters.customDateRange.from) {
      params.set('fromDate', filters.customDateRange.from.toISOString().split('T')[0]);
    }
    if (filters.customDateRange.to) {
      params.set('toDate', filters.customDateRange.to.toISOString().split('T')[0]);
    }
  }
  if (filters.priceFilter !== 'all') params.set('price', filters.priceFilter);
  if (filters.verificationFilter !== 'all') params.set('verification', filters.verificationFilter);
  if (filters.author) params.set('author', filters.author);
  if (filters.sortBy !== 'newest') params.set('sortBy', filters.sortBy);

  return params;
}

export default function SearchFilterBar({ allTags, allAuthors, onFilterChange }: SearchFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filters from URL params
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...parseFiltersFromUrl(searchParams),
  }));

  // State for search input (debounced separately)
  const [searchInput, setSearchInput] = useState(filters.search);

  // State for advanced filters visibility
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // Update URL and trigger filter change
  useEffect(() => {
    const params = buildUrlParams(filters);
    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : '/', { scroll: false });
    onFilterChange(filters);
  }, [filters, router, onFilterChange]);

  // Filter update handlers
  const updateFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput('');
  }, []);

  // Sort and deduplicate tags
  const sortedUniqueTags = useMemo(() => {
    const tagCounts = allTags.reduce(
      (acc, tag) => {
        acc[tag] = (acc[tag] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }, [allTags]);

  // Build active filters list for chips
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const chips: ActiveFilter[] = [];

    if (filters.search) {
      chips.push({
        type: 'search',
        label: `Search: "${filters.search}"`,
        value: filters.search,
        onRemove: () => {
          setSearchInput('');
          updateFilter('search', '');
        },
      });
    }

    filters.tags.forEach((tag) => {
      chips.push({
        type: 'tag',
        label: tag,
        value: tag,
        onRemove: () => toggleTag(tag),
      });
    });

    if (filters.dateRange !== 'all') {
      chips.push({
        type: 'dateRange',
        label: DATE_RANGE_LABELS[filters.dateRange],
        value: filters.dateRange,
        onRemove: () => updateFilter('dateRange', 'all'),
      });
    }

    if (filters.priceFilter !== 'all') {
      chips.push({
        type: 'price',
        label: PRICE_FILTER_LABELS[filters.priceFilter],
        value: filters.priceFilter,
        onRemove: () => updateFilter('priceFilter', 'all'),
      });
    }

    if (filters.verificationFilter !== 'all') {
      chips.push({
        type: 'verification',
        label: VERIFICATION_FILTER_LABELS[filters.verificationFilter],
        value: filters.verificationFilter,
        onRemove: () => updateFilter('verificationFilter', 'all'),
      });
    }

    if (filters.author) {
      const shortAuthor =
        filters.author.length > 12
          ? `${filters.author.slice(0, 6)}...${filters.author.slice(-4)}`
          : filters.author;
      chips.push({
        type: 'author',
        label: `Author: ${shortAuthor}`,
        value: filters.author,
        onRemove: () => updateFilter('author', ''),
      });
    }

    if (filters.sortBy !== 'newest') {
      chips.push({
        type: 'sort',
        label: `Sort: ${SORT_OPTION_LABELS[filters.sortBy]}`,
        value: filters.sortBy,
        onRemove: () => updateFilter('sortBy', 'newest'),
      });
    }

    return chips;
  }, [filters, toggleTag, updateFilter]);

  const hasFilters = activeFilters.length > 0;

  // Dropdown options
  const dateRangeOptions: DropdownOption<DateRangeOption>[] = Object.entries(DATE_RANGE_LABELS).map(
    ([value, label]) => ({ value: value as DateRangeOption, label })
  );

  const priceFilterOptions: DropdownOption<PriceFilter>[] = Object.entries(PRICE_FILTER_LABELS).map(
    ([value, label]) => ({ value: value as PriceFilter, label })
  );

  const verificationFilterOptions: DropdownOption<VerificationFilter>[] = Object.entries(
    VERIFICATION_FILTER_LABELS
  ).map(([value, label]) => ({ value: value as VerificationFilter, label }));

  const sortOptions: DropdownOption<SortOption>[] = Object.entries(SORT_OPTION_LABELS).map(
    ([value, label]) => ({ value: value as SortOption, label })
  );

  return (
    <div className="mb-6 sm:mb-8 space-y-4">
      {/* Search Bar and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search articles..."
            className="w-full px-4 py-3 pl-10 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="w-full sm:w-48">
          <Dropdown
            value={filters.sortBy}
            options={sortOptions}
            onChange={(value) => updateFilter('sortBy', value)}
            label="Sort by"
          />
        </div>
      </div>

      {/* Tags Filter */}
      {sortedUniqueTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sortedUniqueTags.slice(0, 15).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filters.tags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Advanced Filters Toggle (Mobile-friendly) */}
      <button
        type="button"
        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <FilterIcon className="w-4 h-4" />
        <span>Advanced Filters</span>
        <ChevronDownIcon
          className={`w-4 h-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <Dropdown
              value={filters.dateRange}
              options={dateRangeOptions}
              onChange={(value) => updateFilter('dateRange', value)}
              label="Date Range"
            />

            {/* Price Filter */}
            <Dropdown
              value={filters.priceFilter}
              options={priceFilterOptions}
              onChange={(value) => updateFilter('priceFilter', value)}
              label="Price"
            />

            {/* Verification Filter */}
            <Dropdown
              value={filters.verificationFilter}
              options={verificationFilterOptions}
              onChange={(value) => updateFilter('verificationFilter', value)}
              label="Verification"
            />

            {/* Author Filter */}
            <AuthorAutocomplete
              value={filters.author}
              authors={allAuthors}
              onChange={(value) => updateFilter('author', value)}
            />
          </div>

          {/* Custom Date Range (shown when dateRange is 'custom') */}
          {filters.dateRange === 'custom' && (
            <DateRangePicker
              fromDate={filters.customDateRange.from}
              toDate={filters.customDateRange.to}
              onFromChange={(date) =>
                updateFilter('customDateRange', { ...filters.customDateRange, from: date })
              }
              onToChange={(date) =>
                updateFilter('customDateRange', { ...filters.customDateRange, to: date })
              }
            />
          )}
        </div>
      )}

      {/* Active Filter Chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Active filters:</span>
          {activeFilters.map((filter, index) => (
            <FilterChip key={`${filter.type}-${filter.value}-${index}`} label={filter.label} onRemove={filter.onRemove} />
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
