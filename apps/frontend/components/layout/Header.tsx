'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { useWallet, NetworkId } from '@/providers/wallet-provider';
import ThemeToggle from './ThemeToggle';
import { CommandPalette, useCommandPalette } from '@/components/ui/CommandPalette';
import { UserMenu, SignInButton } from '@/components/auth';
import { NotificationBell } from '@/components/notifications';
import { formatAddress } from '@vauban/web3-utils';
import { useScrollDirection } from '@/hooks/useScrollDirection';

// Network badge colors
const NETWORK_STYLES: Record<NetworkId, { bg: string; text: string; label: string }> = {
  mainnet: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-400',
    label: 'Mainnet',
  },
  sepolia: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'Sepolia',
  },
  devnet: {
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    label: 'Devnet',
  },
};

export default function Header() {
  const { data: session, status: sessionStatus } = useSession();
  const { address, isConnected, isConnecting, isDevMode, network, walletName, connectWallet, connectDevAccount, disconnectWallet, getAccountUrl } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const commandPalette = useCommandPalette();
  const scrollDirection = useScrollDirection();

  // User is authenticated via OAuth or wallet
  const isOAuthAuthenticated = sessionStatus === 'authenticated' && session?.user;
  const isAnyAuthenticated = isConnected || isOAuthAuthenticated;

  const networkStyle = NETWORK_STYLES[network];

  return (
    <>
    <motion.header
      initial={false}
      animate={{
        y: scrollDirection === 'down' ? -100 : 0,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 30,
      }}
      className={`
        sticky top-0 z-50 border-b transition-colors duration-200
        ${scrollDirection === 'top'
          ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
          : 'backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 border-gray-200/50 dark:border-gray-700/50'
        }
      `}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent group-hover:from-purple-500 group-hover:to-blue-400 transition-all">
              Vauban
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">Blog</span>
          </Link>

          {/* Search button (opens command palette) */}
          <button
            onClick={commandPalette.open}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Search</span>
            <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">
              Ctrl K
            </kbd>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/feed"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/authors"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Authors
            </Link>
            <Link
              href="/leaderboard"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Leaderboard
            </Link>
            {isAnyAuthenticated && (
              <>
                <Link
                  href="/admin/posts"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Manage
                </Link>
                <Link
                  href="/admin/drafts"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Drafts
                </Link>
                <Link
                  href="/profile"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Profile
                </Link>
                <Link
                  href="/admin/analytics"
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Analytics
                </Link>
              </>
            )}
            <Link
              href="/admin"
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Publish
            </Link>
          </nav>

          {/* Right side: Notifications + Messages + Theme + Wallet + Mobile menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notification bell + Messages (only when authenticated) */}
            {isAnyAuthenticated && (
              <div className="hidden sm:flex items-center gap-1">
                <NotificationBell />
                <Link
                  href="/messages"
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  title="Messages"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </Link>
              </div>
            )}
            <ThemeToggle />

            {/* Desktop auth buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {/* OAuth User Menu (if signed in via OAuth) */}
              {isOAuthAuthenticated && !isConnected && (
                <UserMenu />
              )}

              {/* Wallet connection (if connected via wallet) */}
              {isConnected ? (
                <>
                  {/* Network badge */}
                  <span className={`px-2 py-1 text-xs font-medium rounded ${networkStyle.bg} ${networkStyle.text}`}>
                    {networkStyle.label}
                  </span>

                  {/* Wallet info */}
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    {walletName && !isDevMode && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{walletName}</span>
                    )}
                    {isDevMode && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">DEV</span>
                    )}
                    {getAccountUrl(address || '') ? (
                      <a
                        href={getAccountUrl(address || '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {formatAddress(address || '', 6, 4)}
                      </a>
                    ) : (
                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        {formatAddress(address || '', 6, 4)}
                      </span>
                    )}
                  </div>
                  {/* Switch dev account button */}
                  {isDevMode && (
                    <button
                      onClick={() => {
                        // Toggle between dev account 0 and 1
                        const currentIndex = localStorage.getItem('dev_account_index') || '0';
                        const newIndex = currentIndex === '0' ? 1 : 0;
                        connectDevAccount(newIndex);
                      }}
                      className="px-2 py-1.5 text-xs text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      title="Switch to other dev account"
                    >
                      Switch User
                    </button>
                  )}
                  <button
                    onClick={disconnectWallet}
                    className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                    title="Disconnect"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </>
              ) : !isOAuthAuthenticated && (
                <>
                  {/* OAuth Sign In Button */}
                  <SignInButton size="sm" />

                  {/* Divider */}
                  <span className="text-gray-300 dark:text-gray-600">|</span>

                  {/* Dev accounts for local development */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => connectDevAccount(0)}
                      className="px-2 py-1.5 text-sm text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-600 rounded-l-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                      title="Connect as Dev User 1"
                    >
                      Dev1
                    </button>
                    <button
                      onClick={() => connectDevAccount(1)}
                      className="px-2 py-1.5 text-sm text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 rounded-r-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      title="Connect as Dev User 2"
                    >
                      Dev2
                    </button>
                  </div>

                  {/* Wallet connect */}
                  <button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    title="Connect Starknet wallet (ArgentX, Braavos)"
                  >
                    {isConnecting ? '...' : 'Wallet'}
                  </button>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700">
            <nav className="flex flex-col gap-4">
              <Link
                href="/feed"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Feed
              </Link>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Blog
              </Link>
              <Link
                href="/authors"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Authors
              </Link>
              <Link
                href="/leaderboard"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Leaderboard
              </Link>
              {isAnyAuthenticated && (
                <>
                  <Link
                    href="/admin/posts"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Manage Posts
                  </Link>
                  <Link
                    href="/admin/drafts"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Drafts
                  </Link>
                  <Link
                    href="/admin/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/admin/analytics"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Analytics
                  </Link>
                </>
              )}
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Publish
              </Link>

              {/* Mobile wallet section */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                {isConnected ? (
                  <div className="flex flex-col gap-3">
                    {/* Network badge */}
                    <span className={`self-start px-2 py-1 text-xs font-medium rounded ${networkStyle.bg} ${networkStyle.text}`}>
                      {networkStyle.label}
                    </span>
                    <div className="flex items-center gap-2">
                      {isDevMode && (
                        <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">DEV</span>
                      )}
                      {walletName && !isDevMode && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">{walletName}</span>
                      )}
                      <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
                        {formatAddress(address || '', 6, 4)}
                      </span>
                    </div>
                    <button
                      onClick={() => { disconnectWallet(); setMobileMenuOpen(false); }}
                      className="w-full py-2 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 rounded-lg"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => { connectDevAccount(0); setMobileMenuOpen(false); }}
                        className="flex-1 py-2 text-orange-600 dark:text-orange-400 border border-orange-300 dark:border-orange-600 rounded-lg"
                      >
                        Dev User 1
                      </button>
                      <button
                        onClick={() => { connectDevAccount(1); setMobileMenuOpen(false); }}
                        className="flex-1 py-2 text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 rounded-lg"
                      >
                        Dev User 2
                      </button>
                    </div>
                    <button
                      onClick={() => { connectWallet(); setMobileMenuOpen(false); }}
                      disabled={isConnecting}
                      className="w-full py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </motion.header>

    {/* Command Palette */}
    <CommandPalette isOpen={commandPalette.isOpen} onClose={commandPalette.close} />
    </>
  );
}
