'use client';

import { useState, useEffect, type FC } from 'react';
import { formatDistanceToNow } from 'date-fns';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedAt: Date | null;
  hasSnapshots?: boolean;
  onViewSnapshots?: () => void;
  errorMessage?: string;
}

export const SaveStatusIndicator: FC<SaveStatusIndicatorProps> = ({
  status,
  lastSavedAt,
  hasSnapshots = false,
  onViewSnapshots,
  errorMessage,
}) => {
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Update "time ago" display every 10 seconds
  useEffect(() => {
    if (!lastSavedAt) {
      setTimeAgo('');
      return;
    }

    const updateTimeAgo = () => {
      setTimeAgo(formatDistanceToNow(lastSavedAt, { addSuffix: true }));
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 10000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const statusConfig = {
    idle: {
      icon: null,
      text: lastSavedAt ? `Saved ${timeAgo}` : 'Not saved',
      className: 'text-gray-500 dark:text-gray-400',
    },
    saving: {
      icon: (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ),
      text: 'Saving...',
      className: 'text-blue-600 dark:text-blue-400',
    },
    saved: {
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
      text: `Saved ${timeAgo}`,
      className: 'text-green-600 dark:text-green-400',
    },
    error: {
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
      text: errorMessage || 'Save failed',
      className: 'text-red-600 dark:text-red-400',
    },
    conflict: {
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
      text: 'Conflict detected',
      className: 'text-yellow-600 dark:text-yellow-400',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`flex items-center gap-1.5 text-sm ${config.className}`}>
        {config.icon}
        <span>{config.text}</span>
      </span>

      {hasSnapshots && onViewSnapshots && (
        <button
          onClick={onViewSnapshots}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          title="View backup history"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="sr-only sm:not-sr-only">History</span>
        </button>
      )}
    </div>
  );
};

export default SaveStatusIndicator;
