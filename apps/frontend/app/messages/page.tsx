'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/providers/wallet-provider';
import { useMessaging } from '@/hooks/use-messaging';
import {
  ConversationList,
  MessageThread,
  MessageInput,
  NewConversationModal,
} from '@/components/messaging';
import type { ExportedPublicKey } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useWallet();
  const {
    keyPair,
    publicKey,
    fingerprint,
    isInitializing,
    initializeKeys,
    conversations,
    messages,
    currentConversation,
    selectConversation,
    startConversation,
    sendMessage,
    isSending,
    error,
  } = useMessaging();

  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const handledToRef = useRef<string | null>(null);

  // Get the ?to= query parameter
  const toAddress = searchParams.get('to');

  // Initialize keys on mount
  useEffect(() => {
    if (isConnected && !keyPair && !isInitializing) {
      initializeKeys();
    }
  }, [isConnected, keyPair, isInitializing, initializeKeys]);

  // Handle ?to= query parameter - open modal with pre-filled address (one-shot)
  useEffect(() => {
    if (!toAddress || !keyPair || isInitializing) return;
    if (handledToRef.current === toAddress) return;
    handledToRef.current = toAddress;

    const existingConv = conversations.find(
      (c) => c.participant.toLowerCase() === toAddress.toLowerCase()
    );

    if (existingConv) {
      selectConversation(existingConv.id);
      router.replace('/messages');
    } else {
      setIsNewConversationOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toAddress, keyPair, isInitializing]);

  // Handle recipient selection from modal
  const handleSelectRecipient = async (recipientAddress: string, recipientPublicKey?: ExportedPublicKey) => {
    // If we have the recipient's public key, start the conversation
    if (recipientPublicKey) {
      await startConversation(recipientAddress, recipientPublicKey);
    } else if (publicKey) {
      // For now, use our own public key as a placeholder
      // In production, we'd fetch the recipient's public key from their profile
      // TODO: Implement public key registry/exchange
      await startConversation(recipientAddress, publicKey);
    }

    // Clear the query param
    router.replace('/messages');
  };

  // Not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Messages chiffrés
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
            Connectez-vous pour accéder à vos messages privés chiffrés de bout en bout.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-full transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  // Initializing keys
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">
            Initialisation du chiffrement...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto h-screen flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <Link
              href="/feed"
              className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Messages
              </h1>
              {fingerprint && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Empreinte: {fingerprint}
                </p>
              )}
            </div>
          </div>

          {/* New conversation button */}
          <button
            onClick={() => setIsNewConversationOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            title="Nouveau message"
          >
            <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </header>

        {/* New conversation modal */}
        <NewConversationModal
          isOpen={isNewConversationOpen}
          onClose={() => {
            setIsNewConversationOpen(false);
            // Clear the ?to= param if it was set
            if (toAddress) {
              router.replace('/messages');
            }
          }}
          onSelectRecipient={handleSelectRecipient}
          initialAddress={toAddress || undefined}
        />

        {/* Error display */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation list (sidebar on desktop) */}
          <div className={`
            w-full md:w-80 lg:w-96 flex-shrink-0
            border-r border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-900
            ${currentConversation ? 'hidden md:flex' : 'flex'}
            flex-col
          `}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <input
                type="search"
                placeholder="Rechercher..."
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg border-0 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <ConversationList
              conversations={conversations}
              currentId={currentConversation?.id}
              onSelect={selectConversation}
            />
          </div>

          {/* Message thread */}
          <div className={`
            flex-1 flex flex-col
            ${!currentConversation ? 'hidden md:flex' : 'flex'}
          `}>
            {/* Back button on mobile */}
            {currentConversation && (
              <button
                onClick={() => selectConversation('')}
                className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 text-blue-500"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Retour
              </button>
            )}

            <MessageThread
              messages={messages}
              conversation={currentConversation}
              currentUserAddress={address || ''}
            />

            {currentConversation && (
              <MessageInput
                onSend={sendMessage}
                isSending={isSending}
                disabled={!currentConversation.participantPublicKey}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
