'use client';

import { useMemo } from 'react';
import {
  type Permissions,
  type RoleLevel,
  getPermissionsForRole,
  canPerformAction,
} from '@vauban/shared-types';
import { useRole, useUserRole } from './use-role';

// ============================================================================
// HOOK TYPES
// ============================================================================

export interface UsePermissionsResult extends Permissions {
  /** The underlying role level */
  roleLevel: RoleLevel;
  /** Whether permissions are still loading */
  isLoading: boolean;
  /** Error if permission check failed */
  error: string | null;
  /** Check if user can perform a specific action */
  can: (action: keyof Permissions) => boolean;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to get the current user's permissions based on their role
 *
 * Permissions are derived from the user's role level and include:
 * - Content permissions (view, comment, publish, edit, delete)
 * - Review permissions (approve, reject, feature)
 * - Moderation permissions (reports, bans, hide content)
 * - Admin permissions (manage users, roles, settings)
 * - Owner permissions (withdraw, transfer, upgrade)
 *
 * @example
 * ```tsx
 * function PublishButton() {
 *   const { canPublishImmediately, isLoading } = usePermissions();
 *
 *   if (isLoading) return null;
 *
 *   if (!canPublishImmediately) {
 *     return <Button disabled>Submit for Review</Button>;
 *   }
 *
 *   return <Button>Publish Now</Button>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * function AdminPanel() {
 *   const { canAccessAnalytics, canManageUsers, can } = usePermissions();
 *
 *   return (
 *     <div>
 *       {canAccessAnalytics && <AnalyticsDashboard />}
 *       {canManageUsers && <UserManagement />}
 *       {can('canWithdrawFunds') && <WithdrawButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const { roleLevel, isLoading, error } = useRole();

  const permissions = useMemo(() => {
    return getPermissionsForRole(roleLevel);
  }, [roleLevel]);

  const can = useMemo(() => {
    return (action: keyof Permissions): boolean => {
      return canPerformAction(roleLevel, action);
    };
  }, [roleLevel]);

  return {
    ...permissions,
    roleLevel,
    isLoading,
    error,
    can,
  };
}

/**
 * Hook to get permissions for a specific address
 *
 * Useful for checking permissions of other users (e.g., for display purposes)
 *
 * @param address - The address to check permissions for
 */
export function useUserPermissions(address: string | null | undefined): UsePermissionsResult {
  const { roleLevel, isLoading, error } = useUserRole(address);

  const permissions = useMemo(() => {
    return getPermissionsForRole(roleLevel);
  }, [roleLevel]);

  const can = useMemo(() => {
    return (action: keyof Permissions): boolean => {
      return canPerformAction(roleLevel, action);
    };
  }, [roleLevel]);

  return {
    ...permissions,
    roleLevel,
    isLoading,
    error,
    can,
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Check if the current user can perform a specific action
 *
 * @example
 * ```tsx
 * function FeatureButton({ postId }) {
 *   const canFeature = useCanPerform('canFeaturePosts');
 *
 *   if (!canFeature) return null;
 *
 *   return <Button onClick={() => featurePost(postId)}>Feature</Button>;
 * }
 * ```
 */
export function useCanPerform(action: keyof Permissions): boolean {
  const { can, isLoading } = usePermissions();

  // While loading, assume no permissions (safer default)
  if (isLoading) return false;

  return can(action);
}

/**
 * Hook specifically for content-related permissions
 */
export function useContentPermissions() {
  const {
    canViewPublicContent,
    canComment,
    canLike,
    canSubmitForReview,
    canPublishImmediately,
    canEditOwnContent,
    canEditAnyContent,
    canDeleteOwnContent,
    canDeleteAnyContent,
    isLoading,
    error,
  } = usePermissions();

  return {
    canViewPublicContent,
    canComment,
    canLike,
    canSubmitForReview,
    canPublishImmediately,
    canEditOwnContent,
    canEditAnyContent,
    canDeleteOwnContent,
    canDeleteAnyContent,
    isLoading,
    error,
  };
}

/**
 * Hook specifically for editorial permissions
 */
export function useEditorialPermissions() {
  const {
    canApproveContent,
    canRejectContent,
    canRequestRevisions,
    canFeaturePosts,
    canManageTags,
    isLoading,
    error,
  } = usePermissions();

  return {
    canApproveContent,
    canRejectContent,
    canRequestRevisions,
    canFeaturePosts,
    canManageTags,
    isLoading,
    error,
  };
}

/**
 * Hook specifically for moderation permissions
 */
export function useModerationPermissions() {
  const {
    canViewReports,
    canResolveReports,
    canHideContent,
    canTempBanUsers,
    canPermaBanUsers,
    isLoading,
    error,
  } = usePermissions();

  return {
    canViewReports,
    canResolveReports,
    canHideContent,
    canTempBanUsers,
    canPermaBanUsers,
    isLoading,
    error,
  };
}

/**
 * Hook specifically for admin permissions
 */
export function useAdminPermissions() {
  const {
    canManageUsers,
    canManageRoles,
    canAccessAnalytics,
    canConfigureSettings,
    canDeleteAnyContent,
    canPermaBanUsers,
    isLoading,
    error,
  } = usePermissions();

  return {
    canManageUsers,
    canManageRoles,
    canAccessAnalytics,
    canConfigureSettings,
    canDeleteAnyContent,
    canPermaBanUsers,
    isLoading,
    error,
  };
}

/**
 * Hook specifically for owner permissions
 */
export function useOwnerPermissions() {
  const {
    canWithdrawFunds,
    canTransferOwnership,
    canUpgradeContracts,
    canEmergencyPause,
    isLoading,
    error,
  } = usePermissions();

  return {
    canWithdrawFunds,
    canTransferOwnership,
    canUpgradeContracts,
    canEmergencyPause,
    isLoading,
    error,
  };
}

// ============================================================================
// PERMISSION GATE COMPONENTS
// ============================================================================

/**
 * Component that only renders children if user has the required permission
 *
 * @example
 * ```tsx
 * <RequirePermission permission="canFeaturePosts">
 *   <FeatureButton postId={post.id} />
 * </RequirePermission>
 * ```
 */
export interface RequirePermissionProps {
  permission: keyof Permissions;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps): React.ReactNode {
  const hasPermission = useCanPerform(permission);

  if (!hasPermission) {
    return fallback;
  }

  return children;
}

/**
 * Component that only renders children if user has ALL required permissions
 *
 * @example
 * ```tsx
 * <RequireAllPermissions permissions={['canManageUsers', 'canAccessAnalytics']}>
 *   <AdminDashboard />
 * </RequireAllPermissions>
 * ```
 */
export interface RequireAllPermissionsProps {
  permissions: (keyof Permissions)[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAllPermissions({
  permissions,
  children,
  fallback = null,
}: RequireAllPermissionsProps): React.ReactNode {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return fallback;
  }

  const hasAll = permissions.every((p) => can(p));

  if (!hasAll) {
    return fallback;
  }

  return children;
}

/**
 * Component that renders children if user has ANY of the required permissions
 *
 * @example
 * ```tsx
 * <RequireAnyPermission permissions={['canApproveContent', 'canManageUsers']}>
 *   <AdminLink />
 * </RequireAnyPermission>
 * ```
 */
export interface RequireAnyPermissionProps {
  permissions: (keyof Permissions)[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAnyPermission({
  permissions,
  children,
  fallback = null,
}: RequireAnyPermissionProps): React.ReactNode {
  const { can, isLoading } = usePermissions();

  if (isLoading) {
    return fallback;
  }

  const hasAny = permissions.some((p) => can(p));

  if (!hasAny) {
    return fallback;
  }

  return children;
}
