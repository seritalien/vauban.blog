/**
 * NextAuth v5 Configuration
 *
 * Provides OAuth authentication (GitHub, Google) with custodial wallet support.
 * When a user signs in via OAuth, a Starknet wallet is automatically created
 * for them and stored server-side.
 */
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';

// =============================================================================
// TYPES
// =============================================================================

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      // Custodial wallet address (generated on first sign-in)
      walletAddress?: string | null;
    };
  }

  interface User {
    walletAddress?: string | null;
  }
}

// =============================================================================
// WALLET GENERATION (Simplified - In production, use proper key management)
// =============================================================================

/**
 * Generate a deterministic wallet address from user ID using SHA-256.
 *
 * Uses a keyed hash (HMAC-like construction) so the address is:
 *  - Deterministic (same userId = same address)
 *  - Collision-resistant (SHA-256)
 *  - Not guessable without knowing the salt
 *
 * NOTE: This produces a pseudo-address for custodial wallets.
 * In production with real Starknet wallets, replace with proper key
 * derivation (e.g., BIP-32) and secure private key storage.
 */
async function generateWalletAddress(userId: string): Promise<string> {
  const salt = process.env.AUTH_WALLET_SALT || 'vauban-custodial-v1';
  const data = new TextEncoder().encode(`${salt}:${userId}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `0x${hex}`;
}

// =============================================================================
// PROVIDERS
// =============================================================================

// Build providers array conditionally
const providers = [
  // GitHub OAuth (if configured)
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      })]
    : []),
  // Google OAuth (if configured)
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      })]
    : []),
];

// =============================================================================
// AUTH CONFIG
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextAuth: any = NextAuth({
  providers,
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // On initial sign-in, generate wallet address
      if (user && account) {
        const userId = `${account.provider}:${user.id}`;
        token.walletAddress = await generateWalletAddress(userId);
      }
      return token;
    },
    async session({ session, token }) {
      // Pass wallet address to session
      if (token.walletAddress && typeof token.walletAddress === 'string') {
        session.user.walletAddress = token.walletAddress;
      }
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  trustHost: true,
});

// Export with explicit types to avoid inference issues
export const handlers = nextAuth.handlers as {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
};
export const signIn = nextAuth.signIn as (
  provider?: string,
  options?: { redirectTo?: string; redirect?: boolean }
) => Promise<void>;
export const signOut = nextAuth.signOut as (options?: { redirectTo?: string }) => Promise<void>;
export const auth = nextAuth.auth as () => Promise<{
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    walletAddress?: string | null;
  };
} | null>;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if any OAuth provider is configured
 */
export function hasOAuthProviders(): boolean {
  return providers.length > 0;
}

/**
 * Get list of configured provider names
 */
export function getConfiguredProviders(): string[] {
  return providers.map((p) => {
    // Check if provider has an id property
    const provider = p as { id?: string };
    if (provider.id) {
      return provider.id;
    }
    return 'unknown';
  });
}
