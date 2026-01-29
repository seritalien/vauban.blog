'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PostEditor from '@/components/editor/PostEditor';
import Link from 'next/link';
import { getDrafts } from '@/lib/drafts';

// Disable static generation for this page (requires IPFS client-side)
export const dynamic = 'force-dynamic';

// How recently a draft must have been updated to auto-resume (1 hour)
const AUTO_RESUME_MAX_AGE_MS = 3_600_000;

function AdminPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftIdParam = searchParams.get('draft');
  const fromPage = searchParams.get('from');

  // Auto-resume the most recent draft when no explicit ?draft= param
  const [resolvedDraftId, setResolvedDraftId] = useState<string | null>(draftIdParam);

  useEffect(() => {
    if (draftIdParam) return; // Explicit draft param takes precedence

    const drafts = getDrafts();
    if (drafts.length === 0) return;

    const latest = drafts[0]; // Most recent (sorted by updatedAt desc)
    const updatedAt = new Date(latest.updatedAt).getTime();
    const isRecent = Date.now() - updatedAt < AUTO_RESUME_MAX_AGE_MS;
    const hasContent = !!(latest.title || latest.content);

    if (isRecent && hasContent) {
      setResolvedDraftId(latest.id);
      // Update URL to reflect the resumed draft
      const params = new URLSearchParams();
      params.set('draft', latest.id);
      if (fromPage) params.set('from', fromPage);
      window.history.replaceState(null, '', `/admin?${params.toString()}`);
    }
  }, [draftIdParam, fromPage]);

  return (
    <div className="min-h-screen">
      {/* Header with drafts link */}
      <div className="container mx-auto px-4 pt-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between mb-4">
          <Link
            href="/admin/drafts"
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            View Drafts
          </Link>
        </div>
      </div>

      {/* PostEditor handles everything */}
      <PostEditor
        mode="create"
        draftId={resolvedDraftId}
        onDraftIdChange={(id) => {
          setResolvedDraftId(id);
          const params = new URLSearchParams();
          params.set('draft', id);
          if (fromPage) params.set('from', fromPage);
          window.history.replaceState(null, '', `/admin?${params.toString()}`);
        }}
        onSuccess={() => {
          router.push(fromPage === 'feed' ? '/feed' : '/');
        }}
      />
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function AdminPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <AdminPageInner />
    </Suspense>
  );
}
