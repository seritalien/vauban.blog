import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

// Only set up window mocks when running in jsdom/browser environment
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });

  // Mock window.dispatchEvent for storage events
  const originalDispatchEvent = window.dispatchEvent;
  window.dispatchEvent = vi.fn((event: Event) => {
    return originalDispatchEvent.call(window, event);
  });
}

// Reset localStorage mock before each test
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});
