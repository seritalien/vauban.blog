import { z } from 'zod';

// ============================================================================
// COMMENT SCHEMAS
// ============================================================================

/**
 * Schema for creating a comment
 */
export const CommentInputSchema = z.object({
  postId: z.string().min(1, 'Post ID is required'),

  content: z.string()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment must be at most 2000 characters'),

  parentCommentId: z.string().optional(), // For nested replies

  // Session key signature (for gasless transactions)
  sessionKeySignature: z.string().optional(),
});

export type CommentInput = z.infer<typeof CommentInputSchema>;

/**
 * Schema for comment metadata from blockchain
 */
export const CommentMetadataSchema = z.object({
  id: z.string(),
  postId: z.string(),
  author: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid Starknet address'),
  contentHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid SHA256 hash'),
  parentCommentId: z.string().optional(),
  createdAt: z.number().int().positive(),
  isDeleted: z.boolean().default(false),
  likeCount: z.number().int().min(0).default(0),
});

export type CommentMetadata = z.infer<typeof CommentMetadataSchema>;

/**
 * Schema for complete comment (metadata + content)
 */
export const CommentOutputSchema: z.ZodType<CommentOutput> = z.object({
  id: z.string(),
  postId: z.string(),
  author: z.string(),
  content: z.string(),
  contentHash: z.string(),
  parentCommentId: z.string().optional(),
  createdAt: z.date(),
  isDeleted: z.boolean(),
  likeCount: z.number(),

  // Nested replies
  replies: z.array(z.lazy(() => CommentOutputSchema)).optional(),

  // User interaction state
  isLikedByCurrentUser: z.boolean().optional(),
});

export type CommentOutput = {
  id: string;
  postId: string;
  author: string;
  content: string;
  contentHash: string;
  parentCommentId?: string;
  createdAt: Date;
  isDeleted: boolean;
  likeCount: number;
  replies?: CommentOutput[];
  isLikedByCurrentUser?: boolean;
};

/**
 * Schema for comment query filters
 */
export const CommentQuerySchema = z.object({
  postId: z.string().min(1),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  parentCommentId: z.string().optional(), // Filter by parent (replies)
  sortBy: z.enum(['createdAt', 'likeCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CommentQuery = z.infer<typeof CommentQuerySchema>;

/**
 * Schema for like/unlike action
 */
export const LikeActionSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().min(1),
  action: z.enum(['like', 'unlike']),
  sessionKeySignature: z.string().optional(),
});

export type LikeAction = z.infer<typeof LikeActionSchema>;
