'use client';

import { useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Markdown } from 'tiptap-markdown';
import { createLowlight } from 'lowlight';
import { SlashCommand, getSuggestionConfig } from './extensions/SlashCommand';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';

// Create lowlight instance with common languages
const lowlight = createLowlight();
lowlight.register('typescript', typescript);
lowlight.register('javascript', javascript);
lowlight.register('python', python);
lowlight.register('bash', bash);
lowlight.register('json', json);
lowlight.register('css', css);
lowlight.register('html', html);

export interface UseTiptapEditorOptions {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  editable?: boolean;
}

/**
 * Hook to create and configure a Tiptap editor instance with full extensions.
 *
 * Features:
 * - Markdown support (bidirectional serialization)
 * - Rich text formatting (bold, italic, strike, code, etc.)
 * - Headings (h1-h4)
 * - Lists (ordered, unordered, task lists)
 * - Code blocks with syntax highlighting
 * - Links and images
 * - Smart typography (smart quotes, ellipsis, dashes)
 * - Highlight and underline
 */
export function useTiptapEditor({
  content = '',
  placeholder = 'Type / for commands...',
  onUpdate,
  editable = true,
}: UseTiptapEditorOptions = {}): Editor | null {
  const editor = useEditor({
    immediatelyRender: false, // Fix SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        codeBlock: false, // Use CodeBlockLowlight instead
        heading: {
          levels: [1, 2, 3, 4],
        },
        history: {
          depth: 100,
        },
      }),
      Typography,
      Placeholder.configure({
        placeholder,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors',
        },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
        HTMLAttributes: {
          class: 'rounded-lg bg-gray-900 dark:bg-gray-950 p-4 overflow-x-auto',
        },
      }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      SlashCommand.configure({
        suggestion: getSuggestionConfig(),
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        // Get markdown from editor
        const markdown = editor.storage.markdown.getMarkdown();
        onUpdate(markdown);
      }
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] p-8',
      },
    },
  });

  return editor;
}

/**
 * Get markdown content from editor
 */
export function getMarkdownFromEditor(editor: Editor | null): string {
  if (!editor) return '';
  return editor.storage.markdown.getMarkdown();
}

/**
 * Set markdown content to editor
 */
export function setMarkdownToEditor(editor: Editor | null, markdown: string): void {
  if (!editor) return;
  editor.commands.setContent(markdown);
}
