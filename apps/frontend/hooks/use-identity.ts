'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useWallet } from '@/providers/wallet-provider';

// =============================================================================
// TYPES
// =============================================================================

export type AuthSource = 'wallet' | 'github' | 'google' | null;

export interface Identity {
  /** Always a Starknet address regardless of auth source */
  address: string | null;
  /** Human-readable display name (OAuth name or truncated address) */
  displayName: string | null;
  /** Whether the user is authenticated via any source */
  isAuthenticated: boolean;
  /** How the user authenticated */
  authSource: AuthSource;
  /** true when the address comes from an OAuth-generated custodial wallet */
  isCustodial: boolean;
  /** true when the address comes from a real wallet (keys held by user) */
  isSovereign: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function detectOAuthProvider(session: { user?: { image?: string | null } } | null): 'github' | 'google' | null {
  if (!session?.user) return null;
  const image = session.user.image ?? '';
  if (image.includes('githubusercontent.com') || image.includes('github')) return 'github';
  if (image.includes('googleusercontent.com') || image.includes('google')) return 'google';
  // Fallback: if we have a session but can't detect provider, assume github (primary)
  return 'github';
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Unified identity hook.
 *
 * Provides a single Starknet address regardless of authentication source:
 * - **Wallet** (ArgentX/Braavos/Devnet): sovereign address, keys held by user
 * - **OAuth** (GitHub/Google): custodial address generated deterministically
 *
 * Priority: wallet native > OAuth custodial > null
 */
export function useIdentity(): Identity {
  const { address: walletAddress, isConnected } = useWallet();
  const { data: session, status: sessionStatus } = useSession();

  return useMemo<Identity>(() => {
    const isOAuth = sessionStatus === 'authenticated' && !!session?.user;
    const oauthAddress = isOAuth ? (session?.user?.walletAddress ?? null) : null;
    const oauthProvider = isOAuth ? detectOAuthProvider(session) : null;

    // Priority: wallet native > OAuth custodial > null
    if (isConnected && walletAddress) {
      return {
        address: walletAddress,
        displayName: session?.user?.name ?? null,
        isAuthenticated: true,
        authSource: 'wallet',
        isCustodial: false,
        isSovereign: true,
      };
    }

    if (isOAuth && oauthAddress) {
      return {
        address: oauthAddress,
        displayName: session?.user?.name ?? null,
        isAuthenticated: true,
        authSource: oauthProvider,
        isCustodial: true,
        isSovereign: false,
      };
    }

    return {
      address: null,
      displayName: null,
      isAuthenticated: false,
      authSource: null,
      isCustodial: false,
      isSovereign: false,
    };
  }, [walletAddress, isConnected, session, sessionStatus]);
}

export default useIdentity;
