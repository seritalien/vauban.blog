'use client';

import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { getProfile, getDisplayName, formatAddress } from '@/lib/profiles';
import type { Conversation } from '@/hooks/use-messaging';

interface ConversationListProps {
  conversations: Conversation[];
  currentId?: string;
  onSelect: (id: string) => void;
}

export default function ConversationList({
  conversations,
  currentId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-1">
            Pas de conversations
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Commencez une conversation depuis le profil d'un utilisateur
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv, index) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isSelected={conv.id === currentId}
          onClick={() => onSelect(conv.id)}
          index={index}
        />
      ))}
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
  index,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  const profile = getProfile(conversation.participant);
  const displayName = getDisplayName(conversation.participant, profile);

  return (
    <motion.button
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-4 text-left
        border-b border-gray-100 dark:border-gray-800
        transition-colors
        ${isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
      `}
    >
      {/* Avatar */}
      {profile?.avatar ? (
        <img
          src={profile.avatar}
          alt={displayName}
          className="w-12 h-12 rounded-full object-cover"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
          {displayName[0]?.toUpperCase() || '?'}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-medium text-gray-900 dark:text-white truncate">
            {displayName}
          </span>
          {conversation.lastMessage && (
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
              {formatDistanceToNow(conversation.lastMessage.timestamp, { addSuffix: true })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            {conversation.lastMessage?.content || `@${formatAddress(conversation.participant)}`}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-500 text-white rounded-full">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
