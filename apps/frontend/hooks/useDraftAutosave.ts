'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Draft,
  DraftLock,
  StorageChangeEvent,
  saveDraft,
  getDraft,
  getDraftSnapshots,
  saveDraftSnapshot,
  setDraftLock,
  releaseDraftLock,
  checkDraftConflict,
  subscribeToStorageChanges,
  scheduleAutoSave,
  cancelAutoSave,
} from '@/lib/drafts';
import type { SaveStatus } from '@/components/editor/SaveStatusIndicator';

interface DraftFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string;
  coverImage: string;
  isPaid: boolean;
  price: number;
  scheduledAt?: string;
}

interface UseDraftAutosaveOptions {
  draftId: string | null;
  formData: DraftFormData;
  onDraftIdChange: (id: string) => void;
  onConflictDetected?: (conflict: { lock: DraftLock; remoteDraft: Draft | null }) => void;
  onRemoteUpdate?: (draft: Draft) => void;
}

interface UseDraftAutosaveResult {
  saveStatus: SaveStatus;
  lastSavedAt: Date | null;
  hasSnapshots: boolean;
  snapshotCount: number;
  conflict: {
    hasConflict: boolean;
    lock: DraftLock | null;
    remoteDraft: Draft | null;
  } | null;
  saveDraftNow: () => void;
  createSnapshot: () => void;
  dismissConflict: () => void;
}

const SNAPSHOT_INTERVAL_MS = 30000; // 30 seconds

export function useDraftAutosave({
  draftId,
  formData,
  onDraftIdChange,
  onConflictDetected,
  onRemoteUpdate,
}: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [conflict, setConflict] = useState<{
    hasConflict: boolean;
    lock: DraftLock | null;
    remoteDraft: Draft | null;
  } | null>(null);

  // Refs for timers and tracking
  const snapshotTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lockRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastFormDataRef = useRef<DraftFormData>(formData);
  const isMountedRef = useRef(true);

  // Update ref when formData changes
  useEffect(() => {
    lastFormDataRef.current = formData;
  }, [formData]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (snapshotTimerRef.current) {
        clearInterval(snapshotTimerRef.current);
      }
      if (lockRefreshTimerRef.current) {
        clearInterval(lockRefreshTimerRef.current);
      }
      cancelAutoSave();
      // Release lock on unmount
      if (draftId) {
        releaseDraftLock(draftId);
      }
    };
  }, [draftId]);

  // Check for conflicts and set up lock when draftId changes
  useEffect(() => {
    if (!draftId) {
      setConflict(null);
      return;
    }

    // Check for existing conflict
    const conflictResult = checkDraftConflict(draftId);
    if (conflictResult.hasConflict && conflictResult.lock) {
      const remoteDraft = getDraft(draftId);
      setConflict({
        hasConflict: true,
        lock: conflictResult.lock,
        remoteDraft,
      });
      setSaveStatus('conflict');
      onConflictDetected?.({ lock: conflictResult.lock, remoteDraft });
    } else {
      // Acquire lock
      setDraftLock(draftId);
      setConflict(null);
    }

    // Update snapshot count
    const snapshots = getDraftSnapshots(draftId);
    setSnapshotCount(snapshots.length);
  }, [draftId, onConflictDetected]);

  // Refresh lock periodically to prevent staleness
  useEffect(() => {
    if (!draftId || conflict?.hasConflict) return;

    const refreshLock = () => {
      setDraftLock(draftId);
    };

    // Refresh every 30 seconds
    lockRefreshTimerRef.current = setInterval(refreshLock, 30000);

    return () => {
      if (lockRefreshTimerRef.current) {
        clearInterval(lockRefreshTimerRef.current);
      }
    };
  }, [draftId, conflict?.hasConflict]);

  // Subscribe to storage changes for cross-tab sync
  useEffect(() => {
    if (!draftId) return;

    const handleStorageChange = (event: StorageChangeEvent) => {
      if (!isMountedRef.current) return;

      if (event.type === 'draft_updated' && event.draft) {
        // Another tab updated the draft
        onRemoteUpdate?.(event.draft);
      } else if (event.type === 'lock_acquired' && event.lock) {
        // Another tab acquired the lock
        const conflictResult = checkDraftConflict(draftId);
        if (conflictResult.hasConflict) {
          const remoteDraft = getDraft(draftId);
          setConflict({
            hasConflict: true,
            lock: event.lock,
            remoteDraft,
          });
          setSaveStatus('conflict');
          onConflictDetected?.({ lock: event.lock, remoteDraft });
        }
      }
    };

    const unsubscribe = subscribeToStorageChanges(draftId, handleStorageChange);
    return unsubscribe;
  }, [draftId, onConflictDetected, onRemoteUpdate]);

  // Auto-save when form data changes (debounced)
  useEffect(() => {
    if (!formData.title && !formData.content) return;
    if (conflict?.hasConflict) return;

    setSaveStatus('saving');

    scheduleAutoSave(
      {
        ...formData,
        id: draftId || undefined,
      },
      (saved) => {
        if (!isMountedRef.current) return;

        if (!draftId) {
          onDraftIdChange(saved.id);
          setDraftLock(saved.id);
        }
        setLastSavedAt(new Date());
        setSaveStatus('saved');

        // Reset to idle after 2 seconds
        setTimeout(() => {
          if (isMountedRef.current && setSaveStatus) {
            setSaveStatus('idle');
          }
        }, 2000);
      }
    );

    return () => {
      cancelAutoSave();
    };
  }, [formData, draftId, conflict?.hasConflict, onDraftIdChange]);

  // Periodic snapshot creation (every 30 seconds)
  useEffect(() => {
    if (!draftId || conflict?.hasConflict) return;

    const createPeriodicSnapshot = () => {
      const currentDraft = getDraft(draftId);
      if (currentDraft) {
        saveDraftSnapshot(currentDraft);
        if (isMountedRef.current) {
          const snapshots = getDraftSnapshots(draftId);
          setSnapshotCount(snapshots.length);
        }
      }
    };

    // Create initial snapshot
    createPeriodicSnapshot();

    // Set up interval
    snapshotTimerRef.current = setInterval(createPeriodicSnapshot, SNAPSHOT_INTERVAL_MS);

    return () => {
      if (snapshotTimerRef.current) {
        clearInterval(snapshotTimerRef.current);
      }
    };
  }, [draftId, conflict?.hasConflict]);

  // Manual save function
  const saveDraftNow = useCallback(() => {
    if (conflict?.hasConflict) return;

    setSaveStatus('saving');

    const saved = saveDraft({
      ...lastFormDataRef.current,
      id: draftId || undefined,
    });

    if (!draftId) {
      onDraftIdChange(saved.id);
      setDraftLock(saved.id);
    }

    setLastSavedAt(new Date());
    setSaveStatus('saved');

    setTimeout(() => {
      if (isMountedRef.current) {
        setSaveStatus('idle');
      }
    }, 2000);
  }, [draftId, conflict?.hasConflict, onDraftIdChange]);

  // Manual snapshot creation
  const createSnapshot = useCallback(() => {
    if (!draftId) return;

    const currentDraft = getDraft(draftId);
    if (currentDraft) {
      saveDraftSnapshot(currentDraft);
      const snapshots = getDraftSnapshots(draftId);
      setSnapshotCount(snapshots.length);
    }
  }, [draftId]);

  // Dismiss conflict (take over editing)
  const dismissConflict = useCallback(() => {
    if (!draftId) return;

    setConflict(null);
    setDraftLock(draftId);
    setSaveStatus('idle');
  }, [draftId]);

  return {
    saveStatus,
    lastSavedAt,
    hasSnapshots: snapshotCount > 0,
    snapshotCount,
    conflict,
    saveDraftNow,
    createSnapshot,
    dismissConflict,
  };
}

export default useDraftAutosave;
