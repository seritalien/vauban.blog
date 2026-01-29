import { describe, it, expect } from 'vitest';
import {
  generateMetadata,
  generateArticleJsonLd,
  generateBlogJsonLd,
  generateOrganizationJsonLd,
  generateBreadcrumbJsonLd,
} from '../seo';

const SITE_NAME = 'Vauban Blog';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vauban.blog';
const DEFAULT_DESCRIPTION =
  'A decentralized blogging platform built on Starknet with permanent storage on Arweave.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

// =============================================================================
// generateMetadata
// =============================================================================

describe('generateMetadata', () => {
  it('generates basic metadata with title', () => {
    const meta = generateMetadata({ title: 'My Page' });

    expect(meta.title).toBe('My Page | Vauban Blog');
    expect(meta.description).toBe(DEFAULT_DESCRIPTION);
  });

  it('appends site name to title', () => {
    const meta = generateMetadata({ title: 'About' });

    expect(meta.title).toBe('About | Vauban Blog');
  });

  it('does not double-append site name when title equals site name', () => {
    const meta = generateMetadata({ title: SITE_NAME });

    expect(meta.title).toBe(SITE_NAME);
  });

  it('uses defaults for description, image, and url', () => {
    const meta = generateMetadata({ title: 'Test' });

    expect(meta.description).toBe(DEFAULT_DESCRIPTION);

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.url).toBe(SITE_URL);

    const images = og.images as Array<Record<string, unknown>>;
    expect(images[0].url).toBe(DEFAULT_IMAGE);
  });

  it('sets noIndex robots when specified', () => {
    const meta = generateMetadata({ title: 'Private', noIndex: true });

    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it('sets index and follow robots by default', () => {
    const meta = generateMetadata({ title: 'Public' });

    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it('sets article type with publishedTime, author, and tags', () => {
    const meta = generateMetadata({
      title: 'Article Title',
      type: 'article',
      publishedTime: '2024-01-15T10:00:00Z',
      author: 'Fabien',
      tags: ['web3', 'starknet'],
    });

    const og = meta.openGraph as Record<string, unknown>;
    expect(og.type).toBe('article');
    expect(og.publishedTime).toBe('2024-01-15T10:00:00Z');
    expect(og.authors).toEqual(['Fabien']);
    expect(og.tags).toEqual(['web3', 'starknet']);
  });

  it('uses custom description and image when provided', () => {
    const meta = generateMetadata({
      title: 'Custom',
      description: 'Custom description',
      image: 'https://example.com/image.png',
    });

    expect(meta.description).toBe('Custom description');

    const og = meta.openGraph as Record<string, unknown>;
    const images = og.images as Array<Record<string, unknown>>;
    expect(images[0].url).toBe('https://example.com/image.png');
  });
});

// =============================================================================
// generateArticleJsonLd
// =============================================================================

describe('generateArticleJsonLd', () => {
  const baseArticle = {
    title: 'Test Article',
    description: 'A test description',
    content: 'This is the article body content for testing purposes.',
    url: 'https://vauban.blog/articles/test',
    publishedTime: '2024-01-15T10:00:00Z',
    author: { name: 'Fabien', url: 'https://vauban.blog/author/fabien' },
    tags: ['web3', 'starknet'],
  };

  it('generates valid schema.org Article', () => {
    const jsonLd = generateArticleJsonLd(baseArticle);

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.headline).toBe('Test Article');
    expect(jsonLd.description).toBe('A test description');
    expect(jsonLd.datePublished).toBe('2024-01-15T10:00:00Z');
    expect(jsonLd.mainEntityOfPage['@id']).toBe(
      'https://vauban.blog/articles/test'
    );
  });

  it('includes author info', () => {
    const jsonLd = generateArticleJsonLd(baseArticle);

    expect(jsonLd.author).toEqual({
      '@type': 'Person',
      name: 'Fabien',
      url: 'https://vauban.blog/author/fabien',
    });
  });

  it('limits articleBody to 5000 chars', () => {
    const longContent = 'x'.repeat(10000);
    const jsonLd = generateArticleJsonLd({
      ...baseArticle,
      content: longContent,
    });

    expect(jsonLd.articleBody).toHaveLength(5000);
  });

  it('calculates wordCount', () => {
    const jsonLd = generateArticleJsonLd({
      ...baseArticle,
      content: 'one two three four five',
    });

    expect(jsonLd.wordCount).toBe(5);
  });

  it('uses default image when none provided', () => {
    const jsonLd = generateArticleJsonLd(baseArticle);

    expect(jsonLd.image).toBe(DEFAULT_IMAGE);
  });

  it('uses provided image when available', () => {
    const jsonLd = generateArticleJsonLd({
      ...baseArticle,
      image: 'https://example.com/cover.png',
    });

    expect(jsonLd.image).toBe('https://example.com/cover.png');
  });

  it('uses publishedTime as dateModified when modifiedTime is not provided', () => {
    const jsonLd = generateArticleJsonLd(baseArticle);

    expect(jsonLd.dateModified).toBe('2024-01-15T10:00:00Z');
  });

  it('uses modifiedTime when provided', () => {
    const jsonLd = generateArticleJsonLd({
      ...baseArticle,
      modifiedTime: '2024-02-01T12:00:00Z',
    });

    expect(jsonLd.dateModified).toBe('2024-02-01T12:00:00Z');
  });

  it('joins tags with comma separator for keywords', () => {
    const jsonLd = generateArticleJsonLd(baseArticle);

    expect(jsonLd.keywords).toBe('web3, starknet');
  });

  it('includes publisher info', () => {
    const jsonLd = generateArticleJsonLd(baseArticle);

    expect(jsonLd.publisher).toEqual({
      '@type': 'Organization',
      name: SITE_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    });
  });
});

// =============================================================================
// generateBlogJsonLd
// =============================================================================

describe('generateBlogJsonLd', () => {
  it('generates Blog schema with blog posts', () => {
    const articles = [
      {
        title: 'Post 1',
        url: 'https://vauban.blog/posts/1',
        publishedTime: '2024-01-15T10:00:00Z',
      },
      {
        title: 'Post 2',
        url: 'https://vauban.blog/posts/2',
        image: 'https://example.com/img.png',
        publishedTime: '2024-01-16T10:00:00Z',
      },
    ];

    const jsonLd = generateBlogJsonLd(articles);

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Blog');
    expect(jsonLd.name).toBe(SITE_NAME);
    expect(jsonLd.description).toBe(DEFAULT_DESCRIPTION);
    expect(jsonLd.url).toBe(SITE_URL);
    expect(jsonLd.blogPost).toHaveLength(2);
  });

  it('maps each article to a BlogPosting entry', () => {
    const articles = [
      {
        title: 'Post 1',
        url: 'https://vauban.blog/posts/1',
        publishedTime: '2024-01-15T10:00:00Z',
      },
    ];

    const jsonLd = generateBlogJsonLd(articles);
    const post = jsonLd.blogPost[0];

    expect(post['@type']).toBe('BlogPosting');
    expect(post.headline).toBe('Post 1');
    expect(post.url).toBe('https://vauban.blog/posts/1');
    expect(post.datePublished).toBe('2024-01-15T10:00:00Z');
  });

  it('uses default image for posts without image', () => {
    const articles = [
      {
        title: 'No Image Post',
        url: 'https://vauban.blog/posts/1',
        publishedTime: '2024-01-15T10:00:00Z',
      },
    ];

    const jsonLd = generateBlogJsonLd(articles);

    expect(jsonLd.blogPost[0].image).toBe(DEFAULT_IMAGE);
  });

  it('handles empty articles array', () => {
    const jsonLd = generateBlogJsonLd([]);

    expect(jsonLd.blogPost).toEqual([]);
  });
});

// =============================================================================
// generateOrganizationJsonLd
// =============================================================================

describe('generateOrganizationJsonLd', () => {
  it('generates Organization schema', () => {
    const jsonLd = generateOrganizationJsonLd();

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Organization');
    expect(jsonLd.name).toBe(SITE_NAME);
    expect(jsonLd.url).toBe(SITE_URL);
    expect(jsonLd.logo).toBe(`${SITE_URL}/logo.png`);
  });

  it('includes social links in sameAs', () => {
    const jsonLd = generateOrganizationJsonLd();

    expect(jsonLd.sameAs).toContain('https://twitter.com/vaubanblog');
    expect(jsonLd.sameAs).toContain('https://github.com/vauban-blog');
  });
});

// =============================================================================
// generateBreadcrumbJsonLd
// =============================================================================

describe('generateBreadcrumbJsonLd', () => {
  it('generates BreadcrumbList schema', () => {
    const items = [
      { name: 'Home', url: 'https://vauban.blog' },
      { name: 'Articles', url: 'https://vauban.blog/articles' },
    ];

    const jsonLd = generateBreadcrumbJsonLd(items);

    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('BreadcrumbList');
  });

  it('generates positions starting at 1', () => {
    const items = [
      { name: 'Home', url: 'https://vauban.blog' },
      { name: 'Articles', url: 'https://vauban.blog/articles' },
      { name: 'My Post', url: 'https://vauban.blog/articles/my-post' },
    ];

    const jsonLd = generateBreadcrumbJsonLd(items);

    expect(jsonLd.itemListElement).toHaveLength(3);
    expect(jsonLd.itemListElement[0].position).toBe(1);
    expect(jsonLd.itemListElement[1].position).toBe(2);
    expect(jsonLd.itemListElement[2].position).toBe(3);
  });

  it('maps name and item (url) for each ListItem', () => {
    const items = [
      { name: 'Home', url: 'https://vauban.blog' },
      { name: 'Articles', url: 'https://vauban.blog/articles' },
    ];

    const jsonLd = generateBreadcrumbJsonLd(items);

    expect(jsonLd.itemListElement[0]).toEqual({
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://vauban.blog',
    });
    expect(jsonLd.itemListElement[1]).toEqual({
      '@type': 'ListItem',
      position: 2,
      name: 'Articles',
      item: 'https://vauban.blog/articles',
    });
  });

  it('handles empty items array', () => {
    const jsonLd = generateBreadcrumbJsonLd([]);

    expect(jsonLd.itemListElement).toEqual([]);
  });
});
