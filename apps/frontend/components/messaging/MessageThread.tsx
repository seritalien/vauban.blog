'use client';

import { useRef, useEffect } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { getProfile, getDisplayName } from '@/lib/profiles';
import type { Message, Conversation } from '@/hooks/use-messaging';

interface MessageThreadProps {
  messages: Message[];
  conversation: Conversation | null;
  currentUserAddress: string;
}

export default function MessageThread({
  messages,
  conversation,
  currentUserAddress,
}: MessageThreadProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900/50">
        <div>
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Messages chiffrés
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            Vos messages sont chiffrés de bout en bout. Personne d&apos;autre ne peut les lire.
          </p>
        </div>
      </div>
    );
  }

  const participantProfile = getProfile(conversation.participant);
  const participantName = getDisplayName(conversation.participant, participantProfile);

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        {participantProfile?.avatar ? (
          <img
            src={participantProfile.avatar}
            alt={participantName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            {participantName[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {participantName}
          </h2>
          <p className="text-xs text-green-500 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Chiffré de bout en bout
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <span className="px-3 py-1 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                {date}
              </span>
            </div>

            {/* Messages for this date */}
            <div className="space-y-2">
              {dateMessages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.from === currentUserAddress}
                  index={index}
                />
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  index,
}: {
  message: Message;
  isOwn: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.02 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`
          max-w-[70%] px-4 py-2 rounded-2xl
          ${isOwn
            ? 'bg-blue-500 text-white rounded-br-md'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md shadow-sm'
          }
        `}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
          <span className="text-xs">
            {format(message.timestamp, 'HH:mm')}
          </span>
          {isOwn && (
            <StatusIcon status={message.status} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatusIcon({ status }: { status: Message['status'] }) {
  if (status === 'read') {
    return (
      <svg className="w-4 h-4 text-blue-100" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
      </svg>
    );
  }
  if (status === 'delivered') {
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  );
}

function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {};

  messages.forEach(message => {
    const date = new Date(message.timestamp);
    let dateLabel: string;

    if (isToday(date)) {
      dateLabel = "Aujourd'hui";
    } else if (isYesterday(date)) {
      dateLabel = 'Hier';
    } else {
      dateLabel = format(date, 'EEEE d MMMM', { locale: fr });
    }

    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(message);
  });

  return groups;
}
