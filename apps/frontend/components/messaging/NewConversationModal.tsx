'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/providers/wallet-provider';
import { useFollowStats } from '@/hooks/use-follow';
import { getProfile, getDisplayName, formatAddress } from '@/lib/profiles';
import { lookupPublicKeyByAddress, fetchPublicKey } from '@/lib/public-key-registry';
import type { ExportedPublicKey } from '@/lib/crypto';

// =============================================================================
// TYPES
// =============================================================================

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecipient: (address: string, publicKey?: ExportedPublicKey) => void;
  /** Pre-fill address (from ?to= query param) */
  initialAddress?: string;
}

type Tab = 'following' | 'search';

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Modal for selecting a message recipient.
 *
 * Displays two tabs:
 * - Following: List of users the current user follows
 * - Search: Search by address
 */
export default function NewConversationModal({
  isOpen,
  onClose,
  onSelectRecipient,
  initialAddress,
}: NewConversationModalProps) {
  const { address } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('following');
  const [searchQuery, setSearchQuery] = useState('');

  // Get following list
  const { following, isLoading, hasMoreFollowing, loadMoreFollowing } = useFollowStats(address);

  // If there's an initial address, switch to search tab
  useEffect(() => {
    if (initialAddress) {
      setSearchQuery(initialAddress);
      setActiveTab('search');
    }
  }, [initialAddress]);

  // Filter following list by search query
  const filteredFollowing = useMemo(() => {
    if (!searchQuery) return following;
    const query = searchQuery.toLowerCase();
    return following.filter((addr) => {
      const profile = getProfile(addr);
      const name = getDisplayName(addr, profile);
      return addr.toLowerCase().includes(query) || name.toLowerCase().includes(query);
    });
  }, [following, searchQuery]);

  // Check if search query looks like a valid address
  const isValidAddressQuery = useMemo(() => {
    return /^0x[a-fA-F0-9]+$/.test(searchQuery) && searchQuery.length >= 10;
  }, [searchQuery]);

  const [isLookingUp, setIsLookingUp] = useState(false);
  const [fallbackAddress, setFallbackAddress] = useState<string | null>(null);
  const [manualCid, setManualCid] = useState('');

  const handleSelect = useCallback(async (recipientAddress: string) => {
    setIsLookingUp(true);
    try {
      const pubKey = await lookupPublicKeyByAddress(recipientAddress);
      if (pubKey) {
        onSelectRecipient(recipientAddress, pubKey);
        onClose();
      } else {
        // No key discoverable — show manual CID input fallback
        setFallbackAddress(recipientAddress);
      }
    } catch (err) {
      console.error('Key lookup failed:', err);
      setFallbackAddress(recipientAddress);
    } finally {
      setIsLookingUp(false);
    }
  }, [onSelectRecipient, onClose]);

  const handleManualCidSubmit = useCallback(async () => {
    if (!fallbackAddress || !manualCid.trim()) return;
    setIsLookingUp(true);
    try {
      const pubKey = await fetchPublicKey(fallbackAddress, manualCid.trim());
      onSelectRecipient(fallbackAddress, pubKey ?? undefined);
      onClose();
    } catch (err) {
      console.error('Manual CID fetch failed:', err);
      onSelectRecipient(fallbackAddress);
      onClose();
    } finally {
      setIsLookingUp(false);
      setFallbackAddress(null);
      setManualCid('');
    }
  }, [fallbackAddress, manualCid, onSelectRecipient, onClose]);

  const handleSkipKeyExchange = useCallback(() => {
    if (fallbackAddress) {
      onSelectRecipient(fallbackAddress);
      onClose();
      setFallbackAddress(null);
      setManualCid('');
    }
  }, [fallbackAddress, onSelectRecipient, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Nouvelle conversation
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('following')}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === 'following'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              Abonnements
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`
                flex-1 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === 'search'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              Rechercher
            </button>
          </div>

          {/* Search input */}
          <div className="p-4">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'following' ? 'Filtrer par nom...' : 'Entrer une adresse 0x...'}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {activeTab === 'following' ? (
              <>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredFollowing.length > 0 ? (
                  <>
                    {filteredFollowing.map((addr) => (
                      <RecipientItem
                        key={addr}
                        address={addr}
                        onSelect={handleSelect}
                      />
                    ))}
                    {hasMoreFollowing && (
                      <button
                        onClick={loadMoreFollowing}
                        className="w-full py-3 text-sm text-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        Charger plus...
                      </button>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? (
                      <p>Aucun abonnement correspondant</p>
                    ) : (
                      <>
                        <p className="mb-2">Vous ne suivez personne</p>
                        <p className="text-sm">Suivez des utilisateurs pour leur envoyer des messages</p>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Search tab */}
                {isValidAddressQuery ? (
                  <RecipientItem
                    address={searchQuery}
                    onSelect={handleSelect}
                  />
                ) : searchQuery ? (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p>Entrez une adresse Starknet valide</p>
                    <p className="text-sm mt-1">Format: 0x suivi de caracteres hexadecimaux</p>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <p>Recherchez un utilisateur par adresse</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Loading overlay */}
          {isLookingUp && (
            <div className="flex justify-center py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Fallback: manual CID input when key not discoverable */}
          {fallbackAddress && !isLookingUp && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-yellow-50 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
                Cle publique introuvable pour {formatAddress(fallbackAddress)}.
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
                Collez le CID IPFS de la cle publique du destinataire, ou continuez sans chiffrement.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCid}
                  onChange={(e) => setManualCid(e.target.value)}
                  placeholder="QmXxx... ou bafyxxx..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 rounded-lg border border-yellow-300 dark:border-yellow-600 focus:ring-2 focus:ring-yellow-500"
                />
                <button
                  onClick={handleManualCidSubmit}
                  disabled={!manualCid.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  OK
                </button>
              </div>
              <button
                onClick={handleSkipKeyExchange}
                className="mt-2 w-full text-xs text-yellow-700 dark:text-yellow-400 hover:underline"
              >
                Continuer sans cle (pas de chiffrement E2E)
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Les messages sont chiffres de bout en bout
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// RECIPIENT ITEM
// =============================================================================

interface RecipientItemProps {
  address: string;
  onSelect: (address: string) => void;
}

function RecipientItem({ address, onSelect }: RecipientItemProps) {
  const profile = getProfile(address);
  const displayName = getDisplayName(address, profile);

  return (
    <button
      onClick={() => onSelect(address)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
    >
      {/* Avatar */}
      {profile?.avatar ? (
        <img
          src={profile.avatar}
          alt={displayName}
          className="w-10 h-10 rounded-full object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {displayName[0]?.toUpperCase() || '?'}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {displayName}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {formatAddress(address)}
        </p>
      </div>

      {/* Arrow */}
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
