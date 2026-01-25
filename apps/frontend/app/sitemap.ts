import { MetadataRoute } from 'next';
import { getPosts, initStarknetProvider, setContractAddresses } from '@vauban/web3-utils';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vauban.blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Initialize provider for server-side
  if (typeof window === 'undefined') {
    initStarknetProvider({
      nodeUrl: process.env.MADARA_RPC_URL || 'http://localhost:9944',
    });

    setContractAddresses({
      blogRegistry: process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS,
      social: process.env.NEXT_PUBLIC_SOCIAL_ADDRESS,
      paymaster: process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS,
      sessionKeyManager: process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS,
    });
  }

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/profile`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];

  // Dynamic article pages
  let articlePages: MetadataRoute.Sitemap = [];
  try {
    const posts = await getPosts(100, 0);
    articlePages = posts
      .filter((post) => !post.isDeleted)
      .map((post) => {
        // Use post ID for URL (slug is in content metadata, not on-chain)
        return {
          url: `${siteUrl}/articles/${post.id}`,
          lastModified: new Date(post.updatedAt * 1000),
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        };
      });
  } catch (error) {
    console.error('Failed to fetch posts for sitemap:', error);
  }

  return [...staticPages, ...articlePages];
}
