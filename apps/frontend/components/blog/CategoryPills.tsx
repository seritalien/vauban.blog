'use client';

import { useRef, useState, useEffect } from 'react';

interface CategoryPillsProps {
  categories: string[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
}

export default function CategoryPills({
  categories,
  selectedCategory,
  onSelect,
}: CategoryPillsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (!scrollRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftShadow(scrollLeft > 0);
      setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 1);
    };

    checkScroll();
    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [categories]);

  if (categories.length === 0) return null;

  return (
    <div className="relative mb-6">
      {/* Left shadow */}
      {showLeftShadow && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-900 to-transparent z-10 pointer-events-none" />
      )}

      {/* Right shadow */}
      {showRightShadow && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent z-10 pointer-events-none" />
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* All button */}
        <button
          onClick={() => onSelect(null)}
          className={`
            flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors
            ${!selectedCategory
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
        >
          All
        </button>

        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onSelect(category === selectedCategory ? null : category)}
            className={`
              flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors
              ${category === selectedCategory
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}
