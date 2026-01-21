'use client';

import Link from 'next/link';
import NewsletterSignup from '@/components/newsletter/NewsletterSignup';
import TrustBadges from '@/components/ui/TrustBadges';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      {/* Newsletter Section */}
      <div className="container mx-auto px-4 py-12">
        <NewsletterSignup />
      </div>

      {/* Main Footer Content */}
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="inline-flex items-center gap-2 mb-4">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Vauban
                </span>
              </Link>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
                The decentralized publishing platform. Own your words forever with blockchain-verified, censorship-resistant content.
              </p>
              {/* Social Links */}
              <div className="flex items-center gap-4">
                <a
                  href="https://twitter.com/vaubanblog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Follow on X"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/vauban-blog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="View on GitHub"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
                <a
                  href="https://warpcast.com/vauban"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  title="Follow on Farcaster"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.24 1.5H5.76C3.54 1.5 1.74 3.3 1.74 5.52v12.96c0 2.22 1.8 4.02 4.02 4.02h12.48c2.22 0 4.02-1.8 4.02-4.02V5.52c0-2.22-1.8-4.02-4.02-4.02zM12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Platform</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    Browse Articles
                  </Link>
                </li>
                <li>
                  <Link href="/admin" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    Start Writing
                  </Link>
                </li>
                <li>
                  <a href="https://docs.vauban.blog" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://status.vauban.blog" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    System Status
                  </a>
                </li>
              </ul>
            </div>

            {/* Technology */}
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Technology</h4>
              <ul className="space-y-2">
                <li>
                  <a href="https://starknet.io" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    Starknet L3
                  </a>
                </li>
                <li>
                  <a href="https://arweave.org" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    Arweave Storage
                  </a>
                </li>
                <li>
                  <a href="https://ipfs.tech" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    IPFS Cache
                  </a>
                </li>
                <li>
                  <a href="https://github.com/keep-starknet-strange/madara" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                    Madara Appchain
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>&copy; {currentYear} Vauban Blog.</span>
              <span className="hidden sm:inline">|</span>
              <span className="hidden sm:inline">Powered by</span>
              <a
                href="https://starknet.io"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Starknet L3
              </a>
            </div>

            {/* Trust badges mini */}
            <TrustBadges variant="compact" />
          </div>
        </div>
      </div>
    </footer>
  );
}
