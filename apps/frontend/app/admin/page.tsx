'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';

// Disable static generation for this page (requires IPFS client-side)
export const dynamic = 'force-dynamic';
import { useWallet } from '@/providers/wallet-provider';
import { PostInputSchema } from '@vauban/shared-types';
import {
  calculateContentHash,
  publishPost,
} from '@vauban/web3-utils';
import { useRouter, useSearchParams } from 'next/navigation';
import ImageUpload from '@/components/editor/ImageUpload';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import TagInput from '@/components/editor/TagInput';
import SaveStatusIndicator from '@/components/editor/SaveStatusIndicator';
import DraftRecoveryModal from '@/components/editor/DraftRecoveryModal';
import {
  getDraft,
  saveDraft,
  deleteDraft,
  releaseDraftLock,
  type Draft,
} from '@/lib/drafts';
import { useDraftAutosave } from '@/hooks/useDraftAutosave';
import Link from 'next/link';
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
  return result.Hash;
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

// Inner component that uses useSearchParams
function AdminPageInner() {
  const { account, isConnected } = useWallet();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    tags: [] as string[],
    coverImage: '',
    isPaid: false,
    price: 0,
    isEncrypted: false,
  });

  const [draftId, setDraftId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string>('');
  const [arweaveStatus, setArweaveStatus] = useState<'checking' | 'connected' | 'unavailable'>('checking');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

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

  // Use the autosave hook with versioning and conflict detection
  const {
    saveStatus,
    lastSavedAt,
    hasSnapshots,
    snapshotCount,
    conflict,
    dismissConflict,
  } = useDraftAutosave({
    draftId,
    formData: draftFormData,
    onDraftIdChange: (id) => {
      setDraftId(id);
      window.history.replaceState(null, '', `/admin?draft=${id}`);
    },
    onConflictDetected: () => {
      setShowRecoveryModal(true);
    },
    onRemoteUpdate: (draft) => {
      // Optionally update form with remote changes (for now, just show conflict)
      console.log('Remote update detected:', draft.updatedAt);
    },
  });

  // Generate slug from title
  const generateSlug = (title: string): string => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
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

  // Load draft from URL params
  useEffect(() => {
    const draftIdParam = searchParams.get('draft');
    if (draftIdParam) {
      const draft = getDraft(draftIdParam);
      if (draft) {
        setDraftId(draft.id);
        setFormData({
          title: draft.title,
          slug: draft.slug,
          content: draft.content,
          excerpt: draft.excerpt,
          // Convert comma-separated string from draft to array
          tags: draft.tags ? draft.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          coverImage: draft.coverImage,
          isPaid: draft.isPaid,
          price: draft.price,
          isEncrypted: false,
        });
        // If draft has a slug, consider it manually edited
        if (draft.slug) {
          setSlugManuallyEdited(true);
        }
        if (draft.scheduledAt) {
          setScheduledAt(draft.scheduledAt.slice(0, 16)); // Format for datetime-local input
        }
      }
    }
  }, [searchParams]);

  // Check Arweave connection on mount
  useEffect(() => {
    fetch('/api/arweave/add')
      .then((res) => res.json())
      .then((data) => setArweaveStatus(data.status === 'connected' ? 'connected' : 'unavailable'))
      .catch(() => setArweaveStatus('unavailable'));
  }, []);

  // Cleanup on unmount - release lock
  useEffect(() => {
    return () => {
      if (draftId) {
        releaseDraftLock(draftId);
      }
    };
  }, [draftId]);

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
    // Dismiss any conflict
    dismissConflict();
  }, [dismissConflict]);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Admin Editor</h1>
          <p className="text-gray-600">Please connect your wallet to publish articles.</p>
        </div>
      </div>
    );
  }

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!account) return;

    try {
      setIsPublishing(true);
      setPublishStatus('Validating...');

      // Parse and validate with Zod
      const postData = PostInputSchema.parse({
        ...formData,
        // Tags are already an array from TagInput
        tags: formData.tags,
        // Only include coverImage if it's a non-empty URL
        coverImage: formData.coverImage?.trim() || undefined,
      });

      // Step 1: Upload to IPFS (fast cache) via proxy
      setPublishStatus('Uploading to IPFS...');
      const ipfsCid = await uploadJSONToIPFSProxy(postData);
      console.log('IPFS CID:', ipfsCid);

      // Step 2: Upload to Arweave (permanent storage via Irys)
      setPublishStatus('Uploading to Arweave (permanent storage)...');
      const arweaveResult = await uploadJSONToArweaveProxy(postData);
      const arweaveTxId = arweaveResult.txId;

      if (arweaveResult.simulated) {
        console.log('Arweave TX ID (simulated):', arweaveTxId);
      } else {
        console.log('Arweave TX ID:', arweaveTxId);
      }

      // Step 3: Calculate content hash
      setPublishStatus('Calculating content hash...');
      const contentHash = await calculateContentHash(JSON.stringify(postData));

      // Step 4: Publish to blockchain
      setPublishStatus('Publishing to blockchain...');
      const price = (formData.price * 1e18).toString(); // Convert to Wei
      const txHash = await publishPost(
        account,
        arweaveTxId,
        ipfsCid,
        contentHash,
        price,
        formData.isEncrypted
      );

      setPublishStatus('Published successfully!');
      console.log('Transaction hash:', txHash);

      // Delete draft after successful publish
      if (draftId) {
        deleteDraft(draftId);
      }

      // Redirect to homepage after 2s
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Publishing failed:', error);
      setPublishStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = () => {
    if (!formData.title && !formData.content) return;

    const saved = saveDraft({
      ...formData,
      // Convert tags array back to comma-separated string for draft storage
      tags: formData.tags.join(', '),
      id: draftId || undefined,
      scheduledAt: scheduledAt || undefined,
    });
    setDraftId(saved.id);
    window.history.replaceState(null, '', `/admin?draft=${saved.id}`);
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
    window.history.replaceState(null, '', '/admin');
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
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header with drafts link and save status indicator */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">
            {draftId ? 'Edit Draft' : 'New Article'}
          </h1>
          <div className="flex items-center gap-4">
            {/* Save status indicator with backup history */}
            <SaveStatusIndicator
              status={conflict?.hasConflict ? 'conflict' : saveStatus}
              lastSavedAt={lastSavedAt}
              hasSnapshots={hasSnapshots}
              onViewSnapshots={draftId ? handleViewSnapshots : undefined}
            />
            <Link
              href="/admin/drafts"
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              View Drafts
            </Link>
          </div>
        </div>

        {/* Conflict warning banner */}
        {conflict?.hasConflict && (
          <div className="flex items-center gap-3 mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
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

        {/* Draft actions bar */}
        {draftId && !conflict?.hasConflict && (
          <div className="flex items-center gap-2 mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
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

        <form onSubmit={handlePublish} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
              required
            />
          </div>

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

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-semibold mb-2">Excerpt</label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="w-full border rounded px-4 py-2"
              rows={3}
              required
            />
          </div>

          {/* Content (MDX) */}
          <div>
            <label className="block text-sm font-semibold mb-2">Content (Markdown)</label>
            <MarkdownEditor
              value={formData.content}
              onChange={(content) => setFormData({ ...formData, content })}
              placeholder="Write your article content in Markdown..."
              minHeight={500}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2">Tags</label>
            <TagInput
              value={formData.tags}
              onChange={(tags) => setFormData({ ...formData, tags })}
              placeholder="Add tags..."
              maxTags={10}
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-semibold mb-2">Cover Image</label>
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
                    className="flex-1 border rounded px-4 py-2 text-sm"
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
          </div>

          {/* Pricing */}
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
                className="border rounded px-4 py-2 w-32"
                placeholder="0.0"
                step="0.01"
                min="0"
              />
            )}
          </div>

          {/* Scheduled Publishing */}
          <div>
            <label className="block text-sm font-semibold mb-2">Schedule Publishing (optional)</label>
            <div className="flex items-center gap-4">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                className="border rounded px-4 py-2 dark:bg-gray-900"
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
            {scheduledAt && (
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                Article will be published on {format(new Date(scheduledAt), 'MMMM d, yyyy')} at {format(new Date(scheduledAt), 'HH:mm')}
              </p>
            )}
          </div>

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

          {/* Publish Status */}
          {publishStatus && (
            <div className={`p-4 rounded ${publishStatus.includes('Error') ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'}`}>
              {publishStatus}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={isPublishing || conflict?.hasConflict}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPublishing
                ? 'Publishing...'
                : scheduledAt
                  ? `Schedule for ${format(new Date(scheduledAt), 'MMM d')}`
                  : 'Publish Now'
              }
            </button>
          </div>
        </form>

        {/* Draft Recovery Modal */}
        <DraftRecoveryModal
          draftId={draftId || ''}
          isOpen={showRecoveryModal}
          onClose={() => setShowRecoveryModal(false)}
          onRestore={handleRestoreFromBackup}
          conflict={conflict || undefined}
        />
      </div>
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function AdminPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <AdminPageInner />
    </Suspense>
  );
}
