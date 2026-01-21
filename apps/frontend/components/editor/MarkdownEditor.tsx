'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type RefObject,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { InlineImageUpload } from './ImageUpload';

// Toolbar button configuration
interface ToolbarButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: 'wrap' | 'prefix' | 'insert';
  syntax: string;
  endSyntax?: string;
  placeholder?: string;
  shortcut?: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    id: 'bold',
    label: 'Bold',
    icon: <span className="font-bold">B</span>,
    action: 'wrap',
    syntax: '**',
    placeholder: 'bold text',
    shortcut: 'Ctrl+B',
  },
  {
    id: 'italic',
    label: 'Italic',
    icon: <span className="italic">I</span>,
    action: 'wrap',
    syntax: '*',
    placeholder: 'italic text',
    shortcut: 'Ctrl+I',
  },
  {
    id: 'strikethrough',
    label: 'Strikethrough',
    icon: <span className="line-through">S</span>,
    action: 'wrap',
    syntax: '~~',
    placeholder: 'strikethrough text',
  },
  {
    id: 'divider1',
    label: '',
    icon: null,
    action: 'insert',
    syntax: '',
  },
  {
    id: 'h1',
    label: 'Heading 1',
    icon: <span className="font-bold text-sm">H1</span>,
    action: 'prefix',
    syntax: '# ',
    placeholder: 'Heading 1',
  },
  {
    id: 'h2',
    label: 'Heading 2',
    icon: <span className="font-bold text-sm">H2</span>,
    action: 'prefix',
    syntax: '## ',
    placeholder: 'Heading 2',
  },
  {
    id: 'h3',
    label: 'Heading 3',
    icon: <span className="font-bold text-sm">H3</span>,
    action: 'prefix',
    syntax: '### ',
    placeholder: 'Heading 3',
  },
  {
    id: 'divider2',
    label: '',
    icon: null,
    action: 'insert',
    syntax: '',
  },
  {
    id: 'bullet-list',
    label: 'Bullet List',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="2" cy="6" r="1" fill="currentColor" />
        <circle cx="2" cy="12" r="1" fill="currentColor" />
        <circle cx="2" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
    action: 'prefix',
    syntax: '- ',
    placeholder: 'List item',
  },
  {
    id: 'numbered-list',
    label: 'Numbered List',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h13M7 12h13M7 18h13" />
        <text x="1" y="8" className="text-[8px]" fill="currentColor">1</text>
        <text x="1" y="14" className="text-[8px]" fill="currentColor">2</text>
        <text x="1" y="20" className="text-[8px]" fill="currentColor">3</text>
      </svg>
    ),
    action: 'prefix',
    syntax: '1. ',
    placeholder: 'List item',
  },
  {
    id: 'divider3',
    label: '',
    icon: null,
    action: 'insert',
    syntax: '',
  },
  {
    id: 'inline-code',
    label: 'Inline Code',
    icon: <span className="font-mono text-sm">`</span>,
    action: 'wrap',
    syntax: '`',
    placeholder: 'code',
    shortcut: 'Ctrl+`',
  },
  {
    id: 'code-block',
    label: 'Code Block',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    action: 'wrap',
    syntax: '```\n',
    endSyntax: '\n```',
    placeholder: 'code here',
  },
  {
    id: 'divider4',
    label: '',
    icon: null,
    action: 'insert',
    syntax: '',
  },
  {
    id: 'link',
    label: 'Link',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    action: 'insert',
    syntax: '[link text](url)',
    shortcut: 'Ctrl+K',
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    action: 'prefix',
    syntax: '> ',
    placeholder: 'quote',
  },
];

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  className?: string;
}

// Helper function to insert markdown syntax at cursor position
function insertMarkdownSyntax(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  button: ToolbarButton
): void {
  const textarea = textareaRef.current;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = value.substring(start, end);

  let newText: string;
  let cursorPosition: number;

  if (button.action === 'wrap') {
    const endSyntax = button.endSyntax ?? button.syntax;
    if (selectedText) {
      newText = value.substring(0, start) + button.syntax + selectedText + endSyntax + value.substring(end);
      cursorPosition = start + button.syntax.length + selectedText.length + endSyntax.length;
    } else {
      const placeholder = button.placeholder ?? 'text';
      newText = value.substring(0, start) + button.syntax + placeholder + endSyntax + value.substring(end);
      cursorPosition = start + button.syntax.length;
      // Select the placeholder text
      setTimeout(() => {
        textarea.setSelectionRange(
          start + button.syntax.length,
          start + button.syntax.length + placeholder.length
        );
      }, 0);
    }
  } else if (button.action === 'prefix') {
    // For prefix actions, apply to each line in selection
    const beforeSelection = value.substring(0, start);
    const afterSelection = value.substring(end);
    const lineStart = beforeSelection.lastIndexOf('\n') + 1;

    if (selectedText.includes('\n')) {
      // Multi-line selection: prefix each line
      const lines = selectedText.split('\n');
      const prefixedLines = lines.map((line) => button.syntax + line).join('\n');
      newText = value.substring(0, start) + prefixedLines + afterSelection;
      cursorPosition = start + prefixedLines.length;
    } else {
      // Single line or no selection
      const currentLineText = value.substring(lineStart, end);
      if (currentLineText.startsWith(button.syntax)) {
        // Remove prefix if already present (toggle)
        newText = value.substring(0, lineStart) + currentLineText.substring(button.syntax.length) + afterSelection;
        cursorPosition = Math.max(lineStart, start - button.syntax.length);
      } else {
        newText = value.substring(0, lineStart) + button.syntax + value.substring(lineStart);
        cursorPosition = start + button.syntax.length;
      }
    }
  } else {
    // Insert action
    newText = value.substring(0, start) + button.syntax + value.substring(end);
    cursorPosition = start + button.syntax.length;
  }

  onChange(newText);

  // Restore focus and cursor position
  setTimeout(() => {
    textarea.focus();
    if (button.action !== 'wrap' || selectedText) {
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, 0);
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content in Markdown...',
  minHeight = 400,
  className = '',
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<'split' | 'editor' | 'preview'>('split');
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Set default view mode based on viewport
  useEffect(() => {
    if (isMobile && viewMode === 'split') {
      setViewMode('editor');
    }
  }, [isMobile, viewMode]);

  const handleToolbarClick = useCallback(
    (button: ToolbarButton) => {
      if (button.id.startsWith('divider')) return;
      insertMarkdownSyntax(textareaRef, value, onChange, button);
    },
    [value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key === 'b') {
        e.preventDefault();
        const boldButton = TOOLBAR_BUTTONS.find((b) => b.id === 'bold');
        if (boldButton) handleToolbarClick(boldButton);
      } else if (isMod && e.key === 'i') {
        e.preventDefault();
        const italicButton = TOOLBAR_BUTTONS.find((b) => b.id === 'italic');
        if (italicButton) handleToolbarClick(italicButton);
      } else if (isMod && e.key === 'k') {
        e.preventDefault();
        const linkButton = TOOLBAR_BUTTONS.find((b) => b.id === 'link');
        if (linkButton) handleToolbarClick(linkButton);
      } else if (isMod && e.key === '`') {
        e.preventDefault();
        const codeButton = TOOLBAR_BUTTONS.find((b) => b.id === 'inline-code');
        if (codeButton) handleToolbarClick(codeButton);
      } else if (e.key === 'Tab') {
        // Handle tab for indentation
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        if (e.shiftKey) {
          // Remove indentation
          const beforeCursor = value.substring(0, start);
          const lineStart = beforeCursor.lastIndexOf('\n') + 1;
          const lineContent = value.substring(lineStart);
          if (lineContent.startsWith('  ')) {
            const newValue = value.substring(0, lineStart) + lineContent.substring(2);
            onChange(newValue);
            setTimeout(() => {
              textarea.setSelectionRange(Math.max(start - 2, lineStart), Math.max(end - 2, lineStart));
            }, 0);
          }
        } else {
          // Add indentation
          const newValue = value.substring(0, start) + '  ' + value.substring(end);
          onChange(newValue);
          setTimeout(() => {
            textarea.setSelectionRange(start + 2, start + 2);
          }, 0);
        }
      }
    },
    [value, onChange, handleToolbarClick]
  );

  const handleImageInsert = useCallback(
    (markdown: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        onChange(value + '\n' + markdown + '\n');
        return;
      }

      const start = textarea.selectionStart;
      const newValue = value.substring(0, start) + '\n' + markdown + '\n' + value.substring(start);
      onChange(newValue);

      setTimeout(() => {
        textarea.focus();
        const newPosition = start + markdown.length + 2;
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    },
    [value, onChange]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Markdown preview components (matching article page)
  const markdownComponents = {
    h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return <h2 id={id} {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return <h3 id={id} {...props}>{children}</h3>;
    },
    h4: ({ children, ...props }: React.ComponentPropsWithoutRef<'h4'>) => {
      const text = String(children);
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      return <h4 id={id} {...props}>{children}</h4>;
    },
  };

  const showEditor = viewMode === 'split' || viewMode === 'editor';
  const showPreview = viewMode === 'split' || viewMode === 'preview';

  return (
    <div className={`border rounded-lg overflow-hidden dark:border-gray-700 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {TOOLBAR_BUTTONS.map((button) => {
            if (button.id.startsWith('divider')) {
              return (
                <div
                  key={button.id}
                  className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"
                />
              );
            }
            return (
              <button
                key={button.id}
                type="button"
                onClick={() => handleToolbarClick(button)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title={`${button.label}${button.shortcut ? ` (${button.shortcut})` : ''}`}
              >
                {button.icon}
              </button>
            );
          })}
          <InlineImageUpload onInsert={handleImageInsert} />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'editor'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Edit
          </button>
          {!isMobile && (
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Split
            </button>
          )}
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              viewMode === 'preview'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* Editor and Preview panes */}
      <div
        className={`flex ${viewMode === 'split' ? 'divide-x dark:divide-gray-700' : ''}`}
        style={{ minHeight }}
      >
        {/* Editor pane */}
        {showEditor && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full h-full px-4 py-3 font-mono text-sm resize-none focus:outline-none bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              style={{ minHeight }}
            />
          </div>
        )}

        {/* Preview pane */}
        {showPreview && (
          <div
            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto bg-white dark:bg-gray-900`}
            style={{ minHeight }}
          >
            <div className="px-4 py-3">
              {value ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={markdownComponents}
                  >
                    {value}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 italic text-sm">
                  Preview will appear here...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
        <span className="hidden sm:inline">
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Ctrl+B</kbd> Bold
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Ctrl+I</kbd> Italic
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Ctrl+K</kbd> Link
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px]">Tab</kbd> Indent
        </span>
        <span className="sm:hidden">Tap toolbar buttons to format</span>
      </div>
    </div>
  );
}
