import { z } from 'zod';

// ============================================================================
// AUTHOR PROFILE SCHEMAS
// ============================================================================

/**
 * Schema for author profile
 */
export const AuthorProfileSchema = z.object({
  // Wallet address (primary key)
  address: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),

  // Display name (optional, defaults to truncated address)
  displayName: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name must be at most 50 characters')
    .optional(),

  // Bio/description
  bio: z.string()
    .max(500, 'Bio must be at most 500 characters')
    .optional(),

  // Avatar URL (IPFS or external)
  avatar: z.string().url().optional(),

  // IPFS CID of the user's E2E encryption public key
  publicKeyCid: z.string().optional(),

  // Social links
  website: z.string().url().optional(),
  twitter: z.string()
    .regex(/^@?[a-zA-Z0-9_]{1,15}$/, 'Invalid Twitter handle')
    .optional(),
  github: z.string()
    .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/, 'Invalid GitHub username')
    .optional(),

  // Timestamps
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type AuthorProfile = z.infer<typeof AuthorProfileSchema>;

/**
 * Schema for profile input (creating/updating)
 */
export const ProfileInputSchema = AuthorProfileSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

/**
 * Schema for public author info (displayed on articles)
 */
export const AuthorInfoSchema = z.object({
  address: z.string(),
  displayName: z.string().optional(),
  avatar: z.string().optional(),
});

export type AuthorInfo = z.infer<typeof AuthorInfoSchema>;
