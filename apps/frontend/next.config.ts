import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Experimental features
  experimental: {
    // Enable React 19 features
    reactCompiler: true,
  },

  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },

  // Image optimization
  images: {
    domains: ['localhost', 'arweave.net'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'arweave.net',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
        pathname: '/ipfs/**',
      },
    ],
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_MADARA_RPC: process.env.NEXT_PUBLIC_MADARA_RPC,
    NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS: process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS,
    NEXT_PUBLIC_SOCIAL_ADDRESS: process.env.NEXT_PUBLIC_SOCIAL_ADDRESS,
    NEXT_PUBLIC_PAYMASTER_ADDRESS: process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS,
    NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS: process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS,
    NEXT_PUBLIC_IPFS_GATEWAY_URL: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL,
    NEXT_PUBLIC_IPFS_API_URL: process.env.NEXT_PUBLIC_IPFS_API_URL,
  },

  // Webpack configuration for Web3 libraries
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
