/**
 * Performance Testing Utilities
 *
 * Helpers for detecting N+1 queries, excessive re-renders, and memory leaks.
 */
import { expect, type Mock } from 'vitest';

/**
 * Create a call counter that wraps a mock function.
 * Returns the mock and a method to check call count.
 */
export function createCallCounter(mockFn: Mock) {
  return {
    mock: mockFn,
    get count() {
      return mockFn.mock.calls.length;
    },
    reset() {
      mockFn.mockClear();
    },
  };
}

/**
 * Assert that a mock function was called at most `max` times.
 * Useful for detecting N+1 query patterns.
 */
export function assertMaxCalls(mockFn: Mock, max: number, label: string) {
  const actual = mockFn.mock.calls.length;
  expect(actual, `${label}: expected at most ${max} calls, got ${actual}`).toBeLessThanOrEqual(max);
}

/**
 * Assert that a mock function was called exactly `expected` times.
 */
export function assertExactCalls(mockFn: Mock, expected: number, label: string) {
  const actual = mockFn.mock.calls.length;
  expect(actual, `${label}: expected exactly ${expected} calls, got ${actual}`).toBe(expected);
}

/**
 * Track render counts for a component.
 * Returns a ref object whose `.current` property increments on each render.
 */
export function createRenderCounter() {
  let count = 0;
  return {
    increment() {
      count++;
    },
    get count() {
      return count;
    },
    reset() {
      count = 0;
    },
  };
}

/**
 * Assert that a batch of N items results in at most `maxCalls` RPC calls,
 * detecting N+1 query patterns.
 */
export function assertNoNPlusOne(
  mockFn: Mock,
  itemCount: number,
  maxCallsPerItem: number,
  label: string
) {
  const actual = mockFn.mock.calls.length;
  const maxTotal = itemCount * maxCallsPerItem;
  expect(
    actual,
    `N+1 detected in ${label}: ${actual} calls for ${itemCount} items (max ${maxCallsPerItem}/item = ${maxTotal})`
  ).toBeLessThanOrEqual(maxTotal);
}
