'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PostEditor from '@/components/editor/PostEditor';
import Link from 'next/link';

// Disable static generation for this page (requires IPFS client-side)
export const dynamic = 'force-dynamic';

function AdminPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get('draft');
  const fromPage = searchParams.get('from');

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
        draftId={draftId}
        onDraftIdChange={(id) => {
          window.history.replaceState(null, '', `/admin?draft=${id}`);
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
