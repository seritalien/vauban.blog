'use client';

import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { createPortal } from 'react-dom';
import { performAIAction, type AIAction } from '@/lib/ai';
import { getAIConfig } from '@/lib/ai-config';
import { cn } from '@/lib/utils';

export interface FloatingAIToolbarProps {
  /** Selected text to process */
  selectedText: string;
  /** Position of the selection (for toolbar placement) */
  selectionRect: DOMRect | null;
  /** Full content (for context) */
  fullContent?: string;
  /** Callback when AI replaces selected text */
  onReplaceText: (newText: string) => void;
  /** Callback when AI inserts text after selection */
  onInsertAfter?: (newText: string) => void;
  /** Callback to close the toolbar */
  onClose: () => void;
  /** Container element for positioning */
  containerRef?: React.RefObject<HTMLElement | null>;
}

interface AIActionButton {
  action: AIAction;
  label: string;
  shortLabel: string;
  icon: string;
  gradient: string;
  description: string;
}

// Modern 2026 style AI actions with gradients
const AI_ACTIONS: AIActionButton[] = [
  {
    action: 'improve',
    label: 'Améliorer',
    shortLabel: 'Improve',
    icon: '✨',
    gradient: 'from-purple-500 to-pink-500',
    description: 'Améliore le style et la clarté',
  },
  {
    action: 'fix_grammar',
    label: 'Corriger',
    shortLabel: 'Fix',
    icon: '✓',
    gradient: 'from-green-500 to-emerald-500',
    description: 'Corrige orthographe et grammaire',
  },
  {
    action: 'simplify',
    label: 'Simplifier',
    shortLabel: 'Simple',
    icon: '⇥',
    gradient: 'from-blue-500 to-cyan-500',
    description: 'Rend le texte plus concis',
  },
  {
    action: 'expand',
    label: 'Développer',
    shortLabel: 'Expand',
    icon: '⇤',
    gradient: 'from-orange-500 to-amber-500',
    description: 'Enrichit avec plus de détails',
  },
  {
    action: 'translate_en',
    label: 'Anglais',
    shortLabel: 'EN',
    icon: '🇬🇧',
    gradient: 'from-indigo-500 to-blue-500',
    description: 'Traduit en anglais',
  },
  {
    action: 'translate_fr',
    label: 'Français',
    shortLabel: 'FR',
    icon: '🇫🇷',
    gradient: 'from-red-500 to-blue-500',
    description: 'Traduit en français',
  },
];

/**
 * Floating toolbar that appears on text selection with AI actions.
 * Provides quick access to text transformation features.
 */
export const FloatingAIToolbar: FC<FloatingAIToolbarProps> = ({
  selectedText,
  selectionRect,
  // fullContent - Reserved for future context-aware AI
  onReplaceText,
  onInsertAfter,
  onClose,
  containerRef,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<AIAction | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Calculate toolbar position
  useEffect(() => {
    if (!selectionRect) {
      setPosition(null);
      return;
    }

    const container = containerRef?.current;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    let top = selectionRect.top + scrollTop - 10; // Above the selection
    let left = selectionRect.left + scrollLeft + selectionRect.width / 2;

    // Adjust if toolbar would go above viewport
    if (top < scrollTop + 60) {
      top = selectionRect.bottom + scrollTop + 10; // Below the selection
    }

    // Adjust for container offset
    if (container) {
      const containerRect = container.getBoundingClientRect();
      left = Math.max(containerRect.left + 20, Math.min(left, containerRect.right - 200));
    }

    setPosition({ top, left });
  }, [selectionRect, containerRef]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        if (!result) {
          onClose();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, result]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAction = useCallback(async (action: AIAction) => {
    if (!selectedText.trim()) return;

    setIsLoading(true);
    setCurrentAction(action);
    setError(null);
    setResult(null);

    try {
      const config = getAIConfig();
      const response = await performAIAction(
        action,
        selectedText,
        {
          provider: config.textProvider,
          model: config.textModel,
        }
      );

      if (response.success && response.data) {
        setResult(response.data.trim());
      } else if (!response.success) {
        setError(response.error || 'Failed to process text');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedText]);

  const handleApply = useCallback(() => {
    if (result) {
      onReplaceText(result);
      onClose();
    }
  }, [result, onReplaceText, onClose]);

  const handleInsertAfter = useCallback(() => {
    if (result && onInsertAfter) {
      onInsertAfter(result);
      onClose();
    }
  }, [result, onInsertAfter, onClose]);

  const handleRetry = useCallback(() => {
    if (currentAction) {
      handleAction(currentAction);
    }
  }, [currentAction, handleAction]);

  // Don't render if no selection or position
  if (!selectedText || !position) {
    return null;
  }

  const toolbarContent = (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed z-50 transform -translate-x-1/2",
        "animate-in fade-in zoom-in-95 duration-150"
      )}
      style={{ top: position.top, left: position.left }}
    >
      {/* Main toolbar - Modern glass morphism style */}
      {!result && !error && (
        <div className={cn(
          "flex items-center gap-0.5 p-1.5",
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl",
          "rounded-2xl shadow-2xl shadow-purple-500/10 dark:shadow-black/30",
          "border border-gray-200/50 dark:border-gray-700/50",
          "ring-1 ring-black/5 dark:ring-white/5"
        )}>
          {isLoading ? (
            <div className="flex items-center gap-3 px-4 py-2">
              <div className="relative">
                <div className="w-5 h-5 border-2 border-purple-500/30 rounded-full" />
                <div className="absolute top-0 left-0 w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <span className="text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                IA en action...
              </span>
            </div>
          ) : (
            <>
              {AI_ACTIONS.map((item, index) => (
                <button
                  key={item.action}
                  onClick={() => handleAction(item.action)}
                  className={cn(
                    "group relative flex items-center gap-1.5 px-3 py-2 rounded-xl",
                    "text-sm font-medium transition-all duration-200",
                    "hover:bg-gradient-to-r hover:text-white",
                    `hover:${item.gradient}`,
                    "text-gray-700 dark:text-gray-300",
                    "hover:scale-105 hover:shadow-lg active:scale-95",
                    index === 0 && "bg-gradient-to-r from-purple-500/10 to-pink-500/10"
                  )}
                  title={item.description}
                >
                  <span className="text-base transition-transform group-hover:scale-110">{item.icon}</span>
                  <span className="hidden md:inline">{item.shortLabel}</span>

                  {/* Tooltip */}
                  <span className={cn(
                    "absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1",
                    "text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg",
                    "opacity-0 group-hover:opacity-100 transition-all duration-200",
                    "pointer-events-none whitespace-nowrap shadow-lg",
                    "translate-y-1 group-hover:translate-y-0"
                  )}>
                    {item.label}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                  </span>
                </button>
              ))}

              {/* Divider */}
              <div className="w-px h-8 bg-gradient-to-b from-transparent via-gray-300 dark:via-gray-600 to-transparent mx-1" />

              {/* Close button */}
              <button
                onClick={onClose}
                className={cn(
                  "p-2 rounded-xl text-gray-400 dark:text-gray-500",
                  "hover:text-gray-600 dark:hover:text-gray-300",
                  "hover:bg-gray-100 dark:hover:bg-gray-800",
                  "transition-all duration-200"
                )}
                title="Fermer (Esc)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Result panel - Modern card with glass effect */}
      {result && (
        <div className={cn(
          "w-[420px] max-w-[90vw] p-5",
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl",
          "rounded-2xl shadow-2xl shadow-green-500/10 dark:shadow-black/30",
          "border border-green-200/50 dark:border-green-800/50",
          "animate-in fade-in slide-in-from-top-2 duration-200"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900 dark:text-white">Suggestion IA</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Original text preview */}
          <details className="mb-4 group">
            <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Texte original ({selectedText.length} caractères)
            </summary>
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
              {selectedText}
            </div>
          </details>

          {/* Result with highlight effect */}
          <div className={cn(
            "p-4 rounded-xl mb-4",
            "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20",
            "border border-green-200 dark:border-green-800/50"
          )}>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {result}
            </p>
          </div>

          {/* Action buttons - Modern pill style */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl",
                "bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium",
                "hover:from-green-600 hover:to-emerald-600",
                "shadow-lg shadow-green-500/25 hover:shadow-green-500/40",
                "transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Remplacer
            </button>

            {onInsertAfter && (
              <button
                onClick={handleInsertAfter}
                className={cn(
                  "p-3 rounded-xl",
                  "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
                  "hover:bg-blue-200 dark:hover:bg-blue-800/40",
                  "transition-all duration-200"
                )}
                title="Insérer après la sélection"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}

            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className={cn(
                "p-3 rounded-xl",
                "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                "hover:bg-gray-200 dark:hover:bg-gray-700",
                "transition-all duration-200"
              )}
              title="Copier"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>

            <button
              onClick={handleRetry}
              className={cn(
                "p-3 rounded-xl",
                "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                "hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400",
                "transition-all duration-200"
              )}
              title="Régénérer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error panel - Modern style */}
      {error && (
        <div className={cn(
          "w-80 p-4",
          "bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl",
          "rounded-2xl shadow-2xl shadow-red-500/10 dark:shadow-black/30",
          "border border-red-200/50 dark:border-red-800/50",
          "animate-in fade-in slide-in-from-top-2 duration-200"
        )}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-500 to-rose-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRetry}
              className={cn(
                "flex-1 py-2.5 rounded-xl font-medium",
                "bg-gradient-to-r from-red-500 to-rose-500 text-white",
                "hover:from-red-600 hover:to-rose-600",
                "transition-all duration-200"
              )}
            >
              Réessayer
            </button>
            <button
              onClick={onClose}
              className={cn(
                "px-4 py-2.5 rounded-xl",
                "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
                "hover:bg-gray-200 dark:hover:bg-gray-700",
                "transition-all duration-200"
              )}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Arrow pointer - Modern style */}
      {!result && !error && (
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2">
          <div className={cn(
            "w-4 h-4 rotate-45",
            "bg-white/95 dark:bg-gray-900/95",
            "border-r border-b border-gray-200/50 dark:border-gray-700/50",
            "shadow-lg"
          )} />
        </div>
      )}
    </div>
  );

  // Render in portal for proper stacking
  if (typeof document !== 'undefined') {
    return createPortal(toolbarContent, document.body);
  }

  return null;
};

export default FloatingAIToolbar;
