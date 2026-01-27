'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useRole, useIsAdmin } from '@/hooks/use-role';
import { ROLES, ROLE_LABELS } from '@vauban/shared-types';
import {
  getRoleStats,
  getUserRole,
  grantRole,
  revokeRole,
  ROLE_NAMES,
  ROLE_READER,
  ROLE_WRITER,
  ROLE_CONTRIBUTOR,
  ROLE_MODERATOR,
  ROLE_EDITOR,
  ROLE_ADMIN,
  ROLE_OWNER,
  type RoleStats,
  type UserRoleInfo,
} from '@vauban/web3-utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { formatAddress } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

// Role badge colors
const ROLE_COLORS: Record<number, { bg: string; text: string }> = {
  [ROLE_READER]: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' },
  [ROLE_WRITER]: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  [ROLE_CONTRIBUTOR]: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  [ROLE_MODERATOR]: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  [ROLE_EDITOR]: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  [ROLE_ADMIN]: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  [ROLE_OWNER]: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
};

// Role badge component
function RoleBadge({ role }: { role: number }) {
  const colors = ROLE_COLORS[role] || ROLE_COLORS[ROLE_READER];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
      {ROLE_NAMES[role] || 'Unknown'}
    </span>
  );
}

export default function AdminUsersPage() {
  const { isConnected, account } = useWallet();
  const { roleLabel, roleLevel } = useRole();
  const isAdmin = useIsAdmin();

  const [stats, setStats] = useState<RoleStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [lookupAddress, setLookupAddress] = useState('');
  const [lookupResult, setLookupResult] = useState<UserRoleInfo | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Grant role modal state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantAddress, setGrantAddress] = useState('');
  const [grantRoleValue, setGrantRoleValue] = useState<number>(ROLE_WRITER);
  const [isGranting, setIsGranting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  // Revoke state
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);

  // Load stats on mount
  useEffect(() => {
    async function loadStats() {
      try {
        const data = await getRoleStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load role stats:', err);
      } finally {
        setIsLoadingStats(false);
      }
    }
    loadStats();
  }, []);

  // Lookup user by address
  const handleLookup = async () => {
    if (!lookupAddress.trim()) return;

    setIsLookingUp(true);
    setLookupError(null);
    setLookupResult(null);

    try {
      const result = await getUserRole(lookupAddress.trim());
      setLookupResult(result);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Failed to lookup user');
    } finally {
      setIsLookingUp(false);
    }
  };

  // Grant role handler
  const handleGrantRole = async () => {
    if (!grantAddress.trim() || !account) return;

    setIsGranting(true);
    setGrantError(null);
    setGrantSuccess(null);

    try {
      const tx = await grantRole(account, grantAddress.trim(), grantRoleValue);
      setGrantSuccess(`Role granted successfully! TX: ${tx.slice(0, 10)}...`);
      setShowGrantModal(false);
      setGrantAddress('');
      setGrantRoleValue(ROLE_WRITER);
      // Refresh stats
      const newStats = await getRoleStats();
      setStats(newStats);
      // If we were looking at this user, refresh their info
      if (lookupAddress.toLowerCase() === grantAddress.trim().toLowerCase()) {
        const result = await getUserRole(lookupAddress.trim());
        setLookupResult(result);
      }
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Failed to grant role');
    } finally {
      setIsGranting(false);
    }
  };

  // Revoke role handler
  const handleRevokeRole = async (userAddress: string) => {
    if (!account) return;

    setIsRevoking(true);
    setRevokeError(null);
    setRevokeSuccess(null);

    try {
      const tx = await revokeRole(account, userAddress);
      setRevokeSuccess(`Role revoked successfully! TX: ${tx.slice(0, 10)}...`);
      // Refresh stats
      const newStats = await getRoleStats();
      setStats(newStats);
      // If we were looking at this user, refresh their info
      if (lookupAddress.toLowerCase() === userAddress.toLowerCase()) {
        const result = await getUserRole(userAddress);
        setLookupResult(result);
      }
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : 'Failed to revoke role');
    } finally {
      setIsRevoking(false);
    }
  };

  // Roles that current user can grant (based on their own role)
  const grantableRoles = useMemo(() => {
    const roles: { value: number; label: string }[] = [];

    // Owner can grant any role
    if (roleLevel === ROLES.OWNER) {
      roles.push(
        { value: ROLE_READER, label: ROLE_NAMES[ROLE_READER] },
        { value: ROLE_WRITER, label: ROLE_NAMES[ROLE_WRITER] },
        { value: ROLE_CONTRIBUTOR, label: ROLE_NAMES[ROLE_CONTRIBUTOR] },
        { value: ROLE_MODERATOR, label: ROLE_NAMES[ROLE_MODERATOR] },
        { value: ROLE_EDITOR, label: ROLE_NAMES[ROLE_EDITOR] },
        { value: ROLE_ADMIN, label: ROLE_NAMES[ROLE_ADMIN] },
      );
    }
    // Admin can grant up to EDITOR
    else if (roleLevel === ROLES.ADMIN) {
      roles.push(
        { value: ROLE_READER, label: ROLE_NAMES[ROLE_READER] },
        { value: ROLE_WRITER, label: ROLE_NAMES[ROLE_WRITER] },
        { value: ROLE_CONTRIBUTOR, label: ROLE_NAMES[ROLE_CONTRIBUTOR] },
        { value: ROLE_MODERATOR, label: ROLE_NAMES[ROLE_MODERATOR] },
        { value: ROLE_EDITOR, label: ROLE_NAMES[ROLE_EDITOR] },
      );
    }
    // Editor can grant up to MODERATOR
    else if (roleLevel === ROLES.EDITOR) {
      roles.push(
        { value: ROLE_READER, label: ROLE_NAMES[ROLE_READER] },
        { value: ROLE_WRITER, label: ROLE_NAMES[ROLE_WRITER] },
        { value: ROLE_CONTRIBUTOR, label: ROLE_NAMES[ROLE_CONTRIBUTOR] },
        { value: ROLE_MODERATOR, label: ROLE_NAMES[ROLE_MODERATOR] },
      );
    }

    return roles;
  }, [roleLevel]);

  // Check wallet connection
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your wallet to access user management tools.
          </p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  // Check permissions (require ADMIN+)
  if (!isAdmin) {
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
              You don&apos;t have permission to manage users.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Current role: <span className="font-medium">{roleLabel}</span>
              <br />
              Required: <span className="font-medium">{ROLE_LABELS[ROLES.ADMIN]}</span> or higher
            </p>
          </div>
          <Link href="/admin" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Dashboard
          </Link>
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
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage user roles and permissions
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Your Role:</span>
            <RoleBadge role={roleLevel} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {isLoadingStats ? '-' : stats?.totalUsers || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Users</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {isLoadingStats ? '-' : stats?.writerCount || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Writers</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {isLoadingStats ? '-' : stats?.contributorCount || 0}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Contributors</div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {isLoadingStats ? '-' : (stats?.adminCount || 0) + (stats?.ownerCount || 0)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Admins/Owners</div>
          </div>
        </div>

        {/* Role distribution */}
        {stats && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Role Distribution</h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_READER} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.readerCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_WRITER} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.writerCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_CONTRIBUTOR} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.contributorCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_MODERATOR} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.moderatorCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_EDITOR} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.editorCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_ADMIN} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.adminCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <RoleBadge role={ROLE_OWNER} />
                <span className="text-sm text-gray-600 dark:text-gray-400">{stats.ownerCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lookup User */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Lookup User</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => setLookupAddress(e.target.value)}
                placeholder="Enter user address (0x...)"
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={handleLookup}
                disabled={isLookingUp || !lookupAddress.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isLookingUp ? 'Looking up...' : 'Lookup'}
              </button>
            </div>

            {lookupError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm mb-4">
                {lookupError}
              </div>
            )}

            {lookupResult && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-sm">{formatAddress(lookupResult.user)}</span>
                  <RoleBadge role={lookupResult.role} />
                </div>
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Approved Posts:</span>
                    <span className="font-medium">{lookupResult.approvedPostCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reputation:</span>
                    <span className="font-medium">{lookupResult.reputation.toString()}</span>
                  </div>
                  {lookupResult.grantedAt > 0 && (
                    <div className="flex justify-between">
                      <span>Role Granted:</span>
                      <span className="font-medium">
                        {format(new Date(lookupResult.grantedAt * 1000), 'MMM d, yyyy')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions for this user */}
                {lookupResult.role < roleLevel && lookupResult.role > ROLE_READER && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleRevokeRole(lookupResult.user)}
                      disabled={isRevoking}
                      className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm disabled:opacity-50"
                    >
                      {isRevoking ? 'Revoking...' : 'Revoke Role'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {revokeError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                {revokeError}
              </div>
            )}
            {revokeSuccess && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                {revokeSuccess}
              </div>
            )}
          </div>

          {/* Grant Role */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Grant Role</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Assign a role to a user. You can only grant roles lower than your own.
            </p>
            <button
              onClick={() => setShowGrantModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Grant New Role
            </button>

            {grantSuccess && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-sm">
                {grantSuccess}
              </div>
            )}
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <Link href="/admin" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Grant Role Modal */}
        {showGrantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Grant Role
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    User Address
                  </label>
                  <input
                    type="text"
                    value={grantAddress}
                    onChange={(e) => setGrantAddress(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Role
                  </label>
                  <select
                    value={grantRoleValue}
                    onChange={(e) => setGrantRoleValue(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    {grantableRoles.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {grantError && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {grantError}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowGrantModal(false);
                    setGrantAddress('');
                    setGrantRoleValue(ROLE_WRITER);
                    setGrantError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGrantRole}
                  disabled={!grantAddress.trim() || isGranting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGranting ? 'Granting...' : 'Grant Role'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
