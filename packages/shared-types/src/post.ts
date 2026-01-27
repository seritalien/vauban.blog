import { z } from 'zod';

// ============================================================================
// CONTENT TYPE CONSTANTS (matches Cairo contract)
// ============================================================================

export const POST_TYPE_TWEET = 0;
export const POST_TYPE_THREAD = 1;
export const POST_TYPE_ARTICLE = 2;

// ============================================================================
// CONTENT TYPE ENUM (for TypeScript)
// ============================================================================

export const ContentTypeSchema = z.enum(['tweet', 'thread', 'article']);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/**
 * Map content type string to on-chain constant
 */
export function contentTypeToNumber(type: ContentType): number {
  switch (type) {
    case 'tweet': return POST_TYPE_TWEET;
    case 'thread': return POST_TYPE_THREAD;
    case 'article': return POST_TYPE_ARTICLE;
  }
}

/**
 * Map on-chain constant to content type string
 */
export function numberToContentType(num: number): ContentType {
  switch (num) {
    case POST_TYPE_TWEET: return 'tweet';
    case POST_TYPE_THREAD: return 'thread';
    case POST_TYPE_ARTICLE: return 'article';
    default: return 'article'; // Default to article for backwards compatibility
  }
}

// ============================================================================
// POST SCHEMAS
// ============================================================================

/**
 * Schema for creating/editing a blog post (before blockchain submission)
 * Supports tweets (<280 chars), threads, and full articles
 */
export const PostInputSchema = z.object({
  // Content type determines display and validation rules
  contentType: ContentTypeSchema.default('article'),

  // Title - required for articles, optional for tweets/threads
  title: z.string()
    .max(200, 'Title must be at most 200 characters')
    .optional(),

  // Slug - required for articles, auto-generated for tweets/threads
  slug: z.string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens')
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug must be at most 100 characters')
    .optional(),

  // Content - tweets have 280 char limit, articles require 100+ chars
  content: z.string()
    .min(1, 'Content is required')
    .max(500000, 'Content must be at most 500KB'),

  // Preview text for timeline display (auto-generated from content if not provided)
  preview: z.string()
    .max(280, 'Preview must be at most 280 characters')
    .optional(),

  // Excerpt - required for articles, optional for tweets/threads
  excerpt: z.string()
    .max(500, 'Excerpt must be at most 500 characters')
    .optional(),

  tags: z.array(z.string())
    .max(10, 'Maximum 10 tags allowed')
    .default([]),

  coverImage: z.string()
    .refine(
      (val) => {
        // Accept full URLs
        if (val.startsWith('http://') || val.startsWith('https://')) {
          try {
            new URL(val);
            return true;
          } catch {
            return false;
          }
        }
        // Accept relative IPFS API paths
        if (val.startsWith('/api/ipfs/')) {
          return val.length > '/api/ipfs/'.length;
        }
        return false;
      },
      { message: 'Cover image must be a valid URL or IPFS path (e.g., /api/ipfs/Qm...)' }
    )
    .optional(),

  isPaid: z.boolean().default(false),

  price: z.number()
    .min(0, 'Price cannot be negative')
    .max(1000000, 'Price too high')
    .default(0),

  isEncrypted: z.boolean().default(false),

  // eXtended fields for thread/reply support
  parentId: z.string().optional(), // Post being replied to
  threadRootId: z.string().optional(), // Root post if part of a thread
}).superRefine((data, ctx) => {
  if (data.contentType === 'article') {
    if (!data.title || data.title.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Article title must be at least 3 characters (got ${data.title?.length ?? 0}).`,
        path: ['title'],
      });
    }
    if (data.content.length < 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Article content must be at least 100 characters (got ${data.content.length}).`,
        path: ['content'],
      });
    }
  }
  if (data.contentType === 'tweet' && data.content.length > 280) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Tweet must be 280 characters or less (got ${data.content.length}).`,
      path: ['content'],
    });
  }
});

export type PostInput = z.infer<typeof PostInputSchema>;

/**
 * Schema for post metadata stored on blockchain
 * Includes eXtended fields for Twitter-like functionality
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
  // eXtended fields
  postType: z.number().int().min(0).max(2).default(POST_TYPE_ARTICLE), // 0=tweet, 1=thread, 2=article
  parentId: z.string().optional(), // ID of parent post if this is a reply
  threadRootId: z.string().optional(), // ID of thread root if part of a thread
  isPinned: z.boolean().default(false), // Pinned to author's profile
});

export type PostMetadata = z.infer<typeof PostMetadataSchema>;

/**
 * Schema for complete post (metadata + content)
 * Used when loading full post data from storage
 */
export const PostOutputSchema = z.object({
  // Identity
  id: z.string(),
  author: z.string(),
  contentType: ContentTypeSchema.default('article'),

  // Content
  title: z.string().optional(),
  slug: z.string().optional(),
  content: z.string(),
  preview: z.string().optional(),
  excerpt: z.string().optional(),
  tags: z.array(z.string()).default([]),
  coverImage: z.string().optional(),

  // Pricing
  isPaid: z.boolean().default(false),
  price: z.number().default(0),
  isEncrypted: z.boolean().default(false),

  // Storage
  arweaveTxId: z.string(),
  ipfsCid: z.string(),
  contentHash: z.string(),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
  isDeleted: z.boolean().default(false),

  // eXtended fields
  postType: z.number().int().default(POST_TYPE_ARTICLE),
  parentId: z.string().optional(),
  threadRootId: z.string().optional(),
  isPinned: z.boolean().default(false),

  // Computed fields
  readingTimeMinutes: z.number().optional(),
  wordCount: z.number().optional(),

  // Engagement (populated from Social contract)
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  replyCount: z.number().default(0),
});

export type PostOutput = z.infer<typeof PostOutputSchema>;

/**
 * Schema for post listing (without full content)
 * Used in timeline/feed views and search results
 */
export const PostListItemSchema = z.object({
  id: z.string(),
  author: z.string(),
  contentType: ContentTypeSchema.default('article'),
  title: z.string().optional(),
  slug: z.string().optional(),
  preview: z.string().optional(), // For timeline display
  excerpt: z.string().optional(), // For blog view
  tags: z.array(z.string()).default([]),
  coverImage: z.string().optional(),
  isPaid: z.boolean().default(false),
  price: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  readingTimeMinutes: z.number().optional(),
  // eXtended fields
  postType: z.number().int().default(POST_TYPE_ARTICLE),
  parentId: z.string().optional(),
  threadRootId: z.string().optional(),
  isPinned: z.boolean().default(false),
  // Engagement counts
  likesCount: z.number().default(0),
  commentsCount: z.number().default(0),
  replyCount: z.number().default(0),
});

export type PostListItem = z.infer<typeof PostListItemSchema>;

/**
 * Schema for post query filters
 * Supports filtering by content type for timeline vs blog views
 */
export const PostQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
  author: z.string().optional(),
  tag: z.string().optional(),
  isPaid: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title', 'likes']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  // eXtended query options
  contentType: ContentTypeSchema.optional(), // Filter by content type
  postType: z.number().int().min(0).max(2).optional(), // Filter by on-chain post type
  parentId: z.string().optional(), // Get replies to a specific post
  threadRootId: z.string().optional(), // Get posts in a specific thread
  excludeReplies: z.boolean().default(false), // Exclude replies from results (for main timeline)
  pinnedOnly: z.boolean().default(false), // Only return pinned posts
});

export type PostQuery = z.infer<typeof PostQuerySchema>;

// ============================================================================
// TIMELINE-SPECIFIC TYPES
// ============================================================================

/**
 * Schema for timeline feed items
 * Combines posts with engagement data for efficient timeline rendering
 */
export const TimelineFeedItemSchema = PostListItemSchema.extend({
  // Render hints
  isRepost: z.boolean().default(false),
  repostedBy: z.string().optional(), // Address of user who reposted
  repostedAt: z.date().optional(),
  // Thread context
  threadLength: z.number().optional(), // Number of posts in thread
  threadPreview: z.array(z.string()).optional(), // IDs of first few posts in thread
});

export type TimelineFeedItem = z.infer<typeof TimelineFeedItemSchema>;
