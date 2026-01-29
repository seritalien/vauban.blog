import { describe, it, expect, vi } from 'vitest';
import {
  storeCommentContent,
  getCommentContent,
  hasCommentContent,
  cleanupOldComments,
} from '../comment-storage';

// =============================================================================
// storeCommentContent
// =============================================================================

describe('storeCommentContent', () => {
  it('stores content by hash in localStorage', () => {
    storeCommentContent('hash_abc', 'Hello world');

    const stored = JSON.parse(
      localStorage.getItem('vauban_comments') as string
    );
    expect(stored['hash_abc']).toBeDefined();
    expect(stored['hash_abc'].content).toBe('Hello world');
    expect(typeof stored['hash_abc'].createdAt).toBe('number');
  });

  it('stores multiple comments under different hashes', () => {
    storeCommentContent('hash_1', 'First comment');
    storeCommentContent('hash_2', 'Second comment');

    const stored = JSON.parse(
      localStorage.getItem('vauban_comments') as string
    );
    expect(stored['hash_1'].content).toBe('First comment');
    expect(stored['hash_2'].content).toBe('Second comment');
  });

  it('overwrites content for an existing hash', () => {
    storeCommentContent('hash_abc', 'Original');
    storeCommentContent('hash_abc', 'Updated');

    const stored = JSON.parse(
      localStorage.getItem('vauban_comments') as string
    );
    expect(stored['hash_abc'].content).toBe('Updated');
  });
});

// =============================================================================
// getCommentContent
// =============================================================================

describe('getCommentContent', () => {
  it('retrieves stored content by hash', () => {
    storeCommentContent('hash_abc', 'Hello world');

    expect(getCommentContent('hash_abc')).toBe('Hello world');
  });

  it('returns null for unknown hash', () => {
    expect(getCommentContent('non_existent')).toBeNull();
  });

  it('returns null when localStorage is empty', () => {
    expect(getCommentContent('any_hash')).toBeNull();
  });
});

// =============================================================================
// hasCommentContent
// =============================================================================

describe('hasCommentContent', () => {
  it('returns true for stored hash', () => {
    storeCommentContent('hash_abc', 'Hello');

    expect(hasCommentContent('hash_abc')).toBe(true);
  });

  it('returns false for unknown hash', () => {
    expect(hasCommentContent('unknown')).toBe(false);
  });

  it('returns false when store is empty', () => {
    expect(hasCommentContent('any')).toBe(false);
  });
});

// =============================================================================
// cleanupOldComments
// =============================================================================

describe('cleanupOldComments', () => {
  it('removes entries older than 30 days', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const store = {
      old_hash: {
        content: 'Old comment',
        createdAt: thirtyOneDaysAgo,
      },
    };
    localStorage.setItem('vauban_comments', JSON.stringify(store));

    cleanupOldComments();

    const result = JSON.parse(
      localStorage.getItem('vauban_comments') as string
    );
    expect(result['old_hash']).toBeUndefined();
  });

  it('keeps recent entries', () => {
    const now = Date.now();
    const store = {
      recent_hash: {
        content: 'Recent comment',
        createdAt: now,
      },
    };
    localStorage.setItem('vauban_comments', JSON.stringify(store));

    cleanupOldComments();

    const result = JSON.parse(
      localStorage.getItem('vauban_comments') as string
    );
    expect(result['recent_hash']).toBeDefined();
    expect(result['recent_hash'].content).toBe('Recent comment');
  });

  it('removes old entries and keeps recent entries in the same store', () => {
    const now = Date.now();
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    const store = {
      old_hash: {
        content: 'Old comment',
        createdAt: thirtyOneDaysAgo,
      },
      recent_hash: {
        content: 'Recent comment',
        createdAt: now,
      },
    };
    localStorage.setItem('vauban_comments', JSON.stringify(store));

    cleanupOldComments();

    const result = JSON.parse(
      localStorage.getItem('vauban_comments') as string
    );
    expect(result['old_hash']).toBeUndefined();
    expect(result['recent_hash']).toBeDefined();
  });

  it('handles empty store gracefully', () => {
    localStorage.setItem('vauban_comments', JSON.stringify({}));

    expect(() => cleanupOldComments()).not.toThrow();
  });

  it('handles no stored data gracefully', () => {
    expect(() => cleanupOldComments()).not.toThrow();
  });

  it('does not update localStorage when no entries need cleanup', () => {
    const now = Date.now();
    const store = {
      recent_hash: {
        content: 'Recent comment',
        createdAt: now,
      },
    };
    localStorage.setItem('vauban_comments', JSON.stringify(store));

    // Clear the mock call history after setup
    vi.mocked(localStorage.setItem).mockClear();

    cleanupOldComments();

    // setItem should NOT be called again because nothing changed
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
});
