'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { getProfile, getDisplayName, formatAddress, toAddressString } from '@/lib/profiles';
import type { AuthorProfile } from '@vauban/shared-types';

interface AuthorDisplayProps {
  address: string | bigint | unknown;
  profile?: AuthorProfile | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showAvatar?: boolean;
  linkToProfile?: boolean;
  className?: string;
}

// Generate a consistent gradient background from an address
function generateAvatarGradient(address: string): string {
  const hash = address.slice(2, 10); // Use first 8 hex chars after 0x
  const hue1 = parseInt(hash.slice(0, 2), 16) % 360;
  const hue2 = (hue1 + 40 + (parseInt(hash.slice(2, 4), 16) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 50%))`;
}

// Generate initials from display name or address
function getInitials(displayName: string, address: string): string {
  if (displayName && !displayName.startsWith('0x')) {
    // Use first letter of each word (max 2)
    const words = displayName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return displayName.slice(0, 2).toUpperCase();
  }
  // Use first 2 chars after 0x for addresses
  return address.slice(2, 4).toUpperCase();
}

const sizeClasses = {
  xs: { avatar: 'w-5 h-5 text-[8px]', text: 'text-xs' },
  sm: { avatar: 'w-6 h-6 text-[10px]', text: 'text-sm' },
  md: { avatar: 'w-8 h-8 text-xs', text: 'text-sm' },
  lg: { avatar: 'w-10 h-10 text-sm', text: 'text-base' },
};

/**
 * Reusable component for displaying author information consistently.
 * Shows avatar (custom or generated gradient) + display name or formatted address.
 */
export default function AuthorDisplay({
  address,
  profile: providedProfile,
  size = 'sm',
  showAvatar = true,
  linkToProfile = true,
  className = '',
}: AuthorDisplayProps) {
  const addressStr = toAddressString(address);

  // Fetch profile if not provided
  const profile = useMemo(() => {
    if (providedProfile !== undefined) return providedProfile;
    return getProfile(addressStr);
  }, [addressStr, providedProfile]);

  const displayName = getDisplayName(addressStr, profile);
  const shortAddress = formatAddress(addressStr);
  const hasCustomName = profile?.displayName && !profile.displayName.startsWith('0x');

  const sizes = sizeClasses[size];
  const gradient = generateAvatarGradient(addressStr);
  const initials = getInitials(displayName, addressStr);

  const content = (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {showAvatar && (
        <span
          className={`${sizes.avatar} rounded-full flex items-center justify-center text-white font-medium shrink-0 overflow-hidden`}
          style={{ background: profile?.avatar ? undefined : gradient }}
        >
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </span>
      )}
      <span className={`${sizes.text} font-medium text-gray-700 dark:text-gray-300`}>
        {displayName}
      </span>
      {hasCustomName && (
        <span className={`${sizes.text} text-gray-400 dark:text-gray-500`}>
          ({shortAddress})
        </span>
      )}
    </span>
  );

  if (linkToProfile && addressStr) {
    return (
      <Link
        href={`/authors/${addressStr}`}
        className="hover:opacity-80 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}
