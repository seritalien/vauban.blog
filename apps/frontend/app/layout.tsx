import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '@/providers/wallet-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/components/ui/Toast';
import Header from '@/components/layout/Header';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vauban.blog';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vauban Blog - Decentralized Publishing on Starknet L3',
    template: '%s | Vauban Blog',
  },
  description: 'Web3 blog powered by Madara L3 appchain with permanent storage on Arweave and IPFS. Publish censorship-resistant content with verified authenticity.',
  keywords: ['web3', 'blog', 'starknet', 'decentralized', 'blockchain', 'arweave', 'ipfs', 'madara', 'l3'],
  authors: [{ name: 'Vauban Blog' }],
  creator: 'Vauban Blog',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Vauban Blog',
    title: 'Vauban Blog - Decentralized Publishing on Starknet L3',
    description: 'Web3 blog powered by Madara L3 appchain with permanent storage on Arweave and IPFS.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Vauban Blog',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vauban Blog - Decentralized Publishing on Starknet L3',
    description: 'Web3 blog powered by Madara L3 appchain with permanent storage on Arweave and IPFS.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
        <ThemeProvider>
          <WalletProvider>
            <ToastProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                <footer className="border-t border-gray-200 dark:border-gray-700 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>Vauban Blog - Powered by Starknet L3 Madara Appchain</p>
                </footer>
              </div>
            </ToastProvider>
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
