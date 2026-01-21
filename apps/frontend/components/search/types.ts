/**
 * Types for the advanced search and filter functionality
 */

export type DateRangeOption = 'all' | 'last_week' | 'last_month' | 'last_year' | 'custom';

export type PriceFilter = 'all' | 'free' | 'paid';

export type VerificationFilter = 'all' | 'verified';

export type SortOption = 'newest' | 'oldest' | 'most_liked' | 'most_commented';

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export interface SearchFilters {
  search: string;
  tags: string[];
  dateRange: DateRangeOption;
  customDateRange: DateRange;
  priceFilter: PriceFilter;
  verificationFilter: VerificationFilter;
  author: string;
  sortBy: SortOption;
}

export interface SearchFilterBarProps {
  allTags: string[];
  allAuthors: string[];
  onFilterChange: (filters: SearchFilters) => void;
}

export interface ActiveFilter {
  type: 'search' | 'tag' | 'dateRange' | 'price' | 'verification' | 'author' | 'sort';
  label: string;
  value: string;
  onRemove: () => void;
}

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: SearchFilters = {
  search: '',
  tags: [],
  dateRange: 'all',
  customDateRange: { from: null, to: null },
  priceFilter: 'all',
  verificationFilter: 'all',
  author: '',
  sortBy: 'newest',
};

/**
 * Display labels for filter options
 */
export const DATE_RANGE_LABELS: Record<DateRangeOption, string> = {
  all: 'All time',
  last_week: 'Last week',
  last_month: 'Last month',
  last_year: 'Last year',
  custom: 'Custom range',
};

export const PRICE_FILTER_LABELS: Record<PriceFilter, string> = {
  all: 'All articles',
  free: 'Free only',
  paid: 'Paid only',
};

export const VERIFICATION_FILTER_LABELS: Record<VerificationFilter, string> = {
  all: 'All articles',
  verified: 'Verified only',
};

export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  most_liked: 'Most liked',
  most_commented: 'Most commented',
};
