'use client';

import { useState, useMemo } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useModerationPermissions } from '@/hooks/use-permissions';
import { useRole } from '@/hooks/use-role';
import { ROLES, ROLE_LABELS } from '@vauban/shared-types';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatAddress } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

// Report reasons
const REPORT_REASONS = {
  spam: { label: 'Spam', color: 'yellow' },
  harassment: { label: 'Harassment', color: 'red' },
  misinformation: { label: 'Misinformation', color: 'orange' },
  copyright: { label: 'Copyright', color: 'purple' },
  other: { label: 'Other', color: 'gray' },
} as const;

type ReportReason = keyof typeof REPORT_REASONS;
type ReportStatus = 'pending' | 'resolved' | 'dismissed';
type ContentType = 'post' | 'comment' | 'user';

interface Report {
  id: string;
  reporter: string;
  targetType: ContentType;
  targetId: string;
  targetPreview: string;
  reason: ReportReason;
  details: string;
  createdAt: Date;
  status: ReportStatus;
  resolvedBy?: string;
  resolutionNote?: string;
  resolvedAt?: Date;
}

// Mock reports for demonstration
const MOCK_REPORTS: Report[] = [
  {
    id: '1',
    reporter: '0x1234567890abcdef1234567890abcdef12345678',
    targetType: 'comment',
    targetId: 'c123',
    targetPreview: 'This is spam content promoting a scam website...',
    reason: 'spam',
    details: 'Promoting crypto scam links in comment',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    status: 'pending',
  },
  {
    id: '2',
    reporter: '0xabcdef1234567890abcdef1234567890abcdef12',
    targetType: 'post',
    targetId: 'p456',
    targetPreview: 'Article making false claims about...',
    reason: 'misinformation',
    details: 'Contains factually incorrect information about blockchain technology',
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    status: 'pending',
  },
  {
    id: '3',
    reporter: '0x9876543210fedcba9876543210fedcba98765432',
    targetType: 'comment',
    targetId: 'c789',
    targetPreview: 'Personal attack on author...',
    reason: 'harassment',
    details: 'Targeted harassment and personal attacks',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    status: 'resolved',
    resolvedBy: '0x1111111111111111111111111111111111111111',
    resolutionNote: 'Comment hidden and user warned',
    resolvedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    id: '4',
    reporter: '0x1111222233334444555566667777888899990000',
    targetType: 'user',
    targetId: 'u999',
    targetPreview: 'User: 0xbad...actor',
    reason: 'spam',
    details: 'User has been posting spam comments on multiple articles',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'dismissed',
    resolvedBy: '0x1111111111111111111111111111111111111111',
    resolutionNote: 'No violation found after review',
    resolvedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
  },
];

type FilterTab = 'pending' | 'resolved' | 'all';

export default function ModerationPage() {
  const { isConnected } = useWallet();
  const { canViewReports, canResolveReports, canTempBanUsers, isLoading: permissionsLoading } = useModerationPermissions();
  const { roleLabel } = useRole();

  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [selectedReason, setSelectedReason] = useState<ReportReason | 'all'>('all');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showBanModal, setShowBanModal] = useState<string | null>(null);
  const [banDuration, setBanDuration] = useState<number>(24);
  const [banReason, setBanReason] = useState('');

  // Mock reports
  const reports = MOCK_REPORTS;

  const filteredReports = useMemo(() => {
    let filtered = reports;

    // Filter by tab
    if (activeTab === 'pending') {
      filtered = filtered.filter((r) => r.status === 'pending');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter((r) => r.status === 'resolved' || r.status === 'dismissed');
    }

    // Filter by reason
    if (selectedReason !== 'all') {
      filtered = filtered.filter((r) => r.reason === selectedReason);
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [reports, activeTab, selectedReason]);

  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    resolved: reports.filter((r) => r.status === 'resolved').length,
    dismissed: reports.filter((r) => r.status === 'dismissed').length,
  }), [reports]);

  const handleResolve = async (reportId: string, action: 'hide' | 'warn' | 'ban' | 'dismiss') => {
    setProcessingIds((prev) => new Set(prev).add(reportId));
    try {
      // TODO: Call contract to resolve report
      console.log('Resolving report:', reportId, 'Action:', action);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(reportId);
        return newSet;
      });
    }
  };

  const handleBan = async (userId: string) => {
    if (!banReason) return;

    setProcessingIds((prev) => new Set(prev).add(userId));
    try {
      // TODO: Call contract to ban user
      console.log('Banning user:', userId, 'Duration:', banDuration, 'hours', 'Reason:', banReason);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowBanModal(null);
      setBanDuration(24);
      setBanReason('');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Check wallet connection
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Moderation</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your wallet to access moderation tools.
          </p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Check permissions
  if (!permissionsLoading && !canViewReports) {
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
              You don&apos;t have permission to access moderation tools.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Current role: <span className="font-medium">{roleLabel}</span>
              <br />
              Required: <span className="font-medium">{ROLE_LABELS[ROLES.MODERATOR]}</span> or higher
            </p>
          </div>
          <Link href="/admin" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (permissionsLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Moderation</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg" />
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
            <h1 className="text-3xl font-bold">Moderation</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Review reports and manage content moderation
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Role:</span>
            <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full font-medium">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Reports</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Pending</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Resolved</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-500">{stats.dismissed}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Dismissed</div>
          </div>
        </div>

        {/* Tabs and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {(['pending', 'resolved', 'all'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Reason Filter */}
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value as ReportReason | 'all')}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="all">All Reasons</option>
            {Object.entries(REPORT_REASONS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Reports List */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 dark:text-gray-400">No reports to display</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Report Header */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        REPORT_REASONS[report.reason].color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        REPORT_REASONS[report.reason].color === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                        REPORT_REASONS[report.reason].color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                        REPORT_REASONS[report.reason].color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {REPORT_REASONS[report.reason].label}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs">
                        {report.targetType.charAt(0).toUpperCase() + report.targetType.slice(1)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        report.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                        report.status === 'resolved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}>
                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                      </span>
                    </div>

                    {/* Target Preview */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg mb-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                        &ldquo;{report.targetPreview}&rdquo;
                      </p>
                    </div>

                    {/* Report Details */}
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      {report.details}
                    </p>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>
                        Reported by <span className="font-mono">{formatAddress(report.reporter)}</span>
                      </span>
                      <span>
                        {format(report.createdAt, 'MMM d, yyyy h:mm a')}
                      </span>
                      {report.resolvedBy && (
                        <span>
                          Resolved by <span className="font-mono">{formatAddress(report.resolvedBy)}</span>
                        </span>
                      )}
                    </div>

                    {/* Resolution Note */}
                    {report.resolutionNote && (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <p className="text-sm text-green-700 dark:text-green-300">
                          <strong>Resolution:</strong> {report.resolutionNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {report.status === 'pending' && canResolveReports && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleResolve(report.id, 'hide')}
                        disabled={processingIds.has(report.id)}
                        className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors text-sm disabled:opacity-50"
                      >
                        Hide Content
                      </button>
                      {report.targetType !== 'user' && canTempBanUsers && (
                        <button
                          onClick={() => setShowBanModal(report.id)}
                          disabled={processingIds.has(report.id)}
                          className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm disabled:opacity-50"
                        >
                          Ban User
                        </button>
                      )}
                      <button
                        onClick={() => handleResolve(report.id, 'dismiss')}
                        disabled={processingIds.has(report.id)}
                        className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <Link href="/admin" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Ban Modal */}
        {showBanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Temporarily Ban User
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration (hours)
                  </label>
                  <select
                    value={banDuration}
                    onChange={(e) => setBanDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value={1}>1 hour</option>
                    <option value={6}>6 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>7 days</option>
                    <option value={720}>30 days</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason
                  </label>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter reason for ban..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowBanModal(null);
                    setBanDuration(24);
                    setBanReason('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleBan(showBanModal)}
                  disabled={!banReason || processingIds.has(showBanModal)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingIds.has(showBanModal) ? 'Banning...' : 'Confirm Ban'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
