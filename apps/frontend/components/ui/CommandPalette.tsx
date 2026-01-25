'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type FC,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogPanel, DialogBackdrop } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import Fuse from 'fuse.js';
import { useAllArticles } from '@/hooks/useArticles';
import { useTheme } from '@/providers/theme-provider';
import { performAIAction } from '@/lib/ai';

interface Command {
  id: string;
  name: string;
  description?: string;
  icon: string;
  shortcut?: string;
  action: () => void;
  category?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  customCommands?: Command[];
  onAIAction?: (action: string, text?: string) => void;
}

/**
 * Command palette with keyboard navigation (Cmd+K).
 * Features:
 * 1. Navigation - Navigate to pages
 * 2. Search Articles - Fuzzy search with Fuse.js
 * 3. AI Actions - Improve, fix grammar, generate content
 * 4. Settings - Theme, AI provider config
 */
export const CommandPalette: FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  customCommands = [],
  onAIAction,
}) => {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { articles, isLoading: articlesLoading } = useAllArticles();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fuse.js configuration for fuzzy search
  const fuse = useMemo(() => {
    if (!articles || articles.length === 0) return null;

    return new Fuse(articles, {
      keys: ['title', 'excerpt', 'tags'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [articles]);

  // Navigation commands
  const navigationCommands: Command[] = [
    {
      id: 'home',
      name: 'Go Home',
      description: 'Navigate to homepage',
      icon: '🏠',
      action: () => router.push('/'),
      category: 'Navigation',
    },
    {
      id: 'new-article',
      name: 'New Article',
      description: 'Create a new blog post',
      icon: '📝',
      action: () => router.push('/admin'),
      category: 'Navigation',
    },
    {
      id: 'drafts',
      name: 'Drafts',
      description: 'View your draft articles',
      icon: '📄',
      action: () => router.push('/admin/drafts'),
      category: 'Navigation',
    },
    {
      id: 'profile',
      name: 'My Profile',
      description: 'View your profile',
      icon: '👤',
      action: () => router.push('/profile'),
      category: 'Navigation',
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      description: 'View your dashboard',
      icon: '📊',
      action: () => router.push('/dashboard'),
      category: 'Navigation',
    },
  ];

  // AI action commands
  const aiCommands: Command[] = [
    {
      id: 'ai-improve',
      name: 'AI: Improve Text',
      description: 'Enhance selected text or current content',
      icon: '✨',
      action: async () => {
        if (onAIAction) {
          setIsProcessing(true);
          try {
            await onAIAction('improve');
          } finally {
            setIsProcessing(false);
          }
        }
      },
      category: 'AI Actions',
    },
    {
      id: 'ai-grammar',
      name: 'AI: Fix Grammar',
      description: 'Correct grammar and spelling',
      icon: '✓',
      action: async () => {
        if (onAIAction) {
          setIsProcessing(true);
          try {
            await onAIAction('fix_grammar');
          } finally {
            setIsProcessing(false);
          }
        }
      },
      category: 'AI Actions',
    },
    {
      id: 'ai-title',
      name: 'AI: Generate Title',
      description: 'Generate a title from content',
      icon: '🏷️',
      action: async () => {
        if (onAIAction) {
          setIsProcessing(true);
          try {
            await onAIAction('generate_title');
          } finally {
            setIsProcessing(false);
          }
        }
      },
      category: 'AI Actions',
    },
    {
      id: 'ai-tags',
      name: 'AI: Generate Tags',
      description: 'Generate tags from content',
      icon: '🔖',
      action: async () => {
        if (onAIAction) {
          setIsProcessing(true);
          try {
            await onAIAction('generate_tags');
          } finally {
            setIsProcessing(false);
          }
        }
      },
      category: 'AI Actions',
    },
  ];

  // Settings commands
  const settingsCommands: Command[] = [
    {
      id: 'toggle-theme',
      name: 'Toggle Theme',
      description: `Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`,
      icon: resolvedTheme === 'dark' ? '☀️' : '🌙',
      action: () => toggleTheme(),
      category: 'Settings',
    },
    {
      id: 'ai-settings',
      name: 'AI Settings',
      description: 'Configure AI provider and models',
      icon: '⚙️',
      action: () => router.push('/admin/settings#ai'),
      category: 'Settings',
    },
  ];

  const defaultCommands: Command[] = [
    ...navigationCommands,
    ...aiCommands,
    ...settingsCommands,
  ];

  const allCommands = [...defaultCommands, ...customCommands];

  // Fuzzy search for articles (only when query exists and is search-like)
  const articleResults = useMemo(() => {
    if (!query || !fuse) return [];

    const results = fuse.search(query).slice(0, 5); // Top 5 results
    return results.map((result) => ({
      id: `article-${result.item.id}`,
      name: result.item.title,
      description: result.item.excerpt || result.item.tags?.join(', '),
      icon: '📰',
      action: () => router.push(`/articles/${result.item.slug || result.item.id}`),
      category: 'Search Results',
    }));
  }, [query, fuse, router]);

  // Filter commands by query
  const filteredDefaultCommands = query
    ? allCommands.filter(
        (cmd) =>
          cmd.name.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands;

  // Combine article search results and commands
  const filteredCommands = query && articleResults.length > 0
    ? [...articleResults, ...filteredDefaultCommands]
    : filteredDefaultCommands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      const category = cmd.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(cmd);
      return acc;
    },
    {} as Record<string, Command[]>
  );

  const flattenedCommands = Object.values(groupedCommands).flat();

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < flattenedCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : flattenedCommands.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (flattenedCommands[selectedIndex]) {
            flattenedCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [flattenedCommands, selectedIndex, onClose]
  );

  const executeCommand = async (command: Command) => {
    await command.action();
    // Only close if not processing (AI actions stay open to show progress)
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog open={isOpen} onClose={onClose} className="relative z-50">
          <DialogBackdrop
            as={motion.div}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          <div className="fixed inset-0 overflow-y-auto p-4 pt-[20vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'tween', duration: 0.15 }}
            >
            <DialogPanel
              className="mx-auto max-w-xl overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5"
            >
              {/* Search input */}
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={isProcessing ? "Processing AI action..." : "Type a command or search..."}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isProcessing}
                  className="w-full border-0 bg-transparent py-4 pl-12 pr-4 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:opacity-50"
                />
                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="border-t border-gray-200 dark:border-gray-700 max-h-80 overflow-auto">
                {flattenedCommands.length === 0 ? (
                  <div className="py-8 text-center text-gray-500">
                    No commands found for &quot;{query}&quot;
                  </div>
                ) : (
                  <div className="py-2">
                    {Object.entries(groupedCommands).map(
                      ([category, commands]) => (
                        <div key={category}>
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {category}
                          </div>
                          {commands.map((command) => {
                            const index = flattenedCommands.indexOf(command);
                            const isSelected = index === selectedIndex;

                            return (
                              <button
                                key={command.id}
                                onClick={() => executeCommand(command)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`
                                  w-full flex items-center gap-3 px-4 py-2 text-left
                                  transition-colors duration-75
                                  ${
                                    isSelected
                                      ? 'bg-purple-50 dark:bg-purple-900/20'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                  }
                                `}
                              >
                                <span className="text-xl">{command.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={`text-sm font-medium ${
                                      isSelected
                                        ? 'text-purple-600 dark:text-purple-400'
                                        : 'text-gray-900 dark:text-white'
                                    }`}
                                  >
                                    {command.name}
                                  </p>
                                  {command.description && (
                                    <p className="text-xs text-gray-500 truncate">
                                      {command.description}
                                    </p>
                                  )}
                                </div>
                                {command.shortcut && (
                                  <kbd className="px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">
                                    {command.shortcut}
                                  </kbd>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                      ↑↓
                    </kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                      ↵
                    </kbd>
                    Select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                      esc
                    </kbd>
                    Close
                  </span>
                </div>
              </div>
            </DialogPanel>
            </motion.div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook to manage command palette state with keyboard shortcut.
 */
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
};

export default CommandPalette;
