'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/wallet-provider';
import { ec, Contract } from 'starknet';
import { getProvider } from '@vauban/web3-utils';
import { queryKeys } from '@/lib/query-keys';

interface SessionKeyData {
  publicKey: string;
  privateKey: string;
  masterAccount: string;
  createdAt: number;
  expiresAt: number;
  isOnChain: boolean;
}

interface UseSessionKeyReturn {
  hasActiveSessionKey: boolean;
  sessionKey: SessionKeyData | null;
  isCreating: boolean;
  createSessionKey: () => Promise<boolean>;
  revokeSessionKey: () => Promise<void>;
  getSessionKeyNonce: () => Promise<number>;
}

const SESSION_KEY_STORAGE_PREFIX = 'vauban_session_key_';
const DEFAULT_EXPIRY_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// Contract addresses from env
const SESSION_KEY_MANAGER_ADDRESS = process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS;
const SOCIAL_ADDRESS = process.env.NEXT_PUBLIC_SOCIAL_ADDRESS;

// ============================================================================
// DATA FETCHING
// ============================================================================

function getStorageKey(address: string): string {
  return `${SESSION_KEY_STORAGE_PREFIX}${address}`;
}

/**
 * Load session key from localStorage, checking expiry and master account match.
 */
function loadSessionKey(address: string): SessionKeyData | null {
  const storageKey = getStorageKey(address);

  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return null;

    const data: SessionKeyData = JSON.parse(stored);

    // Check if expired
    if (data.expiresAt < Date.now()) {
      localStorage.removeItem(storageKey);
      return null;
    }

    // Master account mismatch
    if (data.masterAccount !== address) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error loading session key:', error);
    return null;
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useSessionKey(): UseSessionKeyReturn {
  const { address, account, isConnected } = useWallet();
  const queryClient = useQueryClient();

  // --- Session key status query (loads from localStorage, checks expiry) ---
  const { data: sessionKey = null } = useQuery({
    queryKey: queryKeys.sessionKey.status(address ?? ''),
    queryFn: () => loadSessionKey(address!),
    enabled: Boolean(address),
    staleTime: Infinity, // localStorage doesn't change externally
  });

  // Check if session key is still valid
  const hasActiveSessionKey = Boolean(
    sessionKey &&
    sessionKey.expiresAt > Date.now() &&
    sessionKey.masterAccount === address
  );

  // --- Create session key mutation ---
  const createMutation = useMutation({
    mutationFn: async (): Promise<boolean> => {
      if (!account || !address || !isConnected) {
        console.error('Wallet not connected');
        return false;
      }

      if (!SESSION_KEY_MANAGER_ADDRESS || !SOCIAL_ADDRESS) {
        console.error('Session key manager or social address not configured');
        return false;
      }

      try {
        // Generate ephemeral keypair using starknet.js
        const privateKey = ec.starkCurve.utils.randomPrivateKey();
        const privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex');
        const publicKey = ec.starkCurve.getStarkKey(privateKey);

        const now = Date.now();
        const expiryDurationSec = Math.floor(DEFAULT_EXPIRY_DURATION / 1000);
        const expiresAt = now + DEFAULT_EXPIRY_DURATION;

        // Register session key on-chain
        const provider = getProvider();
        const sessionKeyManagerAbi = (await import('@/abis/session_key_manager.json')).default || (await import('@/abis/session_key_manager.json'));

        const contract = new Contract(
          sessionKeyManagerAbi.abi || sessionKeyManagerAbi,
          SESSION_KEY_MANAGER_ADDRESS,
          account
        );

        // Define permissions: allow add_comment on Social contract
        const addCommentSelector = '0x' + BigInt('0x' + Buffer.from('add_comment').toString('hex').slice(0, 16)).toString(16);

        const result = await contract.create_session_key(
          publicKey,
          expiryDurationSec,
          0, // unlimited uses
          [[SOCIAL_ADDRESS, addCommentSelector]] // permissions array
        );

        await provider.waitForTransaction(result.transaction_hash);

        // Create session key data
        const sessionKeyData: SessionKeyData = {
          publicKey,
          privateKey: privateKeyHex,
          masterAccount: address,
          createdAt: now,
          expiresAt,
          isOnChain: true,
        };

        // Store in localStorage
        const storageKey = getStorageKey(address);
        localStorage.setItem(storageKey, JSON.stringify(sessionKeyData));

        return true;
      } catch (error) {
        console.error('Error creating session key:', error);

        // Fall back to local-only session key for better UX
        try {
          const privateKey = ec.starkCurve.utils.randomPrivateKey();
          const privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex');
          const publicKey = ec.starkCurve.getStarkKey(privateKey);

          const now = Date.now();
          const expiresAt = now + DEFAULT_EXPIRY_DURATION;

          const sessionKeyData: SessionKeyData = {
            publicKey,
            privateKey: privateKeyHex,
            masterAccount: address,
            createdAt: now,
            expiresAt,
            isOnChain: false, // Local only - won't work for gasless
          };

          const storageKey = getStorageKey(address);
          localStorage.setItem(storageKey, JSON.stringify(sessionKeyData));

          return true;
        } catch (fallbackError) {
          console.error('Fallback session key creation failed:', fallbackError);
          return false;
        }
      }
    },
    onSuccess: () => {
      if (address) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessionKey.status(address) });
      }
    },
  });

  // --- Revoke session key mutation ---
  const revokeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      // Try to revoke on-chain if it was registered
      if (sessionKey?.isOnChain && account && SESSION_KEY_MANAGER_ADDRESS) {
        try {
          const provider = getProvider();
          const sessionKeyManagerAbi = (await import('@/abis/session_key_manager.json')).default || (await import('@/abis/session_key_manager.json'));

          const contract = new Contract(
            sessionKeyManagerAbi.abi || sessionKeyManagerAbi,
            SESSION_KEY_MANAGER_ADDRESS,
            account
          );

          const result = await contract.revoke_session_key(sessionKey.publicKey);
          await provider.waitForTransaction(result.transaction_hash);
        } catch (error) {
          console.error('Error revoking session key on-chain:', error);
        }
      }

      // Always clear local storage
      if (address) {
        const storageKey = getStorageKey(address);
        localStorage.removeItem(storageKey);
      }
    },
    onSuccess: () => {
      if (address) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.sessionKey.status(address) });
      }
    },
  });

  // --- Imperative create/revoke wrappers ---
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    return createMutation.mutateAsync();
  }, [createMutation]);

  const revokeSessionKey = useCallback(async (): Promise<void> => {
    await revokeMutation.mutateAsync();
  }, [revokeMutation]);

  // Get the current nonce for this session key from the contract (standalone async, not a query)
  const getSessionKeyNonce = useCallback(async (): Promise<number> => {
    if (!sessionKey || !SOCIAL_ADDRESS) {
      return 0;
    }

    try {
      const provider = getProvider();
      const socialAbi = (await import('@/abis/social.json')).default || (await import('@/abis/social.json'));

      const contract = new Contract(
        socialAbi.abi || socialAbi,
        SOCIAL_ADDRESS,
        provider
      );

      const nonce = await contract.get_session_key_nonce(sessionKey.publicKey);
      return Number(nonce);
    } catch (error) {
      console.error('Error getting session key nonce:', error);
      return 0;
    }
  }, [sessionKey]);

  return {
    hasActiveSessionKey,
    sessionKey,
    isCreating: createMutation.isPending,
    createSessionKey,
    revokeSessionKey,
    getSessionKeyNonce,
  };
}
