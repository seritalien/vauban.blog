import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { WalletProvider } from '@/providers/wallet-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ToastProvider } from '@/components/ui/Toast';
import { SessionProvider } from '@/components/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ServiceWorkerRegistration } from '@/components/pwa/ServiceWorkerRegistration';
import { EventStreamListener } from '@/components/events/EventStreamListener';

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
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Vauban Blog',
  },
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
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Force dynamic rendering so process.env is read at request time
  // (not at build time when Docker image has no env vars)
  await headers();

  // Collect all NEXT_PUBLIC_* env vars for client-side runtime access
  const publicEnv = Object.fromEntries(
    Object.entries(process.env)
      .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
      .filter(([, value]) => value !== undefined && value !== '')
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#6366f1" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        {/* Inject NEXT_PUBLIC_* env vars for client-side runtime access.
            Next.js inlines these at build time, but Docker/K8s images are built
            without them — this script makes them available at runtime. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ENV__=${JSON.stringify(publicEnv)};`,
          }}
        />
      </head>
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
        <ServiceWorkerRegistration />
        <SessionProvider>
          <ThemeProvider>
            <QueryProvider>
              <EventStreamListener />
              <WalletProvider>
                <ToastProvider>
                  <div className="min-h-screen flex flex-col">
                    <Header />
                    <main className="flex-1">
                      {children}
                    </main>
                    <Footer />
                  </div>
                </ToastProvider>
              </WalletProvider>
            </QueryProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
