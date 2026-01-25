'use client';

import { type FC } from 'react';
import { useTiptapEditor } from './tiptap/useTiptapEditor';
import { TiptapEditorCore } from './tiptap/TiptapEditorCore';
import { TiptapToolbar } from './tiptap/TiptapToolbar';

export interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

/**
 * Main Tiptap editor wrapper component.
 * Combines toolbar and editor core.
 *
 * Features:
 * - Full markdown support (bidirectional serialization)
 * - Rich text formatting toolbar
 * - Keyboard shortcuts
 * - Syntax highlighting for code blocks
 * - Task lists, links, images
 * - Smart typography
 */
export const TiptapEditor: FC<TiptapEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing your article...',
  editable = true,
  className = '',
}) => {
  const editor = useTiptapEditor({
    content,
    placeholder,
    onUpdate: onChange,
    editable,
  });

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${className}`}>
      <TiptapToolbar editor={editor} />
      <div className="bg-white dark:bg-gray-900">
        <TiptapEditorCore editor={editor} />
      </div>
    </div>
  );
};

export default TiptapEditor;
