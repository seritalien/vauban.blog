/**
 * Local storage for comment content
 *
 * Since the blockchain only stores a content hash (for verification),
 * we store the actual comment text locally, indexed by its hash.
 *
 * For a production system, this would be replaced with IPFS storage
 * (once the Social contract supports split felt252 for CIDs).
 */

const STORAGE_KEY = 'vauban_comments';

interface CommentStore {
  [contentHash: string]: {
    content: string;
    createdAt: number;
  };
}

/**
 * Get all stored comments from localStorage
 */
function getStore(): CommentStore {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save the comment store to localStorage
 */
function saveStore(store: CommentStore): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    console.error('Failed to save comment store:', error);
  }
}

/**
 * Store comment content by its hash
 */
export function storeCommentContent(contentHash: string, content: string): void {
  const store = getStore();
  store[contentHash] = {
    content,
    createdAt: Date.now(),
  };
  saveStore(store);
}

/**
 * Retrieve comment content by its hash
 */
export function getCommentContent(contentHash: string): string | null {
  const store = getStore();
  return store[contentHash]?.content ?? null;
}

/**
 * Check if we have content for a given hash
 */
export function hasCommentContent(contentHash: string): boolean {
  const store = getStore();
  return contentHash in store;
}

/**
 * Clean up old comments (older than 30 days)
 */
export function cleanupOldComments(): void {
  const store = getStore();
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let changed = false;
  for (const hash in store) {
    if (store[hash].createdAt < thirtyDaysAgo) {
      delete store[hash];
      changed = true;
    }
  }

  if (changed) {
    saveStore(store);
  }
}
