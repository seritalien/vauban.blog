import { z } from 'zod';

// ============================================================================
// ROLE CONSTANTS (matching Cairo contract)
// ============================================================================

/**
 * Role hierarchy levels - higher number = more permissions
 * Must match contracts/src/role_registry.cairo
 */
export const ROLES = {
  READER: 0,
  WRITER: 1,
  CONTRIBUTOR: 2,
  MODERATOR: 3,
  EDITOR: 4,
  ADMIN: 5,
  OWNER: 6,
} as const;

export type RoleLevel = (typeof ROLES)[keyof typeof ROLES];
export type RoleName = keyof typeof ROLES;

/**
 * Reverse mapping from role level to name
 */
export const ROLE_NAMES: Record<RoleLevel, RoleName> = {
  0: 'READER',
  1: 'WRITER',
  2: 'CONTRIBUTOR',
  3: 'MODERATOR',
  4: 'EDITOR',
  5: 'ADMIN',
  6: 'OWNER',
} as const;

/**
 * Human-readable role labels
 */
export const ROLE_LABELS: Record<RoleLevel, string> = {
  0: 'Reader',
  1: 'Writer',
  2: 'Contributor',
  3: 'Moderator',
  4: 'Editor',
  5: 'Admin',
  6: 'Owner',
} as const;

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<RoleLevel, string> = {
  0: 'Can view public content and comments',
  1: 'Can submit posts for review, edit own drafts',
  2: 'Can publish immediately (earned trust), edit own posts',
  3: 'Can review reports, hide/unhide comments, temp ban users',
  4: 'Can approve/reject posts, feature articles, manage tags',
  5: 'Can manage all roles, override content, configure settings',
  6: 'Can transfer ownership, upgrade contracts, emergency pause',
} as const;

// ============================================================================
// ROLE SCHEMAS
// ============================================================================

/**
 * Role level schema (0-6)
 */
export const RoleLevelSchema = z.number().int().min(0).max(6);

/**
 * User role information from contract
 */
export const UserRoleSchema = z.object({
  user: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),
  role: RoleLevelSchema,
  grantedAt: z.number().int().nonnegative(),
  grantedBy: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),
  approvedPosts: z.number().int().nonnegative(),
  reputation: z.bigint().or(z.string()),
  isActive: z.boolean(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Role change request
 */
export const RoleChangeRequestSchema = z.object({
  id: z.string(),
  user: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),
  requestedRole: RoleLevelSchema,
  currentRole: RoleLevelSchema,
  reason: z.string().max(500),
  createdAt: z.number().int().positive(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewedBy: z.string().regex(/^0x[a-fA-F0-9]+$/).optional(),
  reviewedAt: z.number().int().positive().optional(),
});

export type RoleChangeRequest = z.infer<typeof RoleChangeRequestSchema>;

// ============================================================================
// PERMISSION SCHEMAS
// ============================================================================

/**
 * Platform permissions derived from role
 */
export const PermissionsSchema = z.object({
  // Content permissions
  canViewPublicContent: z.boolean(),
  canComment: z.boolean(),
  canLike: z.boolean(),
  canSubmitForReview: z.boolean(),
  canPublishImmediately: z.boolean(),
  canEditOwnContent: z.boolean(),
  canEditAnyContent: z.boolean(),
  canDeleteOwnContent: z.boolean(),
  canDeleteAnyContent: z.boolean(),

  // Review/Editorial permissions
  canApproveContent: z.boolean(),
  canRejectContent: z.boolean(),
  canRequestRevisions: z.boolean(),
  canFeaturePosts: z.boolean(),
  canManageTags: z.boolean(),

  // Moderation permissions
  canViewReports: z.boolean(),
  canResolveReports: z.boolean(),
  canHideContent: z.boolean(),
  canTempBanUsers: z.boolean(),
  canPermaBanUsers: z.boolean(),

  // Admin permissions
  canManageUsers: z.boolean(),
  canManageRoles: z.boolean(),
  canAccessAnalytics: z.boolean(),
  canConfigureSettings: z.boolean(),

  // Owner permissions
  canWithdrawFunds: z.boolean(),
  canTransferOwnership: z.boolean(),
  canUpgradeContracts: z.boolean(),
  canEmergencyPause: z.boolean(),
});

export type Permissions = z.infer<typeof PermissionsSchema>;

/**
 * Get permissions for a given role level
 */
export function getPermissionsForRole(roleLevel: RoleLevel): Permissions {
  const basePermissions: Permissions = {
    // Everyone can view and interact
    canViewPublicContent: true,
    canComment: roleLevel >= ROLES.READER,
    canLike: roleLevel >= ROLES.READER,

    // Writer permissions
    canSubmitForReview: roleLevel >= ROLES.WRITER,
    canEditOwnContent: roleLevel >= ROLES.WRITER,
    canDeleteOwnContent: roleLevel >= ROLES.WRITER,

    // Contributor permissions
    canPublishImmediately: roleLevel >= ROLES.CONTRIBUTOR,

    // Moderator permissions
    canViewReports: roleLevel >= ROLES.MODERATOR,
    canResolveReports: roleLevel >= ROLES.MODERATOR,
    canHideContent: roleLevel >= ROLES.MODERATOR,
    canTempBanUsers: roleLevel >= ROLES.MODERATOR,

    // Editor permissions
    canApproveContent: roleLevel >= ROLES.EDITOR,
    canRejectContent: roleLevel >= ROLES.EDITOR,
    canRequestRevisions: roleLevel >= ROLES.EDITOR,
    canFeaturePosts: roleLevel >= ROLES.EDITOR,
    canManageTags: roleLevel >= ROLES.EDITOR,
    canEditAnyContent: roleLevel >= ROLES.EDITOR,

    // Admin permissions
    canDeleteAnyContent: roleLevel >= ROLES.ADMIN,
    canManageUsers: roleLevel >= ROLES.ADMIN,
    canManageRoles: roleLevel >= ROLES.ADMIN,
    canAccessAnalytics: roleLevel >= ROLES.ADMIN,
    canConfigureSettings: roleLevel >= ROLES.ADMIN,
    canPermaBanUsers: roleLevel >= ROLES.ADMIN,

    // Owner permissions
    canWithdrawFunds: roleLevel >= ROLES.OWNER,
    canTransferOwnership: roleLevel >= ROLES.OWNER,
    canUpgradeContracts: roleLevel >= ROLES.OWNER,
    canEmergencyPause: roleLevel >= ROLES.OWNER,
  };

  return basePermissions;
}

/**
 * Check if a role can perform a specific action
 */
export function canPerformAction(
  roleLevel: RoleLevel,
  action: keyof Permissions
): boolean {
  const permissions = getPermissionsForRole(roleLevel);
  return permissions[action];
}

/**
 * Get the minimum role required for a permission
 */
export function getMinimumRoleForPermission(permission: keyof Permissions): RoleLevel {
  for (let role = ROLES.READER; role <= ROLES.OWNER; role++) {
    if (getPermissionsForRole(role as RoleLevel)[permission]) {
      return role as RoleLevel;
    }
  }
  return ROLES.OWNER;
}

// ============================================================================
// REPUTATION SCHEMAS
// ============================================================================

/**
 * Reputation point values (matching Cairo contract)
 */
export const REPUTATION_POINTS = {
  POST_PUBLISHED: 100,
  POST_FEATURED: 500,
  COMMENT: 10,
  LIKE_RECEIVED: 5,
  SUBSCRIBER_GAINED: 50,
  REPORT_VALID: 25,
  SPAM_PENALTY: -200,
} as const;

/**
 * Reputation level thresholds
 */
export const REPUTATION_LEVELS = {
  NEWCOMER: { min: 0, max: 99, level: 1, label: 'Newcomer' },
  ACTIVE_WRITER: { min: 100, max: 499, level: 2, label: 'Active Writer' },
  ESTABLISHED: { min: 500, max: 1999, level: 3, label: 'Established' },
  VETERAN: { min: 2000, max: 9999, level: 4, label: 'Veteran' },
  LEGEND: { min: 10000, max: Infinity, level: 5, label: 'Legend' },
} as const;

/**
 * Badge definitions (bitmap positions)
 */
export const BADGES = {
  FIRST_POST: { bit: 0, label: 'First Post', emoji: '🌱', description: 'Published first article' },
  PROLIFIC_WRITER: { bit: 1, label: 'Prolific Writer', emoji: '📝', description: '10+ posts' },
  CENTURY_CLUB: { bit: 2, label: 'Century Club', emoji: '💯', description: '100+ posts' },
  FEATURED_AUTHOR: { bit: 3, label: 'Featured Author', emoji: '⭐', description: 'Had a featured article' },
  CONVERSATIONALIST: { bit: 4, label: 'Conversationalist', emoji: '💬', description: '100+ comments' },
  BELOVED: { bit: 5, label: 'Beloved', emoji: '❤️', description: '1000+ likes received' },
  EARLY_ADOPTER: { bit: 6, label: 'Early Adopter', emoji: '🎖️', description: 'Joined in first month' },
  VERIFIED: { bit: 7, label: 'Verified', emoji: '✅', description: 'Completed profile verification' },
  TOP_WRITER: { bit: 8, label: 'Top Writer', emoji: '🏆', description: 'Monthly top 10 by engagement' },
  PREMIUM_AUTHOR: { bit: 9, label: 'Premium Author', emoji: '💎', description: 'Has paid subscribers' },
  TRUSTED: { bit: 10, label: 'Trusted', emoji: '🔒', description: 'Contributor role earned' },
  GUARDIAN: { bit: 11, label: 'Guardian', emoji: '🛡️', description: 'Active moderator' },
} as const;

export type BadgeName = keyof typeof BADGES;

/**
 * User reputation information
 */
export const UserReputationSchema = z.object({
  user: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),
  totalPoints: z.bigint().or(z.string()),
  level: z.number().int().min(1).max(5),
  badges: z.bigint().or(z.string()), // Bitmap
  joinedAt: z.number().int().positive(),
  postCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  likeCount: z.number().int().nonnegative(),
});

export type UserReputation = z.infer<typeof UserReputationSchema>;

/**
 * Check if user has a specific badge
 */
export function hasBadge(badgeBitmap: bigint | string, badge: BadgeName): boolean {
  const bitmap = typeof badgeBitmap === 'string' ? BigInt(badgeBitmap) : badgeBitmap;
  const badgeBit = BigInt(1) << BigInt(BADGES[badge].bit);
  return (bitmap & badgeBit) !== BigInt(0);
}

/**
 * Get all badges a user has
 */
export function getUserBadges(badgeBitmap: bigint | string): BadgeName[] {
  const badges: BadgeName[] = [];
  for (const [name] of Object.entries(BADGES)) {
    if (hasBadge(badgeBitmap, name as BadgeName)) {
      badges.push(name as BadgeName);
    }
  }
  return badges;
}

/**
 * Get reputation level from points
 */
export function getReputationLevel(points: bigint | string | number): typeof REPUTATION_LEVELS[keyof typeof REPUTATION_LEVELS] {
  const p = typeof points === 'bigint' ? Number(points) : typeof points === 'string' ? Number(BigInt(points)) : points;

  if (p >= REPUTATION_LEVELS.LEGEND.min) return REPUTATION_LEVELS.LEGEND;
  if (p >= REPUTATION_LEVELS.VETERAN.min) return REPUTATION_LEVELS.VETERAN;
  if (p >= REPUTATION_LEVELS.ESTABLISHED.min) return REPUTATION_LEVELS.ESTABLISHED;
  if (p >= REPUTATION_LEVELS.ACTIVE_WRITER.min) return REPUTATION_LEVELS.ACTIVE_WRITER;
  return REPUTATION_LEVELS.NEWCOMER;
}
