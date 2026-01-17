'use client';

import Link from 'next/link';
import { useWallet } from '@/providers/wallet-provider';
import { formatAddress } from '@vauban/web3-utils';

export default function Header() {
  const { address, isConnected, isConnecting, connectWallet, disconnectWallet } = useWallet();

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold">
          Vauban Blog
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="hover:underline">
            Articles
          </Link>
          {isConnected && (
            <Link href="/admin" className="hover:underline">
              Admin
            </Link>
          )}

          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <span className="text-sm text-gray-600">{formatAddress(address!)}</span>
                <button
                  onClick={disconnectWallet}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={connectWallet}
                disabled={isConnecting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
