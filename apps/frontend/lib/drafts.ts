// Draft management using localStorage

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

const DRAFTS_STORAGE_KEY = 'vauban_drafts';

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
  const drafts = getDrafts();
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
      localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
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
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  return newDraft;
}

export function deleteDraft(id: string): boolean {
  const drafts = getDrafts();
  const filtered = drafts.filter((d) => d.id !== id);

  if (filtered.length !== drafts.length) {
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(filtered));
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
