'use client';

import { useReputation } from '@/hooks/use-reputation';
import { ReputationBadge } from './ReputationBadge';

interface ReputationCardProps {
  address: string;
}

export function ReputationCard({ address }: ReputationCardProps) {
  const { level, levelName, points, badges, isLoading } = useReputation(address);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </div>
    );
  }

  if (points === 0 && badges.length === 0) return null;

  const levelProgress = Math.min((points % 1000) / 10, 100);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Reputation
        </h3>
        <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
          Level {level} &middot; {levelName}
        </span>
      </div>

      {/* Points and level bar */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{points.toLocaleString()}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">points</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Badges earned</p>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <ReputationBadge key={badge.type} badge={badge} size="md" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
