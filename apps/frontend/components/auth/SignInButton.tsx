'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface SignInButtonProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

/**
 * Sign in button that links to the sign-in page
 *
 * @example
 * ```tsx
 * <SignInButton size="md" />
 * ```
 */
export default function SignInButton({
  size = 'md',
  className = '',
}: SignInButtonProps) {
  const { status } = useSession();

  // Don't show if already authenticated
  if (status === 'authenticated') {
    return null;
  }

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };

  return (
    <Link
      href="/auth/signin"
      className={`
        inline-flex items-center justify-center
        ${sizeClasses[size]}
        bg-blue-600 hover:bg-blue-700
        text-white font-medium
        rounded-full
        transition-colors
        ${className}
      `}
    >
      Sign in
    </Link>
  );
}
