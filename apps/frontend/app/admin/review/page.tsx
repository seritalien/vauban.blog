'use client';

import { useState, useMemo } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { useRole } from '@/hooks/use-role';
import { useAdminReview } from '@/hooks/use-admin-review';
import { ROLES, ROLE_LABELS } from '@vauban/shared-types';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatAddress } from '@/lib/profiles';

export const dynamic = 'force-dynamic';


export default function ReviewQueuePage() {
  const { isConnected } = useWallet();
  const { canApproveContent, isLoading: permissionsLoading } = usePermissions();
  const { roleLabel } = useRole();
  const {
    pendingPosts,
    pendingCount,
    isLoading: reviewLoading,
    approvePost,
    rejectPost,
    isApproving,
    isRejecting,
  } = useAdminReview();

  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const filteredPosts = useMemo(() => {
    return pendingPosts;
  }, [pendingPosts]);

  const stats = useMemo(() => ({
    total: pendingCount,
    pending: pendingPosts.length,
  }), [pendingCount, pendingPosts]);

  const handleSelectAll = () => {
    if (selectedPosts.size === filteredPosts.length) {
      setSelectedPosts(new Set());
    } else {
      setSelectedPosts(new Set(filteredPosts.map((p) => p.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedPosts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPosts(newSelected);
  };

  const handleApprove = async (postId: string) => {
    setProcessingIds((prev) => new Set(prev).add(postId));
    try {
      await approvePost(postId);
      setSelectedPosts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleReject = async (postId: string) => {
    setProcessingIds((prev) => new Set(prev).add(postId));
    try {
      await rejectPost(postId);
      setSelectedPosts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const handleBulkApprove = async () => {
    for (const postId of selectedPosts) {
      await handleApprove(postId);
    }
  };

  const handleBulkReject = async () => {
    for (const postId of selectedPosts) {
      await handleReject(postId);
    }
  };

  // Check wallet connection
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Review Queue</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your wallet to access the review queue.
          </p>
          <Link
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Check permissions
  if (!permissionsLoading && !canApproveContent) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              You don&apos;t have permission to access the review queue.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Current role: <span className="font-medium">{roleLabel}</span>
              <br />
              Required: <span className="font-medium">{ROLE_LABELS[ROLES.EDITOR]}</span> or higher
            </p>
          </div>
          <Link
            href="/admin"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (permissionsLoading || reviewLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Review Queue</h1>
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Review Queue</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Approve or reject pending posts from writers
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Role:</span>
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Pending</div>
          </div>
          <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Loaded for Review</div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedPosts.size > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
            <span className="text-blue-700 dark:text-blue-300">
              {selectedPosts.size} post{selectedPosts.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Approve All
              </button>
              <button
                onClick={handleBulkReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Reject All
              </button>
              <button
                onClick={() => setSelectedPosts(new Set())}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Posts List */}
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">No posts in the review queue</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Posts submitted by writers will appear here
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedPosts.size === filteredPosts.length && filteredPosts.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Select All ({filteredPosts.length})
                </span>
              </div>
            </div>

            {/* Posts */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className={`p-6 transition-colors ${
                    selectedPosts.has(post.id) ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedPosts.has(post.id)}
                      onChange={() => handleSelect(post.id)}
                      className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            Post #{post.id}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                              by <span className="font-mono">{formatAddress(post.author)}</span>
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {format(new Date(post.createdAt * 1000), 'MMM d, yyyy h:mm a')}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600">|</span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                              Pending Review
                            </span>
                          </div>

                          {post.ipfsCid && (
                            <div className="mt-2 text-xs text-gray-400 font-mono truncate">
                              IPFS: {post.ipfsCid}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/review/${post.id}/preview`}
                            className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                          >
                            Preview
                          </Link>
                          <button
                            onClick={() => handleApprove(post.id)}
                            disabled={processingIds.has(post.id) || isApproving}
                            className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingIds.has(post.id) && isApproving ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(post.id)}
                            disabled={processingIds.has(post.id) || isRejecting}
                            className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processingIds.has(post.id) && isRejecting ? 'Rejecting...' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <Link
            href="/admin"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
