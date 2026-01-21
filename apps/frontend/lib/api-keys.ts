/**
 * API Key Management for M2M (Machine-to-Machine) Authentication
 *
 * In production, this should use a database for API key storage.
 * For simplicity, we're using environment variables for the MVP.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute

/**
 * Validate an API key
 */
export function validateApiKey(apiKey: string | null): boolean {
  if (!apiKey) return false;

  const validApiKey = process.env.M2M_API_KEY;
  if (!validApiKey) {
    console.warn('M2M_API_KEY not configured in environment');
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (apiKey.length !== validApiKey.length) return false;

  let result = 0;
  for (let i = 0; i < apiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ validApiKey.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Check rate limit for an API key
 * Returns true if request is allowed, false if rate limited
 */
export function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(apiKey);

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(apiKey, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Get remaining rate limit requests
 */
export function getRateLimitRemaining(apiKey: string): number {
  const entry = rateLimitStore.get(apiKey);
  if (!entry || Date.now() > entry.resetTime) {
    return RATE_LIMIT_MAX_REQUESTS;
  }
  return Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);
}

/**
 * Get rate limit reset time
 */
export function getRateLimitReset(apiKey: string): number {
  const entry = rateLimitStore.get(apiKey);
  if (!entry || Date.now() > entry.resetTime) {
    return Date.now() + RATE_LIMIT_WINDOW_MS;
  }
  return entry.resetTime;
}

/**
 * Generate a new API key (for admin use)
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'vb_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}
