'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface HeroStats {
  totalPosts: number;
  verifiedPercent: number;
  totalAuthors: number;
}

interface HeroSectionProps {
  stats: HeroStats;
}

export default function HeroSection({ stats }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 dark:from-black dark:via-gray-900 dark:to-black">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="hero-gradient-orb hero-gradient-orb-1" />
        <div className="hero-gradient-orb hero-gradient-orb-2" />
        <div className="hero-gradient-orb hero-gradient-orb-3" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />

      <div className="relative container mx-auto px-4 py-20 sm:py-28 lg:py-36">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm text-gray-300">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Powered by Starknet L3
            </span>
          </motion.div>

          {/* Main headline */}
          <motion.h1
            className="mt-8 text-4xl sm:text-5xl lg:text-7xl font-bold text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Own your words.{' '}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Forever.
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Publish on a sovereign blockchain with permanent Arweave storage.
            Your content, cryptographically verified, censorship-resistant, and truly yours.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Link
              href="/admin"
              className="group px-8 py-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold text-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-purple-500/25"
            >
              Start Writing
              <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">
                &rarr;
              </span>
            </Link>
            <Link
              href="#articles"
              className="px-8 py-4 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-lg hover:bg-white/20 transition-all duration-300"
            >
              Explore Articles
            </Link>
          </motion.div>

          {/* Live stats */}
          <motion.div
            className="mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className="p-4 sm:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl sm:text-4xl font-bold text-white">
                {stats.totalPosts}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-gray-400">
                Articles Published
              </div>
            </div>
            <div className="p-4 sm:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl sm:text-4xl font-bold text-green-400">
                {stats.verifiedPercent}%
              </div>
              <div className="mt-1 text-xs sm:text-sm text-gray-400">
                Content Verified
              </div>
            </div>
            <div className="p-4 sm:p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="text-2xl sm:text-4xl font-bold text-white">
                {stats.totalAuthors}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-gray-400">
                Active Authors
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white dark:from-gray-900 to-transparent" />
    </section>
  );
}
