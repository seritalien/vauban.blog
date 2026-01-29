'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/wallet-provider';
import { queryKeys } from '@/lib/query-keys';
import {
  getEarnings,
  getRevenueConfig,
  withdrawEarnings as withdrawEarningsContract,
  type Earnings,
  type RevenueConfig,
} from '@vauban/web3-utils';

export interface UseTreasuryResult {
  earnings: Earnings | null;
  config: RevenueConfig | null;
  isLoading: boolean;
  error: string | null;
  withdraw: () => Promise<void>;
  isWithdrawing: boolean;
}

export function useTreasury(address: string | null | undefined): UseTreasuryResult {
  const { account } = useWallet();
  const queryClient = useQueryClient();

  const earningsQuery = useQuery({
    queryKey: queryKeys.treasury.earnings(address ?? ''),
    queryFn: () => getEarnings(address!),
    enabled: !!address,
  });

  const configQuery = useQuery({
    queryKey: queryKeys.treasury.config,
    queryFn: () => getRevenueConfig(),
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error('Wallet not connected');
      await withdrawEarningsContract(account);
    },
    onSuccess: () => {
      if (address) {
        queryClient.invalidateQueries({ queryKey: queryKeys.treasury.earnings(address) });
      }
    },
  });

  return {
    earnings: earningsQuery.data ?? null,
    config: configQuery.data ?? null,
    isLoading: earningsQuery.isLoading || configQuery.isLoading,
    error: earningsQuery.error?.message ?? configQuery.error?.message ?? withdrawMutation.error?.message ?? null,
    withdraw: () => withdrawMutation.mutateAsync(),
    isWithdrawing: withdrawMutation.isPending,
  };
}
