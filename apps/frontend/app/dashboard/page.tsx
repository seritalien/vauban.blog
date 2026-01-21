'use client';

import { useMemo } from 'react';
import { usePosts } from '@/hooks/use-posts';
import { useWallet } from '@/providers/wallet-provider';
import { useRole } from '@/hooks/use-role';
import {
  BADGES,
  getReputationLevel,
  getUserBadges,
} from '@vauban/shared-types';
import Link from 'next/link';
import { format, subDays, isAfter } from 'date-fns';
import { normalizeAddress } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

// Mock earnings data (will be replaced with contract calls)
interface EarningsData {
  totalEarned: bigint;
  pendingWithdrawal: bigint;
  withdrawn: bigint;
  thisMonth: bigint;
  subscriberCount: number;
}

// Mock reputation data
interface ReputationData {
  totalPoints: bigint;
  level: number;
  badges: bigint;
  postCount: number;
  commentCount: number;
  likeCount: number;
}

export default function AuthorDashboardPage() {
  const { address, isConnected } = useWallet();
  const { posts, isLoading } = usePosts(100, 0);
  const { roleLabel, userRole } = useRole();

  // Filter to user's posts
  const myPosts = useMemo(() => {
    if (!address) return [];
    const normalizedAddress = normalizeAddress(address);
    return posts.filter((p) => normalizeAddress(p.author) === normalizedAddress);
  }, [posts, address]);

  // Mock earnings (will be from Treasury contract)
  const earnings: EarningsData = useMemo(() => ({
    totalEarned: BigInt(125000000000000000000), // 125 STRK
    pendingWithdrawal: BigInt(25000000000000000000), // 25 STRK
    withdrawn: BigInt(100000000000000000000), // 100 STRK
    thisMonth: BigInt(45000000000000000000), // 45 STRK
    subscriberCount: 23,
  }), []);

  // Mock reputation (will be from Reputation contract)
  const reputation: ReputationData = useMemo(() => ({
    totalPoints: userRole?.reputation ? BigInt(userRole.reputation) : BigInt(1250),
    level: 3,
    badges: BigInt(0b0000_0101_1001), // FIRST_POST, FEATURED_AUTHOR, CONVERSATIONALIST, EARLY_ADOPTER
    postCount: myPosts.length,
    commentCount: 47,
    likeCount: 312,
  }), [userRole, myPosts.length]);

  // Calculate post stats
  const postStats = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const thirtyDaysAgo = subDays(new Date(), 30);

    return {
      total: myPosts.length,
      thisWeek: myPosts.filter((p) => isAfter(p.createdAt, sevenDaysAgo)).length,
      thisMonth: myPosts.filter((p) => isAfter(p.createdAt, thirtyDaysAgo)).length,
      paidPosts: myPosts.filter((p) => p.isPaid).length,
      verifiedPosts: myPosts.filter((p) => p.isVerified).length,
    };
  }, [myPosts]);

  // Get reputation level info
  const reputationLevel = getReputationLevel(reputation.totalPoints);
  const userBadges = getUserBadges(reputation.badges);

  // Format STRK amounts
  const formatStrk = (wei: bigint) => {
    const strk = Number(wei) / 1e18;
    return strk.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Author Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your wallet to view your dashboard.
          </p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Author Dashboard</h1>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />
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
            <h1 className="text-3xl font-bold">Author Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your performance, earnings, and reputation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              {roleLabel}
            </span>
            <Link
              href="/admin"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Write New Article
            </Link>
          </div>
        </div>

        {/* Earnings Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Earnings</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-6 text-white">
              <div className="text-3xl font-bold">{formatStrk(earnings.totalEarned)} STRK</div>
              <div className="text-green-100 text-sm mt-1">Total Earned</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatStrk(earnings.pendingWithdrawal)} STRK</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">Pending Withdrawal</div>
              {earnings.pendingWithdrawal > 0 && (
                <button className="mt-3 px-4 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors">
                  Withdraw
                </button>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{formatStrk(earnings.thisMonth)} STRK</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">This Month</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{earnings.subscriberCount}</div>
              <div className="text-gray-500 dark:text-gray-400 text-sm mt-1">Subscribers</div>
            </div>
          </div>
        </div>

        {/* Reputation Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Reputation</h2>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Level Progress */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-4xl font-bold text-gray-900 dark:text-white">
                    Level {reputationLevel.level}
                  </div>
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full text-sm font-medium">
                    {reputationLevel.label}
                  </span>
                </div>
                <div className="text-gray-600 dark:text-gray-400 mb-3">
                  {Number(reputation.totalPoints).toLocaleString()} reputation points
                </div>

                {/* Progress bar to next level */}
                {reputationLevel.level < 5 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min(100, ((Number(reputation.totalPoints) - reputationLevel.min) / (reputationLevel.max - reputationLevel.min)) * 100)}%`
                      }}
                    />
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap gap-6 mt-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Posts:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{reputation.postCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Comments:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{reputation.commentCount}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Likes Received:</span>{' '}
                    <span className="font-medium text-gray-900 dark:text-white">{reputation.likeCount}</span>
                  </div>
                </div>
              </div>

              {/* Badges */}
              <div className="md:border-l md:border-gray-200 dark:md:border-gray-700 md:pl-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Badges</h3>
                <div className="flex flex-wrap gap-2">
                  {userBadges.length === 0 ? (
                    <span className="text-gray-500 dark:text-gray-400 text-sm">No badges yet</span>
                  ) : (
                    userBadges.map((badgeName) => {
                      const badge = BADGES[badgeName];
                      return (
                        <div
                          key={badgeName}
                          className="group relative px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm"
                          title={badge.description}
                        >
                          <span className="mr-1">{badge.emoji}</span>
                          <span className="text-gray-700 dark:text-gray-300">{badge.label}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Show locked badges hint */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                  {12 - userBadges.length} more badges to unlock
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Post Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Content Performance</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Posts" value={postStats.total} />
            <StatCard title="This Week" value={postStats.thisWeek} highlight />
            <StatCard title="This Month" value={postStats.thisMonth} />
            <StatCard title="Paid Articles" value={postStats.paidPosts} />
            <StatCard title="Verified" value={postStats.verifiedPosts} />
          </div>
        </div>

        {/* Recent Posts */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Your Recent Posts</h2>
            <Link
              href="/admin/posts"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              View all &rarr;
            </Link>
          </div>

          {myPosts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">You haven&apos;t published any posts yet.</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Write Your First Article
              </Link>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 font-medium">Title</th>
                    <th className="px-6 py-3 font-medium">Published</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {myPosts.slice(0, 5).map((post) => (
                    <tr key={post.id}>
                      <td className="px-6 py-4">
                        <Link
                          href={`/articles/${post.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
                        >
                          {post.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {format(post.createdAt, 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        {post.isPaid ? (
                          <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                            {post.price} STRK
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            Free
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {post.isVerified ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 text-sm">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/posts/${post.id}/edit`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink
              href="/admin"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              }
              title="New Article"
              description="Write and publish a new post"
            />
            <QuickLink
              href="/admin/drafts"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="Drafts"
              description="Continue working on drafts"
            />
            <QuickLink
              href="/admin/profile"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              title="Profile"
              description="Update your author profile"
            />
            <QuickLink
              href="/admin/analytics"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Analytics"
              description="View detailed statistics"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, highlight = false }: { title: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${
      highlight
        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
        : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
    }`}>
      <div className={`text-2xl font-bold ${
        highlight ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
      }`}>
        {value}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-sm transition-all"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </Link>
  );
}
