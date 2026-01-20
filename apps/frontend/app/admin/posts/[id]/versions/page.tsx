'use client';

import { useState, useEffect, use } from 'react';
import { getPostVersions, PostVersion } from '@vauban/web3-utils';
import { format } from 'date-fns';
import Link from 'next/link';

export default function PostVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = use(params);
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVersion, setCurrentVersion] = useState<number>(0);

  useEffect(() => {
    async function loadVersions() {
      try {
        setIsLoading(true);

        // Get version count for current version indicator
        const versionCount = await import('@vauban/web3-utils').then(m => m.getPostVersionCount(postId));
        setCurrentVersion(versionCount);

        // Get version history
        const fetchedVersions = await getPostVersions(postId, 50, 0);
        setVersions(fetchedVersions);
      } catch (error) {
        console.error('Failed to load versions:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadVersions();
  }, [postId]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Version History</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Post #{postId}</p>
          </div>
          <Link
            href="/admin/posts"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Back to Posts
          </Link>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading versions...</p>
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">No version history available.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {versions.map((version) => (
              <div
                key={version.version}
                className={`p-6 rounded-lg border ${
                  version.version === currentVersion
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Version {version.version}
                      </h3>
                      {version.version === currentVersion && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {format(new Date(version.createdAt * 1000), 'MMMM d, yyyy HH:mm:ss')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">IPFS CID:</span>
                    <p className="font-mono text-gray-600 dark:text-gray-400 break-all">
                      {version.ipfsCid || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Arweave TX:</span>
                    <p className="font-mono text-gray-600 dark:text-gray-400 break-all">
                      {version.arweaveTxId || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Content Hash:</span>
                    <p className="font-mono text-gray-600 dark:text-gray-400 break-all">
                      {version.contentHash.slice(0, 20)}...
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Editor:</span>
                    <p className="font-mono text-gray-600 dark:text-gray-400">
                      {version.editor.slice(0, 10)}...{version.editor.slice(-6)}
                    </p>
                  </div>
                </div>

                {version.ipfsCid && (
                  <div className="mt-4 flex gap-2">
                    <a
                      href={`/api/ipfs/${version.ipfsCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      View on IPFS
                    </a>
                    {version.arweaveTxId && !version.arweaveTxId.startsWith('ar_') && (
                      <a
                        href={`https://arweave.net/${version.arweaveTxId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        View on Arweave
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">About Version History</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Every time a post is updated, a new version is created. The blockchain stores all versions,
            allowing you to track changes over time. Previous content remains accessible via IPFS/Arweave.
          </p>
        </div>
      </div>
    </div>
  );
}
