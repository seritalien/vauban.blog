'use client';

import { useState } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { PostInputSchema } from '@vauban/shared-types';
import {
  uploadJSONToIPFS,
  uploadJSONToArweave,
  calculateContentHash,
  publishPost,
} from '@vauban/web3-utils';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { account, isConnected } = useWallet();
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    tags: '',
    coverImage: '',
    isPaid: false,
    price: 0,
    isEncrypted: false,
  });

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string>('');

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
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      });

      // Step 1: Upload to IPFS (fast cache)
      setPublishStatus('Uploading to IPFS...');
      const ipfsCid = await uploadJSONToIPFS(postData);
      console.log('IPFS CID:', ipfsCid);

      // Step 2: Upload to Arweave (permanent storage)
      // Note: Requires Arweave wallet - for now, simulate
      setPublishStatus('Uploading to Arweave... (simulated)');
      const arweaveTxId = `ar_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      console.log('Arweave TX ID (simulated):', arweaveTxId);

      // In production:
      // const arweaveWallet = await loadArweaveWallet(walletJson);
      // const arweaveTxId = await uploadJSONToArweave(postData, arweaveWallet);

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

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Publish Article</h1>

        <form onSubmit={handlePublish} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border rounded px-4 py-2"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold mb-2">Slug (URL)</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full border rounded px-4 py-2"
              placeholder="my-article-slug"
              required
            />
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
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full border rounded px-4 py-2 font-mono"
              rows={20}
              required
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-semibold mb-2">Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              className="w-full border rounded px-4 py-2"
              placeholder="web3, blockchain, tutorial"
            />
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-semibold mb-2">Cover Image URL</label>
            <input
              type="url"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              className="w-full border rounded px-4 py-2"
            />
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

          {/* Publish Status */}
          {publishStatus && (
            <div className={`p-4 rounded ${publishStatus.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
              {publishStatus}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPublishing}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isPublishing ? 'Publishing...' : 'Publish Article'}
          </button>
        </form>
      </div>
    </div>
  );
}
