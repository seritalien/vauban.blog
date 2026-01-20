import { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vauban.blog';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/posts/', '/admin/profile/', '/admin/drafts/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
