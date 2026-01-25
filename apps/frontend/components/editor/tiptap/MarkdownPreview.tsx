'use client';

import { type FC, type ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

// Custom components to handle edge cases
const components = {
  // Handle images with empty or invalid src
  img: ({ src, alt, ...props }: ComponentProps<'img'>) => {
    // Don't render images with empty src to avoid browser warnings
    if (!src || src === '') {
      return (
        <span className="inline-block px-2 py-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 rounded">
          [Image: {alt || 'no source'}]
        </span>
      );
    }
    return <img src={src} alt={alt || ''} {...props} />;
  },
};

/**
 * Markdown preview component using react-markdown.
 * Renders markdown content with GitHub Flavored Markdown support.
 */
export const MarkdownPreview: FC<MarkdownPreviewProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose dark:prose-invert max-w-none p-8 ${className}`}>
      {content ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {content}
        </ReactMarkdown>
      ) : (
        <p className="text-gray-400 dark:text-gray-600 italic">
          Preview will appear here as you type...
        </p>
      )}
    </div>
  );
};

export default MarkdownPreview;
