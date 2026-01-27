'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
}

/**
 * Wrapper for NextAuth SessionProvider
 *
 * Must be used in layout to enable session hooks throughout the app
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <SessionProvider>
 *   {children}
 * </SessionProvider>
 * ```
 */
export default function SessionProvider({ children }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
