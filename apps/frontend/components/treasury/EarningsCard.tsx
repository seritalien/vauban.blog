'use client';

import { useTreasury } from '@/hooks/use-treasury';

interface EarningsCardProps {
  address: string;
}

function formatWei(value: bigint): string {
  const eth = Number(value) / 1e18;
  if (eth === 0) return '0';
  if (eth < 0.001) return '<0.001';
  return eth.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function EarningsCard({ address }: EarningsCardProps) {
  const { earnings, config, isLoading, withdraw, isWithdrawing, error } = useTreasury(address);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4" />
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  if (!earnings || (earnings.totalEarned === 0n && earnings.pending === 0n)) {
    return null;
  }

  const hasPending = earnings.pending > 0n;
  const platformFee = config ? (config.platformFeeBps / 100).toFixed(1) : '?';
  const referralFee = config ? (config.referralFeeBps / 100).toFixed(1) : '?';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
        Earnings
      </h3>

      {/* Amounts */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {formatWei(earnings.totalEarned)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Earned</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatWei(earnings.pending)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Available</div>
        </div>
        <div>
          <div className="text-lg font-bold text-gray-500">
            {formatWei(earnings.totalWithdrawn)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Withdrawn</div>
        </div>
      </div>

      {/* Revenue split info */}
      {config && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          Revenue split: {100 - config.platformFeeBps / 100 - config.referralFeeBps / 100}% creator
          &middot; {platformFee}% platform &middot; {referralFee}% referral
        </div>
      )}

      {/* Withdraw button */}
      {hasPending && (
        <button
          onClick={withdraw}
          disabled={isWithdrawing}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isWithdrawing ? 'Withdrawing...' : `Withdraw ${formatWei(earnings.pending)} STRK`}
        </button>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
