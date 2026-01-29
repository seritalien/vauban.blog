'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type ScrollDirection = 'up' | 'down' | 'top';

/**
 * Hook to detect scroll direction.
 * Returns:
 * - 'top': When scrollY < threshold (near top of page)
 * - 'down': When scrolling down
 * - 'up': When scrolling up
 *
 * Uses refs internally to avoid re-registering the scroll listener
 * on every scroll event. Only re-renders when the direction changes.
 */
export function useScrollDirection(threshold = 50): ScrollDirection {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('top');
  const lastScrollY = useRef(0);
  const directionRef = useRef<ScrollDirection>('top');

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const prevScrollY = lastScrollY.current;
    const currentDirection = directionRef.current;

    let newDirection: ScrollDirection | null = null;

    // Near top of page
    if (currentScrollY < threshold) {
      if (currentDirection !== 'top') {
        newDirection = 'top';
      }
    }
    // Scrolling down
    else if (currentScrollY > prevScrollY && currentDirection !== 'down') {
      newDirection = 'down';
    }
    // Scrolling up
    else if (currentScrollY < prevScrollY && currentDirection !== 'up') {
      newDirection = 'up';
    }

    lastScrollY.current = currentScrollY;

    if (newDirection !== null) {
      directionRef.current = newDirection;
      setScrollDirection(newDirection);
    }
  }, [threshold]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return scrollDirection;
}
