'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/wallet-provider';
import { queryKeys } from '@/lib/query-keys';
import {
  deleteComment as deleteCommentContract,
  banUser as banUserContract,
  unbanUser as unbanUserContract,
  isBanned as isBannedContract,
  getReportCount,
} from '@vauban/web3-utils';

interface UseAdminModerationResult {
  isLoading: boolean;
  error: string | null;
  resolveReport: (commentId: string) => Promise<void>;
  banUser: (address: string) => Promise<void>;
  unbanUser: (address: string) => Promise<void>;
  checkBanned: (address: string) => Promise<boolean>;
  getReports: (commentId: string) => Promise<number>;
  isBanning: boolean;
  isUnbanning: boolean;
  isResolving: boolean;
}

export function useAdminModeration(): UseAdminModerationResult {
  const { account } = useWallet();
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!account) throw new Error('Wallet not connected');
      await deleteCommentContract(account, commentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.moderationReports });
      queryClient.invalidateQueries({ queryKey: queryKeys.comments.all });
    },
  });

  const banMutation = useMutation({
    mutationFn: async (address: string) => {
      if (!account) throw new Error('Wallet not connected');
      await banUserContract(account, address);
    },
    onSuccess: async (_data, address) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.bannedUsers });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.moderationReports });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user:banned', data: { address } }),
      }).catch(() => {});
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (address: string) => {
      if (!account) throw new Error('Wallet not connected');
      await unbanUserContract(account, address);
    },
    onSuccess: async (_data, address) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.bannedUsers });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user:unbanned', data: { address } }),
      }).catch(() => {});
    },
  });

  return {
    isLoading: false,
    error:
      resolveMutation.error?.message ??
      banMutation.error?.message ??
      unbanMutation.error?.message ??
      null,
    resolveReport: (commentId: string) => resolveMutation.mutateAsync(commentId),
    banUser: (address: string) => banMutation.mutateAsync(address),
    unbanUser: (address: string) => unbanMutation.mutateAsync(address),
    checkBanned: (address: string) => isBannedContract(address),
    getReports: (commentId: string) => getReportCount(commentId),
    isBanning: banMutation.isPending,
    isUnbanning: unbanMutation.isPending,
    isResolving: resolveMutation.isPending,
  };
}
