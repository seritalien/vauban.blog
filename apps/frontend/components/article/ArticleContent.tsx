'use client';

import { type FC, type ReactNode, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

export interface ArticleContentProps {
  /** Markdown content */
  content: string;
  /** Additional class names */
  className?: string;
  /** Current sentence index being read aloud (-1 = none) */
  currentSentenceIndex?: number;
}

// Split text into sentences for highlighting
function splitIntoSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(Boolean);
}

/**
 * Enhanced article content renderer with improved typography and code styling.
 * Supports sentence highlighting during text-to-speech playback.
 */
export const ArticleContent: FC<ArticleContentProps> = ({ content, className = '', currentSentenceIndex = -1 }) => {
  // Ref to scroll to the active sentence
  const activeRef = useRef<HTMLSpanElement>(null);

  // Global sentence counter for the entire article
  const sentenceCounterRef = useRef(0);

  // Reset counter on each render before processing paragraphs
  sentenceCounterRef.current = 0;

  // Auto-scroll to active sentence
  useEffect(() => {
    if (currentSentenceIndex >= 0 && activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentSentenceIndex]);

  // Helper to render text with sentence highlighting
  const renderTextWithSentences = (text: string): ReactNode => {
    if (currentSentenceIndex < 0) {
      return text;
    }

    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return text;

    return sentences.map((sentence, localIdx) => {
      const globalIdx = sentenceCounterRef.current + localIdx;
      const isActive = globalIdx === currentSentenceIndex;

      return (
        <span
          key={`sentence-${globalIdx}`}
          ref={isActive ? activeRef : null}
          className={`sentence ${isActive ? 'sentence-active' : ''}`}
          data-sentence-index={globalIdx}
        >
          {sentence}{' '}
        </span>
      );
    });
  };

  // After rendering text, update the counter
  const advanceSentenceCounter = (text: string) => {
    const sentences = splitIntoSentences(text);
    sentenceCounterRef.current += sentences.length;
  };
  return (
    <div
      className={`
        prose prose-lg dark:prose-invert max-w-none

        /* Headings */
        prose-headings:font-bold prose-headings:tracking-tight
        prose-h1:text-4xl prose-h1:mb-6
        prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-gray-200 prose-h2:dark:border-gray-700
        prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
        prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-2

        /* Paragraphs */
        prose-p:text-gray-700 prose-p:dark:text-gray-300 prose-p:leading-relaxed prose-p:mb-4

        /* Links */
        prose-a:text-blue-600 prose-a:dark:text-blue-400 prose-a:no-underline prose-a:border-b prose-a:border-blue-300 prose-a:dark:border-blue-700
        hover:prose-a:border-blue-600 hover:prose-a:dark:border-blue-400

        /* Lists */
        prose-ul:my-4 prose-ol:my-4
        prose-li:text-gray-700 prose-li:dark:text-gray-300 prose-li:my-1

        /* Blockquotes */
        prose-blockquote:border-l-4 prose-blockquote:border-purple-500 prose-blockquote:bg-purple-50 prose-blockquote:dark:bg-purple-900/20
        prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:italic prose-blockquote:rounded-r-lg
        prose-blockquote:text-gray-700 prose-blockquote:dark:text-gray-300

        /* Code */
        prose-code:text-purple-600 prose-code:dark:text-purple-400 prose-code:bg-gray-100 prose-code:dark:bg-gray-800
        prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
        prose-code:before:content-none prose-code:after:content-none

        /* Code blocks */
        prose-pre:bg-gray-900 prose-pre:dark:bg-gray-950 prose-pre:rounded-lg prose-pre:shadow-lg
        prose-pre:overflow-x-auto prose-pre:p-4 prose-pre:my-6

        /* Images */
        prose-img:rounded-lg prose-img:shadow-lg prose-img:my-8

        /* Tables */
        prose-table:border-collapse prose-table:w-full prose-table:my-6
        prose-th:bg-gray-100 prose-th:dark:bg-gray-800 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold
        prose-td:border prose-td:border-gray-200 prose-td:dark:border-gray-700 prose-td:px-4 prose-td:py-2

        /* Horizontal rules */
        prose-hr:my-8 prose-hr:border-gray-200 prose-hr:dark:border-gray-700

        /* Strong and emphasis */
        prose-strong:text-gray-900 prose-strong:dark:text-white prose-strong:font-semibold
        prose-em:text-gray-700 prose-em:dark:text-gray-300

        ${className}
      `}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom paragraph with sentence highlighting for TTS
          p: ({ children, ...props }) => {
            // Extract text from children
            const textContent = String(children);
            const rendered = renderTextWithSentences(textContent);
            advanceSentenceCounter(textContent);
            return <p {...props}>{currentSentenceIndex >= 0 ? rendered : children}</p>;
          },
          // Add IDs to headings for anchor links
          h2: ({ children, ...props }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h2 id={id} className="group" {...props}>
                {children}
                <a
                  href={`#${id}`}
                  className="ml-2 opacity-0 group-hover:opacity-50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                  aria-label={`Link to ${text}`}
                >
                  #
                </a>
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return (
              <h3 id={id} className="group" {...props}>
                {children}
                <a
                  href={`#${id}`}
                  className="ml-2 opacity-0 group-hover:opacity-50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-opacity"
                  aria-label={`Link to ${text}`}
                >
                  #
                </a>
              </h3>
            );
          },
          h4: ({ children, ...props }) => {
            const text = String(children);
            const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return <h4 id={id} {...props}>{children}</h4>;
          },
          // Enhanced code blocks with copy button
          pre: ({ children, ...props }) => {
            return (
              <div className="relative group">
                <pre {...props}>{children}</pre>
                <button
                  onClick={() => {
                    const code = (children as ReactNode & { props?: { children?: string } })?.props?.children;
                    if (typeof code === 'string') {
                      navigator.clipboard.writeText(code);
                    }
                  }}
                  className="absolute top-2 right-2 p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy code"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            );
          },
          // Enhanced images with zoom capability
          img: ({ src, alt, ...props }) => {
            return (
              <figure className="my-8">
                <img
                  src={src}
                  alt={alt}
                  className="rounded-lg shadow-lg w-full cursor-zoom-in"
                  loading="lazy"
                  onClick={() => {
                    // Simple lightbox - open image in new tab
                    if (src && typeof src === 'string') window.open(src, '_blank');
                  }}
                  {...props}
                />
                {alt && (
                  <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400 italic">
                    {alt}
                  </figcaption>
                )}
              </figure>
            );
          },
          // Enhanced blockquotes
          blockquote: ({ children, ...props }) => {
            return (
              <blockquote className="relative" {...props}>
                <svg
                  className="absolute -left-2 -top-2 w-8 h-8 text-purple-300 dark:text-purple-700 opacity-50"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                {children}
              </blockquote>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default ArticleContent;
