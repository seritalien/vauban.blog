'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/providers/wallet-provider';

interface MessageUserButtonProps {
  /** Address of the user to message */
  recipientAddress: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show label text */
  showLabel?: boolean;
  /** Custom class name */
  className?: string;
  /** Optional onClick override */
  onClick?: () => void;
}

/**
 * Button to initiate a message conversation with a user.
 *
 * Navigates to /messages?to=address to start or continue a conversation.
 *
 * @example
 * ```tsx
 * <MessageUserButton recipientAddress="0x123..." />
 * <MessageUserButton recipientAddress="0x123..." size="sm" showLabel={false} />
 * ```
 */
export default function MessageUserButton({
  recipientAddress,
  size = 'md',
  showLabel = true,
  className = '',
  onClick,
}: MessageUserButtonProps) {
  const router = useRouter();
  const { address, isConnected } = useWallet();

  // Don't show button for own profile
  if (address?.toLowerCase() === recipientAddress.toLowerCase()) {
    return null;
  }

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }

    if (!isConnected) {
      router.push('/auth/signin?redirect=/messages');
      return;
    }

    // Navigate to messages with recipient pre-selected
    router.push(`/messages?to=${recipientAddress}`);
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-5 h-5',
  };

  return (
    <button
      onClick={handleClick}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses[size]}
        font-medium rounded-full
        bg-gray-100 hover:bg-gray-200
        dark:bg-gray-800 dark:hover:bg-gray-700
        text-gray-700 dark:text-gray-300
        transition-colors
        ${className}
      `}
      title="Envoyer un message"
    >
      <svg
        className={iconSizes[size]}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
      {showLabel && <span>Message</span>}
    </button>
  );
}
