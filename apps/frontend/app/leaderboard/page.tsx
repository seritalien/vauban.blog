'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { usePosts } from '@/hooks/use-posts';
import { getPostLikes } from '@vauban/web3-utils';
import { getProfile, getDisplayName } from '@/lib/profiles';
import { FollowButton } from '@/components/social';

export const dynamic = 'force-dynamic';

interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName: string;
  avatar?: string;
  points: number;
  level: number;
  postCount: number;
  likesReceived: number;
  badges: string[];
}

type LeaderboardPeriod = 'all-time' | 'monthly' | 'weekly';
type LeaderboardMetric = 'points' | 'posts' | 'likes';

const LEVEL_NAMES = ['Newcomer', 'Active Writer', 'Established', 'Veteran', 'Legend'];
const LEVEL_COLORS = [
  'text-gray-500',
  'text-green-500',
  'text-blue-500',
  'text-purple-500',
  'text-amber-500',
];

function getBadgeEmoji(badge: string): string {
  const badges: Record<string, string> = {
    first_post: '✍️',
    prolific_writer: '📝',
    century_club: '💯',
    featured_author: '⭐',
    conversationalist: '💬',
    beloved: '❤️',
    early_adopter: '🚀',
    verified: '✓',
    top_writer: '🏆',
    premium_author: '💎',
    trusted: '🛡️',
    guardian: '⚔️',
  };
  return badges[badge] || '🏅';
}

function LeaderboardRow({
  entry,
  index,
}: {
  entry: LeaderboardEntry;
  index: number;
}) {
  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { icon: '🥇', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' };
    if (rank === 2) return { icon: '🥈', className: 'bg-gray-100 dark:bg-gray-800 text-gray-600' };
    if (rank === 3) return { icon: '🥉', className: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' };
    return { icon: rank.toString(), className: 'bg-gray-50 dark:bg-gray-900 text-gray-500' };
  };

  const rankDisplay = getRankDisplay(entry.rank);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
    >
      {/* Rank */}
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${rankDisplay.className}`}
      >
        {rankDisplay.icon}
      </div>

      {/* Avatar */}
      <Link href={`/authors/${entry.address}`} className="flex-shrink-0">
        {entry.avatar ? (
          <img
            src={entry.avatar}
            alt={entry.displayName}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-700"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold ring-2 ring-gray-100 dark:ring-gray-700">
            {entry.displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/authors/${entry.address}`}
            className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
          >
            {entry.displayName}
          </Link>
          <span className={`text-xs font-medium ${LEVEL_COLORS[entry.level - 1] || LEVEL_COLORS[0]}`}>
            Lvl {entry.level} · {LEVEL_NAMES[entry.level - 1] || 'Newcomer'}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
          <span>{entry.postCount} posts</span>
          <span>·</span>
          <span>{entry.likesReceived} likes</span>
          {entry.badges.length > 0 && (
            <>
              <span>·</span>
              <span className="flex gap-0.5">
                {entry.badges.slice(0, 5).map((badge) => (
                  <span key={badge} title={badge.replace('_', ' ')}>
                    {getBadgeEmoji(badge)}
                  </span>
                ))}
                {entry.badges.length > 5 && (
                  <span className="text-xs">+{entry.badges.length - 5}</span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Points */}
      <div className="text-right">
        <div className="text-2xl font-bold text-gray-900 dark:text-white">
          {entry.points.toLocaleString()}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">points</div>
      </div>

      {/* Follow button */}
      <FollowButton targetAddress={entry.address} size="sm" />
    </motion.div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse"
        >
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
          <div className="text-right">
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LeaderboardPage() {
  const { posts, isLoading } = usePosts(100, 0);
  const [period, setPeriod] = useState<LeaderboardPeriod>('all-time');
  const [metric, setMetric] = useState<LeaderboardMetric>('points');

  // Fetch real like counts from the Social contract
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);

  useEffect(() => {
    if (posts.length === 0) return;

    let cancelled = false;
    setIsLoadingLikes(true);

    async function fetchLikes() {
      const map: Record<string, number> = {};
      // Batch fetch likes in groups of 10 to avoid overwhelming the RPC
      const batchSize = 10;
      for (let i = 0; i < posts.length; i += batchSize) {
        if (cancelled) return;
        const batch = posts.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (post) => {
            try {
              const count = await getPostLikes(post.id);
              return { id: post.id, author: post.author, count };
            } catch {
              return { id: post.id, author: post.author, count: 0 };
            }
          })
        );
        for (const r of results) {
          map[r.id] = r.count;
        }
      }
      if (!cancelled) {
        setLikesMap(map);
        setIsLoadingLikes(false);
      }
    }

    fetchLikes();
    return () => { cancelled = true; };
  }, [posts]);

  // Calculate leaderboard from posts data + real likes
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    const authorStats: Record<string, {
      address: string;
      postCount: number;
      likesReceived: number;
    }> = {};

    posts.forEach((post) => {
      const addr = post.author;
      if (!authorStats[addr]) {
        authorStats[addr] = {
          address: addr,
          postCount: 0,
          likesReceived: 0,
        };
      }
      authorStats[addr].postCount += 1;
      authorStats[addr].likesReceived += likesMap[post.id] ?? 0;
    });

    const entries: LeaderboardEntry[] = Object.values(authorStats).map((stats) => {
      const profile = getProfile(stats.address);
      // Calculate points based on activity
      const points = stats.postCount * 100 + stats.likesReceived * 5;
      // Calculate level based on points
      let level = 1;
      if (points >= 10000) level = 5;
      else if (points >= 2000) level = 4;
      else if (points >= 500) level = 3;
      else if (points >= 100) level = 2;

      // Generate badges based on activity
      const badges: string[] = [];
      if (stats.postCount >= 1) badges.push('first_post');
      if (stats.postCount >= 10) badges.push('prolific_writer');
      if (stats.postCount >= 100) badges.push('century_club');
      if (stats.likesReceived >= 1000) badges.push('beloved');

      return {
        rank: 0,
        address: stats.address,
        displayName: getDisplayName(stats.address, profile),
        avatar: profile?.avatar,
        points,
        level,
        postCount: stats.postCount,
        likesReceived: stats.likesReceived,
        badges,
      };
    });

    // Sort by selected metric
    entries.sort((a, b) => {
      switch (metric) {
        case 'posts':
          return b.postCount - a.postCount;
        case 'likes':
          return b.likesReceived - a.likesReceived;
        default:
          return b.points - a.points;
      }
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries.slice(0, 50); // Top 50
  }, [posts, metric, likesMap]);

  const periodOptions: { value: LeaderboardPeriod; label: string }[] = [
    { value: 'all-time', label: 'All Time' },
    { value: 'monthly', label: 'This Month' },
    { value: 'weekly', label: 'This Week' },
  ];

  const metricOptions: { value: LeaderboardMetric; label: string; icon: string }[] = [
    { value: 'points', label: 'Points', icon: '⚡' },
    { value: 'posts', label: 'Posts', icon: '📝' },
    { value: 'likes', label: 'Likes', icon: '❤️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Leaderboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Top contributors in the Vauban community
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
          {/* Period selector */}
          <div className="flex rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  period === option.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Metric selector */}
          <div className="flex rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1">
            {metricOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setMetric(option.value)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                  metric === option.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>{option.icon}</span>
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Loading indicator for likes fetch */}
        {isLoadingLikes && !isLoading && (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mb-4">
            Fetching on-chain engagement data...
          </div>
        )}

        {/* Top 3 Podium */}
        {!isLoading && leaderboard.length >= 3 && (
          <div className="flex justify-center items-end gap-4 mb-8">
            {/* 2nd place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <Link href={`/authors/${leaderboard[1].address}`}>
                <div className="relative">
                  {leaderboard[1].avatar ? (
                    <img
                      src={leaderboard[1].avatar}
                      alt={leaderboard[1].displayName}
                      className="w-16 h-16 rounded-full object-cover ring-4 ring-gray-300 dark:ring-gray-600 mx-auto"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xl font-bold ring-4 ring-gray-300 dark:ring-gray-600 mx-auto">
                      {leaderboard[1].displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl">🥈</span>
                </div>
              </Link>
              <p className="mt-4 font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
                {leaderboard[1].displayName}
              </p>
              <p className="text-sm text-gray-500">{leaderboard[1].points.toLocaleString()} pts</p>
              <div className="h-20 w-24 bg-gray-200 dark:bg-gray-700 rounded-t-lg mt-2" />
            </motion.div>

            {/* 1st place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Link href={`/authors/${leaderboard[0].address}`}>
                <div className="relative">
                  {leaderboard[0].avatar ? (
                    <img
                      src={leaderboard[0].avatar}
                      alt={leaderboard[0].displayName}
                      className="w-20 h-20 rounded-full object-cover ring-4 ring-amber-400 dark:ring-amber-500 mx-auto"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold ring-4 ring-amber-400 dark:ring-amber-500 mx-auto">
                      {leaderboard[0].displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl">🥇</span>
                </div>
              </Link>
              <p className="mt-4 font-bold text-gray-900 dark:text-white truncate max-w-[120px]">
                {leaderboard[0].displayName}
              </p>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {leaderboard[0].points.toLocaleString()} pts
              </p>
              <div className="h-28 w-28 bg-amber-100 dark:bg-amber-900/30 rounded-t-lg mt-2" />
            </motion.div>

            {/* 3rd place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <Link href={`/authors/${leaderboard[2].address}`}>
                <div className="relative">
                  {leaderboard[2].avatar ? (
                    <img
                      src={leaderboard[2].avatar}
                      alt={leaderboard[2].displayName}
                      className="w-14 h-14 rounded-full object-cover ring-4 ring-orange-300 dark:ring-orange-600 mx-auto"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-lg font-bold ring-4 ring-orange-300 dark:ring-orange-600 mx-auto">
                      {leaderboard[2].displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xl">🥉</span>
                </div>
              </Link>
              <p className="mt-4 font-medium text-gray-900 dark:text-white truncate max-w-[90px]">
                {leaderboard[2].displayName}
              </p>
              <p className="text-sm text-gray-500">{leaderboard[2].points.toLocaleString()} pts</p>
              <div className="h-14 w-20 bg-orange-100 dark:bg-orange-900/30 rounded-t-lg mt-2" />
            </motion.div>
          </div>
        )}

        {/* Full leaderboard */}
        <div className="space-y-4">
          {isLoading ? (
            <LeaderboardSkeleton />
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-3xl">🏆</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No rankings yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Be the first to publish and climb the leaderboard!
              </p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
              >
                Start Writing
              </Link>
            </div>
          ) : (
            leaderboard.slice(3).map((entry, index) => (
              <LeaderboardRow key={entry.address} entry={entry} index={index} />
            ))
          )}
        </div>

        {/* Stats summary */}
        {!isLoading && leaderboard.length > 0 && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {leaderboard.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Authors</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {leaderboard.reduce((sum, e) => sum + e.postCount, 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Posts</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {leaderboard.reduce((sum, e) => sum + e.likesReceived, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Likes</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {leaderboard.reduce((sum, e) => sum + e.points, 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Points</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
