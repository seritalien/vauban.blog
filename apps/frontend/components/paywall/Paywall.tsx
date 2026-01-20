'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import { hasAccess, purchasePost } from '@vauban/web3-utils';

interface PaywallProps {
  postId: string;
  price: string; // in STRK
  children: React.ReactNode;
}

export default function Paywall({ postId, price, children }: PaywallProps) {
  const { account, address, isConnected } = useWallet();
  const { showToast } = useToast();
  const [hasAccessToPost, setHasAccessToPost] = useState<boolean | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if user has access
  useEffect(() => {
    async function checkAccess() {
      if (!address) {
        setHasAccessToPost(false);
        setIsChecking(false);
        return;
      }

      try {
        const access = await hasAccess(postId, address);
        setHasAccessToPost(access);
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccessToPost(false);
      } finally {
        setIsChecking(false);
      }
    }

    checkAccess();
  }, [postId, address]);

  const handlePurchase = async () => {
    if (!account) {
      showToast('Please connect your wallet first', 'warning');
      return;
    }

    try {
      setIsPurchasing(true);
      showToast('Processing purchase...', 'info');

      await purchasePost(account, postId);

      showToast('Purchase successful! You now have access.', 'success');
      setHasAccessToPost(true);
    } catch (error) {
      console.error('Purchase failed:', error);
      showToast(
        `Purchase failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  // Still checking access
  if (isChecking) {
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  // User has access - show content
  if (hasAccessToPost) {
    return <>{children}</>;
  }

  // User doesn't have access - show paywall
  const priceInStrk = parseFloat(price) / 1e18;

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="blur-md pointer-events-none select-none max-h-96 overflow-hidden">
        {children}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-gray-900 via-white/80 dark:via-gray-900/80 to-transparent" />

      {/* Purchase prompt */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 max-w-md mx-4 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Premium Content
          </h3>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            This article requires a one-time purchase to unlock full access.
          </p>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              {priceInStrk.toFixed(2)}
            </span>
            <span className="text-lg text-gray-600 dark:text-gray-400 ml-2">STRK</span>
          </div>

          {!isConnected ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connect your wallet to purchase this article
            </p>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPurchasing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                'Unlock Article'
              )}
            </button>
          )}

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            One-time purchase. Access forever on this wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
