'use client';

import { useState, useEffect, useCallback, useRef, type FC } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { PostInputSchema } from '@vauban/shared-types';
import { calculateContentHash } from '@vauban/web3-utils';
import ImageUpload from '@/components/editor/ImageUpload';
import TiptapSplitEditor, { type TiptapSplitEditorHandle } from '@/components/editor/TiptapSplitEditor';
import TagInput from '@/components/editor/TagInput';
import SaveStatusIndicator from '@/components/editor/SaveStatusIndicator';
import DraftRecoveryModal from '@/components/editor/DraftRecoveryModal';
import AIAssistant from '@/components/editor/AIAssistant';
import AISettingsPanel from '@/components/admin/AISettingsPanel';
import FieldWithAI from '@/components/editor/FieldWithAI';
import FloatingAIToolbar from '@/components/editor/FloatingAIToolbar';
import {
  getDraft,
  saveDraft,
  deleteDraft,
  releaseDraftLock,
  type Draft,
} from '@/lib/drafts';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';
import { format } from 'date-fns';

// Upload to IPFS via local proxy (avoids CORS issues)
async function uploadJSONToIPFSProxy(data: unknown): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  formData.append('file', blob, 'data.json');

  const response = await fetch('/api/ipfs/add', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return result.cid;
}

// Upload to Arweave via local proxy (handles Irys/bundler integration)
async function uploadJSONToArweaveProxy(data: unknown): Promise<{ txId: string; simulated: boolean }> {
  const response = await fetch('/api/arweave/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Arweave upload failed: ${response.statusText}`);
  }

  const result = await response.json();
  return { txId: result.txId, simulated: result.simulated };
}

export interface PostEditorProps {
  /** Editor mode */
  mode: 'create' | 'edit';
  /** Initial data for editing an existing post */
  initialData?: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    tags: string[];
    coverImage: string;
    isPaid?: boolean;
    price?: number;
  };
  /** Post ID for edit mode */
  postId?: string;
  /** Draft ID to load (for create mode) */
  draftId?: string | null;
  /** Callback when publish/update succeeds */
  onSuccess?: () => void;
  /** Callback when draft ID changes */
  onDraftIdChange?: (id: string) => void;
  /** Custom submit handler (for edit mode with different blockchain call) */
  onSubmit?: (data: {
    postData: unknown;
    ipfsCid: string;
    arweaveTxId: string;
    contentHash: string;
  }) => Promise<void>;
}

export interface PostFormData {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string[];
  coverImage: string;
  isPaid: boolean;
  price: number;
  isEncrypted: boolean;
}

export const PostEditor: FC<PostEditorProps> = ({
  mode,
  initialData,
  // postId - Reserved for future version history feature
  draftId: initialDraftId = null,
  onSuccess,
  onDraftIdChange,
  onSubmit,
}) => {
  const { account, isConnected } = useWallet();

  const [formData, setFormData] = useState<PostFormData>({
    title: initialData?.title ?? '',
    slug: initialData?.slug ?? '',
    content: initialData?.content ?? '',
    excerpt: initialData?.excerpt ?? '',
    tags: initialData?.tags ?? [],
    coverImage: initialData?.coverImage ?? '',
    isPaid: initialData?.isPaid ?? false,
    price: initialData?.price ?? 0,
    isEncrypted: false,
  });

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<string>('');
  const [arweaveStatus, setArweaveStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(Boolean(initialData?.slug));
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // AI Assistant state
  const [aiSidebarExpanded, setAiSidebarExpanded] = useState(false);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [showFloatingToolbar, setShowFloatingToolbar] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const tiptapEditorRef = useRef<TiptapSplitEditorHandle>(null);

  // Prepare form data for autosave hook (convert tags array to string)
  const draftFormData = {
    title: formData.title,
    slug: formData.slug,
    content: formData.content,
    excerpt: formData.excerpt,
    tags: formData.tags.join(', '),
    coverImage: formData.coverImage,
    isPaid: formData.isPaid,
    price: formData.price,
    scheduledAt: scheduledAt || undefined,
  };

  // Use the autosave hook with versioning and conflict detection (only in create mode)
  const {
    saveStatus,
    lastSavedAt,
    hasSnapshots,
    snapshotCount,
    conflict,
    dismissConflict,
  } = useDraftAutosave({
    draftId: mode === 'create' ? draftId : null, // Disable autosave in edit mode
    formData: draftFormData,
    onDraftIdChange: (id) => {
      setDraftId(id);
      onDraftIdChange?.(id);
    },
    onConflictDetected: () => {
      setShowRecoveryModal(true);
    },
    onRemoteUpdate: (draft) => {
      console.log('Remote update detected:', draft.updatedAt);
    },
  });

  // Generate slug from title (max 100 chars for API compatibility)
  const generateSlug = (title: string): string => {
    let slug = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Truncate to 100 chars max, cutting at word boundary
    if (slug.length > 100) {
      slug = slug.substring(0, 100);
      const lastHyphen = slug.lastIndexOf('-');
      if (lastHyphen > 50) {
        slug = slug.substring(0, lastHyphen);
      }
    }

    return slug;
  };

  // Handle title change with auto-slug generation
  const handleTitleChange = (newTitle: string) => {
    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      // Only auto-generate slug if user hasn't manually edited it
      slug: slugManuallyEdited ? prev.slug : generateSlug(newTitle),
    }));
  };

  // Handle slug change (mark as manually edited)
  const handleSlugChange = (newSlug: string) => {
    setSlugManuallyEdited(true);
    setFormData((prev) => ({ ...prev, slug: newSlug }));
  };

  // Load draft from URL params (create mode only)
  useEffect(() => {
    if (mode === 'create' && initialDraftId) {
      const draft = getDraft(initialDraftId);
      if (draft) {
        setDraftId(draft.id);
        setFormData({
          title: draft.title,
          slug: draft.slug,
          content: draft.content,
          excerpt: draft.excerpt,
          tags: draft.tags ? draft.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          coverImage: draft.coverImage,
          isPaid: draft.isPaid,
          price: draft.price,
          isEncrypted: false,
        });
        if (draft.slug) {
          setSlugManuallyEdited(true);
        }
        if (draft.scheduledAt) {
          setScheduledAt(draft.scheduledAt.slice(0, 16));
        }
      }
    }
  }, [mode, initialDraftId]);

  // Sync initialData changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && initialData) {
      setFormData({
        title: initialData.title,
        slug: initialData.slug,
        content: initialData.content,
        excerpt: initialData.excerpt,
        tags: initialData.tags,
        coverImage: initialData.coverImage,
        isPaid: initialData.isPaid ?? false,
        price: initialData.price ?? 0,
        isEncrypted: false,
      });
      if (initialData.slug) {
        setSlugManuallyEdited(true);
      }
    }
  }, [mode, initialData]);

  // Check Arweave connection on mount
  useEffect(() => {
    fetch('/api/arweave/add')
      .then((res) => res.json())
      .then((data) => setArweaveStatus(data.status === 'connected' ? 'connected' : 'unavailable'))
      .catch(() => setArweaveStatus('unavailable'));
  }, []);

  // Cleanup on unmount - release lock (create mode only)
  useEffect(() => {
    return () => {
      if (mode === 'create' && draftId) {
        releaseDraftLock(draftId);
      }
    };
  }, [mode, draftId]);

  // Handle selection changes from Tiptap editor
  const handleTiptapSelectionChange = useCallback((text: string) => {
    setSelectedText(text);
    // Clear textarea-related states since we're using Tiptap
    if (text) {
      setSelectionRange(null); // Tiptap handles its own selection
    } else {
      setSelectionRange(null);
      setSelectionRect(null);
      setShowFloatingToolbar(false);
    }
  }, []);

  // Keyboard shortcuts (Cmd/Ctrl+S to save, Cmd/Ctrl+Shift+P to toggle AI sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key === 's') {
        e.preventDefault();
        // Trigger form submission
        const form = document.querySelector('form');
        if (form && !isSubmitting) {
          form.requestSubmit();
        }
      }

      if (modifier && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setAiSidebarExpanded((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting]);

  // AI Assistant callbacks
  const handleAIReplaceText = useCallback((newText: string) => {
    // Use Tiptap editor ref if available
    if (tiptapEditorRef.current) {
      tiptapEditorRef.current.replaceSelectedText(newText);
      setSelectedText('');
      setSelectionRect(null);
      setShowFloatingToolbar(false);
      return;
    }
    // Fallback for textarea (legacy)
    if (selectionRange) {
      const before = formData.content.substring(0, selectionRange.start);
      const after = formData.content.substring(selectionRange.end);
      setFormData({ ...formData, content: before + newText + after });
      setSelectedText('');
      setSelectionRange(null);
      setSelectionRect(null);
      setShowFloatingToolbar(false);
    }
  }, [formData, selectionRange]);

  const handleFloatingToolbarClose = useCallback(() => {
    setShowFloatingToolbar(false);
    setSelectionRect(null);
  }, []);

  const handleAIInsertAfterSelection = useCallback((newText: string) => {
    if (selectionRange) {
      const before = formData.content.substring(0, selectionRange.end);
      const after = formData.content.substring(selectionRange.end);
      setFormData({ ...formData, content: before + '\n\n' + newText + after });
      setSelectedText('');
      setSelectionRange(null);
      setSelectionRect(null);
      setShowFloatingToolbar(false);
    }
  }, [formData, selectionRange]);

  const handleAIInsertText = useCallback((newText: string) => {
    // Use Tiptap editor ref if available
    if (tiptapEditorRef.current) {
      tiptapEditorRef.current.insertTextAtEnd(newText);
      return;
    }
    // Fallback for textarea (legacy)
    setFormData({ ...formData, content: formData.content + '\n\n' + newText });
  }, [formData]);

  const handleAISuggestTitle = useCallback((title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: slugManuallyEdited ? prev.slug : generateSlug(title),
    }));
  }, [slugManuallyEdited]);

  const handleAISuggestTags = useCallback((tags: string[]) => {
    setFormData({ ...formData, tags });
  }, [formData]);

  const handleAISuggestExcerpt = useCallback((excerpt: string) => {
    setFormData({ ...formData, excerpt });
  }, [formData]);

  const handleAISetCoverImage = useCallback((coverImage: string) => {
    setFormData({ ...formData, coverImage });
  }, [formData]);

  const handleRestoreFromBackup = useCallback((restoredDraft: Draft) => {
    setFormData({
      title: restoredDraft.title,
      slug: restoredDraft.slug,
      content: restoredDraft.content,
      excerpt: restoredDraft.excerpt,
      tags: restoredDraft.tags ? restoredDraft.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      coverImage: restoredDraft.coverImage,
      isPaid: restoredDraft.isPaid,
      price: restoredDraft.price,
      isEncrypted: false,
    });
    if (restoredDraft.scheduledAt) {
      setScheduledAt(restoredDraft.scheduledAt.slice(0, 16));
    }
    if (restoredDraft.slug) {
      setSlugManuallyEdited(true);
    }
    dismissConflict();
  }, [dismissConflict]);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">
            {mode === 'edit' ? 'Edit Post' : 'New Article'}
          </h1>
          <p className="text-gray-600">Please connect your wallet to {mode === 'edit' ? 'edit posts' : 'publish articles'}.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) return;

    // Check if scheduled for future date - use server-side scheduling (create mode only)
    if (mode === 'create' && scheduledAt) {
      const scheduledTime = new Date(scheduledAt).getTime();
      const now = Date.now();

      if (scheduledTime > now) {
        try {
          setIsSubmitting(true);
          setSubmitStatus('Scheduling post for automatic publishing...');

          // Schedule via server-side API
          const response = await fetch('/api/scheduled', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scheduledAt: new Date(scheduledAt).toISOString(),
              authorAddress: account.address,
              postData: {
                ...formData,
                tags: formData.tags,
              },
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to schedule post');
          }

          await response.json();

          // Delete local draft since it's now scheduled server-side
          if (draftId) {
            deleteDraft(draftId);
          }

          setSubmitStatus(
            `Post scheduled for ${format(new Date(scheduledAt), 'MMMM d, yyyy')} at ${format(new Date(scheduledAt), 'HH:mm')}. ` +
            `It will be automatically published at that time.`
          );

          // Call success callback after delay
          setTimeout(() => {
            onSuccess?.();
          }, 3000);

          return;
        } catch (error) {
          setSubmitStatus(`Error: ${error instanceof Error ? error.message : 'Failed to schedule'}`);
          return;
        } finally {
          setIsSubmitting(false);
        }
      }
    }

    try {
      setIsSubmitting(true);
      setSubmitStatus('Validating...');

      // Parse and validate with Zod
      const postData = PostInputSchema.parse({
        ...formData,
        contentType: 'article',
        tags: formData.tags,
        coverImage: formData.coverImage?.trim() || undefined,
      });

      // Step 1: Upload to IPFS (fast cache) via proxy
      setSubmitStatus('Uploading to IPFS...');
      const ipfsCid = await uploadJSONToIPFSProxy(postData);
      console.log('IPFS CID:', ipfsCid);

      // Step 2: Upload to Arweave (permanent storage via Irys)
      setSubmitStatus('Uploading to Arweave (permanent storage)...');
      const arweaveResult = await uploadJSONToArweaveProxy(postData);
      const arweaveTxId = arweaveResult.txId;

      if (arweaveResult.simulated) {
        console.log('Arweave TX ID (simulated):', arweaveTxId);
      } else {
        console.log('Arweave TX ID:', arweaveTxId);
      }

      // Step 3: Calculate content hash
      setSubmitStatus('Calculating content hash...');
      const contentHash = await calculateContentHash(JSON.stringify(postData));

      // Step 4: Custom submit handler or default blockchain publish
      if (onSubmit) {
        setSubmitStatus(mode === 'edit' ? 'Updating on blockchain...' : 'Publishing to blockchain...');
        await onSubmit({ postData, ipfsCid, arweaveTxId, contentHash });
      } else {
        // Default: publish new post (handled by parent component for edit mode)
        setSubmitStatus('Publishing to blockchain...');
        const { publishPost } = await import('@vauban/web3-utils');
        const price = (formData.price * 1e18).toString();
        await publishPost(
          account,
          arweaveTxId,
          ipfsCid,
          contentHash,
          price,
          formData.isEncrypted
        );
      }

      setSubmitStatus(mode === 'edit' ? 'Updated successfully!' : 'Published successfully!');

      // Delete draft after successful publish (create mode)
      if (mode === 'create' && draftId) {
        deleteDraft(draftId);
      }

      // Call success callback after delay
      setTimeout(() => {
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error(`${mode === 'edit' ? 'Update' : 'Publishing'} failed:`, error);
      setSubmitStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    if (!formData.title && !formData.content) return;

    const saved = saveDraft({
      ...formData,
      tags: formData.tags.join(', '),
      id: draftId || undefined,
      scheduledAt: scheduledAt || undefined,
    });
    setDraftId(saved.id);
    onDraftIdChange?.(saved.id);
  };

  const handleNewDraft = () => {
    // Release lock on current draft
    if (draftId) {
      releaseDraftLock(draftId);
    }

    setDraftId(null);
    setFormData({
      title: '',
      slug: '',
      content: '',
      excerpt: '',
      tags: [],
      coverImage: '',
      isPaid: false,
      price: 0,
      isEncrypted: false,
    });
    setScheduledAt('');
    setSlugManuallyEdited(false);
    onDraftIdChange?.('');
  };

  const handleDeleteDraft = () => {
    if (draftId && confirm('Are you sure you want to delete this draft?')) {
      deleteDraft(draftId);
      handleNewDraft();
    }
  };

  const handleViewSnapshots = () => {
    setShowRecoveryModal(true);
  };

  return (
    <div className="flex min-h-screen">
      {/* Main content area */}
      <div className={`flex-1 transition-all duration-300 ${aiSidebarExpanded ? 'mr-80' : ''}`}>
        <div className="space-y-6">
          {/* Header with AI buttons and save status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* AI Assistant buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setAiSidebarExpanded(!aiSidebarExpanded)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                    aiSidebarExpanded
                      ? 'bg-purple-600 text-white'
                      : 'border border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}
                  title="Assistant IA"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="hidden sm:inline">AI</span>
                </button>
                <button
                  onClick={() => setAiSettingsOpen(true)}
                  className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                  title="Configuration IA"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              {/* Save status indicator with backup history (create mode only) */}
              {mode === 'create' && (
                <SaveStatusIndicator
                  status={conflict?.hasConflict ? 'conflict' : saveStatus}
                  lastSavedAt={lastSavedAt}
                  hasSnapshots={hasSnapshots}
                  onViewSnapshots={draftId ? handleViewSnapshots : undefined}
                />
              )}
            </div>
          </div>

          {/* Conflict warning banner (create mode) */}
          {mode === 'create' && conflict?.hasConflict && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Edit conflict detected
                </p>
                <p className="text-xs text-red-700 dark:text-red-300">
                  This draft is being edited in another tab. Your changes may be overwritten.
                </p>
              </div>
              <button
                onClick={() => setShowRecoveryModal(true)}
                className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700 rounded-lg transition-colors"
              >
                Resolve
              </button>
            </div>
          )}

          {/* Draft actions bar (create mode only) */}
          {mode === 'create' && draftId && !conflict?.hasConflict && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-sm text-yellow-800 dark:text-yellow-200 flex-1">
                Editing draft
                {snapshotCount > 0 && (
                  <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                    ({snapshotCount} backup{snapshotCount !== 1 ? 's' : ''})
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={handleNewDraft}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                New Article
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                Delete Draft
              </button>
            </div>
          )}

          {/* Version info (edit mode) */}
          {mode === 'edit' && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <p className="text-gray-600 dark:text-gray-400">
                <span className="font-semibold">Current Version:</span> This will create a new version.
                Previous versions are preserved in history.
              </p>
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title with AI suggestions */}
            <FieldWithAI
              label="Title"
              value={formData.title}
              onChange={handleTitleChange}
              aiAction="suggest_title"
              aiContext={formData.content}
              placeholder="Enter your article title..."
              required
              helperText="AI can suggest a compelling title based on your content"
            />

            {/* Slug */}
            <div>
              <label className="block text-sm font-semibold mb-2">Slug (URL)</label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
                    /articles/
                  </span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    className="w-full border rounded pl-20 pr-4 py-2 dark:bg-gray-900 dark:border-gray-700"
                    placeholder="my-article-slug"
                    required
                  />
                </div>
                {slugManuallyEdited && formData.title && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlugManuallyEdited(false);
                      setFormData((prev) => ({ ...prev, slug: generateSlug(prev.title) }));
                    }}
                    className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded border border-blue-300 dark:border-blue-600"
                    title="Regenerate slug from title"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {slugManuallyEdited ? 'Manually edited' : 'Auto-generated from title'}
              </p>
            </div>

            {/* Excerpt with AI generation */}
            <FieldWithAI
              label="Excerpt"
              value={formData.excerpt}
              onChange={(excerpt) => setFormData({ ...formData, excerpt })}
              aiAction="suggest_excerpt"
              aiContext={formData.content}
              placeholder="A brief summary of your article..."
              required
              multiline
              rows={3}
              helperText="AI can generate an engaging excerpt from your content"
            />

            {/* Content (MDX) with AI */}
            <div ref={editorContainerRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold">Content (Markdown)</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    AI: Select text + bubble menu or type &quot;/&quot;
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      alert('AI Actions:\n\n1. Select text → Click AI button in bubble menu\n2. Type "/" for slash commands\n3. Available actions: Improve, Fix grammar, Shorter, Longer, Translate');
                    }}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-colors text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
                    title="AI actions help"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              <TiptapSplitEditor
                ref={tiptapEditorRef}
                content={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                placeholder="Write your article content in Markdown..."
                editable={!isSubmitting}
                onSelectionChange={handleTiptapSelectionChange}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use AI to improve your writing: select text for quick actions or type &quot;/&quot; for commands
              </p>
            </div>

            {/* Tags with AI */}
            <FieldWithAI
              label="Tags"
              value={formData.tags.join(', ')}
              onChange={(tagsStr) => {
                const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
                setFormData({ ...formData, tags });
              }}
              aiAction="suggest_tags"
              aiContext={formData.content}
              helperText="AI can suggest relevant tags based on your content"
            >
              <TagInput
                value={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
                placeholder="Add tags..."
                maxTags={10}
              />
            </FieldWithAI>

            {/* Cover Image with AI */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold">Cover Image</label>
                <button
                  type="button"
                  onClick={async () => {
                    // Prevent multiple clicks
                    if (isGeneratingImage) return;

                    if (!formData.title && !formData.content) {
                      alert('Please add a title or content first');
                      return;
                    }

                    setIsGeneratingImage(true);
                    try {
                      const { generateCoverImage } = await import('@/lib/ai-images');
                      const result = await generateCoverImage(formData.title, formData.content);
                      if (result.success) {
                        // Always upload to IPFS for persistence
                        let blob: Blob;

                        if (result.url.startsWith('blob:')) {
                          const blobResponse = await fetch(result.url);
                          blob = await blobResponse.blob();
                        } else if (result.url.startsWith('data:')) {
                          // Convert base64 data URL to blob
                          const response = await fetch(result.url);
                          blob = await response.blob();
                        } else {
                          // External URL (e.g., Pollinations) - fetch and convert to blob
                          console.log('[PostEditor] Fetching external image for IPFS upload:', result.url.substring(0, 80));
                          const response = await fetch(result.url);
                          if (!response.ok) {
                            throw new Error('Failed to fetch generated image');
                          }
                          blob = await response.blob();
                        }

                        // Upload to IPFS
                        const ipfsFormData = new FormData();
                        ipfsFormData.append('file', blob, 'cover.png');

                        const ipfsResponse = await fetch('/api/ipfs/add', {
                          method: 'POST',
                          body: ipfsFormData,
                        });

                        if (!ipfsResponse.ok) {
                          throw new Error('Failed to upload image to IPFS');
                        }

                        const ipfsData = await ipfsResponse.json();
                        const ipfsUrl = `/api/ipfs/${ipfsData.cid}`;
                        console.log('[PostEditor] Image uploaded to IPFS:', ipfsUrl);
                        // Use functional update to avoid stale closure
                        setFormData(prev => ({ ...prev, coverImage: ipfsUrl }));

                        // Revoke blob URL to free memory
                        if (result.url.startsWith('blob:')) {
                          URL.revokeObjectURL(result.url);
                        }
                      } else {
                        alert(`Error: ${result.error}`);
                      }
                    } catch (error) {
                      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setIsGeneratingImage(false);
                    }
                  }}
                  disabled={isGeneratingImage}
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-colors ${
                    isGeneratingImage
                      ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                      : 'text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20'
                  }`}
                  title="Generate cover image with AI"
                >
                  {isGeneratingImage ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Génération... (30-60s)</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>AI</span>
                    </>
                  )}
                </button>
              </div>
              {formData.coverImage ? (
                <div className="space-y-2">
                  <img
                    src={formData.coverImage}
                    alt="Cover preview"
                    className="w-full h-48 object-cover rounded"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.coverImage}
                      onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                      className="flex-1 border rounded px-4 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                      placeholder="Image URL or /api/ipfs/..."
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, coverImage: '' })}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <ImageUpload
                  onUpload={(url) => setFormData({ ...formData, coverImage: url })}
                />
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Upload an image or generate one with AI based on your article
              </p>
            </div>

            {/* Pricing (create mode only) */}
            {mode === 'create' && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isPaid}
                    onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold">Paid Article</span>
                </label>

                {formData.isPaid && (
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="border rounded px-4 py-2 w-32 dark:bg-gray-900 dark:border-gray-700"
                    placeholder="0.0"
                    step="0.01"
                    min="0"
                  />
                )}
              </div>
            )}

            {/* Scheduled Publishing (create mode only) */}
            {mode === 'create' && (
              <div>
                <label className="block text-sm font-semibold mb-2">Schedule Publishing (optional)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    className="border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
                  />
                  {scheduledAt && (
                    <button
                      type="button"
                      onClick={() => setScheduledAt('')}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {scheduledAt && new Date(scheduledAt) > new Date() && (
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Scheduled for {format(new Date(scheduledAt), 'MMMM d, yyyy')} at {format(new Date(scheduledAt), 'HH:mm')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Post will be automatically published at the scheduled time.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Arweave Status */}
            <div className="border rounded p-4 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Arweave Storage:</span>
                {arweaveStatus === 'checking' ? (
                  <span className="text-gray-500 text-sm">Checking...</span>
                ) : arweaveStatus === 'connected' ? (
                  <span className="text-green-600 dark:text-green-400 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Connected (Irys devnet)
                  </span>
                ) : (
                  <span className="text-yellow-600 dark:text-yellow-400 text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Simulated (service unavailable)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Content is permanently stored on Arweave via Irys bundler for immutability.
              </p>
            </div>

            {/* Submit Status */}
            {submitStatus && (
              <div className={`p-4 rounded ${submitStatus.includes('Error') ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'}`}>
                {submitStatus}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-4">
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Save Draft
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || (mode === 'create' && conflict?.hasConflict)}
                className={`flex-1 py-3 font-semibold rounded disabled:opacity-50 transition-colors ${
                  mode === 'create' && scheduledAt && new Date(scheduledAt) > new Date()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {isSubmitting
                  ? mode === 'create' && scheduledAt && new Date(scheduledAt) > new Date()
                    ? 'Scheduling...'
                    : mode === 'edit'
                      ? 'Updating...'
                      : 'Publishing...'
                  : mode === 'create' && scheduledAt && new Date(scheduledAt) > new Date()
                    ? `Schedule for ${format(new Date(scheduledAt), 'MMM d, HH:mm')}`
                    : mode === 'edit'
                      ? 'Update Post (Create New Version)'
                      : 'Publish Now'
                }
              </button>
            </div>
          </form>
          </div>

          {/* Draft Recovery Modal (create mode only) */}
          {mode === 'create' && (
            <DraftRecoveryModal
              draftId={draftId || ''}
              isOpen={showRecoveryModal}
              onClose={() => setShowRecoveryModal(false)}
              onRestore={handleRestoreFromBackup}
              conflict={conflict || undefined}
            />
          )}

          {/* AI Settings Panel */}
          <AISettingsPanel
            isOpen={aiSettingsOpen}
            onClose={() => setAiSettingsOpen(false)}
          />

          {/* Floating AI Toolbar - appears on text selection */}
          {showFloatingToolbar && selectedText && selectionRect && (
            <FloatingAIToolbar
              selectedText={selectedText}
              selectionRect={selectionRect}
              fullContent={formData.content}
              onReplaceText={handleAIReplaceText}
              onInsertAfter={handleAIInsertAfterSelection}
              onClose={handleFloatingToolbarClose}
              containerRef={editorContainerRef}
            />
          )}
        </div>
      </div>

      {/* AI Assistant Sidebar */}
      <div className={`fixed right-0 top-16 h-[calc(100%-4rem)] z-30 transition-transform duration-300 ${aiSidebarExpanded ? 'translate-x-0' : 'translate-x-full'}`}>
        <AIAssistant
          selectedText={selectedText}
          fullContent={formData.content}
          title={formData.title}
          tags={formData.tags}
          excerpt={formData.excerpt}
          onReplaceText={handleAIReplaceText}
          onInsertText={handleAIInsertText}
          onSuggestTitle={handleAISuggestTitle}
          onSuggestTags={handleAISuggestTags}
          onSuggestExcerpt={handleAISuggestExcerpt}
          onSetCoverImage={handleAISetCoverImage}
          isExpanded={aiSidebarExpanded}
          onToggleExpanded={() => setAiSidebarExpanded(!aiSidebarExpanded)}
        />
      </div>
    </div>
  );
};

export default PostEditor;
