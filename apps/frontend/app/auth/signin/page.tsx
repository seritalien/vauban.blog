'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function SignInPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: string) => {
    setIsLoading(provider);
    setError(null);

    try {
      await signIn(provider, { callbackUrl: '/feed' });
    } catch {
      setError('Failed to sign in. Please try again.');
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center border-b border-gray-200 dark:border-gray-700">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Vauban
              </h1>
            </Link>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Sign in to join the decentralized conversation
            </p>
          </div>

          {/* OAuth Buttons */}
          <div className="p-8 space-y-4">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm text-center"
              >
                {error}
              </motion.div>
            )}

            {/* GitHub */}
            <button
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading !== null}
              className="
                w-full flex items-center justify-center gap-3
                px-4 py-3
                bg-gray-900 dark:bg-white
                text-white dark:text-gray-900
                font-medium rounded-lg
                hover:bg-gray-800 dark:hover:bg-gray-100
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isLoading === 'github' ? (
                <Spinner />
              ) : (
                <GitHubIcon className="w-5 h-5" />
              )}
              Continue with GitHub
            </button>

            {/* Google */}
            <button
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading !== null}
              className="
                w-full flex items-center justify-center gap-3
                px-4 py-3
                bg-white dark:bg-gray-700
                text-gray-900 dark:text-white
                font-medium rounded-lg
                border border-gray-300 dark:border-gray-600
                hover:bg-gray-50 dark:hover:bg-gray-600
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isLoading === 'google' ? (
                <Spinner />
              ) : (
                <GoogleIcon className="w-5 h-5" />
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  or connect your wallet
                </span>
              </div>
            </div>

            {/* Wallet Connect Info */}
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Already have a Starknet wallet?
              </p>
              <Link
                href="/"
                className="mt-2 inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:underline"
              >
                <WalletIcon className="w-4 h-4" />
                Connect with ArgentX or Braavos
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-4">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="text-lg">🔐</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Secure & Private
            </p>
          </div>
          <div className="p-4">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <span className="text-lg">⛓️</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              On-chain Ownership
            </p>
          </div>
          <div className="p-4">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <span className="text-lg">🆓</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Gasless Interactions
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================================================
// ICONS
// =============================================================================

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}
