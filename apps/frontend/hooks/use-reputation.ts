'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import {
  getUserReputation,
  type UserReputation,
  BADGE_INFO,
  LEVEL_NAMES,
} from '@vauban/web3-utils';

export interface Badge {
  type: string;
  name: string;
  description: string;
  icon: string;
}

export interface UseReputationResult {
  reputation: UserReputation | null;
  level: number;
  levelName: string;
  points: number;
  badges: Badge[];
  hasBadge: (badgeType: string) => boolean;
  isLoading: boolean;
  error: string | null;
}

export function useReputation(address: string | null | undefined): UseReputationResult {
  const query = useQuery({
    queryKey: queryKeys.reputation.user(address ?? ''),
    queryFn: () => getUserReputation(address!),
    enabled: !!address,
  });

  const reputation = query.data ?? null;
  const badges: Badge[] = reputation?.badgeList?.map((badgeName: string) => {
    const info = BADGE_INFO[badgeName as keyof typeof BADGE_INFO];
    return {
      type: badgeName,
      name: info?.name ?? badgeName,
      description: info?.description ?? '',
      icon: info?.icon ?? '',
    };
  }) ?? [];

  return {
    reputation,
    level: reputation?.level ?? 0,
    levelName: LEVEL_NAMES[reputation?.level ?? 0] ?? 'Newcomer',
    points: Number(reputation?.totalPoints ?? 0),
    badges,
    hasBadge: (badgeType: string) => badges.some((b) => b.type === badgeType),
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
  };
}
