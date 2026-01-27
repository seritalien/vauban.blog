'use client';

import { useState, useRef, useEffect } from 'react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  isSending,
  disabled = false,
  placeholder = 'Écrire un message...',
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSending || disabled) return;

    const message = content.trim();
    setContent('');
    await onSend(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    >
      <div className="flex items-end gap-2">
        {/* Attachment button (future feature) */}
        <button
          type="button"
          disabled
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-50"
          title="Pièce jointe (bientôt)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            rows={1}
            className="
              w-full px-4 py-3 pr-12
              bg-gray-100 dark:bg-gray-800
              text-gray-900 dark:text-white
              placeholder-gray-500 dark:placeholder-gray-400
              rounded-2xl resize-none
              border-0 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
              disabled:opacity-50
            "
            style={{ maxHeight: '150px' }}
          />

          {/* Encryption indicator */}
          <div className="absolute right-3 bottom-3" aria-label="Chiffré">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
            </svg>
          </div>
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={!content.trim() || isSending || disabled}
          className="
            p-3 rounded-full
            bg-blue-500 hover:bg-blue-600
            text-white
            transition-colors
            disabled:bg-gray-300 dark:disabled:bg-gray-700
            disabled:cursor-not-allowed
          "
        >
          {isSending ? (
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>

      {/* Encryption note */}
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
        <svg className="w-3 h-3 inline mr-1" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
        Chiffrement de bout en bout - Seul vous et votre correspondant pouvez lire ces messages
      </p>
    </form>
  );
}
