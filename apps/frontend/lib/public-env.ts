/**
 * Runtime environment variable access for NEXT_PUBLIC_* variables.
 *
 * In Next.js, NEXT_PUBLIC_* vars are inlined at build time. When deploying
 * via Docker/K8s where env vars are set at runtime (not build time),
 * the inlined values are undefined. This module provides runtime access
 * via a <script> tag injected in layout.tsx that sets window.__ENV__.
 */

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

/**
 * Get a NEXT_PUBLIC_* environment variable at runtime.
 * - Server-side: reads from process.env (always available)
 * - Client-side: reads from window.__ENV__ (injected by layout.tsx),
 *   falls back to process.env (build-time inlined value)
 */
export function getPublicEnv(key: string): string | undefined {
  if (typeof window === 'undefined') {
    return process.env[key];
  }
  return window.__ENV__?.[key] || process.env[key] || undefined;
}
