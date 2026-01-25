import type { Metadata } from 'next';

const SITE_NAME = 'Vauban Blog';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vauban.blog';
const DEFAULT_DESCRIPTION = 'A decentralized blogging platform built on Starknet with permanent storage on Arweave.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

export interface SEOConfig {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  noIndex?: boolean;
}

/**
 * Generate Next.js metadata for a page
 */
export function generateMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    image = DEFAULT_IMAGE,
    url = SITE_URL,
    type = 'website',
    publishedTime,
    modifiedTime,
    author,
    tags = [],
    noIndex = false,
  } = config;

  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;

  const metadata: Metadata = {
    title: fullTitle,
    description,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE_NAME,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: type === 'article' ? 'article' : 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };

  // Add article-specific metadata
  if (type === 'article') {
    metadata.openGraph = {
      ...metadata.openGraph,
      type: 'article',
      publishedTime,
      modifiedTime,
      authors: author ? [author] : undefined,
      tags,
    };
  }

  return metadata;
}

/**
 * Generate JSON-LD structured data for an article
 */
export function generateArticleJsonLd(article: {
  title: string;
  description: string;
  content: string;
  url: string;
  image?: string;
  publishedTime: string;
  modifiedTime?: string;
  author: {
    name: string;
    url?: string;
  };
  tags?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    image: article.image || DEFAULT_IMAGE,
    datePublished: article.publishedTime,
    dateModified: article.modifiedTime || article.publishedTime,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
    keywords: article.tags?.join(', '),
    articleBody: article.content.substring(0, 5000), // Limit for SEO
    wordCount: article.content.split(/\s+/).length,
  };
}

/**
 * Generate JSON-LD structured data for a blog listing page
 */
export function generateBlogJsonLd(articles: Array<{
  title: string;
  url: string;
  image?: string;
  publishedTime: string;
}>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    blogPost: articles.map((article) => ({
      '@type': 'BlogPosting',
      headline: article.title,
      url: article.url,
      image: article.image || DEFAULT_IMAGE,
      datePublished: article.publishedTime,
    })),
  };
}

/**
 * Generate JSON-LD structured data for organization
 */
export function generateOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    sameAs: [
      'https://twitter.com/vaubanblog',
      'https://github.com/vauban-blog',
    ],
  };
}

/**
 * Generate JSON-LD structured data for breadcrumbs
 */
export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
