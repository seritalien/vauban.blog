'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@/providers/wallet-provider';
import {
  KeyPair,
  ExportedPublicKey,
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptMessage,
  storeKeyPair,
  getStoredKeyPair,
  getKeyFingerprint,
} from '@/lib/crypto';
import { uploadJSONToIPFSViaAPI } from '@/lib/ipfs-client';

// =============================================================================
// TYPES
// =============================================================================

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  status: 'sent' | 'delivered' | 'read';
}

export interface Conversation {
  id: string;
  participant: string;
  participantPublicKey?: ExportedPublicKey;
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: number;
}

export interface UseMessagingResult {
  /** User's key pair (null if not initialized) */
  keyPair: KeyPair | null;
  /** User's public key in exportable format */
  publicKey: ExportedPublicKey | null;
  /** Key fingerprint for verification */
  fingerprint: string | null;
  /** Whether keys are being initialized */
  isInitializing: boolean;
  /** Initialize or load user's encryption keys */
  initializeKeys: () => Promise<void>;
  /** List of conversations */
  conversations: Conversation[];
  /** Messages in current conversation */
  messages: Message[];
  /** Currently selected conversation */
  currentConversation: Conversation | null;
  /** Select a conversation */
  selectConversation: (conversationId: string) => void;
  /** Start a new conversation with a user */
  startConversation: (participantAddress: string, participantPublicKey: ExportedPublicKey) => Promise<void>;
  /** Send a message to current conversation */
  sendMessage: (content: string) => Promise<void>;
  /** Whether a message is being sent */
  isSending: boolean;
  /** Error message */
  error: string | null;
}

// Local storage key for conversations
const CONVERSATIONS_KEY = 'vauban-conversations';
const MESSAGES_KEY = 'vauban-messages';

// =============================================================================
// HOOK
// =============================================================================

export function useMessaging(): UseMessagingResult {
  const { address, isConnected } = useWallet();
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [publicKey, setPublicKey] = useState<ExportedPublicKey | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to avoid stale closures and infinite loops in selectConversation
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  // Load conversations from localStorage
  useEffect(() => {
    if (!address) return;

    const stored = localStorage.getItem(`${CONVERSATIONS_KEY}-${address}`);
    if (stored) {
      try {
        setConversations(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading conversations:', e);
      }
    }
  }, [address]);

  // Save conversations to localStorage
  useEffect(() => {
    if (!address || conversations.length === 0) return;
    localStorage.setItem(`${CONVERSATIONS_KEY}-${address}`, JSON.stringify(conversations));
  }, [address, conversations]);

  // Initialize encryption keys
  const initializeKeys = useCallback(async () => {
    if (!address || isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      // Check if we have stored keys
      let keys = await getStoredKeyPair(address);

      if (!keys) {
        // Generate new key pair
        keys = await generateKeyPair();
        await storeKeyPair(address, keys);
        console.log('Generated new encryption keys');
      } else {
        console.log('Loaded existing encryption keys');
      }

      setKeyPair(keys);

      // Export public key
      const exported = await exportPublicKey(keys.publicKey);
      setPublicKey(exported);

      // Get fingerprint
      const fp = await getKeyFingerprint(keys.publicKey);
      setFingerprint(fp);
    } catch (err) {
      console.error('Error initializing keys:', err);
      setError('Failed to initialize encryption keys');
    } finally {
      setIsInitializing(false);
    }
  }, [address, isInitializing]);

  // Auto-initialize keys when connected
  useEffect(() => {
    if (isConnected && address && !keyPair && !isInitializing) {
      initializeKeys();
    }
  }, [isConnected, address, keyPair, isInitializing, initializeKeys]);

  // Select a conversation and load messages
  const selectConversation = useCallback((conversationId: string) => {
    const conv = conversationsRef.current.find(c => c.id === conversationId);
    if (!conv) return;

    setCurrentConversation(conv);

    // Load messages for this conversation
    const stored = localStorage.getItem(`${MESSAGES_KEY}-${conversationId}`);
    if (stored) {
      try {
        setMessages(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading messages:', e);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }

    // Mark as read
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      )
    );
  }, []);

  // Start a new conversation
  const startConversation = useCallback(async (
    participantAddress: string,
    participantPublicKey: ExportedPublicKey
  ) => {
    if (!address) {
      setError('Not connected');
      return;
    }

    // Check if conversation already exists
    const existing = conversations.find(c => c.participant === participantAddress);
    if (existing) {
      selectConversation(existing.id);
      return;
    }

    // Create new conversation
    const newConv: Conversation = {
      id: `${address}-${participantAddress}`,
      participant: participantAddress,
      participantPublicKey,
      unreadCount: 0,
      updatedAt: Date.now(),
    };

    setConversations(prev => [newConv, ...prev]);
    setCurrentConversation(newConv);
    setMessages([]);
  }, [address, conversations, selectConversation]);

  // Send a message
  const sendMessage = useCallback(async (content: string) => {
    if (!keyPair || !currentConversation || !address) {
      setError('Cannot send message: not initialized');
      return;
    }

    if (!currentConversation.participantPublicKey) {
      setError('Recipient public key not available');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      // Import recipient's public key
      const recipientPublicKey = await importPublicKey(currentConversation.participantPublicKey);

      // Encrypt the message
      const encrypted = await encryptMessage(
        content,
        keyPair.privateKey,
        keyPair.publicKey,
        recipientPublicKey
      );

      // Upload encrypted message to IPFS
      const messageData = {
        encrypted,
        from: address,
        to: currentConversation.participant,
        timestamp: Date.now(),
      };
      const cid = await uploadJSONToIPFSViaAPI(messageData);

      // Create message object
      const newMessage: Message = {
        id: cid,
        from: address,
        to: currentConversation.participant,
        content,
        timestamp: Date.now(),
        status: 'sent',
      };

      // Add to messages
      setMessages(prev => [...prev, newMessage]);

      // Update conversation
      setConversations(prev =>
        prev.map(c =>
          c.id === currentConversation.id
            ? { ...c, lastMessage: newMessage, updatedAt: Date.now() }
            : c
        )
      );

      // Save messages to localStorage
      const conversationMessages = [...messages, newMessage];
      localStorage.setItem(
        `${MESSAGES_KEY}-${currentConversation.id}`,
        JSON.stringify(conversationMessages)
      );

      // TODO: Notify recipient via on-chain event or push notification
      console.log('Message sent and stored on IPFS:', cid);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [keyPair, currentConversation, address, messages]);

  return {
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
  };
}

export default useMessaging;
