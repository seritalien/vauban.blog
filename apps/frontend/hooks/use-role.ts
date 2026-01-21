'use client';

import { useState, useEffect, useCallback } from 'react';
import { Contract } from 'starknet';
import {
  ROLES,
  ROLE_NAMES,
  ROLE_LABELS,
  type RoleLevel,
  type RoleName,
  type UserRole,
} from '@vauban/shared-types';
import { useWallet } from '@/providers/wallet-provider';
import { getProvider } from '@vauban/web3-utils';

// ============================================================================
// ROLE REGISTRY CONTRACT CONFIGURATION
// ============================================================================

/**
 * Get RoleRegistry contract address from environment
 */
function getRoleRegistryAddress(): string | null {
  const address = process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS;
  return address || null;
}

/**
 * Minimal ABI for RoleRegistry read functions
 * Full ABI will be generated when contract is deployed
 */
const ROLE_REGISTRY_ABI = [
  {
    name: 'get_user_role',
    type: 'function',
    inputs: [{ name: 'user', type: 'felt' }],
    outputs: [
      {
        name: 'role',
        type: '(felt, u8, u64, felt, u32, u64, bool)',
      },
    ],
    state_mutability: 'view',
  },
  {
    name: 'is_registered',
    type: 'function',
    inputs: [{ name: 'user', type: 'felt' }],
    outputs: [{ name: 'registered', type: 'bool' }],
    state_mutability: 'view',
  },
  {
    name: 'get_role_level',
    type: 'function',
    inputs: [{ name: 'user', type: 'felt' }],
    outputs: [{ name: 'level', type: 'u8' }],
    state_mutability: 'view',
  },
] as const;

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UseRoleResult {
  /** The user's role level (0-6) */
  roleLevel: RoleLevel;
  /** The user's role name (READER, WRITER, etc.) */
  roleName: RoleName;
  /** Human-readable role label */
  roleLabel: string;
  /** Full role information from contract */
  userRole: UserRole | null;
  /** Whether the user is registered in the system */
  isRegistered: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Refresh role data */
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to get the current user's role from the RoleRegistry contract
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { roleLevel, roleName, isLoading } = useRole();
 *
 *   if (isLoading) return <p>Loading...</p>;
 *
 *   return <p>Your role: {roleName}</p>;
 * }
 * ```
 */
export function useRole(): UseRoleResult {
  const { address, isConnected } = useWallet();

  const [roleLevel, setRoleLevel] = useState<RoleLevel>(ROLES.READER);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    // Reset to READER if not connected
    if (!isConnected || !address) {
      setRoleLevel(ROLES.READER);
      setUserRole(null);
      setIsRegistered(false);
      setError(null);
      return;
    }

    const contractAddress = getRoleRegistryAddress();

    // If contract not deployed, default to READER
    if (!contractAddress) {
      setRoleLevel(ROLES.READER);
      setUserRole(null);
      setIsRegistered(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const contract = new Contract(ROLE_REGISTRY_ABI as any, contractAddress, provider);

      // First check if user is registered
      try {
        const registered = await contract.is_registered(address);
        setIsRegistered(Boolean(registered));

        if (!registered) {
          // Not registered = READER role
          setRoleLevel(ROLES.READER);
          setUserRole(null);
          return;
        }
      } catch (regErr) {
        // If is_registered fails, try to get role directly
        console.warn('is_registered call failed, trying get_role_level:', regErr);
      }

      // Get the full user role data
      try {
        const result = await contract.get_user_role(address);

        // Parse the result tuple
        // Expected: (user, role, granted_at, granted_by, approved_posts, reputation, is_active)
        const level = Number(result.role || result[1] || 0);
        const safeLevel = Math.min(Math.max(level, 0), 6) as RoleLevel;

        setRoleLevel(safeLevel);
        setIsRegistered(true);
        setUserRole({
          user: address,
          role: safeLevel,
          grantedAt: Number(result.granted_at || result[2] || 0),
          grantedBy: String(result.granted_by || result[3] || '0x0'),
          approvedPosts: Number(result.approved_posts || result[4] || 0),
          reputation: BigInt(result.reputation || result[5] || 0).toString(),
          isActive: Boolean(result.is_active ?? result[6] ?? true),
        });
      } catch (roleErr) {
        // Fallback: try simple get_role_level
        try {
          const level = await contract.get_role_level(address);
          const safeLevel = Math.min(Math.max(Number(level), 0), 6) as RoleLevel;
          setRoleLevel(safeLevel);
          setUserRole(null);
        } catch {
          // Contract call failed, default to READER
          console.warn('Failed to get role, defaulting to READER:', roleErr);
          setRoleLevel(ROLES.READER);
          setUserRole(null);
        }
      }
    } catch (err) {
      console.error('Error fetching role:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch role');
      // Default to READER on error
      setRoleLevel(ROLES.READER);
      setUserRole(null);
      setIsRegistered(false);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  // Fetch role on mount and when address changes
  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    roleLevel,
    roleName: ROLE_NAMES[roleLevel],
    roleLabel: ROLE_LABELS[roleLevel],
    userRole,
    isRegistered,
    isLoading,
    error,
    refresh: fetchRole,
  };
}

/**
 * Hook to get role for a specific address (not necessarily the connected user)
 *
 * @param address - The address to check
 */
export function useUserRole(address: string | null | undefined): UseRoleResult {
  const [roleLevel, setRoleLevel] = useState<RoleLevel>(ROLES.READER);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRole = useCallback(async () => {
    if (!address) {
      setRoleLevel(ROLES.READER);
      setUserRole(null);
      setIsRegistered(false);
      setError(null);
      return;
    }

    const contractAddress = getRoleRegistryAddress();

    if (!contractAddress) {
      setRoleLevel(ROLES.READER);
      setUserRole(null);
      setIsRegistered(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const provider = getProvider();
      const contract = new Contract(ROLE_REGISTRY_ABI as any, contractAddress, provider);

      // Get role level
      const level = await contract.get_role_level(address);
      const safeLevel = Math.min(Math.max(Number(level), 0), 6) as RoleLevel;

      setRoleLevel(safeLevel);
      setIsRegistered(safeLevel > ROLES.READER);
      setUserRole(null); // Full user role requires additional call
    } catch (err) {
      console.error('Error fetching user role:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch role');
      setRoleLevel(ROLES.READER);
      setUserRole(null);
      setIsRegistered(false);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  return {
    roleLevel,
    roleName: ROLE_NAMES[roleLevel],
    roleLabel: ROLE_LABELS[roleLevel],
    userRole,
    isRegistered,
    isLoading,
    error,
    refresh: fetchRole,
  };
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

/**
 * Simple hook to check if user has at least a certain role
 */
export function useHasRole(minimumRole: RoleLevel): boolean {
  const { roleLevel } = useRole();
  return roleLevel >= minimumRole;
}

/**
 * Check if user is an admin (ADMIN or OWNER)
 */
export function useIsAdmin(): boolean {
  return useHasRole(ROLES.ADMIN);
}

/**
 * Check if user is the owner
 */
export function useIsOwner(): boolean {
  return useHasRole(ROLES.OWNER);
}

/**
 * Check if user is at least a moderator
 */
export function useIsModerator(): boolean {
  return useHasRole(ROLES.MODERATOR);
}

/**
 * Check if user is at least an editor
 */
export function useIsEditor(): boolean {
  return useHasRole(ROLES.EDITOR);
}

/**
 * Check if user can publish immediately (CONTRIBUTOR+)
 */
export function useCanPublish(): boolean {
  return useHasRole(ROLES.CONTRIBUTOR);
}
