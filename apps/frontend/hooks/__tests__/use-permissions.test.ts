import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { roleState, userRoleState, mockGetPermissionsForRole, mockCanPerformAction } = vi.hoisted(() => {
  const roleState = {
    roleLevel: 0 as number,
    roleName: 'READER' as string,
    roleLabel: 'Reader' as string,
    userRole: null as Record<string, unknown> | null,
    isRegistered: false,
    isLoading: false,
    error: null as string | null,
    refresh: vi.fn().mockResolvedValue(undefined),
  };

  const userRoleState = {
    roleLevel: 0 as number,
    roleName: 'READER' as string,
    roleLabel: 'Reader' as string,
    userRole: null as Record<string, unknown> | null,
    isRegistered: false,
    isLoading: false,
    error: null as string | null,
    refresh: vi.fn().mockResolvedValue(undefined),
  };

  // Build a real-ish permission set based on role level
  const buildPermissions = (level: number) => ({
    canViewPublicContent: true,
    canComment: level >= 0,
    canLike: level >= 0,
    canSubmitForReview: level >= 1,
    canEditOwnContent: level >= 1,
    canDeleteOwnContent: level >= 1,
    canPublishImmediately: level >= 2,
    canViewReports: level >= 3,
    canResolveReports: level >= 3,
    canHideContent: level >= 3,
    canTempBanUsers: level >= 3,
    canApproveContent: level >= 4,
    canRejectContent: level >= 4,
    canRequestRevisions: level >= 4,
    canFeaturePosts: level >= 4,
    canManageTags: level >= 4,
    canEditAnyContent: level >= 4,
    canDeleteAnyContent: level >= 5,
    canManageUsers: level >= 5,
    canManageRoles: level >= 5,
    canAccessAnalytics: level >= 5,
    canConfigureSettings: level >= 5,
    canPermaBanUsers: level >= 5,
    canWithdrawFunds: level >= 6,
    canTransferOwnership: level >= 6,
    canUpgradeContracts: level >= 6,
    canEmergencyPause: level >= 6,
  });

  const mockGetPermissionsForRole = vi.fn((level: number) => buildPermissions(level));
  const mockCanPerformAction = vi.fn((level: number, action: string) => {
    const perms = buildPermissions(level);
    return perms[action as keyof typeof perms] ?? false;
  });

  return { roleState, userRoleState, mockGetPermissionsForRole, mockCanPerformAction };
});

vi.mock('./use-role', () => ({
  useRole: () => roleState,
  useUserRole: () => userRoleState,
}));

// The permissions hook is under test - mock only the use-role dependency
vi.mock('@/hooks/use-role', () => ({
  useRole: () => roleState,
  useUserRole: () => userRoleState,
}));

vi.mock('@vauban/shared-types', () => ({
  ROLES: { READER: 0, WRITER: 1, CONTRIBUTOR: 2, MODERATOR: 3, EDITOR: 4, ADMIN: 5, OWNER: 6 },
  ROLE_NAMES: { 0: 'READER', 1: 'WRITER', 2: 'CONTRIBUTOR', 3: 'EDITOR', 4: 'MODERATOR', 5: 'ADMIN', 6: 'OWNER' },
  ROLE_LABELS: { 0: 'Reader', 1: 'Writer', 2: 'Contributor', 3: 'Editor', 4: 'Moderator', 5: 'Admin', 6: 'Owner' },
  getPermissionsForRole: mockGetPermissionsForRole,
  canPerformAction: mockCanPerformAction,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  usePermissions,
  useUserPermissions,
  useCanPerform,
  useContentPermissions,
  useEditorialPermissions,
  useModerationPermissions,
  useAdminPermissions,
  useOwnerPermissions,
} from '@/hooks/use-permissions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setRoleLevel(level: number) {
  roleState.roleLevel = level;
  roleState.isLoading = false;
  roleState.error = null;
}

function setUserRoleLevel(level: number) {
  userRoleState.roleLevel = level;
  userRoleState.isLoading = false;
  userRoleState.error = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  roleState.roleLevel = 0;
  roleState.isLoading = false;
  roleState.error = null;
  roleState.userRole = null;
  roleState.isRegistered = false;

  userRoleState.roleLevel = 0;
  userRoleState.isLoading = false;
  userRoleState.error = null;
  userRoleState.userRole = null;
  userRoleState.isRegistered = false;
});

// ===== usePermissions =====

describe('usePermissions', () => {
  it('returns permissions for READER (level 0)', () => {
    setRoleLevel(0);
    const { result } = renderHook(() => usePermissions());

    expect(result.current.roleLevel).toBe(0);
    expect(result.current.canViewPublicContent).toBe(true);
    expect(result.current.canComment).toBe(true);
    expect(result.current.canLike).toBe(true);
    // READER cannot submit for review
    expect(result.current.canSubmitForReview).toBe(false);
    expect(result.current.canPublishImmediately).toBe(false);
    expect(result.current.canManageUsers).toBe(false);
    expect(result.current.canWithdrawFunds).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns permissions for ADMIN (level 5)', () => {
    setRoleLevel(5);
    const { result } = renderHook(() => usePermissions());

    expect(result.current.roleLevel).toBe(5);
    expect(result.current.canViewPublicContent).toBe(true);
    expect(result.current.canComment).toBe(true);
    expect(result.current.canSubmitForReview).toBe(true);
    expect(result.current.canPublishImmediately).toBe(true);
    expect(result.current.canManageUsers).toBe(true);
    expect(result.current.canManageRoles).toBe(true);
    expect(result.current.canAccessAnalytics).toBe(true);
    expect(result.current.canDeleteAnyContent).toBe(true);
    // ADMIN cannot do owner-level things
    expect(result.current.canWithdrawFunds).toBe(false);
    expect(result.current.canTransferOwnership).toBe(false);
  });

  it('can() method returns correct boolean for an action', () => {
    setRoleLevel(5);
    const { result } = renderHook(() => usePermissions());

    expect(result.current.can('canManageUsers')).toBe(true);
    expect(result.current.can('canWithdrawFunds')).toBe(false);
    expect(result.current.can('canViewPublicContent')).toBe(true);
    expect(mockCanPerformAction).toHaveBeenCalled();
  });
});

// ===== useUserPermissions =====

describe('useUserPermissions', () => {
  it('works with a specific address (returns permissions from userRole state)', () => {
    setUserRoleLevel(3);
    const { result } = renderHook(() => useUserPermissions('0xSomeAddress'));

    expect(result.current.roleLevel).toBe(3);
    expect(result.current.canViewReports).toBe(true);
    expect(result.current.canResolveReports).toBe(true);
    expect(result.current.canHideContent).toBe(true);
    // Level 3 (MODERATOR) cannot approve content (level 4)
    expect(result.current.canApproveContent).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});

// ===== useCanPerform =====

describe('useCanPerform', () => {
  it('returns false while loading', () => {
    roleState.isLoading = true;
    const { result } = renderHook(() => useCanPerform('canManageUsers'));

    expect(result.current).toBe(false);
  });

  it('returns true when user has the permission', () => {
    setRoleLevel(5);
    const { result } = renderHook(() => useCanPerform('canManageUsers'));

    expect(result.current).toBe(true);
  });

  it('returns false when user lacks the permission', () => {
    setRoleLevel(0);
    const { result } = renderHook(() => useCanPerform('canManageUsers'));

    expect(result.current).toBe(false);
  });
});

// ===== useContentPermissions =====

describe('useContentPermissions', () => {
  it('returns content permissions subset', () => {
    setRoleLevel(2); // CONTRIBUTOR
    const { result } = renderHook(() => useContentPermissions());

    expect(result.current.canViewPublicContent).toBe(true);
    expect(result.current.canComment).toBe(true);
    expect(result.current.canLike).toBe(true);
    expect(result.current.canSubmitForReview).toBe(true);
    expect(result.current.canPublishImmediately).toBe(true);
    expect(result.current.canEditOwnContent).toBe(true);
    expect(result.current.canDeleteOwnContent).toBe(true);
    // CONTRIBUTOR cannot edit any content
    expect(result.current.canEditAnyContent).toBe(false);
    expect(result.current.canDeleteAnyContent).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('only exposes content permission fields', () => {
    setRoleLevel(5);
    const { result } = renderHook(() => useContentPermissions());

    const keys = Object.keys(result.current);
    // Should contain content permissions + isLoading + error
    expect(keys).toContain('canViewPublicContent');
    expect(keys).toContain('canComment');
    expect(keys).toContain('canLike');
    expect(keys).toContain('canSubmitForReview');
    expect(keys).toContain('canPublishImmediately');
    expect(keys).toContain('canEditOwnContent');
    expect(keys).toContain('canEditAnyContent');
    expect(keys).toContain('canDeleteOwnContent');
    expect(keys).toContain('canDeleteAnyContent');
    expect(keys).toContain('isLoading');
    expect(keys).toContain('error');
    // Should NOT contain admin, owner, or moderation fields
    expect(keys).not.toContain('canManageUsers');
    expect(keys).not.toContain('canWithdrawFunds');
    expect(keys).not.toContain('canViewReports');
    expect(keys).not.toContain('canApproveContent');
  });
});

// ===== useEditorialPermissions =====

describe('useEditorialPermissions', () => {
  it('returns editorial permissions subset', () => {
    setRoleLevel(4); // EDITOR
    const { result } = renderHook(() => useEditorialPermissions());

    expect(result.current.canApproveContent).toBe(true);
    expect(result.current.canRejectContent).toBe(true);
    expect(result.current.canRequestRevisions).toBe(true);
    expect(result.current.canFeaturePosts).toBe(true);
    expect(result.current.canManageTags).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('only exposes editorial permission fields', () => {
    setRoleLevel(5);
    const { result } = renderHook(() => useEditorialPermissions());

    const keys = Object.keys(result.current);
    expect(keys).toContain('canApproveContent');
    expect(keys).toContain('canRejectContent');
    expect(keys).toContain('canRequestRevisions');
    expect(keys).toContain('canFeaturePosts');
    expect(keys).toContain('canManageTags');
    expect(keys).toContain('isLoading');
    expect(keys).toContain('error');
    expect(keys).not.toContain('canManageUsers');
    expect(keys).not.toContain('canWithdrawFunds');
  });
});

// ===== useModerationPermissions =====

describe('useModerationPermissions', () => {
  it('returns moderation permissions subset', () => {
    setRoleLevel(3); // MODERATOR
    const { result } = renderHook(() => useModerationPermissions());

    expect(result.current.canViewReports).toBe(true);
    expect(result.current.canResolveReports).toBe(true);
    expect(result.current.canHideContent).toBe(true);
    expect(result.current.canTempBanUsers).toBe(true);
    // MODERATOR cannot perma-ban (that's ADMIN)
    expect(result.current.canPermaBanUsers).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('only exposes moderation permission fields', () => {
    setRoleLevel(5);
    const { result } = renderHook(() => useModerationPermissions());

    const keys = Object.keys(result.current);
    expect(keys).toContain('canViewReports');
    expect(keys).toContain('canResolveReports');
    expect(keys).toContain('canHideContent');
    expect(keys).toContain('canTempBanUsers');
    expect(keys).toContain('canPermaBanUsers');
    expect(keys).toContain('isLoading');
    expect(keys).toContain('error');
    expect(keys).not.toContain('canManageUsers');
    expect(keys).not.toContain('canWithdrawFunds');
  });
});

// ===== useAdminPermissions =====

describe('useAdminPermissions', () => {
  it('returns admin permissions subset', () => {
    setRoleLevel(5); // ADMIN
    const { result } = renderHook(() => useAdminPermissions());

    expect(result.current.canManageUsers).toBe(true);
    expect(result.current.canManageRoles).toBe(true);
    expect(result.current.canAccessAnalytics).toBe(true);
    expect(result.current.canConfigureSettings).toBe(true);
    expect(result.current.canDeleteAnyContent).toBe(true);
    expect(result.current.canPermaBanUsers).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('only exposes admin permission fields', () => {
    setRoleLevel(6);
    const { result } = renderHook(() => useAdminPermissions());

    const keys = Object.keys(result.current);
    expect(keys).toContain('canManageUsers');
    expect(keys).toContain('canManageRoles');
    expect(keys).toContain('canAccessAnalytics');
    expect(keys).toContain('canConfigureSettings');
    expect(keys).toContain('canDeleteAnyContent');
    expect(keys).toContain('canPermaBanUsers');
    expect(keys).toContain('isLoading');
    expect(keys).toContain('error');
    expect(keys).not.toContain('canWithdrawFunds');
    expect(keys).not.toContain('canViewPublicContent');
  });
});

// ===== useOwnerPermissions =====

describe('useOwnerPermissions', () => {
  it('returns owner permissions subset', () => {
    setRoleLevel(6); // OWNER
    const { result } = renderHook(() => useOwnerPermissions());

    expect(result.current.canWithdrawFunds).toBe(true);
    expect(result.current.canTransferOwnership).toBe(true);
    expect(result.current.canUpgradeContracts).toBe(true);
    expect(result.current.canEmergencyPause).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns false for owner permissions when not owner', () => {
    setRoleLevel(5); // ADMIN, not OWNER
    const { result } = renderHook(() => useOwnerPermissions());

    expect(result.current.canWithdrawFunds).toBe(false);
    expect(result.current.canTransferOwnership).toBe(false);
    expect(result.current.canUpgradeContracts).toBe(false);
    expect(result.current.canEmergencyPause).toBe(false);
  });

  it('only exposes owner permission fields', () => {
    setRoleLevel(6);
    const { result } = renderHook(() => useOwnerPermissions());

    const keys = Object.keys(result.current);
    expect(keys).toContain('canWithdrawFunds');
    expect(keys).toContain('canTransferOwnership');
    expect(keys).toContain('canUpgradeContracts');
    expect(keys).toContain('canEmergencyPause');
    expect(keys).toContain('isLoading');
    expect(keys).toContain('error');
    expect(keys).not.toContain('canManageUsers');
    expect(keys).not.toContain('canViewPublicContent');
  });
});
