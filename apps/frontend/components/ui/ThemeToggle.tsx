'use client';

import { useState, useEffect, type FC } from 'react';
import { motion } from 'framer-motion';

interface ThemeToggleProps {
  className?: string;
}

/**
 * Animated theme toggle switch with sun/moon icons.
 */
export const ThemeToggle: FC<ThemeToggleProps> = ({ className = '' }) => {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Check initial theme on mount
  useEffect(() => {
    setMounted(true);
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);

    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`w-14 h-7 rounded-full bg-gray-200 dark:bg-gray-700 ${className}`} />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative w-14 h-7 rounded-full transition-colors duration-300
        ${isDark ? 'bg-purple-600' : 'bg-gray-200'}
        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        dark:focus:ring-offset-gray-900
        ${className}
      `}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <motion.div
        className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
        animate={{ left: isDark ? 'calc(100% - 24px)' : '4px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 180 }}
          transition={{ duration: 0.2 }}
          className="text-xs"
        >
          {isDark ? '🌙' : '☀️'}
        </motion.span>
      </motion.div>
    </button>
  );
};

export default ThemeToggle;
