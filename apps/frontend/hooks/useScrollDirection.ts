'use client';

import { useState, useEffect } from 'react';

export type ScrollDirection = 'up' | 'down' | 'top';

/**
 * Hook to detect scroll direction.
 * Returns:
 * - 'top': When scrollY < 50px (near top of page)
 * - 'down': When scrolling down
 * - 'up': When scrolling up
 */
export function useScrollDirection(threshold = 50): ScrollDirection {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('top');
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Near top of page
      if (currentScrollY < threshold) {
        setScrollDirection('top');
      }
      // Scrolling down
      else if (currentScrollY > lastScrollY && scrollDirection !== 'down') {
        setScrollDirection('down');
      }
      // Scrolling up
      else if (currentScrollY < lastScrollY && scrollDirection !== 'up') {
        setScrollDirection('up');
      }

      setLastScrollY(currentScrollY);
    };

    // Add event listener with passive flag for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Check initial state
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, scrollDirection, threshold]);

  return scrollDirection;
}
