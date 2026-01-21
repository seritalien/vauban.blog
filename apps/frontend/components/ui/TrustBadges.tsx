'use client';

import { motion } from 'framer-motion';

interface TrustBadgesProps {
  variant?: 'full' | 'compact';
}

const badges = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
    title: 'Permanent',
    description: 'Stored on Arweave forever',
    color: 'from-amber-500 to-orange-500',
    glowColor: 'group-hover:shadow-amber-500/25',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Verified',
    description: 'SHA256 content integrity',
    color: 'from-green-500 to-emerald-500',
    glowColor: 'group-hover:shadow-green-500/25',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    title: 'Decentralized',
    description: 'Powered by Starknet L3',
    color: 'from-blue-500 to-purple-500',
    glowColor: 'group-hover:shadow-blue-500/25',
  },
];

export default function TrustBadges({ variant = 'full' }: TrustBadgesProps) {
  if (variant === 'compact') {
    return (
      <div className="flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
        {badges.map((badge, index) => (
          <div key={badge.title} className="flex items-center gap-1.5">
            <span className={`w-4 h-4 bg-gradient-to-r ${badge.color} rounded-full flex items-center justify-center text-white`}>
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </span>
            <span>{badge.title}</span>
            {index < badges.length - 1 && (
              <span className="ml-3 text-gray-300 dark:text-gray-600">|</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-800/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Built for Trust
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {badges.map((badge, index) => (
            <motion.div
              key={badge.title}
              className={`group relative p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:border-transparent ${badge.glowColor} hover:shadow-lg cursor-default`}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              {/* Gradient border on hover */}
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r ${badge.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 blur-sm`} />
              <div className="absolute inset-[1px] rounded-xl bg-white dark:bg-gray-800" />

              <div className="relative">
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${badge.color} text-white mb-4`}>
                  {badge.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {badge.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {badge.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
