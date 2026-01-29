import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock next-auth before importing auth module
vi.mock('next-auth', () => {
  const mockHandlers = {
    GET: vi.fn(),
    POST: vi.fn(),
  };

  const mockAuth = vi.fn();
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();

  return {
    default: vi.fn(() => ({
      handlers: mockHandlers,
      auth: mockAuth,
      signIn: mockSignIn,
      signOut: mockSignOut,
    })),
  };
});

vi.mock('next-auth/providers/github', () => ({
  default: vi.fn((config: Record<string, string>) => ({
    id: 'github',
    name: 'GitHub',
    ...config,
  })),
}));

vi.mock('next-auth/providers/google', () => ({
  default: vi.fn((config: Record<string, string>) => ({
    id: 'google',
    name: 'Google',
    ...config,
  })),
}));

describe('auth.ts', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('hasOAuthProviders', () => {
    it('returns false when no providers are configured', async () => {
      // Ensure no provider env vars are set
      delete process.env.AUTH_GITHUB_ID;
      delete process.env.AUTH_GITHUB_SECRET;
      delete process.env.AUTH_GOOGLE_ID;
      delete process.env.AUTH_GOOGLE_SECRET;

      // Re-import to get fresh module with current env
      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { hasOAuthProviders } = await import('../auth');
      expect(hasOAuthProviders()).toBe(false);
    });

    it('returns true when GitHub provider is configured', async () => {
      process.env.AUTH_GITHUB_ID = 'github-id';
      process.env.AUTH_GITHUB_SECRET = 'github-secret';
      delete process.env.AUTH_GOOGLE_ID;
      delete process.env.AUTH_GOOGLE_SECRET;

      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { hasOAuthProviders } = await import('../auth');
      expect(hasOAuthProviders()).toBe(true);
    });

    it('returns true when Google provider is configured', async () => {
      delete process.env.AUTH_GITHUB_ID;
      delete process.env.AUTH_GITHUB_SECRET;
      process.env.AUTH_GOOGLE_ID = 'google-id';
      process.env.AUTH_GOOGLE_SECRET = 'google-secret';

      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { hasOAuthProviders } = await import('../auth');
      expect(hasOAuthProviders()).toBe(true);
    });

    it('returns true when both providers are configured', async () => {
      process.env.AUTH_GITHUB_ID = 'github-id';
      process.env.AUTH_GITHUB_SECRET = 'github-secret';
      process.env.AUTH_GOOGLE_ID = 'google-id';
      process.env.AUTH_GOOGLE_SECRET = 'google-secret';

      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { hasOAuthProviders } = await import('../auth');
      expect(hasOAuthProviders()).toBe(true);
    });
  });

  describe('getConfiguredProviders', () => {
    it('returns empty array when no providers configured', async () => {
      delete process.env.AUTH_GITHUB_ID;
      delete process.env.AUTH_GITHUB_SECRET;
      delete process.env.AUTH_GOOGLE_ID;
      delete process.env.AUTH_GOOGLE_SECRET;

      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { getConfiguredProviders } = await import('../auth');
      expect(getConfiguredProviders()).toEqual([]);
    });

    it('returns github when only GitHub is configured', async () => {
      process.env.AUTH_GITHUB_ID = 'github-id';
      process.env.AUTH_GITHUB_SECRET = 'github-secret';
      delete process.env.AUTH_GOOGLE_ID;
      delete process.env.AUTH_GOOGLE_SECRET;

      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { getConfiguredProviders } = await import('../auth');
      expect(getConfiguredProviders()).toEqual(['github']);
    });

    it('returns both providers when both are configured', async () => {
      process.env.AUTH_GITHUB_ID = 'github-id';
      process.env.AUTH_GITHUB_SECRET = 'github-secret';
      process.env.AUTH_GOOGLE_ID = 'google-id';
      process.env.AUTH_GOOGLE_SECRET = 'google-secret';

      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const { getConfiguredProviders } = await import('../auth');
      expect(getConfiguredProviders()).toEqual(['github', 'google']);
    });
  });

  describe('exports', () => {
    it('exports handlers, signIn, signOut, and auth', async () => {
      vi.resetModules();
      vi.doMock('next-auth', () => ({
        default: vi.fn(() => ({
          handlers: { GET: vi.fn(), POST: vi.fn() },
          auth: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
        })),
      }));
      vi.doMock('next-auth/providers/github', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'github', ...config })),
      }));
      vi.doMock('next-auth/providers/google', () => ({
        default: vi.fn((config: Record<string, string>) => ({ id: 'google', ...config })),
      }));

      const authModule = await import('../auth');
      expect(authModule.handlers).toBeDefined();
      expect(authModule.signIn).toBeDefined();
      expect(authModule.signOut).toBeDefined();
      expect(authModule.auth).toBeDefined();
    });
  });
});
