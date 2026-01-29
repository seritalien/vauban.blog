import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ============================================================================
// HOISTED MOCKS
// ============================================================================

const {
  web3Mocks,
  walletState,
  mockContract,
  ROLES,
  ROLE_NAMES,
  ROLE_LABELS,
  getPermissionsForRole,
  canPerformAction,
} = vi.hoisted(() => {
  const mockContract = {
    is_registered: vi.fn().mockResolvedValue(false),
    get_user_role: vi.fn().mockResolvedValue({
      role: 0,
      granted_at: 0,
      granted_by: '0x0',
      approved_posts: 0,
      reputation: 0n,
      is_active: true,
    }),
    get_role_level: vi.fn().mockResolvedValue(0),
  };

  const web3Mocks = {
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    calculateContentHash: vi.fn(),
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn(),
    followsAbi: [],
    roleRegistryAbi: [],
  };

  const walletState = {
    address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001' as string | null,
    isConnected: true,
  };

  // Role constants must be in hoisted block to be available for vi.mock
  const ROLES = {
    READER: 0,
    WRITER: 1,
    CONTRIBUTOR: 2,
    MODERATOR: 3,
    EDITOR: 4,
    ADMIN: 5,
    OWNER: 6,
  } as const;

  type RoleLevel = (typeof ROLES)[keyof typeof ROLES];

  const ROLE_NAMES: Record<number, string> = {
    0: 'READER',
    1: 'WRITER',
    2: 'CONTRIBUTOR',
    3: 'MODERATOR',
    4: 'EDITOR',
    5: 'ADMIN',
    6: 'OWNER',
  };

  const ROLE_LABELS: Record<number, string> = {
    0: 'Reader',
    1: 'Writer',
    2: 'Contributor',
    3: 'Moderator',
    4: 'Editor',
    5: 'Admin',
    6: 'Owner',
  };

  interface Permissions {
    canViewPublicContent: boolean;
    canComment: boolean;
    canLike: boolean;
    canSubmitForReview: boolean;
    canPublishImmediately: boolean;
    canEditOwnContent: boolean;
    canEditAnyContent: boolean;
    canDeleteOwnContent: boolean;
    canDeleteAnyContent: boolean;
    canApproveContent: boolean;
    canRejectContent: boolean;
    canRequestRevisions: boolean;
    canFeaturePosts: boolean;
    canManageTags: boolean;
    canViewReports: boolean;
    canResolveReports: boolean;
    canHideContent: boolean;
    canTempBanUsers: boolean;
    canPermaBanUsers: boolean;
    canManageUsers: boolean;
    canManageRoles: boolean;
    canAccessAnalytics: boolean;
    canConfigureSettings: boolean;
    canWithdrawFunds: boolean;
    canTransferOwnership: boolean;
    canUpgradeContracts: boolean;
    canEmergencyPause: boolean;
  }

  function getPermissionsForRole(roleLevel: RoleLevel): Permissions {
    return {
      canViewPublicContent: true,
      canComment: roleLevel >= ROLES.READER,
      canLike: roleLevel >= ROLES.READER,
      canSubmitForReview: roleLevel >= ROLES.WRITER,
      canEditOwnContent: roleLevel >= ROLES.WRITER,
      canDeleteOwnContent: roleLevel >= ROLES.WRITER,
      canPublishImmediately: roleLevel >= ROLES.CONTRIBUTOR,
      canViewReports: roleLevel >= ROLES.MODERATOR,
      canResolveReports: roleLevel >= ROLES.MODERATOR,
      canHideContent: roleLevel >= ROLES.MODERATOR,
      canTempBanUsers: roleLevel >= ROLES.MODERATOR,
      canApproveContent: roleLevel >= ROLES.EDITOR,
      canRejectContent: roleLevel >= ROLES.EDITOR,
      canRequestRevisions: roleLevel >= ROLES.EDITOR,
      canFeaturePosts: roleLevel >= ROLES.EDITOR,
      canManageTags: roleLevel >= ROLES.EDITOR,
      canEditAnyContent: roleLevel >= ROLES.EDITOR,
      canDeleteAnyContent: roleLevel >= ROLES.ADMIN,
      canManageUsers: roleLevel >= ROLES.ADMIN,
      canManageRoles: roleLevel >= ROLES.ADMIN,
      canAccessAnalytics: roleLevel >= ROLES.ADMIN,
      canConfigureSettings: roleLevel >= ROLES.ADMIN,
      canPermaBanUsers: roleLevel >= ROLES.ADMIN,
      canWithdrawFunds: roleLevel >= ROLES.OWNER,
      canTransferOwnership: roleLevel >= ROLES.OWNER,
      canUpgradeContracts: roleLevel >= ROLES.OWNER,
      canEmergencyPause: roleLevel >= ROLES.OWNER,
    };
  }

  function canPerformAction(roleLevel: RoleLevel, action: keyof Permissions): boolean {
    const permissions = getPermissionsForRole(roleLevel);
    return permissions[action];
  }

  return {
    web3Mocks,
    walletState,
    mockContract,
    ROLES,
    ROLE_NAMES,
    ROLE_LABELS,
    getPermissionsForRole,
    canPerformAction,
  };
});

// ============================================================================
// TYPES (for use in tests)
// ============================================================================

type RoleLevel = (typeof ROLES)[keyof typeof ROLES];

interface Permissions {
  canViewPublicContent: boolean;
  canComment: boolean;
  canLike: boolean;
  canSubmitForReview: boolean;
  canPublishImmediately: boolean;
  canEditOwnContent: boolean;
  canEditAnyContent: boolean;
  canDeleteOwnContent: boolean;
  canDeleteAnyContent: boolean;
  canApproveContent: boolean;
  canRejectContent: boolean;
  canRequestRevisions: boolean;
  canFeaturePosts: boolean;
  canManageTags: boolean;
  canViewReports: boolean;
  canResolveReports: boolean;
  canHideContent: boolean;
  canTempBanUsers: boolean;
  canPermaBanUsers: boolean;
  canManageUsers: boolean;
  canManageRoles: boolean;
  canAccessAnalytics: boolean;
  canConfigureSettings: boolean;
  canWithdrawFunds: boolean;
  canTransferOwnership: boolean;
  canUpgradeContracts: boolean;
  canEmergencyPause: boolean;
}

// ============================================================================
// MODULE MOCKS
// ============================================================================

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => web3Mocks);

vi.mock('starknet', () => {
  function MockContract() {
    return mockContract;
  }
  MockContract.prototype = {};
  return {
    Contract: MockContract,
  };
});

vi.mock('@vauban/shared-types', () => ({
  ROLES,
  ROLE_NAMES,
  ROLE_LABELS,
  getPermissionsForRole,
  canPerformAction,
}));

// Import hooks after mocks are set up
import {
  useRole,
  useUserRole,
  useHasRole,
  useIsAdmin,
  useIsOwner,
  useIsModerator,
  useIsEditor,
  useCanPublish,
} from '@/hooks/use-role';

// ============================================================================
// HELPERS
// ============================================================================

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

function setUserRole(level: number, options?: {
  grantedAt?: number;
  grantedBy?: string;
  approvedPosts?: number;
  reputation?: bigint;
  isActive?: boolean;
}) {
  mockContract.is_registered.mockResolvedValue(true);
  mockContract.get_user_role.mockResolvedValue({
    role: level,
    granted_at: options?.grantedAt ?? Date.now(),
    granted_by: options?.grantedBy ?? '0x0',
    approved_posts: options?.approvedPosts ?? 0,
    reputation: options?.reputation ?? 0n,
    is_active: options?.isActive ?? true,
  });
}

function setUnregisteredUser() {
  mockContract.is_registered.mockResolvedValue(false);
}

function setDisconnectedWallet() {
  walletState.address = null;
  walletState.isConnected = false;
}

function setConnectedWallet(address?: string) {
  walletState.address = address ?? '0x0A11CE0000000000000000000000000000000000000000000000000000000001';
  walletState.isConnected = true;
}

// ============================================================================
// TESTS
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS = '0xROLEREGISTRY';
  setConnectedWallet();
  setUnregisteredUser();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ============================================================================
// SECTION 1: Role Hierarchy Tests
// ============================================================================

describe('Role Hierarchy', () => {
  describe('Role Level Ordering', () => {
    it('READER (0) is the lowest role', () => {
      expect(ROLES.READER).toBe(0);
    });

    it('OWNER (6) is the highest role', () => {
      expect(ROLES.OWNER).toBe(6);
    });

    it('roles are ordered correctly: READER < WRITER < CONTRIBUTOR < MODERATOR < EDITOR < ADMIN < OWNER', () => {
      expect(ROLES.READER).toBeLessThan(ROLES.WRITER);
      expect(ROLES.WRITER).toBeLessThan(ROLES.CONTRIBUTOR);
      expect(ROLES.CONTRIBUTOR).toBeLessThan(ROLES.MODERATOR);
      expect(ROLES.MODERATOR).toBeLessThan(ROLES.EDITOR);
      expect(ROLES.EDITOR).toBeLessThan(ROLES.ADMIN);
      expect(ROLES.ADMIN).toBeLessThan(ROLES.OWNER);
    });

    it('each role level is exactly 1 higher than the previous', () => {
      expect(ROLES.WRITER - ROLES.READER).toBe(1);
      expect(ROLES.CONTRIBUTOR - ROLES.WRITER).toBe(1);
      expect(ROLES.MODERATOR - ROLES.CONTRIBUTOR).toBe(1);
      expect(ROLES.EDITOR - ROLES.MODERATOR).toBe(1);
      expect(ROLES.ADMIN - ROLES.EDITOR).toBe(1);
      expect(ROLES.OWNER - ROLES.ADMIN).toBe(1);
    });
  });

  describe('Role Names and Labels', () => {
    it.each([
      [0, 'READER', 'Reader'],
      [1, 'WRITER', 'Writer'],
      [2, 'CONTRIBUTOR', 'Contributor'],
      [3, 'MODERATOR', 'Moderator'],
      [4, 'EDITOR', 'Editor'],
      [5, 'ADMIN', 'Admin'],
      [6, 'OWNER', 'Owner'],
    ])('level %i has name %s and label %s', (level, name, label) => {
      expect(ROLE_NAMES[level]).toBe(name);
      expect(ROLE_LABELS[level]).toBe(label);
    });
  });
});

// ============================================================================
// SECTION 2: useRole Hook Tests
// ============================================================================

describe('useRole Hook', () => {
  describe('Disconnected Wallet', () => {
    it('returns READER role when wallet is not connected', async () => {
      setDisconnectedWallet();
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      expect(result.current.roleLevel).toBe(ROLES.READER);
      expect(result.current.roleName).toBe('READER');
      expect(result.current.isRegistered).toBe(false);
      expect(result.current.userRole).toBeNull();
    });
  });

  describe('Unregistered User', () => {
    it('returns READER role when user is not registered', async () => {
      setUnregisteredUser();
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(ROLES.READER);
      expect(result.current.roleName).toBe('READER');
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Registered Users - All Role Levels', () => {
    it.each([
      [ROLES.READER, 'READER', 'Reader'],
      [ROLES.WRITER, 'WRITER', 'Writer'],
      [ROLES.CONTRIBUTOR, 'CONTRIBUTOR', 'Contributor'],
      [ROLES.MODERATOR, 'MODERATOR', 'Moderator'],
      [ROLES.EDITOR, 'EDITOR', 'Editor'],
      [ROLES.ADMIN, 'ADMIN', 'Admin'],
      [ROLES.OWNER, 'OWNER', 'Owner'],
    ])('returns correct data for %s role (level %i)', async (level, expectedName, expectedLabel) => {
      setUserRole(level);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(level);
      expect(result.current.roleName).toBe(expectedName);
      expect(result.current.roleLabel).toBe(expectedLabel);
      expect(result.current.isRegistered).toBe(true);
    });
  });

  describe('Full User Role Data', () => {
    it('returns complete userRole object with all fields', async () => {
      const grantedAt = 1704067200; // 2024-01-01
      const grantedBy = '0xADMIN123';
      const approvedPosts = 42;
      const reputation = 12500n;

      setUserRole(ROLES.CONTRIBUTOR, {
        grantedAt,
        grantedBy,
        approvedPosts,
        reputation,
        isActive: true,
      });
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.userRole).not.toBeNull();
      expect(result.current.userRole?.role).toBe(ROLES.CONTRIBUTOR);
      expect(result.current.userRole?.grantedAt).toBe(grantedAt);
      expect(result.current.userRole?.grantedBy).toBe(grantedBy);
      expect(result.current.userRole?.approvedPosts).toBe(approvedPosts);
      expect(result.current.userRole?.isActive).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('defaults to READER when contract calls fail', async () => {
      mockContract.is_registered.mockRejectedValue(new Error('Network error'));
      mockContract.get_user_role.mockRejectedValue(new Error('RPC error'));
      mockContract.get_role_level.mockRejectedValue(new Error('RPC error'));
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(ROLES.READER);
      expect(result.current.roleName).toBe('READER');
    });

    it('falls back to get_role_level when get_user_role fails', async () => {
      mockContract.is_registered.mockResolvedValue(true);
      mockContract.get_user_role.mockRejectedValue(new Error('Function not found'));
      mockContract.get_role_level.mockResolvedValue(ROLES.EDITOR);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(ROLES.EDITOR);
      expect(result.current.roleName).toBe('EDITOR');
      expect(result.current.userRole).toBeNull(); // No detailed info from fallback
    });
  });

  describe('Role Level Clamping', () => {
    it('clamps role level below 0 to 0', async () => {
      mockContract.is_registered.mockResolvedValue(true);
      mockContract.get_user_role.mockResolvedValue({
        role: -5,
        granted_at: 0,
        granted_by: '0x0',
        approved_posts: 0,
        reputation: 0n,
        is_active: true,
      });
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(0);
    });

    it('clamps role level above 6 to 6', async () => {
      mockContract.is_registered.mockResolvedValue(true);
      mockContract.get_user_role.mockResolvedValue({
        role: 99,
        granted_at: 0,
        granted_by: '0x0',
        approved_posts: 0,
        reputation: 0n,
        is_active: true,
      });
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(ROLES.OWNER); // Max is 6
    });
  });
});

// ============================================================================
// SECTION 3: useUserRole Hook Tests
// ============================================================================

describe('useUserRole Hook', () => {
  it('returns READER when address is null', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useUserRole(null), { wrapper });

    expect(result.current.roleLevel).toBe(ROLES.READER);
    expect(result.current.roleName).toBe('READER');
    expect(result.current.isLoading).toBe(false);
  });

  it('returns READER when address is undefined', async () => {
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useUserRole(undefined), { wrapper });

    expect(result.current.roleLevel).toBe(ROLES.READER);
    expect(result.current.roleName).toBe('READER');
  });

  it('fetches role for a specific address', async () => {
    setUserRole(ROLES.MODERATOR);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useUserRole('0xOTHER_USER_ADDRESS'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(ROLES.MODERATOR);
    expect(result.current.roleName).toBe('MODERATOR');
  });

  it('can check permissions for users other than the connected wallet', async () => {
    setUserRole(ROLES.ADMIN);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(
      () => useUserRole('0xDIFFERENT_ADDRESS'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.roleLevel).toBe(ROLES.ADMIN);
    expect(result.current.isRegistered).toBe(true);
  });
});

// ============================================================================
// SECTION 4: useHasRole Hook Tests
// ============================================================================

describe('useHasRole Hook', () => {
  describe('Role Level Comparison', () => {
    it.each([
      [ROLES.READER, ROLES.READER, true, 'READER has READER'],
      [ROLES.READER, ROLES.WRITER, false, 'READER does not have WRITER'],
      [ROLES.WRITER, ROLES.READER, true, 'WRITER has READER'],
      [ROLES.WRITER, ROLES.WRITER, true, 'WRITER has WRITER'],
      [ROLES.WRITER, ROLES.CONTRIBUTOR, false, 'WRITER does not have CONTRIBUTOR'],
      [ROLES.CONTRIBUTOR, ROLES.WRITER, true, 'CONTRIBUTOR has WRITER'],
      [ROLES.ADMIN, ROLES.MODERATOR, true, 'ADMIN has MODERATOR'],
      [ROLES.ADMIN, ROLES.OWNER, false, 'ADMIN does not have OWNER'],
      [ROLES.OWNER, ROLES.ADMIN, true, 'OWNER has ADMIN'],
      [ROLES.OWNER, ROLES.OWNER, true, 'OWNER has OWNER'],
    ])('user with role %i checking for minimum %i returns %s (%s)', async (userRole, minRole, expected, _desc) => {
      setUserRole(userRole);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useHasRole(minRole), { wrapper });

      await waitFor(() => {
        // Wait for the underlying useRole to finish loading
        expect(mockContract.is_registered).toHaveBeenCalled();
      });

      // Allow for async settling
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current).toBe(expected);
    });
  });
});

// ============================================================================
// SECTION 5: Role Shortcut Hooks Tests
// ============================================================================

describe('Role Shortcut Hooks', () => {
  describe('useIsAdmin', () => {
    it.each([
      [ROLES.READER, false],
      [ROLES.WRITER, false],
      [ROLES.CONTRIBUTOR, false],
      [ROLES.MODERATOR, false],
      [ROLES.EDITOR, false],
      [ROLES.ADMIN, true],
      [ROLES.OWNER, true],
    ])('returns %s for role level %i', async (roleLevel, expected) => {
      setUserRole(roleLevel);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useIsAdmin(), { wrapper });

      await waitFor(() => {
        expect(mockContract.is_registered).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current).toBe(expected);
    });
  });

  describe('useIsOwner', () => {
    it.each([
      [ROLES.READER, false],
      [ROLES.WRITER, false],
      [ROLES.CONTRIBUTOR, false],
      [ROLES.MODERATOR, false],
      [ROLES.EDITOR, false],
      [ROLES.ADMIN, false],
      [ROLES.OWNER, true],
    ])('returns %s for role level %i', async (roleLevel, expected) => {
      setUserRole(roleLevel);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useIsOwner(), { wrapper });

      await waitFor(() => {
        expect(mockContract.is_registered).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current).toBe(expected);
    });
  });

  describe('useIsModerator', () => {
    it.each([
      [ROLES.READER, false],
      [ROLES.WRITER, false],
      [ROLES.CONTRIBUTOR, false],
      [ROLES.MODERATOR, true],
      [ROLES.EDITOR, true],
      [ROLES.ADMIN, true],
      [ROLES.OWNER, true],
    ])('returns %s for role level %i', async (roleLevel, expected) => {
      setUserRole(roleLevel);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useIsModerator(), { wrapper });

      await waitFor(() => {
        expect(mockContract.is_registered).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current).toBe(expected);
    });
  });

  describe('useIsEditor', () => {
    it.each([
      [ROLES.READER, false],
      [ROLES.WRITER, false],
      [ROLES.CONTRIBUTOR, false],
      [ROLES.MODERATOR, false],
      [ROLES.EDITOR, true],
      [ROLES.ADMIN, true],
      [ROLES.OWNER, true],
    ])('returns %s for role level %i', async (roleLevel, expected) => {
      setUserRole(roleLevel);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useIsEditor(), { wrapper });

      await waitFor(() => {
        expect(mockContract.is_registered).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current).toBe(expected);
    });
  });

  describe('useCanPublish', () => {
    it.each([
      [ROLES.READER, false],
      [ROLES.WRITER, false],
      [ROLES.CONTRIBUTOR, true],
      [ROLES.MODERATOR, true],
      [ROLES.EDITOR, true],
      [ROLES.ADMIN, true],
      [ROLES.OWNER, true],
    ])('returns %s for role level %i', async (roleLevel, expected) => {
      setUserRole(roleLevel);
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useCanPublish(), { wrapper });

      await waitFor(() => {
        expect(mockContract.is_registered).toHaveBeenCalled();
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(result.current).toBe(expected);
    });
  });
});

// ============================================================================
// SECTION 6: Permission-Based Access Control Tests
// ============================================================================

describe('Permission-Based Access Control', () => {
  describe('Content Permissions', () => {
    it.each([
      ['canViewPublicContent', ROLES.READER, true],
      ['canComment', ROLES.READER, true],
      ['canLike', ROLES.READER, true],
      ['canSubmitForReview', ROLES.READER, false],
      ['canSubmitForReview', ROLES.WRITER, true],
      ['canEditOwnContent', ROLES.READER, false],
      ['canEditOwnContent', ROLES.WRITER, true],
      ['canDeleteOwnContent', ROLES.READER, false],
      ['canDeleteOwnContent', ROLES.WRITER, true],
      ['canPublishImmediately', ROLES.WRITER, false],
      ['canPublishImmediately', ROLES.CONTRIBUTOR, true],
    ] as const)('%s permission is %s for %s', (permission, roleLevel, expected) => {
      const permissions = getPermissionsForRole(roleLevel);
      expect(permissions[permission]).toBe(expected);
    });
  });

  describe('Moderation Permissions', () => {
    it.each([
      ['canViewReports', ROLES.CONTRIBUTOR, false],
      ['canViewReports', ROLES.MODERATOR, true],
      ['canResolveReports', ROLES.CONTRIBUTOR, false],
      ['canResolveReports', ROLES.MODERATOR, true],
      ['canHideContent', ROLES.CONTRIBUTOR, false],
      ['canHideContent', ROLES.MODERATOR, true],
      ['canTempBanUsers', ROLES.CONTRIBUTOR, false],
      ['canTempBanUsers', ROLES.MODERATOR, true],
      ['canPermaBanUsers', ROLES.MODERATOR, false],
      ['canPermaBanUsers', ROLES.ADMIN, true],
    ] as const)('%s permission is %s for role level %i', (permission, roleLevel, expected) => {
      const permissions = getPermissionsForRole(roleLevel);
      expect(permissions[permission]).toBe(expected);
    });
  });

  describe('Editorial Permissions', () => {
    it.each([
      ['canApproveContent', ROLES.MODERATOR, false],
      ['canApproveContent', ROLES.EDITOR, true],
      ['canRejectContent', ROLES.MODERATOR, false],
      ['canRejectContent', ROLES.EDITOR, true],
      ['canRequestRevisions', ROLES.MODERATOR, false],
      ['canRequestRevisions', ROLES.EDITOR, true],
      ['canFeaturePosts', ROLES.MODERATOR, false],
      ['canFeaturePosts', ROLES.EDITOR, true],
      ['canManageTags', ROLES.MODERATOR, false],
      ['canManageTags', ROLES.EDITOR, true],
      ['canEditAnyContent', ROLES.MODERATOR, false],
      ['canEditAnyContent', ROLES.EDITOR, true],
    ] as const)('%s permission is %s for role level %i', (permission, roleLevel, expected) => {
      const permissions = getPermissionsForRole(roleLevel);
      expect(permissions[permission]).toBe(expected);
    });
  });

  describe('Admin Permissions', () => {
    it.each([
      ['canDeleteAnyContent', ROLES.EDITOR, false],
      ['canDeleteAnyContent', ROLES.ADMIN, true],
      ['canManageUsers', ROLES.EDITOR, false],
      ['canManageUsers', ROLES.ADMIN, true],
      ['canManageRoles', ROLES.EDITOR, false],
      ['canManageRoles', ROLES.ADMIN, true],
      ['canAccessAnalytics', ROLES.EDITOR, false],
      ['canAccessAnalytics', ROLES.ADMIN, true],
      ['canConfigureSettings', ROLES.EDITOR, false],
      ['canConfigureSettings', ROLES.ADMIN, true],
    ] as const)('%s permission is %s for role level %i', (permission, roleLevel, expected) => {
      const permissions = getPermissionsForRole(roleLevel);
      expect(permissions[permission]).toBe(expected);
    });
  });

  describe('Owner Permissions', () => {
    it.each([
      ['canWithdrawFunds', ROLES.ADMIN, false],
      ['canWithdrawFunds', ROLES.OWNER, true],
      ['canTransferOwnership', ROLES.ADMIN, false],
      ['canTransferOwnership', ROLES.OWNER, true],
      ['canUpgradeContracts', ROLES.ADMIN, false],
      ['canUpgradeContracts', ROLES.OWNER, true],
      ['canEmergencyPause', ROLES.ADMIN, false],
      ['canEmergencyPause', ROLES.OWNER, true],
    ] as const)('%s permission is %s for role level %i', (permission, roleLevel, expected) => {
      const permissions = getPermissionsForRole(roleLevel);
      expect(permissions[permission]).toBe(expected);
    });
  });

  describe('canPerformAction Function', () => {
    it('returns true when user has permission', () => {
      expect(canPerformAction(ROLES.ADMIN, 'canManageUsers')).toBe(true);
    });

    it('returns false when user lacks permission', () => {
      expect(canPerformAction(ROLES.READER, 'canManageUsers')).toBe(false);
    });

    it('works correctly for boundary cases', () => {
      // WRITER is the minimum for canSubmitForReview
      expect(canPerformAction(ROLES.READER, 'canSubmitForReview')).toBe(false);
      expect(canPerformAction(ROLES.WRITER, 'canSubmitForReview')).toBe(true);
      expect(canPerformAction(ROLES.CONTRIBUTOR, 'canSubmitForReview')).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 7: Role Hierarchy Inheritance Tests
// ============================================================================

describe('Role Hierarchy Inheritance', () => {
  describe('Higher Roles Inherit Lower Role Permissions', () => {
    it('OWNER has all permissions of ADMIN', () => {
      const ownerPerms = getPermissionsForRole(ROLES.OWNER);
      const adminPerms = getPermissionsForRole(ROLES.ADMIN);

      // All admin permissions should be true for owner
      Object.entries(adminPerms).forEach(([perm, value]) => {
        if (value) {
          expect(ownerPerms[perm as keyof Permissions]).toBe(true);
        }
      });
    });

    it('ADMIN has all permissions of EDITOR', () => {
      const adminPerms = getPermissionsForRole(ROLES.ADMIN);
      const editorPerms = getPermissionsForRole(ROLES.EDITOR);

      Object.entries(editorPerms).forEach(([perm, value]) => {
        if (value) {
          expect(adminPerms[perm as keyof Permissions]).toBe(true);
        }
      });
    });

    it('EDITOR has all permissions of MODERATOR', () => {
      const editorPerms = getPermissionsForRole(ROLES.EDITOR);
      const modPerms = getPermissionsForRole(ROLES.MODERATOR);

      Object.entries(modPerms).forEach(([perm, value]) => {
        if (value) {
          expect(editorPerms[perm as keyof Permissions]).toBe(true);
        }
      });
    });

    it('MODERATOR has all permissions of CONTRIBUTOR', () => {
      const modPerms = getPermissionsForRole(ROLES.MODERATOR);
      const contribPerms = getPermissionsForRole(ROLES.CONTRIBUTOR);

      Object.entries(contribPerms).forEach(([perm, value]) => {
        if (value) {
          expect(modPerms[perm as keyof Permissions]).toBe(true);
        }
      });
    });

    it('CONTRIBUTOR has all permissions of WRITER', () => {
      const contribPerms = getPermissionsForRole(ROLES.CONTRIBUTOR);
      const writerPerms = getPermissionsForRole(ROLES.WRITER);

      Object.entries(writerPerms).forEach(([perm, value]) => {
        if (value) {
          expect(contribPerms[perm as keyof Permissions]).toBe(true);
        }
      });
    });

    it('WRITER has all permissions of READER', () => {
      const writerPerms = getPermissionsForRole(ROLES.WRITER);
      const readerPerms = getPermissionsForRole(ROLES.READER);

      Object.entries(readerPerms).forEach(([perm, value]) => {
        if (value) {
          expect(writerPerms[perm as keyof Permissions]).toBe(true);
        }
      });
    });
  });

  describe('Permission Count Increases with Role Level', () => {
    it('each higher role has at least as many permissions as the lower role', () => {
      const countPermissions = (level: RoleLevel): number => {
        const perms = getPermissionsForRole(level);
        return Object.values(perms).filter(Boolean).length;
      };

      const readerCount = countPermissions(ROLES.READER);
      const writerCount = countPermissions(ROLES.WRITER);
      const contributorCount = countPermissions(ROLES.CONTRIBUTOR);
      const moderatorCount = countPermissions(ROLES.MODERATOR);
      const editorCount = countPermissions(ROLES.EDITOR);
      const adminCount = countPermissions(ROLES.ADMIN);
      const ownerCount = countPermissions(ROLES.OWNER);

      expect(writerCount).toBeGreaterThanOrEqual(readerCount);
      expect(contributorCount).toBeGreaterThanOrEqual(writerCount);
      expect(moderatorCount).toBeGreaterThanOrEqual(contributorCount);
      expect(editorCount).toBeGreaterThanOrEqual(moderatorCount);
      expect(adminCount).toBeGreaterThanOrEqual(editorCount);
      expect(ownerCount).toBeGreaterThanOrEqual(adminCount);
    });
  });
});

// ============================================================================
// SECTION 8: Feature Gating Scenarios
// ============================================================================

describe('Feature Gating Scenarios', () => {
  describe('Publishing Features', () => {
    it('READER cannot submit articles', () => {
      const perms = getPermissionsForRole(ROLES.READER);
      expect(perms.canSubmitForReview).toBe(false);
    });

    it('WRITER can submit articles for review but not publish directly', () => {
      const perms = getPermissionsForRole(ROLES.WRITER);
      expect(perms.canSubmitForReview).toBe(true);
      expect(perms.canPublishImmediately).toBe(false);
    });

    it('CONTRIBUTOR can publish articles directly', () => {
      const perms = getPermissionsForRole(ROLES.CONTRIBUTOR);
      expect(perms.canSubmitForReview).toBe(true);
      expect(perms.canPublishImmediately).toBe(true);
    });
  });

  describe('Moderation Features', () => {
    it('only MODERATOR+ can access moderation queue', () => {
      expect(getPermissionsForRole(ROLES.CONTRIBUTOR).canViewReports).toBe(false);
      expect(getPermissionsForRole(ROLES.MODERATOR).canViewReports).toBe(true);
      expect(getPermissionsForRole(ROLES.EDITOR).canViewReports).toBe(true);
      expect(getPermissionsForRole(ROLES.ADMIN).canViewReports).toBe(true);
    });

    it('MODERATOR can temp ban but not perma ban', () => {
      const perms = getPermissionsForRole(ROLES.MODERATOR);
      expect(perms.canTempBanUsers).toBe(true);
      expect(perms.canPermaBanUsers).toBe(false);
    });

    it('ADMIN can perma ban users', () => {
      const perms = getPermissionsForRole(ROLES.ADMIN);
      expect(perms.canTempBanUsers).toBe(true);
      expect(perms.canPermaBanUsers).toBe(true);
    });
  });

  describe('Admin Features', () => {
    it('only ADMIN+ can access admin dashboard', () => {
      expect(getPermissionsForRole(ROLES.EDITOR).canAccessAnalytics).toBe(false);
      expect(getPermissionsForRole(ROLES.ADMIN).canAccessAnalytics).toBe(true);
      expect(getPermissionsForRole(ROLES.OWNER).canAccessAnalytics).toBe(true);
    });

    it('only ADMIN+ can manage users and roles', () => {
      expect(getPermissionsForRole(ROLES.EDITOR).canManageUsers).toBe(false);
      expect(getPermissionsForRole(ROLES.EDITOR).canManageRoles).toBe(false);
      expect(getPermissionsForRole(ROLES.ADMIN).canManageUsers).toBe(true);
      expect(getPermissionsForRole(ROLES.ADMIN).canManageRoles).toBe(true);
    });
  });

  describe('Owner-Only Features', () => {
    it('only OWNER can withdraw funds', () => {
      expect(getPermissionsForRole(ROLES.ADMIN).canWithdrawFunds).toBe(false);
      expect(getPermissionsForRole(ROLES.OWNER).canWithdrawFunds).toBe(true);
    });

    it('only OWNER can transfer ownership', () => {
      expect(getPermissionsForRole(ROLES.ADMIN).canTransferOwnership).toBe(false);
      expect(getPermissionsForRole(ROLES.OWNER).canTransferOwnership).toBe(true);
    });

    it('only OWNER can upgrade contracts', () => {
      expect(getPermissionsForRole(ROLES.ADMIN).canUpgradeContracts).toBe(false);
      expect(getPermissionsForRole(ROLES.OWNER).canUpgradeContracts).toBe(true);
    });

    it('only OWNER can emergency pause', () => {
      expect(getPermissionsForRole(ROLES.ADMIN).canEmergencyPause).toBe(false);
      expect(getPermissionsForRole(ROLES.OWNER).canEmergencyPause).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 9: Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases', () => {
  describe('Missing Contract Address', () => {
    it('returns READER when contract address is not set', async () => {
      delete process.env.NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS;
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.roleLevel).toBe(ROLES.READER);
      expect(result.current.roleName).toBe('READER');
    });
  });

  describe('Refresh Functionality', () => {
    it('refresh invalidates and refetches role data', async () => {
      setUserRole(ROLES.WRITER);
      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await result.current.refresh();

      expect(invalidateSpy).toHaveBeenCalled();
    });
  });

  describe('Concurrent Role Checks', () => {
    it('multiple hooks can check different aspects simultaneously', async () => {
      setUserRole(ROLES.EDITOR);
      const { wrapper } = createQueryWrapper();

      const { result: roleResult } = renderHook(() => useRole(), { wrapper });
      const { result: isAdminResult } = renderHook(() => useIsAdmin(), { wrapper });
      const { result: isEditorResult } = renderHook(() => useIsEditor(), { wrapper });
      const { result: canPublishResult } = renderHook(() => useCanPublish(), { wrapper });

      await waitFor(() => {
        expect(roleResult.current.isLoading).toBe(false);
      });

      expect(roleResult.current.roleLevel).toBe(ROLES.EDITOR);
      expect(isAdminResult.current).toBe(false);
      expect(isEditorResult.current).toBe(true);
      expect(canPublishResult.current).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 10: Security Considerations
// ============================================================================

describe('Security Considerations', () => {
  describe('Default to Least Privilege', () => {
    it('defaults to READER (lowest privilege) on any error', async () => {
      // Set up all contract calls to fail
      mockContract.is_registered.mockRejectedValue(new Error('Any error'));
      mockContract.get_user_role.mockRejectedValue(new Error('Any error'));
      mockContract.get_role_level.mockRejectedValue(new Error('Any error'));
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // When all contract calls fail, should default to READER (lowest privilege)
      expect(result.current.roleLevel).toBe(ROLES.READER);
    });

    it('defaults to READER when wallet disconnects', () => {
      setDisconnectedWallet();
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      expect(result.current.roleLevel).toBe(ROLES.READER);
      expect(result.current.isRegistered).toBe(false);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('invalid high role level is clamped to OWNER', async () => {
      mockContract.is_registered.mockResolvedValue(true);
      mockContract.get_user_role.mockResolvedValue({
        role: 999, // Attempted escalation
        granted_at: 0,
        granted_by: '0x0',
        approved_posts: 0,
        reputation: 0n,
        is_active: true,
      });
      const { wrapper } = createQueryWrapper();

      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should be clamped to max valid role (OWNER = 6)
      expect(result.current.roleLevel).toBeLessThanOrEqual(ROLES.OWNER);
    });
  });
});
