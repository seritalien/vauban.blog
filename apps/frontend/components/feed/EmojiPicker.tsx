'use client';

import { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😎', '🤔', '😏', '😢', '😭', '😤', '🤯', '🥳', '😴', '🤗', '🙄', '😬', '🫡'],
  },
  {
    name: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '💪', '✌️', '🤞', '👋', '🫶', '❤️', '🔥', '⭐', '💯', '✨', '🎉', '🚀', '💡', '🎯', '🏆'],
  },
  {
    name: 'Nature',
    emojis: ['🌍', '🌙', '☀️', '🌈', '⚡', '🌊', '🌸', '🍀', '🌿', '🐱', '🐶', '🦋', '🐝', '🦊', '🐻', '🦁', '🐸', '🐙', '🦄', '🐧'],
  },
  {
    name: 'Objects',
    emojis: ['📱', '💻', '⌨️', '📸', '🎵', '🎮', '📚', '✏️', '🔑', '🛡️', '⚙️', '🔔', '📌', '🏷️', '📊', '🗂️', '📝', '🔗', '💬', '📣'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
        title="Ajouter un emoji"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50">
          {/* Category tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-2 pt-2">
            {EMOJI_CATEGORIES.map((cat, idx) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setActiveCategory(idx)}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-t transition-colors ${
                  activeCategory === idx
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="p-2 grid grid-cols-10 gap-0.5 max-h-40 overflow-y-auto">
            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onSelect(emoji);
                  setIsOpen(false);
                }}
                className="w-7 h-7 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
