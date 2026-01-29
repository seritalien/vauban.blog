'use client';

import type { Badge } from '@/hooks/use-reputation';

interface ReputationBadgeProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

export function ReputationBadge({ badge, size = 'md' }: ReputationBadgeProps) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 dark:from-amber-900/30 dark:to-yellow-800/30 border border-amber-200 dark:border-amber-700 ${sizeClasses[size]}`}
      title={`${badge.name}: ${badge.description}`}
    >
      <span role="img" aria-label={badge.name}>
        {badge.icon}
      </span>
    </div>
  );
}
