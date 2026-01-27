// Draft management using localStorage with versioning and conflict detection

export interface Draft {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string;
  coverImage: string;
  isPaid: boolean;
  price: number;
  scheduledAt?: string; // ISO date string for scheduled publishing
  createdAt: string;
  updatedAt: string;
}

export interface DraftSnapshot {
  id: string;
  draftId: string;
  draft: Draft;
  timestamp: string;
}

export interface DraftLock {
  draftId: string;
  tabId: string;
  timestamp: string;
}

export interface DraftConflictResult {
  hasConflict: boolean;
  isStale?: boolean;
  lock: DraftLock | null;
}

export type StorageChangeEvent =
  | { type: 'draft_updated'; draftId: string; draft: Draft | null }
  | { type: 'lock_acquired'; draftId: string; lock: DraftLock }
  | { type: 'lock_released'; draftId: string };

const DRAFTS_STORAGE_KEY = 'vauban_drafts';
const SNAPSHOTS_STORAGE_KEY = 'vauban_draft_snapshots';
const LOCK_KEY_PREFIX = 'vauban_draft_lock_';
const MAX_SNAPSHOTS_PER_DRAFT = 5;
const MAX_DRAFTS = 10; // Limit number of drafts to prevent quota issues
const LOCK_STALE_THRESHOLD_MS = 60000; // 60 seconds

/**
 * Safely write to localStorage with quota handling
 * If quota is exceeded, tries to free space by removing old data
 */
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('[Drafts] localStorage quota exceeded, cleaning up...');

      // Try to free space by removing old snapshots first
      try {
        localStorage.removeItem(SNAPSHOTS_STORAGE_KEY);
        console.log('[Drafts] Cleared snapshots to free space');
      } catch {
        // Ignore
      }

      // Try again
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        // Still failing, try removing oldest drafts
        try {
          const drafts = getDrafts();
          if (drafts.length > 3) {
            // Keep only the 3 most recent drafts
            const trimmed = drafts.slice(0, 3);
            localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(trimmed));
            console.log(`[Drafts] Trimmed to ${trimmed.length} drafts to free space`);

            // Try one more time
            localStorage.setItem(key, value);
            return true;
          }
        } catch {
          console.error('[Drafts] Could not free enough space');
        }
      }
    }
    console.error('[Drafts] Failed to save to localStorage:', error);
    return false;
  }
}

// Tab instance ID (unique per browser tab)
let tabInstanceId: string | null = null;

export function getDrafts(): Draft[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getDraft(id: string): Draft | null {
  const drafts = getDrafts();
  return drafts.find((d) => d.id === id) || null;
}

export function saveDraft(draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Draft {
  let drafts = getDrafts();
  const now = new Date().toISOString();

  if (draft.id) {
    // Update existing draft
    const index = drafts.findIndex((d) => d.id === draft.id);
    if (index !== -1) {
      const updated: Draft = {
        ...drafts[index],
        ...draft,
        id: draft.id,
        updatedAt: now,
      };
      drafts[index] = updated;
      safeLocalStorageSet(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
      return updated;
    }
  }

  // Create new draft
  const newDraft: Draft = {
    ...draft,
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
  };

  drafts.unshift(newDraft);

  // Limit number of drafts to prevent quota issues
  if (drafts.length > MAX_DRAFTS) {
    drafts = drafts.slice(0, MAX_DRAFTS);
    console.log(`[Drafts] Trimmed to ${MAX_DRAFTS} drafts`);
  }

  safeLocalStorageSet(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  return newDraft;
}

export function deleteDraft(id: string): boolean {
  const drafts = getDrafts();
  const filtered = drafts.filter((d) => d.id !== id);

  if (filtered.length !== drafts.length) {
    safeLocalStorageSet(DRAFTS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  }
  return false;
}

export function clearAllDrafts(): void {
  localStorage.removeItem(DRAFTS_STORAGE_KEY);
}

// Auto-save helper
let autoSaveTimer: NodeJS.Timeout | null = null;

export function scheduleAutoSave(
  draft: Omit<Draft, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  callback?: (saved: Draft) => void
): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    const saved = saveDraft(draft);
    callback?.(saved);
  }, 2000); // Auto-save after 2 seconds of inactivity
}

export function cancelAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

// ============================================
// Draft Snapshots (Versioning)
// ============================================

function getAllSnapshots(): DraftSnapshot[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

function saveAllSnapshots(snapshots: DraftSnapshot[]): void {
  localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
}

export function getDraftSnapshots(draftId: string): DraftSnapshot[] {
  const allSnapshots = getAllSnapshots();
  return allSnapshots
    .filter((s) => s.draftId === draftId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function saveDraftSnapshot(draft: Draft): DraftSnapshot {
  const allSnapshots = getAllSnapshots();
  const now = new Date().toISOString();

  const newSnapshot: DraftSnapshot = {
    id: `snapshot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    draftId: draft.id,
    draft: { ...draft },
    timestamp: now,
  };

  // Get snapshots for this draft and other drafts separately
  const otherDraftSnapshots = allSnapshots.filter((s) => s.draftId !== draft.id);
  const thisDraftSnapshots = allSnapshots.filter((s) => s.draftId === draft.id);

  // Add new snapshot and keep only the most recent MAX_SNAPSHOTS_PER_DRAFT
  thisDraftSnapshots.unshift(newSnapshot);
  thisDraftSnapshots.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const trimmedSnapshots = thisDraftSnapshots.slice(0, MAX_SNAPSHOTS_PER_DRAFT);

  // Save all snapshots (other drafts + trimmed this draft)
  saveAllSnapshots([...otherDraftSnapshots, ...trimmedSnapshots]);

  return newSnapshot;
}

export function restoreDraftFromSnapshot(snapshotId: string): Draft | null {
  const allSnapshots = getAllSnapshots();
  const snapshot = allSnapshots.find((s) => s.id === snapshotId);

  if (!snapshot) {
    return null;
  }

  // Get the current draft to create a backup snapshot before restoring
  const currentDraft = getDraft(snapshot.draftId);
  if (currentDraft) {
    // Create a backup of the current state before restoring
    saveDraftSnapshot(currentDraft);
  }

  // Restore the draft from snapshot
  const now = new Date().toISOString();
  const restoredDraft: Draft = {
    ...snapshot.draft,
    updatedAt: now,
  };

  // Update the draft in storage
  const drafts = getDrafts();
  const index = drafts.findIndex((d) => d.id === snapshot.draftId);
  if (index !== -1) {
    drafts[index] = restoredDraft;
  } else {
    drafts.unshift(restoredDraft);
  }
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));

  return restoredDraft;
}

// ============================================
// Cross-Tab Conflict Detection
// ============================================

export function getTabInstanceId(): string {
  if (typeof window === 'undefined') return '';

  if (!tabInstanceId) {
    tabInstanceId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return tabInstanceId;
}

// For testing purposes only - resets the cached tab instance ID
export function _resetTabInstanceId(): void {
  tabInstanceId = null;
}

export function setDraftLock(draftId: string): void {
  if (typeof window === 'undefined') return;

  const lock: DraftLock = {
    draftId,
    tabId: getTabInstanceId(),
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem(`${LOCK_KEY_PREFIX}${draftId}`, JSON.stringify(lock));
}

export function getDraftLock(draftId: string): DraftLock | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(`${LOCK_KEY_PREFIX}${draftId}`);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function releaseDraftLock(draftId: string): void {
  if (typeof window === 'undefined') return;

  const lock = getDraftLock(draftId);
  // Only release if current tab owns the lock
  if (lock && lock.tabId === getTabInstanceId()) {
    localStorage.removeItem(`${LOCK_KEY_PREFIX}${draftId}`);
  }
}

export function checkDraftConflict(draftId: string): DraftConflictResult {
  const lock = getDraftLock(draftId);

  if (!lock) {
    return { hasConflict: false, lock: null };
  }

  const currentTabId = getTabInstanceId();

  // No conflict if current tab owns the lock
  if (lock.tabId === currentTabId) {
    return { hasConflict: false, lock };
  }

  // Check if the lock is stale (older than threshold)
  const lockAge = Date.now() - new Date(lock.timestamp).getTime();
  if (lockAge > LOCK_STALE_THRESHOLD_MS) {
    return { hasConflict: false, isStale: true, lock };
  }

  // Another tab has an active lock
  return { hasConflict: true, lock };
}

export function subscribeToStorageChanges(
  draftId: string,
  callback: (event: StorageChangeEvent) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: StorageEvent) => {
    if (!event.key) return;

    // Handle draft updates
    if (event.key === DRAFTS_STORAGE_KEY && event.newValue) {
      try {
        const drafts: Draft[] = JSON.parse(event.newValue);
        const updatedDraft = drafts.find((d) => d.id === draftId);
        if (updatedDraft) {
          callback({ type: 'draft_updated', draftId, draft: updatedDraft });
        }
      } catch {
        // Ignore parse errors
      }
      return;
    }

    // Handle lock changes for this draft
    const lockKey = `${LOCK_KEY_PREFIX}${draftId}`;
    if (event.key === lockKey) {
      if (event.newValue) {
        try {
          const lock: DraftLock = JSON.parse(event.newValue);
          callback({ type: 'lock_acquired', draftId, lock });
        } catch {
          // Ignore parse errors
        }
      } else {
        callback({ type: 'lock_released', draftId });
      }
    }
  };

  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('storage', handler);
  };
}
