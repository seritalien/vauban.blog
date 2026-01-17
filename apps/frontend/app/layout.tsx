import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/providers/wallet-provider';
import Header from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Vauban Blog - Decentralized Publishing on Starknet L3',
  description: 'Web3 blog powered by Madara L3, Arweave, and IPFS',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <footer className="border-t py-6 text-center text-sm text-gray-600">
              <p>Vauban Blog - Powered by Starknet L3 Madara Appchain</p>
            </footer>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
