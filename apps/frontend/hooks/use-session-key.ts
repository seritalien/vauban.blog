'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { ec, Contract } from 'starknet';
import { getProvider } from '@vauban/web3-utils';

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

export function useSessionKey(): UseSessionKeyReturn {
  const { address, account, isConnected } = useWallet();
  const [sessionKey, setSessionKey] = useState<SessionKeyData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Generate storage key for this account
  const getStorageKey = useCallback(() => {
    if (!address) return null;
    return `${SESSION_KEY_STORAGE_PREFIX}${address}`;
  }, [address]);

  // Load session key from localStorage
  useEffect(() => {
    if (!address) {
      setSessionKey(null);
      return;
    }

    const storageKey = getStorageKey();
    if (!storageKey) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data: SessionKeyData = JSON.parse(stored);

        // Check if expired
        if (data.expiresAt < Date.now()) {
          localStorage.removeItem(storageKey);
          setSessionKey(null);
        } else if (data.masterAccount === address) {
          setSessionKey(data);
        } else {
          // Master account mismatch - remove
          localStorage.removeItem(storageKey);
          setSessionKey(null);
        }
      }
    } catch (error) {
      console.error('Error loading session key:', error);
      setSessionKey(null);
    }
  }, [address, getStorageKey]);

  // Check if session key is still valid
  const hasActiveSessionKey = Boolean(
    sessionKey &&
    sessionKey.expiresAt > Date.now() &&
    sessionKey.masterAccount === address
  );

  // Create a new session key (registers on-chain)
  const createSessionKey = useCallback(async (): Promise<boolean> => {
    if (!account || !address || !isConnected) {
      console.error('Wallet not connected');
      return false;
    }

    if (!SESSION_KEY_MANAGER_ADDRESS || !SOCIAL_ADDRESS) {
      console.error('Session key manager or social address not configured');
      return false;
    }

    try {
      setIsCreating(true);

      // Generate ephemeral keypair using starknet.js
      const privateKey = ec.starkCurve.utils.randomPrivateKey();
      const privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex');
      const publicKey = ec.starkCurve.getStarkKey(privateKey);

      const now = Date.now();
      const expiryDurationSec = Math.floor(DEFAULT_EXPIRY_DURATION / 1000);
      const expiresAt = now + DEFAULT_EXPIRY_DURATION;

      // Register session key on-chain
      const provider = getProvider();

      // Import ABI dynamically
      const sessionKeyManagerAbi = (await import('@/abis/session_key_manager.json')).default || (await import('@/abis/session_key_manager.json'));

      const contract = new Contract(
        sessionKeyManagerAbi.abi || sessionKeyManagerAbi,
        SESSION_KEY_MANAGER_ADDRESS,
        account
      );

      // Define permissions: allow add_comment on Social contract
      // selector for "add_comment" function
      const addCommentSelector = '0x' + BigInt('0x' + Buffer.from('add_comment').toString('hex').slice(0, 16)).toString(16);

      console.log('Creating session key on-chain...');
      const result = await contract.create_session_key(
        publicKey,
        expiryDurationSec,
        0, // unlimited uses
        [[SOCIAL_ADDRESS, addCommentSelector]] // permissions array
      );

      console.log('Session key TX:', result.transaction_hash);
      await provider.waitForTransaction(result.transaction_hash);
      console.log('Session key registered on-chain');

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
      const storageKey = getStorageKey();
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify(sessionKeyData));
        setSessionKey(sessionKeyData);
      }

      console.log('Session key created:', publicKey);
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

        const storageKey = getStorageKey();
        if (storageKey) {
          localStorage.setItem(storageKey, JSON.stringify(sessionKeyData));
          setSessionKey(sessionKeyData);
        }

        console.log('Session key created (local only):', publicKey);
        return true;
      } catch (fallbackError) {
        console.error('Fallback session key creation failed:', fallbackError);
        return false;
      }
    } finally {
      setIsCreating(false);
    }
  }, [account, address, isConnected, getStorageKey]);

  // Revoke/remove session key
  const revokeSessionKey = useCallback(async () => {
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
        console.log('Session key revoked on-chain');
      } catch (error) {
        console.error('Error revoking session key on-chain:', error);
      }
    }

    // Always clear local storage
    const storageKey = getStorageKey();
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
    setSessionKey(null);
  }, [sessionKey, account, getStorageKey]);

  // Get the current nonce for this session key from the contract
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
    isCreating,
    createSessionKey,
    revokeSessionKey,
    getSessionKeyNonce,
  };
}
