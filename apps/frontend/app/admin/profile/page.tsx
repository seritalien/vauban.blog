'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { getProfile, saveProfile, formatAddress } from '@/lib/profiles';
import ImageUpload from '@/components/editor/ImageUpload';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function ProfileSettingsPage() {
  const { address, isConnected } = useWallet();

  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    avatar: '',
    website: '',
    twitter: '',
    github: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Load existing profile
  useEffect(() => {
    if (address) {
      const existing = getProfile(address);
      if (existing) {
        setFormData({
          displayName: existing.displayName || '',
          bio: existing.bio || '',
          avatar: existing.avatar || '',
          website: existing.website || '',
          twitter: existing.twitter || '',
          github: existing.github || '',
        });
      }
    }
  }, [address]);

  const handleSave = () => {
    if (!address) return;

    setIsSaving(true);
    try {
      saveProfile({
        address: address,
        displayName: formData.displayName || undefined,
        bio: formData.bio || undefined,
        avatar: formData.avatar || undefined,
        website: formData.website || undefined,
        twitter: formData.twitter || undefined,
        github: formData.github || undefined,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-4">Profile Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please connect your wallet to edit your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <Link
            href={`/authors/${address}`}
            className="text-sm text-blue-600 hover:underline"
          >
            View Public Profile
          </Link>
        </div>

        <div className="space-y-6">
          {/* Avatar */}
          <div>
            <label className="block text-sm font-semibold mb-2">Profile Picture</label>
            {formData.avatar ? (
              <div className="flex items-center gap-4">
                <img
                  src={formData.avatar}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover"
                />
                <div className="flex-1">
                  <input
                    type="url"
                    value={formData.avatar}
                    onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                    className="w-full border rounded px-4 py-2 text-sm dark:bg-gray-900 dark:border-gray-700"
                    placeholder="Image URL"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, avatar: '' })}
                    className="mt-2 text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <ImageUpload
                onUpload={(url) => setFormData({ ...formData, avatar: url })}
              />
            )}
          </div>

          {/* Wallet Address (read-only) */}
          <div>
            <label className="block text-sm font-semibold mb-2">Wallet Address</label>
            <input
              type="text"
              value={address || ''}
              disabled
              className="w-full border rounded px-4 py-2 bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono text-sm dark:border-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Your wallet address cannot be changed.
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-semibold mb-2">Display Name</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
              placeholder={formatAddress(address || '')}
              maxLength={50}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              If empty, your wallet address will be displayed.
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold mb-2">Bio</label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
              rows={4}
              placeholder="Tell readers about yourself..."
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {formData.bio.length}/500 characters
            </p>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-semibold mb-2">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
              placeholder="https://yourwebsite.com"
            />
          </div>

          {/* Twitter */}
          <div>
            <label className="block text-sm font-semibold mb-2">Twitter</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 rounded-l bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:border-gray-700">
                @
              </span>
              <input
                type="text"
                value={formData.twitter.replace('@', '')}
                onChange={(e) => setFormData({ ...formData, twitter: e.target.value.replace('@', '') })}
                className="flex-1 border rounded-r px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
                placeholder="username"
                maxLength={15}
              />
            </div>
          </div>

          {/* GitHub */}
          <div>
            <label className="block text-sm font-semibold mb-2">GitHub</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 rounded-l bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 dark:border-gray-700">
                github.com/
              </span>
              <input
                type="text"
                value={formData.github}
                onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                className="flex-1 border rounded-r px-4 py-2 dark:bg-gray-900 dark:border-gray-700"
                placeholder="username"
                maxLength={39}
              />
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>

            {saveStatus === 'saved' && (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Profile saved!
              </span>
            )}

            {saveStatus === 'error' && (
              <span className="text-red-600 dark:text-red-400">
                Failed to save profile
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
