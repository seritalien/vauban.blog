'use client';

import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useTiptapEditor } from './tiptap/useTiptapEditor';
import { TiptapEditorCore } from './tiptap/TiptapEditorCore';
import { TiptapToolbar } from './tiptap/TiptapToolbar';
import { TiptapBubbleMenu } from './tiptap/TiptapBubbleMenu';
import { MarkdownPreview } from './tiptap/MarkdownPreview';
import { useSyncScroll } from './tiptap/useSyncScroll';
import { performAIAction } from '@/lib/ai';
import { useToast } from '@/components/ui/Toast';

export interface TiptapSplitEditorHandle {
  /** Replace currently selected text with new text */
  replaceSelectedText: (newText: string) => void;
  /** Insert text at the end of the document */
  insertTextAtEnd: (text: string) => void;
  /** Get the currently selected text */
  getSelectedText: () => string;
}

export interface TiptapSplitEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  /** Callback when text selection changes */
  onSelectionChange?: (selectedText: string) => void;
}

/**
 * Tiptap editor with split-screen live preview.
 *
 * Features:
 * - Split-screen layout (editor | preview)
 * - Draggable resize divider
 * - Synchronized scrolling
 * - Full markdown support
 * - Rich text toolbar
 */
export const TiptapSplitEditor = forwardRef<TiptapSplitEditorHandle, TiptapSplitEditorProps>(({
  content,
  onChange,
  placeholder = 'Start writing your article...',
  editable = true,
  className = '',
  onSelectionChange,
}, ref) => {
  const [markdown, setMarkdown] = useState(content);
  const [editorWidth, setEditorWidth] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);

  const { editorRef, previewRef } = useSyncScroll();
  const { showToast } = useToast();

  const handleUpdate = useCallback(
    (newContent: string) => {
      setMarkdown(newContent);
      onChange(newContent);
    },
    [onChange]
  );

  // Create editor first (without AI handler)
  const editor = useTiptapEditor({
    content,
    placeholder,
    onUpdate: handleUpdate,
    editable,
  });

  // AI action handler (now can use editor safely)
  const handleAIAction = useCallback(
    async (action: string, selectedText?: string) => {
      if (!editor) return;

      try {
        const { from, to } = editor.state.selection;
        const textToProcess = selectedText || editor.state.doc.textBetween(from, to, ' ');

        if (!textToProcess && action !== 'continue') {
          showToast('Please select some text first', 'error');
          return;
        }

        // For 'continue' action, use the full content as context
        const contextText = action === 'continue' ? markdown : textToProcess;

        // Show loading toast
        showToast(`AI is ${action.replace('_', ' ')}...`, 'info');

        // Perform AI action
        const result = await performAIAction(action as any, contextText);

        // Check if AI action was successful
        if (!result.success) {
          showToast(result.error || 'AI action failed', 'error');
          return;
        }

        const aiContent = result.data;

        // Replace selected text with AI result
        if (selectedText || (from !== to)) {
          editor.chain().focus().deleteRange({ from, to }).insertContent(aiContent).run();
        } else {
          // For 'continue' action, insert at current cursor position
          editor.chain().focus().insertContent(' ' + aiContent).run();
        }

        showToast('AI action completed', 'success');
      } catch (error) {
        console.error('AI action failed:', error);
        showToast('AI action failed. Please try again.', 'error');
      }
    },
    [editor, markdown, showToast]
  );

  // Update editor options with AI handler
  useEffect(() => {
    if (editor && handleAIAction) {
      // Store the AI handler in editor storage for slash commands
      (editor as any).storage.aiHandler = handleAIAction;
    }
  }, [editor, handleAIAction]);

  // Track selection changes and notify parent
  useEffect(() => {
    if (!editor || !onSelectionChange) return;

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        onSelectionChange(text);
      } else {
        onSelectionChange('');
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    editor.on('focus', handleSelectionUpdate);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('focus', handleSelectionUpdate);
    };
  }, [editor, onSelectionChange]);

  // Expose imperative methods to parent via ref
  useImperativeHandle(ref, () => ({
    replaceSelectedText: (newText: string) => {
      if (!editor) return;
      const { from, to } = editor.state.selection;
      if (from !== to) {
        editor.chain().focus().deleteRange({ from, to }).insertContent(newText).run();
      }
    },
    insertTextAtEnd: (text: string) => {
      if (!editor) return;
      editor.chain().focus().insertContentAt(editor.state.doc.content.size, '\n\n' + text).run();
    },
    getSelectedText: () => {
      if (!editor) return '';
      const { from, to } = editor.state.selection;
      return editor.state.doc.textBetween(from, to, ' ');
    },
  }), [editor]);

  // Update markdown when content prop changes (for loading existing drafts/posts)
  useEffect(() => {
    if (content !== markdown && editor) {
      setMarkdown(content);
      editor.commands.setContent(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // Drag resize functionality
  const handleMouseDown = useCallback(() => {
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.getElementById('tiptap-split-container');
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp between 30% and 70%
      const clampedWidth = Math.max(30, Math.min(70, newWidth));
      setEditorWidth(clampedWidth);
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div
      id="tiptap-split-container"
      className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}
    >
      <TiptapToolbar editor={editor} />

      <div className="flex h-[600px]">
        {/* Editor Pane */}
        <div
          ref={editorRef}
          className="overflow-y-auto bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700"
          style={{ width: `${editorWidth}%` }}
        >
          <TiptapEditorCore editor={editor} />
          <TiptapBubbleMenu editor={editor} onAIAction={handleAIAction} />
        </div>

        {/* Drag Resizer */}
        <div
          className="w-1 bg-gray-200 dark:bg-gray-700 cursor-col-resize hover:bg-purple-500 transition-colors flex-shrink-0"
          onMouseDown={handleMouseDown}
          title="Drag to resize"
        />

        {/* Preview Pane */}
        <div
          ref={previewRef}
          className="overflow-y-auto bg-gray-50 dark:bg-gray-900"
          style={{ width: `${100 - editorWidth}%` }}
        >
          <div className="sticky top-0 z-10 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Preview
            </span>
          </div>
          <MarkdownPreview content={markdown} />
        </div>
      </div>
    </div>
  );
});

TiptapSplitEditor.displayName = 'TiptapSplitEditor';

export default TiptapSplitEditor;
