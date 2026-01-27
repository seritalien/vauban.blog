'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Tiptap extension types require complex generics that are not worth typing explicitly
import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: ({ editor, range }: any) => void;
}

// Slash command menu component
const SlashCommandMenu = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }

      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }

      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  return (
    <div className="z-50 min-w-[300px] max-w-[400px] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          Commands
        </p>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {props.items.length ? (
          props.items.map((item: SlashCommandItem, index: number) => (
            <button
              key={index}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`
                w-full flex items-start gap-3 px-3 py-2 text-left transition-colors
                ${
                  index === selectedIndex
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
            >
              <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    index === selectedIndex
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {item.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
            </button>
          ))
        ) : (
          <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No results
          </div>
        )}
      </div>
    </div>
  );
});

SlashCommandMenu.displayName = 'SlashCommandMenu';

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      } as Partial<SuggestionOptions>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionConfig = () => ({
  items: ({ query, editor }: { query: string; editor: any }) => {
    const onAIAction = editor?.storage?.aiHandler;

    const items: SlashCommandItem[] = [
      {
        title: 'Heading 1',
        description: 'Large section heading',
        icon: 'H1',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
        },
      },
      {
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: 'H2',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
        },
      },
      {
        title: 'Heading 3',
        description: 'Small section heading',
        icon: 'H3',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
        },
      },
      {
        title: 'Bullet List',
        description: 'Create a simple bullet list',
        icon: '•',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
      },
      {
        title: 'Numbered List',
        description: 'Create a numbered list',
        icon: '1.',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
      },
      {
        title: 'Task List',
        description: 'Create a task list with checkboxes',
        icon: '☑',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
      },
      {
        title: 'Code Block',
        description: 'Insert a code block with syntax highlighting',
        icon: '</>',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
      },
      {
        title: 'Quote',
        description: 'Insert a blockquote',
        icon: '❝',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      },
      {
        title: 'Divider',
        description: 'Insert a horizontal rule',
        icon: '—',
        command: ({ editor, range }: any) => {
          editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      },
    ];

    // Add AI commands if handler is provided
    // Note: Only "Continue Writing" works well with slash commands.
    // For text transformations (improve, fix, shorten, expand), users should:
    // 1. Select the text first
    // 2. Use the bubble menu that appears (with AI buttons)
    if (onAIAction) {
      items.push(
        {
          title: 'AI: Continue Writing',
          description: 'Let AI continue from current position',
          icon: '✨',
          command: async ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            await onAIAction('continue');
          },
        },
        {
          title: 'AI: Help (How to use)',
          description: 'Select text first, then use the bubble menu for AI actions',
          icon: '❓',
          command: ({ editor, range }: any) => {
            editor.chain().focus().deleteRange(range).run();
            // Just show a hint - no action needed
            alert('💡 Tip: To use AI on text:\n\n1. Select the text you want to transform\n2. A bubble menu will appear with AI buttons:\n   ✨ Improve | ✓ Fix | ⇥ Shorter | ⇤ Longer\n\nThe /continue command works without selection.');
          },
        }
      );
    }

    return items.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase())
    );
  },

  render: () => {
    let component: ReactRenderer;
    let popup: TippyInstance[];

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(SlashCommandMenu, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup[0]?.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0]?.hide();
          return true;
        }

        return (component.ref as { onKeyDown?: (props: any) => boolean } | null)?.onKeyDown?.(props);
      },

      onExit() {
        popup[0]?.destroy();
        component.destroy();
      },
    };
  },
});

export default SlashCommand;
