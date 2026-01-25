'use client';

import { useMemo, useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePosts } from '@/hooks/use-posts';
import { useWallet } from '@/providers/wallet-provider';
import { useRole } from '@/hooks/use-role';
import {
  BADGES,
  getReputationLevel,
  getUserBadges,
} from '@vauban/shared-types';
import Link from 'next/link';
import { format, subDays, isAfter, formatDistanceToNow } from 'date-fns';
import { normalizeAddress, getProfile, saveProfile, formatAddress } from '@/lib/profiles';
import ImageUpload from '@/components/editor/ImageUpload';
import { LoadingPage } from '@/components/ui/Loading';

export const dynamic = 'force-dynamic';

// Tab types
type ProfileTab = 'overview' | 'posts' | 'settings';

// Scheduled post type
interface ScheduledPost {
  id: string;
  scheduledAt: string;
  createdAt: string;
  authorAddress: string;
  postData: {
    title: string;
    slug: string;
    excerpt: string;
    tags: string[];
  };
  status: 'pending' | 'published' | 'failed';
  error?: string;
  publishedAt?: string;
}

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

// Wrapper component to handle Suspense for useSearchParams
function ProfilePageContent() {
  const { address, isConnected } = useWallet();
  const { posts, isLoading } = usePosts(100, 0);
  const { roleLabel, userRole } = useRole();
  const searchParams = useSearchParams();

  // Active tab - read from URL param or default to 'overview'
  const tabParam = searchParams.get('tab') as ProfileTab | null;
  const initialTab = tabParam && ['overview', 'posts', 'settings'].includes(tabParam) ? tabParam : 'overview';
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);

  // Update tab when URL param changes
  useEffect(() => {
    if (tabParam && ['overview', 'posts', 'settings'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  // Scheduled posts state
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  // Profile settings state
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    avatar: '',
    website: '',
    twitter: '',
    github: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Load existing profile
  useEffect(() => {
    if (address) {
      const existing = getProfile(address);
      if (existing) {
        setFormData({
          displayName: existing.displayName || '',
          bio: existing.bio || '',
          avatar: existing.avatar || '',
          website: existing.website || '',
          twitter: existing.twitter || '',
          github: existing.github || '',
        });
      }
    }
  }, [address]);

  // Fetch scheduled posts
  const fetchScheduledPosts = useCallback(async () => {
    if (!address) return;
    try {
      const response = await fetch(`/api/scheduled?author=${address}&status=pending`);
      if (response.ok) {
        const data = await response.json();
        setScheduledPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Failed to fetch scheduled posts:', error);
    }
  }, [address]);

  useEffect(() => {
    fetchScheduledPosts();
  }, [fetchScheduledPosts]);

  // Cancel scheduled post
  const handleCancelScheduled = async (postId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled post?')) return;
    try {
      const response = await fetch(`/api/scheduled?id=${postId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setScheduledPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (error) {
      console.error('Failed to cancel scheduled post:', error);
    }
  };

  // Save profile
  const handleSaveProfile = () => {
    if (!address) return;

    setIsSaving(true);
    try {
      saveProfile({
        address: address,
        displayName: formData.displayName || undefined,
        bio: formData.bio || undefined,
        avatar: formData.avatar || undefined,
        website: formData.website || undefined,
        twitter: formData.twitter || undefined,
        github: formData.github || undefined,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

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
          <h1 className="text-3xl font-bold mb-4">My Profile</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Please connect your wallet to view your profile.
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
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 dark:bg-gray-700 h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const tabs: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      id: 'posts',
      label: 'My Posts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            {formData.avatar ? (
              <img
                src={formData.avatar}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                {(formData.displayName || address || '?')[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {formData.displayName || formatAddress(address || '')}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-mono">
                {formatAddress(address || '')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              {roleLabel}
            </span>
            <Link
              href={`/authors/${address}`}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
            >
              View Public Profile
            </Link>
            <Link
              href="/admin"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Write Article
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'posts' && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded-full">
                    {myPosts.length}
                  </span>
                )}
                {tab.id === 'posts' && scheduledPosts.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                    +{scheduledPosts.length} scheduled
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab
            earnings={earnings}
            reputation={reputation}
            reputationLevel={reputationLevel}
            userBadges={userBadges}
            postStats={postStats}
            scheduledPosts={scheduledPosts}
            myPosts={myPosts}
            formatStrk={formatStrk}
            onCancelScheduled={handleCancelScheduled}
          />
        )}

        {activeTab === 'posts' && (
          <PostsTab
            myPosts={myPosts}
            scheduledPosts={scheduledPosts}
            onCancelScheduled={handleCancelScheduled}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            address={address || ''}
            formData={formData}
            setFormData={setFormData}
            isSaving={isSaving}
            saveStatus={saveStatus}
            onSave={handleSaveProfile}
          />
        )}
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  earnings,
  reputation,
  reputationLevel,
  userBadges,
  postStats,
  scheduledPosts,
  myPosts,
  formatStrk,
  onCancelScheduled,
}: {
  earnings: EarningsData;
  reputation: ReputationData;
  reputationLevel: ReturnType<typeof getReputationLevel>;
  userBadges: string[];
  postStats: { total: number; thisWeek: number; thisMonth: number; paidPosts: number; verifiedPosts: number };
  scheduledPosts: ScheduledPost[];
  myPosts: Array<{ id: string; title: string; createdAt: Date; isPaid: boolean; isVerified: boolean; price?: number }>;
  formatStrk: (wei: bigint) => string;
  onCancelScheduled: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Earnings Section */}
      <section>
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
      </section>

      {/* Reputation Section */}
      <section>
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
                    const badge = BADGES[badgeName as keyof typeof BADGES];
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
      </section>

      {/* Post Stats */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Content Performance</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Total Posts" value={postStats.total} />
          <StatCard title="This Week" value={postStats.thisWeek} highlight />
          <StatCard title="This Month" value={postStats.thisMonth} />
          <StatCard title="Paid Articles" value={postStats.paidPosts} />
          <StatCard title="Verified" value={postStats.verifiedPosts} />
        </div>
      </section>

      {/* Scheduled Posts */}
      {scheduledPosts.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Scheduled Posts
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {scheduledPosts.length} {scheduledPosts.length === 1 ? 'post' : 'posts'} queued
            </span>
          </div>
          <ScheduledPostsList posts={scheduledPosts} onCancel={onCancelScheduled} />
        </section>
      )}

      {/* Recent Posts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Posts</h2>
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
          <RecentPostsTable posts={myPosts.slice(0, 5)} />
        )}
      </section>

      {/* Quick Links */}
      <section>
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
            href="/admin/posts"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
            title="Manage Posts"
            description="Edit or delete your posts"
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
      </section>
    </div>
  );
}

// Posts Tab Component
function PostsTab({
  myPosts,
  scheduledPosts,
  onCancelScheduled,
}: {
  myPosts: Array<{ id: string; title: string; createdAt: Date; isPaid: boolean; isVerified: boolean; price?: number }>;
  scheduledPosts: ScheduledPost[];
  onCancelScheduled: (id: string) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Scheduled Posts */}
      {scheduledPosts.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Scheduled ({scheduledPosts.length})
          </h2>
          <ScheduledPostsList posts={scheduledPosts} onCancel={onCancelScheduled} />
        </section>
      )}

      {/* Published Posts */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Published ({myPosts.length})</h2>
          <Link
            href="/admin"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            + New Article
          </Link>
        </div>

        {myPosts.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-4">You haven&apos;t published any posts yet.</p>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Write Your First Article
            </Link>
          </div>
        ) : (
          <RecentPostsTable posts={myPosts} showAll />
        )}
      </section>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({
  address,
  formData,
  setFormData,
  isSaving,
  saveStatus,
  onSave,
}: {
  address: string;
  formData: {
    displayName: string;
    bio: string;
    avatar: string;
    website: string;
    twitter: string;
    github: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<typeof formData>>;
  isSaving: boolean;
  saveStatus: 'idle' | 'saved' | 'error';
  onSave: () => void;
}) {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar */}
      <div>
        <label className="block text-sm font-semibold mb-2">Profile Picture</label>
        {formData.avatar ? (
          <div className="flex items-center gap-4">
            <img
              src={formData.avatar}
              alt="Avatar"
              className="w-24 h-24 rounded-full object-cover"
            />
            <div className="flex-1">
              <input
                type="url"
                value={formData.avatar}
                onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                className="w-full border rounded px-4 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                placeholder="Image URL"
              />
              <button
                type="button"
                onClick={() => setFormData({ ...formData, avatar: '' })}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <ImageUpload
            onUpload={(url) => setFormData({ ...formData, avatar: url })}
          />
        )}
      </div>

      {/* Wallet Address (read-only) */}
      <div>
        <label className="block text-sm font-semibold mb-2">Wallet Address</label>
        <input
          type="text"
          value={address}
          disabled
          className="w-full border rounded px-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono text-sm dark:border-gray-700"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Your wallet address cannot be changed.
        </p>
      </div>

      {/* Display Name */}
      <div>
        <label className="block text-sm font-semibold mb-2">Display Name</label>
        <input
          type="text"
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
          placeholder={formatAddress(address)}
          maxLength={50}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          If empty, your wallet address will be displayed.
        </p>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-semibold mb-2">Bio</label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
          rows={4}
          placeholder="Tell readers about yourself..."
          maxLength={500}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {formData.bio.length}/500 characters
        </p>
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-semibold mb-2">Website</label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
          className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
          placeholder="https://yourwebsite.com"
        />
      </div>

      {/* Twitter */}
      <div>
        <label className="block text-sm font-semibold mb-2">Twitter</label>
        <div className="flex">
          <span className="inline-flex items-center px-3 border border-r-0 rounded-l bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:border-gray-700">
            @
          </span>
          <input
            type="text"
            value={formData.twitter.replace('@', '')}
            onChange={(e) => setFormData({ ...formData, twitter: e.target.value.replace('@', '') })}
            className="flex-1 border rounded-r px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
            placeholder="username"
            maxLength={15}
          />
        </div>
      </div>

      {/* GitHub */}
      <div>
        <label className="block text-sm font-semibold mb-2">GitHub</label>
        <div className="flex">
          <span className="inline-flex items-center px-3 border border-r-0 rounded-l bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:border-gray-700">
            github.com/
          </span>
          <input
            type="text"
            value={formData.github}
            onChange={(e) => setFormData({ ...formData, github: e.target.value })}
            className="flex-1 border rounded-r px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
            placeholder="username"
            maxLength={39}
          />
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-4 pt-4">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Profile'}
        </button>

        {saveStatus === 'saved' && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Profile saved!
          </span>
        )}

        {saveStatus === 'error' && (
          <span className="text-red-600 dark:text-red-400">
            Failed to save profile
          </span>
        )}
      </div>
    </div>
  );
}

// Shared Components
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

function ScheduledPostsList({
  posts,
  onCancel,
}: {
  posts: ScheduledPost[];
  onCancel: (id: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {posts.map((post) => (
          <div key={post.id} className="p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {post.postData.title}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {format(new Date(post.scheduledAt), 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {format(new Date(post.scheduledAt), 'HH:mm')}
                </span>
                <span className="text-green-600 dark:text-green-400">
                  {formatDistanceToNow(new Date(post.scheduledAt), { addSuffix: true })}
                </span>
              </div>
            </div>
            <button
              onClick={() => onCancel(post.id)}
              className="ml-4 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentPostsTable({
  posts,
  showAll = false,
}: {
  posts: Array<{ id: string; title: string; createdAt: Date; isPaid: boolean; isVerified: boolean; price?: number }>;
  showAll?: boolean;
}) {
  return (
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
          {posts.map((post) => (
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
      {showAll && posts.length > 10 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Showing all {posts.length} posts
          </span>
        </div>
      )}
    </div>
  );
}

// Main page component with Suspense boundary for useSearchParams
export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingPage message="Loading profile..." />}>
      <ProfilePageContent />
    </Suspense>
  );
}
