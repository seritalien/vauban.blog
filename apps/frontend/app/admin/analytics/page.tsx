'use client';

import { useMemo } from 'react';
import { usePosts } from '@/hooks/use-posts';
import { useWallet } from '@/providers/wallet-provider';
import Link from 'next/link';
import { format, subDays, isAfter } from 'date-fns';
import { normalizeAddress } from '@/lib/profiles';

export const dynamic = 'force-dynamic';

export default function AnalyticsDashboardPage() {
  const { address, isConnected } = useWallet();
  const { posts, isLoading } = usePosts(100, 0);

  // Calculate analytics
  const analytics = useMemo(() => {
    const totalPosts = posts.length;
    const normalizedUserAddress = address ? normalizeAddress(address) : '';
    const myPosts = address
      ? posts.filter((p) => normalizeAddress(p.author) === normalizedUserAddress)
      : [];
    const myPostsCount = myPosts.length;

    // Posts in last 7 days
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentPosts = posts.filter((p) => isAfter(p.createdAt, sevenDaysAgo));

    // Posts in last 30 days
    const thirtyDaysAgo = subDays(new Date(), 30);
    const monthlyPosts = posts.filter((p) => isAfter(p.createdAt, thirtyDaysAgo));

    // Paid vs free posts
    const paidPosts = posts.filter((p) => p.isPaid);
    const freePosts = posts.filter((p) => !p.isPaid);

    // Tags distribution
    const tagCounts: Record<string, number> = {};
    posts.forEach((p) => {
      (p.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Recent posts for activity feed
    const recentActivity = [...posts]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      totalPosts,
      myPostsCount,
      recentPostsCount: recentPosts.length,
      monthlyPostsCount: monthlyPosts.length,
      paidPostsCount: paidPosts.length,
      freePostsCount: freePosts.length,
      topTags,
      recentActivity,
      myPosts,
    };
  }, [posts, address]);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Analytics Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to view analytics.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
        <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Posts"
            value={analytics.totalPosts}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            }
            color="blue"
          />
          <StatCard
            title="Your Posts"
            value={analytics.myPostsCount}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            color="purple"
          />
          <StatCard
            title="Last 7 Days"
            value={analytics.recentPostsCount}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            color="green"
          />
          <StatCard
            title="Paid Posts"
            value={analytics.paidPostsCount}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="yellow"
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
              {analytics.recentActivity.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
              ) : (
                <div className="space-y-4">
                  {analytics.recentActivity.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-4 pb-4 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/articles/${post.id}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1"
                        >
                          {post.title}
                        </Link>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Published {format(post.createdAt, 'MMM d, yyyy')}
                        </p>
                      </div>
                      {post.isPaid && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                          {post.price} STRK
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Tags */}
          <div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Popular Tags</h2>
              {analytics.topTags.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No tags yet</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topTags.map(([tag, count]) => (
                    <div key={tag} className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                        {tag}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {count} {count === 1 ? 'post' : 'posts'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link
                  href="/admin"
                  className="flex items-center gap-2 w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Article
                </Link>
                <Link
                  href="/admin/drafts"
                  className="flex items-center gap-2 w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Drafts
                </Link>
                <Link
                  href="/admin/profile"
                  className="flex items-center gap-2 w-full px-4 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Your Posts */}
        {analytics.myPosts.length > 0 && (
          <div className="mt-8">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Your Posts</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-3 font-medium">Title</th>
                      <th className="pb-3 font-medium">Published</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {analytics.myPosts.map((post) => (
                      <tr key={post.id}>
                        <td className="py-3">
                          <Link
                            href={`/articles/${post.id}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            {post.title}
                          </Link>
                        </td>
                        <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                          {format(post.createdAt, 'MMM d, yyyy')}
                        </td>
                        <td className="py-3">
                          {post.isPaid ? (
                            <span className="px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                              {post.price} STRK
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                              Free
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {(post.tags || []).slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                            {(post.tags || []).length > 2 && (
                              <span className="text-xs text-gray-400">
                                +{post.tags.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'green' | 'yellow';
}) {
  const colors = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
