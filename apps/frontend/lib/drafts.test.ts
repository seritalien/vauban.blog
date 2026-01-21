import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDrafts,
  getDraft,
  saveDraft,
  deleteDraft,
  clearAllDrafts,
  scheduleAutoSave,
  cancelAutoSave,
  getDraftSnapshots,
  saveDraftSnapshot,
  restoreDraftFromSnapshot,
  getTabInstanceId,
  setDraftLock,
  getDraftLock,
  releaseDraftLock,
  checkDraftConflict,
  subscribeToStorageChanges,
  _resetTabInstanceId,
  type Draft,
  type DraftSnapshot,
  type DraftLock,
} from './drafts';

describe('drafts.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    _resetTabInstanceId();
  });

  afterEach(() => {
    vi.useRealTimers();
    cancelAutoSave();
  });

  describe('getDrafts', () => {
    it('returns empty array when no drafts exist', () => {
      expect(getDrafts()).toEqual([]);
    });

    it('returns stored drafts from localStorage', () => {
      const drafts: Draft[] = [
        {
          id: 'draft_1',
          title: 'Test Draft',
          slug: 'test-draft',
          content: 'Content here',
          excerpt: 'Excerpt',
          tags: 'tag1, tag2',
          coverImage: '',
          isPaid: false,
          price: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];
      localStorage.setItem('vauban_drafts', JSON.stringify(drafts));

      expect(getDrafts()).toEqual(drafts);
    });

    it('returns empty array when localStorage contains invalid JSON', () => {
      localStorage.setItem('vauban_drafts', 'invalid json');
      expect(getDrafts()).toEqual([]);
    });
  });

  describe('getDraft', () => {
    it('returns null when draft does not exist', () => {
      expect(getDraft('non-existent')).toBeNull();
    });

    it('returns the draft when it exists', () => {
      const draft: Draft = {
        id: 'draft_123',
        title: 'Test Draft',
        slug: 'test-draft',
        content: 'Content',
        excerpt: 'Excerpt',
        tags: 'tag1',
        coverImage: '',
        isPaid: false,
        price: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      localStorage.setItem('vauban_drafts', JSON.stringify([draft]));

      expect(getDraft('draft_123')).toEqual(draft);
    });
  });

  describe('saveDraft', () => {
    it('creates a new draft with generated ID when no ID provided', () => {
      const draftInput = {
        title: 'New Draft',
        slug: 'new-draft',
        content: 'Content here',
        excerpt: 'Excerpt',
        tags: 'tag1, tag2',
        coverImage: '',
        isPaid: false,
        price: 0,
      };

      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
      const saved = saveDraft(draftInput);

      expect(saved.id).toMatch(/^draft_\d+_[a-z0-9]+$/);
      expect(saved.title).toBe('New Draft');
      expect(saved.createdAt).toBe('2024-01-15T10:00:00.000Z');
      expect(saved.updatedAt).toBe('2024-01-15T10:00:00.000Z');

      const stored = getDrafts();
      expect(stored).toHaveLength(1);
      expect(stored[0]).toEqual(saved);
    });

    it('updates existing draft when ID is provided', () => {
      const existingDraft: Draft = {
        id: 'draft_existing',
        title: 'Original Title',
        slug: 'original-slug',
        content: 'Original content',
        excerpt: 'Excerpt',
        tags: 'tag1',
        coverImage: '',
        isPaid: false,
        price: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      localStorage.setItem('vauban_drafts', JSON.stringify([existingDraft]));

      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
      const updated = saveDraft({
        ...existingDraft,
        title: 'Updated Title',
        id: 'draft_existing',
      });

      expect(updated.id).toBe('draft_existing');
      expect(updated.title).toBe('Updated Title');
      expect(updated.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(updated.updatedAt).toBe('2024-01-15T10:00:00.000Z');

      const stored = getDrafts();
      expect(stored).toHaveLength(1);
      expect(stored[0].title).toBe('Updated Title');
    });

    it('creates new draft when provided ID does not exist', () => {
      const draftInput = {
        id: 'non_existent_id',
        title: 'New Draft',
        slug: 'new-draft',
        content: 'Content',
        excerpt: 'Excerpt',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
      };

      const saved = saveDraft(draftInput);

      // Should create a new draft with a new ID (not the provided one)
      expect(saved.id).toMatch(/^draft_\d+_[a-z0-9]+$/);
      expect(saved.title).toBe('New Draft');
    });

    it('preserves scheduledAt field when provided', () => {
      const draftInput = {
        title: 'Scheduled Draft',
        slug: 'scheduled-draft',
        content: 'Content',
        excerpt: 'Excerpt',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
        scheduledAt: '2024-02-01T10:00:00Z',
      };

      const saved = saveDraft(draftInput);

      expect(saved.scheduledAt).toBe('2024-02-01T10:00:00Z');
    });

    it('adds new drafts to the beginning of the list', () => {
      saveDraft({
        title: 'First Draft',
        slug: 'first',
        content: '',
        excerpt: '',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
      });
      saveDraft({
        title: 'Second Draft',
        slug: 'second',
        content: '',
        excerpt: '',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
      });

      const drafts = getDrafts();
      expect(drafts[0].title).toBe('Second Draft');
      expect(drafts[1].title).toBe('First Draft');
    });
  });

  describe('deleteDraft', () => {
    it('returns false when draft does not exist', () => {
      expect(deleteDraft('non-existent')).toBe(false);
    });

    it('removes draft and returns true when draft exists', () => {
      const draft: Draft = {
        id: 'draft_to_delete',
        title: 'Draft to Delete',
        slug: 'delete-me',
        content: '',
        excerpt: '',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      localStorage.setItem('vauban_drafts', JSON.stringify([draft]));

      expect(deleteDraft('draft_to_delete')).toBe(true);
      expect(getDrafts()).toEqual([]);
    });

    it('only removes the specified draft', () => {
      const drafts: Draft[] = [
        {
          id: 'draft_1',
          title: 'Draft 1',
          slug: 'draft-1',
          content: '',
          excerpt: '',
          tags: '',
          coverImage: '',
          isPaid: false,
          price: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'draft_2',
          title: 'Draft 2',
          slug: 'draft-2',
          content: '',
          excerpt: '',
          tags: '',
          coverImage: '',
          isPaid: false,
          price: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];
      localStorage.setItem('vauban_drafts', JSON.stringify(drafts));

      deleteDraft('draft_1');

      const remaining = getDrafts();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('draft_2');
    });
  });

  describe('clearAllDrafts', () => {
    it('removes all drafts from localStorage', () => {
      const drafts: Draft[] = [
        {
          id: 'draft_1',
          title: 'Draft 1',
          slug: 'draft-1',
          content: '',
          excerpt: '',
          tags: '',
          coverImage: '',
          isPaid: false,
          price: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];
      localStorage.setItem('vauban_drafts', JSON.stringify(drafts));

      clearAllDrafts();

      expect(getDrafts()).toEqual([]);
      expect(localStorage.getItem('vauban_drafts')).toBeNull();
    });
  });

  describe('scheduleAutoSave', () => {
    it('saves draft after 2 second delay', () => {
      const callback = vi.fn();
      const draftInput = {
        title: 'Auto-save Draft',
        slug: 'auto-save',
        content: 'Content',
        excerpt: 'Excerpt',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
      };

      scheduleAutoSave(draftInput, callback);

      // Should not be called immediately
      expect(callback).not.toHaveBeenCalled();
      expect(getDrafts()).toHaveLength(0);

      // Advance timer by 2 seconds
      vi.advanceTimersByTime(2000);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(getDrafts()).toHaveLength(1);
      expect(getDrafts()[0].title).toBe('Auto-save Draft');
    });

    it('cancels previous scheduled save when called again', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      scheduleAutoSave(
        {
          title: 'First',
          slug: 'first',
          content: '',
          excerpt: '',
          tags: '',
          coverImage: '',
          isPaid: false,
          price: 0,
        },
        callback1
      );

      // Wait 1 second
      vi.advanceTimersByTime(1000);

      scheduleAutoSave(
        {
          title: 'Second',
          slug: 'second',
          content: '',
          excerpt: '',
          tags: '',
          coverImage: '',
          isPaid: false,
          price: 0,
        },
        callback2
      );

      // Wait another 2 seconds
      vi.advanceTimersByTime(2000);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(getDrafts()).toHaveLength(1);
      expect(getDrafts()[0].title).toBe('Second');
    });

    it('works without callback', () => {
      scheduleAutoSave({
        title: 'No Callback',
        slug: 'no-callback',
        content: '',
        excerpt: '',
        tags: '',
        coverImage: '',
        isPaid: false,
        price: 0,
      });

      vi.advanceTimersByTime(2000);

      expect(getDrafts()).toHaveLength(1);
      expect(getDrafts()[0].title).toBe('No Callback');
    });
  });

  describe('cancelAutoSave', () => {
    it('cancels scheduled auto-save', () => {
      const callback = vi.fn();

      scheduleAutoSave(
        {
          title: 'Cancelled',
          slug: 'cancelled',
          content: '',
          excerpt: '',
          tags: '',
          coverImage: '',
          isPaid: false,
          price: 0,
        },
        callback
      );

      cancelAutoSave();
      vi.advanceTimersByTime(3000);

      expect(callback).not.toHaveBeenCalled();
      expect(getDrafts()).toHaveLength(0);
    });

    it('does nothing when no auto-save is scheduled', () => {
      // Should not throw
      expect(() => cancelAutoSave()).not.toThrow();
    });
  });

  // ============================================
  // NEW TESTS: Draft Versioning (Snapshots)
  // ============================================
  describe('Draft Snapshots (Versioning)', () => {
    const baseDraft: Draft = {
      id: 'draft_test',
      title: 'Test Draft',
      slug: 'test-draft',
      content: 'Original content',
      excerpt: 'Excerpt',
      tags: 'tag1',
      coverImage: '',
      isPaid: false,
      price: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    describe('getDraftSnapshots', () => {
      it('returns empty array when no snapshots exist for draft', () => {
        expect(getDraftSnapshots('draft_test')).toEqual([]);
      });

      it('returns snapshots for specified draft', () => {
        const snapshot: DraftSnapshot = {
          id: 'snapshot_1',
          draftId: 'draft_test',
          draft: baseDraft,
          timestamp: '2024-01-01T10:00:00Z',
        };
        localStorage.setItem(
          'vauban_draft_snapshots',
          JSON.stringify([snapshot])
        );

        const snapshots = getDraftSnapshots('draft_test');
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]).toEqual(snapshot);
      });

      it('only returns snapshots for the specified draft', () => {
        const snapshots: DraftSnapshot[] = [
          {
            id: 'snapshot_1',
            draftId: 'draft_test',
            draft: baseDraft,
            timestamp: '2024-01-01T10:00:00Z',
          },
          {
            id: 'snapshot_2',
            draftId: 'other_draft',
            draft: { ...baseDraft, id: 'other_draft' },
            timestamp: '2024-01-01T11:00:00Z',
          },
        ];
        localStorage.setItem(
          'vauban_draft_snapshots',
          JSON.stringify(snapshots)
        );

        const result = getDraftSnapshots('draft_test');
        expect(result).toHaveLength(1);
        expect(result[0].draftId).toBe('draft_test');
      });

      it('returns snapshots sorted by timestamp (newest first)', () => {
        const snapshots: DraftSnapshot[] = [
          {
            id: 'snapshot_1',
            draftId: 'draft_test',
            draft: { ...baseDraft, content: 'Version 1' },
            timestamp: '2024-01-01T10:00:00Z',
          },
          {
            id: 'snapshot_3',
            draftId: 'draft_test',
            draft: { ...baseDraft, content: 'Version 3' },
            timestamp: '2024-01-01T12:00:00Z',
          },
          {
            id: 'snapshot_2',
            draftId: 'draft_test',
            draft: { ...baseDraft, content: 'Version 2' },
            timestamp: '2024-01-01T11:00:00Z',
          },
        ];
        localStorage.setItem(
          'vauban_draft_snapshots',
          JSON.stringify(snapshots)
        );

        const result = getDraftSnapshots('draft_test');
        expect(result[0].draft.content).toBe('Version 3');
        expect(result[1].draft.content).toBe('Version 2');
        expect(result[2].draft.content).toBe('Version 1');
      });
    });

    describe('saveDraftSnapshot', () => {
      it('creates a new snapshot for the draft', () => {
        vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

        const snapshot = saveDraftSnapshot(baseDraft);

        expect(snapshot.draftId).toBe('draft_test');
        expect(snapshot.draft).toEqual(baseDraft);
        expect(snapshot.timestamp).toBe('2024-01-15T10:00:00.000Z');
        expect(snapshot.id).toMatch(/^snapshot_\d+_[a-z0-9]+$/);

        const stored = getDraftSnapshots('draft_test');
        expect(stored).toHaveLength(1);
      });

      it('maintains only the last 5 snapshots for a draft', () => {
        // Create 6 snapshots
        for (let i = 0; i < 6; i++) {
          vi.setSystemTime(new Date(`2024-01-15T${10 + i}:00:00Z`));
          saveDraftSnapshot({ ...baseDraft, content: `Version ${i + 1}` });
        }

        const snapshots = getDraftSnapshots('draft_test');
        expect(snapshots).toHaveLength(5);

        // Should keep the 5 most recent (versions 2-6)
        expect(snapshots[0].draft.content).toBe('Version 6');
        expect(snapshots[4].draft.content).toBe('Version 2');
      });

      it('does not affect snapshots from other drafts', () => {
        // Create snapshot for another draft
        const otherDraft = { ...baseDraft, id: 'other_draft' };
        saveDraftSnapshot(otherDraft);

        // Create 6 snapshots for test draft (should only keep 5)
        for (let i = 0; i < 6; i++) {
          vi.setSystemTime(new Date(`2024-01-15T${10 + i}:00:00Z`));
          saveDraftSnapshot({ ...baseDraft, content: `Version ${i + 1}` });
        }

        // Other draft's snapshot should still exist
        const otherSnapshots = getDraftSnapshots('other_draft');
        expect(otherSnapshots).toHaveLength(1);
      });
    });

    describe('restoreDraftFromSnapshot', () => {
      it('restores a draft from snapshot', () => {
        // Save original draft
        localStorage.setItem('vauban_drafts', JSON.stringify([baseDraft]));

        // Create snapshot with old content
        const snapshot: DraftSnapshot = {
          id: 'snapshot_1',
          draftId: 'draft_test',
          draft: { ...baseDraft, content: 'Old content to restore' },
          timestamp: '2024-01-01T10:00:00Z',
        };
        localStorage.setItem(
          'vauban_draft_snapshots',
          JSON.stringify([snapshot])
        );

        // Update the draft
        saveDraft({
          ...baseDraft,
          content: 'New content',
          id: 'draft_test',
        });

        // Restore from snapshot
        vi.setSystemTime(new Date('2024-01-20T10:00:00Z'));
        const restored = restoreDraftFromSnapshot('snapshot_1');

        expect(restored).not.toBeNull();
        expect(restored?.content).toBe('Old content to restore');
        expect(restored?.updatedAt).toBe('2024-01-20T10:00:00.000Z');

        // Verify the draft is updated in storage
        const currentDraft = getDraft('draft_test');
        expect(currentDraft?.content).toBe('Old content to restore');
      });

      it('returns null when snapshot does not exist', () => {
        const restored = restoreDraftFromSnapshot('non_existent');
        expect(restored).toBeNull();
      });

      it('creates a new snapshot before restoring (backup current state)', () => {
        // Save original draft
        localStorage.setItem('vauban_drafts', JSON.stringify([baseDraft]));

        // Create snapshot
        const snapshot: DraftSnapshot = {
          id: 'snapshot_old',
          draftId: 'draft_test',
          draft: { ...baseDraft, content: 'Old content' },
          timestamp: '2024-01-01T10:00:00Z',
        };
        localStorage.setItem(
          'vauban_draft_snapshots',
          JSON.stringify([snapshot])
        );

        // Update draft to new content
        saveDraft({
          ...baseDraft,
          content: 'Current content before restore',
          id: 'draft_test',
        });

        vi.setSystemTime(new Date('2024-01-20T10:00:00Z'));
        restoreDraftFromSnapshot('snapshot_old');

        // Should have 2 snapshots now: the original + backup of current state
        const snapshots = getDraftSnapshots('draft_test');
        expect(snapshots).toHaveLength(2);

        // The newer snapshot should be the backup
        expect(snapshots[0].draft.content).toBe('Current content before restore');
      });
    });
  });

  // ============================================
  // NEW TESTS: Cross-Tab Conflict Detection
  // ============================================
  describe('Cross-Tab Conflict Detection', () => {
    describe('getTabInstanceId', () => {
      it('returns a unique tab instance ID', () => {
        const id1 = getTabInstanceId();
        expect(id1).toMatch(/^tab_\d+_[a-z0-9]+$/);
      });

      it('returns the same ID on subsequent calls within same session', () => {
        const id1 = getTabInstanceId();
        const id2 = getTabInstanceId();
        expect(id1).toBe(id2);
      });
    });

    describe('setDraftLock', () => {
      it('sets a lock for a draft', () => {
        vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

        setDraftLock('draft_test');

        const lock = getDraftLock('draft_test');
        expect(lock).not.toBeNull();
        expect(lock?.draftId).toBe('draft_test');
        expect(lock?.tabId).toBe(getTabInstanceId());
        expect(lock?.timestamp).toBe('2024-01-15T10:00:00.000Z');
      });

      it('updates existing lock', () => {
        vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
        setDraftLock('draft_test');

        vi.setSystemTime(new Date('2024-01-15T10:05:00Z'));
        setDraftLock('draft_test');

        const lock = getDraftLock('draft_test');
        expect(lock?.timestamp).toBe('2024-01-15T10:05:00.000Z');
      });
    });

    describe('getDraftLock', () => {
      it('returns null when no lock exists', () => {
        expect(getDraftLock('draft_test')).toBeNull();
      });

      it('returns the lock when it exists', () => {
        setDraftLock('draft_test');
        const lock = getDraftLock('draft_test');
        expect(lock).not.toBeNull();
        expect(lock?.draftId).toBe('draft_test');
      });
    });

    describe('releaseDraftLock', () => {
      it('removes the lock for a draft', () => {
        setDraftLock('draft_test');
        expect(getDraftLock('draft_test')).not.toBeNull();

        releaseDraftLock('draft_test');
        expect(getDraftLock('draft_test')).toBeNull();
      });

      it('does nothing when no lock exists', () => {
        // Should not throw
        expect(() => releaseDraftLock('draft_test')).not.toThrow();
      });

      it('only releases lock if current tab owns it', () => {
        // Simulate another tab's lock
        const otherTabLock: DraftLock = {
          draftId: 'draft_test',
          tabId: 'other_tab_123',
          timestamp: '2024-01-15T10:00:00Z',
        };
        localStorage.setItem(
          'vauban_draft_lock_draft_test',
          JSON.stringify(otherTabLock)
        );

        releaseDraftLock('draft_test');

        // Lock should still exist (owned by other tab)
        expect(getDraftLock('draft_test')).not.toBeNull();
      });
    });

    describe('checkDraftConflict', () => {
      it('returns no conflict when no lock exists', () => {
        const result = checkDraftConflict('draft_test');
        expect(result.hasConflict).toBe(false);
        expect(result.lock).toBeNull();
      });

      it('returns no conflict when current tab owns the lock', () => {
        setDraftLock('draft_test');
        const result = checkDraftConflict('draft_test');
        expect(result.hasConflict).toBe(false);
      });

      it('returns conflict when another tab owns the lock', () => {
        // Set system time so the lock is not stale
        vi.setSystemTime(new Date('2024-01-15T10:00:30Z'));

        const otherTabLock: DraftLock = {
          draftId: 'draft_test',
          tabId: 'other_tab_123',
          timestamp: '2024-01-15T10:00:00.000Z',
        };
        localStorage.setItem(
          'vauban_draft_lock_draft_test',
          JSON.stringify(otherTabLock)
        );

        const result = checkDraftConflict('draft_test');
        expect(result.hasConflict).toBe(true);
        expect(result.lock?.tabId).toBe('other_tab_123');
      });

      it('considers lock stale after 60 seconds', () => {
        vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));
        const oldLock: DraftLock = {
          draftId: 'draft_test',
          tabId: 'other_tab_123',
          timestamp: '2024-01-15T10:00:00.000Z',
        };
        localStorage.setItem(
          'vauban_draft_lock_draft_test',
          JSON.stringify(oldLock)
        );

        // Advance time by 61 seconds
        vi.setSystemTime(new Date('2024-01-15T10:01:01Z'));

        const result = checkDraftConflict('draft_test');
        expect(result.hasConflict).toBe(false);
        expect(result.isStale).toBe(true);
      });
    });

    describe('subscribeToStorageChanges', () => {
      it('calls callback when storage changes for specified draft', () => {
        const callback = vi.fn();
        const unsubscribe = subscribeToStorageChanges('draft_test', callback);

        // Simulate storage event from another tab
        const event = new StorageEvent('storage', {
          key: 'vauban_drafts',
          newValue: JSON.stringify([
            {
              id: 'draft_test',
              title: 'Updated',
              slug: 'test',
              content: 'New content',
              excerpt: '',
              tags: '',
              coverImage: '',
              isPaid: false,
              price: 0,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-15T10:00:00Z',
            },
          ]),
          oldValue: null,
        });
        window.dispatchEvent(event);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'draft_updated',
            draftId: 'draft_test',
          })
        );

        unsubscribe();
      });

      it('calls callback when draft lock changes', () => {
        const callback = vi.fn();
        const unsubscribe = subscribeToStorageChanges('draft_test', callback);

        // Simulate lock being acquired by another tab
        const event = new StorageEvent('storage', {
          key: 'vauban_draft_lock_draft_test',
          newValue: JSON.stringify({
            draftId: 'draft_test',
            tabId: 'other_tab',
            timestamp: '2024-01-15T10:00:00Z',
          }),
          oldValue: null,
        });
        window.dispatchEvent(event);

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'lock_acquired',
            draftId: 'draft_test',
          })
        );

        unsubscribe();
      });

      it('unsubscribes correctly', () => {
        const callback = vi.fn();
        const unsubscribe = subscribeToStorageChanges('draft_test', callback);

        unsubscribe();

        // Simulate storage event
        const event = new StorageEvent('storage', {
          key: 'vauban_drafts',
          newValue: '[]',
          oldValue: null,
        });
        window.dispatchEvent(event);

        expect(callback).not.toHaveBeenCalled();
      });
    });
  });
});
