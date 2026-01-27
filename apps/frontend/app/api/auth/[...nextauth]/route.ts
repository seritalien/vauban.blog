/**
 * NextAuth v5 API Route Handler
 *
 * Handles all authentication routes:
 * - /api/auth/signin
 * - /api/auth/signout
 * - /api/auth/callback/:provider
 * - /api/auth/session
 */
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
