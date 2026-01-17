import { z } from 'zod';

// ============================================================================
// POST SCHEMAS
// ============================================================================

/**
 * Schema for creating/editing a blog post (before blockchain submission)
 */
export const PostInputSchema = z.object({
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(200, 'Title must be at most 200 characters'),

  slug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug must be at most 100 characters'),

  content: z.string()
    .min(100, 'Content must be at least 100 characters')
    .max(500000, 'Content must be at most 500KB'),

  excerpt: z.string()
    .min(10, 'Excerpt must be at least 10 characters')
    .max(500, 'Excerpt must be at most 500 characters'),

  tags: z.array(z.string())
    .min(1, 'At least one tag is required')
    .max(10, 'Maximum 10 tags allowed'),

  coverImage: z.string().url().optional(),

  isPaid: z.boolean().default(false),

  price: z.number()
    .min(0, 'Price cannot be negative')
    .max(1000000, 'Price too high')
    .default(0),

  isEncrypted: z.boolean().default(false),
});

export type PostInput = z.infer<typeof PostInputSchema>;

/**
 * Schema for post metadata stored on blockchain
 */
export const PostMetadataSchema = z.object({
  id: z.string(),
  author: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),
  arweaveTxId: z.string().min(1, 'Arweave transaction ID required'),
  ipfsCid: z.string().min(1, 'IPFS CID required'),
  contentHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid SHA256 hash'),
  price: z.string(), // BigInt as string (Wei)
  isEncrypted: z.boolean(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  isDeleted: z.boolean().default(false),
});

export type PostMetadata = z.infer<typeof PostMetadataSchema>;

/**
 * Schema for complete post (metadata + content)
 */
export const PostOutputSchema = PostInputSchema.extend({
  id: z.string(),
  author: z.string(),
  arweaveTxId: z.string(),
  ipfsCid: z.string(),
  contentHash: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isDeleted: z.boolean().default(false),

  // Computed fields
  readingTimeMinutes: z.number().optional(),
  wordCount: z.number().optional(),
});

export type PostOutput = z.infer<typeof PostOutputSchema>;

/**
 * Schema for post listing (without full content)
 */
export const PostListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string(),
  author: z.string(),
  tags: z.array(z.string()),
  coverImage: z.string().optional(),
  isPaid: z.boolean(),
  price: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  readingTimeMinutes: z.number().optional(),
});

export type PostListItem = z.infer<typeof PostListItemSchema>;

/**
 * Schema for post query filters
 */
export const PostQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  author: z.string().optional(),
  tag: z.string().optional(),
  isPaid: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PostQuery = z.infer<typeof PostQuerySchema>;
