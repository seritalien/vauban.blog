'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
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
import { getProvider, roleRegistryAbi } from '@vauban/web3-utils';
import { queryKeys } from '@/lib/query-keys';
import { getPublicEnv } from '@/lib/public-env';

// ============================================================================
// ROLE REGISTRY CONTRACT CONFIGURATION
// ============================================================================

/**
 * Get RoleRegistry contract address from environment
 */
function getRoleRegistryAddress(): string | null {
  const address = getPublicEnv('NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS');
  return address || null;
}

/**
 * RoleRegistry ABI from @vauban/web3-utils (generated from Cairo contract)
 */
const ROLE_REGISTRY_ABI = roleRegistryAbi;

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
// DATA FETCHING
// ============================================================================

interface RoleData {
  roleLevel: RoleLevel;
  userRole: UserRole | null;
  isRegistered: boolean;
}

/**
 * Fetch role data for an address from the RoleRegistry contract.
 * Handles the nested try/catch fallback pattern:
 * get_user_role → get_role_level → default READER
 */
async function fetchRoleData(address: string): Promise<RoleData> {
  const contractAddress = getRoleRegistryAddress();

  // If contract not deployed, default to READER
  if (!contractAddress) {
    return { roleLevel: ROLES.READER, userRole: null, isRegistered: false };
  }

  const provider = getProvider();
  const contract = new Contract(ROLE_REGISTRY_ABI, contractAddress, provider);

  // First check if user is registered
  let isRegistered = false;
  try {
    const registered = await contract.is_registered(address);
    isRegistered = Boolean(registered);

    if (!registered) {
      return { roleLevel: ROLES.READER, userRole: null, isRegistered: false };
    }
  } catch (regErr) {
    // If is_registered fails, try to get role directly
    console.warn('is_registered call failed, trying get_role_level:', regErr);
  }

  // Get the full user role data
  try {
    const result = await contract.get_user_role(address);

    // Parse the result tuple
    const level = Number(result.role || result[1] || 0);
    const safeLevel = Math.min(Math.max(level, 0), 6) as RoleLevel;

    return {
      roleLevel: safeLevel,
      isRegistered: true,
      userRole: {
        user: address,
        role: safeLevel,
        grantedAt: Number(result.granted_at || result[2] || 0),
        grantedBy: String(result.granted_by || result[3] || '0x0'),
        approvedPosts: Number(result.approved_posts || result[4] || 0),
        reputation: BigInt(result.reputation || result[5] || 0).toString(),
        isActive: Boolean(result.is_active ?? result[6] ?? true),
      },
    };
  } catch (roleErr) {
    // Fallback: try simple get_role_level
    try {
      const level = await contract.get_role_level(address);
      const safeLevel = Math.min(Math.max(Number(level), 0), 6) as RoleLevel;
      return { roleLevel: safeLevel, userRole: null, isRegistered: isRegistered };
    } catch {
      // Contract call failed, default to READER
      console.warn('Failed to get role, defaulting to READER:', roleErr);
      return { roleLevel: ROLES.READER, userRole: null, isRegistered: false };
    }
  }
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

const DEFAULT_ROLE_DATA: RoleData = {
  roleLevel: ROLES.READER,
  userRole: null,
  isRegistered: false,
};

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
  const queryClient = useQueryClient();

  const enabled = Boolean(isConnected && address);

  const { data = DEFAULT_ROLE_DATA, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.role.user(address ?? ''),
    queryFn: () => fetchRoleData(address!),
    enabled,
    staleTime: 60_000, // role changes rarely
  });

  const roleLevel = enabled ? data.roleLevel : ROLES.READER;
  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const refresh = useCallback(async () => {
    if (address) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.role.user(address) });
    }
  }, [address, queryClient]);

  return {
    roleLevel,
    roleName: ROLE_NAMES[roleLevel],
    roleLabel: ROLE_LABELS[roleLevel],
    userRole: enabled ? data.userRole : null,
    isRegistered: enabled ? data.isRegistered : false,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook to get role for a specific address (not necessarily the connected user)
 *
 * @param address - The address to check
 */
export function useUserRole(address: string | null | undefined): UseRoleResult {
  const queryClient = useQueryClient();

  const enabled = Boolean(address);

  const { data = DEFAULT_ROLE_DATA, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.role.user(address ?? ''),
    queryFn: () => fetchRoleData(address!),
    enabled,
    staleTime: 60_000,
  });

  const roleLevel = enabled ? data.roleLevel : ROLES.READER;
  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;

  const refresh = useCallback(async () => {
    if (address) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.role.user(address) });
    }
  }, [address, queryClient]);

  return {
    roleLevel,
    roleName: ROLE_NAMES[roleLevel],
    roleLabel: ROLE_LABELS[roleLevel],
    userRole: enabled ? data.userRole : null,
    isRegistered: enabled ? data.isRegistered : false,
    isLoading,
    error,
    refresh,
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
