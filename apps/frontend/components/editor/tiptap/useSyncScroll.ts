'use client';

import { useRef, useEffect } from 'react';

/**
 * Hook to synchronize scrolling between two panes.
 * Uses percentage-based scrolling for simple and reliable sync.
 *
 * @returns refs for editor and preview panes
 */
export function useSyncScroll() {
  const editorRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isScrollingEditor = useRef(false);
  const isScrollingPreview = useRef(false);

  useEffect(() => {
    const editor = editorRef.current;
    const preview = previewRef.current;

    if (!editor || !preview) return;

    const handleEditorScroll = () => {
      if (isScrollingPreview.current) return;

      isScrollingEditor.current = true;

      // Calculate scroll percentage
      const scrollPercentage =
        editor.scrollTop / (editor.scrollHeight - editor.clientHeight);

      // Apply to preview
      const previewScrollTop =
        scrollPercentage * (preview.scrollHeight - preview.clientHeight);

      preview.scrollTop = previewScrollTop;

      // Reset flag after a short delay
      setTimeout(() => {
        isScrollingEditor.current = false;
      }, 100);
    };

    const handlePreviewScroll = () => {
      if (isScrollingEditor.current) return;

      isScrollingPreview.current = true;

      // Calculate scroll percentage
      const scrollPercentage =
        preview.scrollTop / (preview.scrollHeight - preview.clientHeight);

      // Apply to editor
      const editorScrollTop =
        scrollPercentage * (editor.scrollHeight - editor.clientHeight);

      editor.scrollTop = editorScrollTop;

      // Reset flag after a short delay
      setTimeout(() => {
        isScrollingPreview.current = false;
      }, 100);
    };

    editor.addEventListener('scroll', handleEditorScroll, { passive: true });
    preview.addEventListener('scroll', handlePreviewScroll, { passive: true });

    return () => {
      editor.removeEventListener('scroll', handleEditorScroll);
      preview.removeEventListener('scroll', handlePreviewScroll);
    };
  }, []);

  return { editorRef, previewRef };
}
