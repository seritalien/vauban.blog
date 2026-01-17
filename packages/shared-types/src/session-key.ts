import { z } from 'zod';

// ============================================================================
// SESSION KEY SCHEMAS
// ============================================================================

/**
 * Permission scope for session key
 */
export const PermissionSchema = z.object({
  targetContract: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid contract address'),
  functionSelector: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid function selector'),
});

export type Permission = z.infer<typeof PermissionSchema>;

/**
 * Schema for creating a session key
 */
export const CreateSessionKeySchema = z.object({
  sessionPublicKey: z.string()
    .regex(/^0x[a-fA-F0-9]+$/, 'Invalid public key'),

  expiryDuration: z.number()
    .int()
    .min(3600, 'Minimum 1 hour') // 1 hour
    .max(2592000, 'Maximum 30 days') // 30 days
    .default(604800), // 7 days

  maxUses: z.number()
    .int()
    .min(0, 'Max uses cannot be negative')
    .default(0), // 0 = unlimited

  permissions: z.array(PermissionSchema)
    .min(1, 'At least one permission required')
    .max(10, 'Maximum 10 permissions allowed'),

  // Master account signature
  masterSignature: z.string(),
});

export type CreateSessionKey = z.infer<typeof CreateSessionKeySchema>;

/**
 * Schema for session key metadata from blockchain
 */
export const SessionKeyMetadataSchema = z.object({
  sessionPublicKey: z.string(),
  masterAccount: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid address'),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  isRevoked: z.boolean().default(false),
  useCount: z.number().int().min(0).default(0),
  maxUses: z.number().int().min(0).default(0),
});

export type SessionKeyMetadata = z.infer<typeof SessionKeyMetadataSchema>;

/**
 * Schema for session key stored locally (client-side)
 */
export const LocalSessionKeySchema = z.object({
  sessionPublicKey: z.string(),
  sessionPrivateKey: z.string(), // Encrypted or in memory only
  masterAccount: z.string(),
  expiresAt: z.number(),
  permissions: z.array(PermissionSchema),
  createdAt: z.number(),

  // Metadata
  masterSignature: z.string(),
});

export type LocalSessionKey = z.infer<typeof LocalSessionKeySchema>;

/**
 * Schema for validating session key usage
 */
export const ValidateSessionKeySchema = z.object({
  sessionPublicKey: z.string(),
  targetContract: z.string(),
  functionSelector: z.string(),
});

export type ValidateSessionKey = z.infer<typeof ValidateSessionKeySchema>;

/**
 * Session key status
 */
export const SessionKeyStatusSchema = z.object({
  isValid: z.boolean(),
  isExpired: z.boolean(),
  isRevoked: z.boolean(),
  remainingUses: z.number().int().optional(),
  expiresIn: z.number().int().optional(), // Seconds until expiry
});

export type SessionKeyStatus = z.infer<typeof SessionKeyStatusSchema>;
