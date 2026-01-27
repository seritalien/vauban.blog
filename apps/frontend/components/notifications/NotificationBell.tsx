'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '@/providers/wallet-provider';
import { formatDistanceToNow } from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

export type NotificationType = 'like' | 'comment' | 'follow' | 'mention' | 'message';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  fromAddress?: string;
  link?: string;
  createdAt: number;
  read: boolean;
}

// =============================================================================
// LOCAL STORAGE
// =============================================================================

const NOTIFICATIONS_KEY = 'vauban-notifications';

function getStoredNotifications(address: string): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(`${NOTIFICATIONS_KEY}-${address}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStoredNotifications(address: string, notifications: Notification[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${NOTIFICATIONS_KEY}-${address}`, JSON.stringify(notifications));
}

// =============================================================================
// HOOK
// =============================================================================

function useNotifications() {
  const { address } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load on mount
  useEffect(() => {
    if (!address) return;
    setNotifications(getStoredNotifications(address));
  }, [address]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    if (!address) return;
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    setStoredNotifications(address, updated);
  }, [address, notifications]);

  const markRead = useCallback((id: string) => {
    if (!address) return;
    const updated = notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    setStoredNotifications(address, updated);
  }, [address, notifications]);

  const clearAll = useCallback(() => {
    if (!address) return;
    setNotifications([]);
    setStoredNotifications(address, []);
  }, [address]);

  return { notifications, unreadCount, markAllRead, markRead, clearAll };
}

// =============================================================================
// NOTIFICATION ICON
// =============================================================================

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'like':
      return (
        <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      );
    case 'comment':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
      );
    case 'follow':
      return (
        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
      );
    case 'mention':
      return (
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
          </svg>
        </div>
      );
    case 'message':
      return (
        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      );
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function NotificationBell() {
  const { isConnected } = useWallet();
  const { notifications, unreadCount, markAllRead, markRead, clearAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!isConnected) return null;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markAllRead();
          }
        }}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
        title="Notifications"
      >
        <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                  Tout effacer
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm">Aucune notification</p>
                </div>
              ) : (
                notifications.slice(0, 20).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markRead}
                    onClose={() => setIsOpen(false)}
                  />
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-2">
                <Link
                  href="/messages"
                  className="block text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  onClick={() => setIsOpen(false)}
                >
                  Voir les messages
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================================================
// NOTIFICATION ITEM
// =============================================================================

function NotificationItem({
  notification,
  onRead,
  onClose,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onClose: () => void;
}) {
  const handleClick = () => {
    onRead(notification.id);
    onClose();
  };

  const content = (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer
        ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
      `}
      onClick={handleClick}
    >
      {getNotificationIcon(notification.type)}

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 dark:text-gray-100">
          {notification.message}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
        </p>
      </div>

      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
      )}
    </div>
  );

  if (notification.link) {
    return <Link href={notification.link}>{content}</Link>;
  }

  return content;
}
