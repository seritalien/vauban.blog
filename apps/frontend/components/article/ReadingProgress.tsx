'use client';

import { useState, useEffect, type FC } from 'react';

export interface ReadingProgressProps {
  /** Target element to track (defaults to article) */
  targetSelector?: string;
  /** Color of the progress bar */
  color?: string;
  /** Height of the progress bar */
  height?: number;
  /** Show percentage text */
  showPercentage?: boolean;
}

/**
 * Reading progress indicator that shows how far through an article the user has scrolled.
 * Displays as a fixed bar at the top of the viewport.
 */
export const ReadingProgress: FC<ReadingProgressProps> = ({
  targetSelector = 'article',
  color = 'bg-gradient-to-r from-purple-500 to-blue-500',
  height = 3,
  showPercentage = false,
}) => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateProgress = () => {
      const target = document.querySelector(targetSelector);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const scrollTop = window.scrollY;
      const docHeight = target.scrollHeight;
      const winHeight = window.innerHeight;

      // Calculate progress based on how much of the article has been scrolled past
      const scrolled = scrollTop - (rect.top + scrollTop - winHeight * 0.3);
      const total = docHeight - winHeight * 0.5;
      const percentage = Math.min(100, Math.max(0, (scrolled / total) * 100));

      setProgress(percentage);
      setIsVisible(scrollTop > 100);
    };

    // Initial calculation
    updateProgress();

    // Update on scroll
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, [targetSelector]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50"
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Reading progress"
    >
      <div
        className={`h-full ${color} transition-all duration-150 ease-out`}
        style={{ width: `${progress}%` }}
      />
      {showPercentage && progress > 0 && (
        <span className="absolute right-2 top-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-gray-900/80 px-1 rounded">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  );
};

export default ReadingProgress;
