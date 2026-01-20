'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { getDrafts, deleteDraft, Draft } from '@/lib/drafts';
import { useWallet } from '@/providers/wallet-provider';

export default function DraftsPage() {
  const { isConnected } = useWallet();
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    setDrafts(getDrafts());
  }, []);

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this draft?')) {
      deleteDraft(id);
      setDrafts(getDrafts());
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Drafts</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to view drafts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Drafts</h1>
          <Link
            href="/admin"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Article
          </Link>
        </div>

        {drafts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-600 dark:text-gray-400 text-lg">No drafts saved</p>
            <p className="text-gray-500 dark:text-gray-500 mt-2">
              Start writing and your work will be auto-saved.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div
                key={draft.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                      {draft.title || 'Untitled Draft'}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {draft.excerpt || draft.content?.slice(0, 150) || 'No content yet...'}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      <span>Updated {format(new Date(draft.updatedAt), 'MMM d, yyyy HH:mm')}</span>
                      {draft.scheduledAt && (
                        <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Scheduled: {format(new Date(draft.scheduledAt), 'MMM d, yyyy HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin?draft=${draft.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(draft.id)}
                      className="px-4 py-2 text-red-600 border border-red-300 dark:border-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
