'use client';

import { useState, useRef } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import { useToast } from '@/components/ui/Toast';
import { getProfile, getDisplayName } from '@/lib/profiles';
import { usePostBastion } from '@/hooks/use-post-bastion';
import { uploadFileToIPFSViaAPI } from '@/lib/ipfs-client';
import EmojiPicker from './EmojiPicker';
import Link from 'next/link';

interface ComposerProps {
  /** Called after successful post */
  onPostSuccess?: (postId: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Max character count */
  maxLength?: number;
  /** Reply to post ID */
  replyToId?: string;
}

export default function Composer({
  onPostSuccess,
  placeholder = "Quoi de neuf ?",
  maxLength = 280,
  replyToId,
}: ComposerProps) {
  const { address, isConnected } = useWallet();
  const { showToast } = useToast();
  const { postBastion, postReply, isPosting, error: postError, clearError } = usePostBastion();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profile = address ? getProfile(address) : null;
  const displayName = address ? getDisplayName(address, profile) : 'Anonymous';

  const charCount = content.length;
  const charPercentage = (charCount / maxLength) * 100;
  const isOverLimit = charCount > maxLength;
  const isEmpty = content.trim().length === 0;

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    clearError();

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Veuillez choisir un fichier image', 'error');
      return;
    }

    // 5 MB max
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image trop volumineuse (max 5 Mo)', 'error');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!isConnected || isEmpty || isOverLimit || isPosting) return;

    try {
      let imageUrl: string | undefined;

      // Upload image to IPFS if one was selected
      if (imageFile) {
        setIsUploadingImage(true);
        try {
          const cid = await uploadFileToIPFSViaAPI(imageFile);
          imageUrl = `/api/ipfs/${cid}`;
        } catch (err) {
          console.error('Error uploading image:', err);
          showToast('Échec du téléchargement de l\'image', 'error');
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      let postId: string | null;

      if (replyToId) {
        postId = await postReply(content, replyToId);
      } else {
        postId = await postBastion(content, imageUrl);
      }

      if (postId) {
        setContent('');
        removeImage();
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
        showToast(replyToId ? 'Réponse publiée !' : 'Bastion posé !', 'success');
        onPostSuccess?.(postId);
      } else if (postError) {
        showToast(postError, 'error');
      }
    } catch (error) {
      console.error('Error posting:', error);
      showToast('Échec de la publication. Réessayez.', 'error');
    }
  };

  if (!isConnected) {
    return (
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-center text-gray-500 dark:text-gray-400">
          <Link href="/auth/signin" className="text-blue-600 dark:text-blue-400 hover:underline">
            Connectez-vous
          </Link>{' '}
          pour bastonner
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {displayName[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            placeholder={placeholder}
            className="w-full bg-transparent text-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none border-0 focus:ring-0 focus:outline-none min-h-[80px]"
            rows={1}
            disabled={isPosting}
          />

          {/* Image preview */}
          {imagePreview && (
            <div className="relative mt-2 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-64 w-auto rounded-xl"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-gray-900/70 hover:bg-gray-900/90 text-white rounded-full transition-colors"
                title="Supprimer l'image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Error message */}
          {postError && (
            <p className="text-red-500 text-sm mt-1">{postError}</p>
          )}

          {/* Character count and actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            {/* Media buttons */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                type="button"
                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors disabled:opacity-50"
                title="Ajouter une image"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPosting || isUploadingImage}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <EmojiPicker
                onSelect={(emoji) => {
                  setContent(prev => prev + emoji);
                  textareaRef.current?.focus();
                }}
              />
              <Link
                href="/admin?from=feed"
                className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                title="Écrire un article long"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </Link>
            </div>

            {/* Character counter and post button */}
            <div className="flex items-center gap-4">
              {/* Circular progress indicator */}
              {content.length > 0 && (
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 transform -rotate-90">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray={`${Math.min(charPercentage, 100) * 0.88} 88`}
                      className={`
                        transition-all duration-200
                        ${isOverLimit
                          ? 'text-red-500'
                          : charPercentage > 80
                            ? 'text-yellow-500'
                            : 'text-blue-500'
                        }
                      `}
                    />
                  </svg>
                  {charPercentage > 80 && (
                    <span className={`
                      absolute inset-0 flex items-center justify-center text-xs font-medium
                      ${isOverLimit ? 'text-red-500' : 'text-gray-500'}
                    `}>
                      {maxLength - charCount}
                    </span>
                  )}
                </div>
              )}

              {/* Post button */}
              <button
                onClick={handleSubmit}
                disabled={isEmpty || isOverLimit || isPosting || isUploadingImage}
                className={`
                  px-5 py-2 font-bold text-white rounded-full transition-colors
                  ${isEmpty || isOverLimit || isPosting || isUploadingImage
                    ? 'bg-blue-300 dark:bg-blue-800 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                  }
                `}
              >
                {isPosting || isUploadingImage ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Publication...
                  </span>
                ) : (
                  replyToId ? 'Répondre' : 'Bastionne !'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
