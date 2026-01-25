'use client';

import { type FC, useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { type Editor } from '@tiptap/react';
import { cn } from '@/lib/utils';

export interface TiptapBubbleMenuProps {
  editor: Editor | null;
  onAIAction?: (action: string, selectedText: string) => Promise<void>;
}

interface AIActionDef {
  id: string;
  label: string;
  icon: string;
  gradient: string;
}

const AI_ACTIONS: AIActionDef[] = [
  { id: 'improve', label: 'Améliorer', icon: '✨', gradient: 'from-purple-500 to-pink-500' },
  { id: 'fix_grammar', label: 'Corriger', icon: '✓', gradient: 'from-green-500 to-emerald-500' },
  { id: 'simplify', label: 'Simplifier', icon: '⇥', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'expand', label: 'Développer', icon: '⇤', gradient: 'from-orange-500 to-amber-500' },
  { id: 'translate_en', label: 'EN', icon: '🇬🇧', gradient: 'from-indigo-500 to-blue-500' },
  { id: 'translate_fr', label: 'FR', icon: '🇫🇷', gradient: 'from-red-500 to-blue-500' },
];

/**
 * Modern bubble menu that appears when text is selected.
 * Shows AI action buttons with glass morphism design.
 */
export const TiptapBubbleMenu: FC<TiptapBubbleMenuProps> = ({ editor, onAIAction }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;

    const updateBubbleMenu = () => {
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to && !editor.state.selection.empty;

      // Don't show if already loading
      if (isLoading) return;

      setIsVisible(hasSelection);

      if (hasSelection) {
        try {
          // Use Tiptap's coordsAtPos for accurate positioning
          const startCoords = editor.view.coordsAtPos(from);
          const endCoords = editor.view.coordsAtPos(to);

          // Position above the selection, centered
          const centerX = (startCoords.left + endCoords.right) / 2;
          const top = startCoords.top - 10; // Above selection

          setPosition({
            top: top + window.scrollY,
            left: centerX,
          });
        } catch {
          // Fallback if coordsAtPos fails
          setIsVisible(false);
        }
      }
    };

    // Debounce to avoid flickering
    let timeout: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeout);
      timeout = setTimeout(updateBubbleMenu, 100);
    };

    editor.on('selectionUpdate', debouncedUpdate);
    editor.on('focus', debouncedUpdate);

    return () => {
      clearTimeout(timeout);
      editor.off('selectionUpdate', debouncedUpdate);
      editor.off('focus', debouncedUpdate);
    };
  }, [editor, isLoading]);

  const getSelectedText = useCallback(() => {
    if (!editor) return '';
    const { from, to } = editor.state.selection;
    return editor.state.doc.textBetween(from, to, ' ');
  }, [editor]);

  const handleAction = useCallback(async (actionId: string) => {
    if (!onAIAction) return;

    const text = getSelectedText();
    if (!text) return;

    setIsLoading(true);
    setLoadingAction(actionId);

    try {
      await onAIAction(actionId, text);
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
      setIsVisible(false);
    }
  }, [onAIAction, getSelectedText]);

  if (!editor || !isVisible || !onAIAction) {
    return null;
  }

  const menuContent = (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[9999] transform -translate-x-1/2 -translate-y-full",
        "animate-in fade-in zoom-in-95 duration-150"
      )}
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
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
            {AI_ACTIONS.map((action, index) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                disabled={isLoading}
                className={cn(
                  "group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl",
                  "text-sm font-medium transition-all duration-200",
                  "hover:bg-gradient-to-r hover:text-white",
                  `hover:${action.gradient}`,
                  "text-gray-700 dark:text-gray-300",
                  "hover:scale-105 hover:shadow-lg active:scale-95",
                  loadingAction === action.id && "opacity-50",
                  index === 0 && "bg-gradient-to-r from-purple-500/10 to-pink-500/10"
                )}
                title={action.label}
              >
                <span className="text-base transition-transform group-hover:scale-110">{action.icon}</span>
                <span className="hidden sm:inline text-xs">{action.label}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Arrow pointer */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full -mt-1">
        <div className={cn(
          "w-3 h-3 rotate-45",
          "bg-white/95 dark:bg-gray-900/95",
          "border-r border-b border-gray-200/50 dark:border-gray-700/50"
        )} />
      </div>
    </div>
  );

  // Render in portal for proper stacking
  if (typeof document !== 'undefined') {
    return createPortal(menuContent, document.body);
  }

  return null;
};

export default TiptapBubbleMenu;
