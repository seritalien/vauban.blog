'use client';

import { useState, useEffect, type FC } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  getDraftSnapshots,
  restoreDraftFromSnapshot,
  getDraft,
  type Draft,
  type DraftSnapshot,
  type DraftLock,
} from '@/lib/drafts';

interface DraftRecoveryModalProps {
  draftId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (draft: Draft) => void;
  conflict?: {
    hasConflict: boolean;
    lock: DraftLock | null;
    remoteDraft?: Draft | null;
  };
}

type TabType = 'snapshots' | 'conflict';

export const DraftRecoveryModal: FC<DraftRecoveryModalProps> = ({
  draftId,
  isOpen,
  onClose,
  onRestore,
  conflict,
}) => {
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>(
    conflict?.hasConflict ? 'conflict' : 'snapshots'
  );
  const [isRestoring, setIsRestoring] = useState(false);

  // Load snapshots when modal opens
  useEffect(() => {
    if (isOpen && draftId) {
      const loadedSnapshots = getDraftSnapshots(draftId);
      setSnapshots(loadedSnapshots);
      setSelectedSnapshot(null);
      setPreviewContent('');

      // Set active tab based on conflict
      if (conflict?.hasConflict) {
        setActiveTab('conflict');
      } else {
        setActiveTab('snapshots');
      }
    }
  }, [isOpen, draftId, conflict?.hasConflict]);

  // Load preview when snapshot is selected
  useEffect(() => {
    if (selectedSnapshot) {
      const snapshot = snapshots.find((s) => s.id === selectedSnapshot);
      if (snapshot) {
        setPreviewContent(snapshot.draft.content.substring(0, 500));
      }
    } else {
      setPreviewContent('');
    }
  }, [selectedSnapshot, snapshots]);

  const handleRestoreSnapshot = async () => {
    if (!selectedSnapshot) return;

    setIsRestoring(true);
    try {
      const restored = restoreDraftFromSnapshot(selectedSnapshot);
      if (restored) {
        onRestore(restored);
        onClose();
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleUseCurrentTab = () => {
    // Just close the modal - keep the current tab's version
    onClose();
  };

  const handleUseOtherTab = () => {
    // Load the remote version
    if (conflict?.remoteDraft) {
      onRestore(conflict.remoteDraft);
    } else {
      // Reload from storage
      const currentDraft = getDraft(draftId);
      if (currentDraft) {
        onRestore(currentDraft);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const hasConflict = conflict?.hasConflict ?? false;
  const showTabs = hasConflict || snapshots.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {hasConflict ? 'Edit Conflict Detected' : 'Restore from Backup'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs (if showing both) */}
        {showTabs && hasConflict && snapshots.length > 0 && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('conflict')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'conflict'
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50 dark:bg-red-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Conflict
              </span>
            </button>
            <button
              onClick={() => setActiveTab('snapshots')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'snapshots'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Backups ({snapshots.length})
              </span>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Conflict Tab */}
          {activeTab === 'conflict' && hasConflict && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="font-medium text-red-800 dark:text-red-200">
                    This draft is being edited in another tab
                  </h3>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                    Another browser tab has modified this draft. Choose which version to keep.
                  </p>
                  {conflict?.lock && (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Last edit: {formatDistanceToNow(new Date(conflict.lock.timestamp), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleUseCurrentTab}
                  className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium text-gray-900 dark:text-white">
                      Keep my version
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Continue editing with the content in this tab. The other tab&apos;s changes will be lost.
                  </p>
                </button>

                <button
                  onClick={handleUseOtherTab}
                  className="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-green-500 dark:hover:border-green-400 transition-colors text-left group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="font-medium text-gray-900 dark:text-white">
                      Load other version
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Discard current changes and load the version from the other tab.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Snapshots Tab */}
          {activeTab === 'snapshots' && (
            <div className="space-y-4">
              {snapshots.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    No backups available for this draft
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Backups are created automatically every 30 seconds while editing
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select a backup to preview and restore. Your current version will be saved as a backup before restoring.
                  </p>

                  <div className="space-y-2">
                    {snapshots.map((snapshot, index) => (
                      <button
                        key={snapshot.id}
                        onClick={() => setSelectedSnapshot(snapshot.id)}
                        className={`w-full p-3 rounded-lg border-2 transition-colors text-left ${
                          selectedSnapshot === snapshot.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              index === 0
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {snapshot.draft.title || 'Untitled'}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(snapshot.timestamp), 'MMM d, yyyy')} at{' '}
                                {format(new Date(snapshot.timestamp), 'HH:mm:ss')}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  {selectedSnapshot && previewContent && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Preview
                      </h4>
                      <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono overflow-hidden">
                        {previewContent}
                        {previewContent.length >= 500 && '...'}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'snapshots' && snapshots.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRestoreSnapshot}
              disabled={!selectedSnapshot || isRestoring}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {isRestoring ? 'Restoring...' : 'Restore Backup'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DraftRecoveryModal;
