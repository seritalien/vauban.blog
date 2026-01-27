import { vi } from 'vitest';

// =============================================================================
// Post Zod Schema Tests (from @vauban/shared-types)
// =============================================================================

import {
  PostInputSchema,
  PostMetadataSchema,
  contentTypeToNumber,
  numberToContentType,
  POST_TYPE_TWEET,
  POST_TYPE_THREAD,
  POST_TYPE_ARTICLE,
} from '@vauban/shared-types';

// =============================================================================
// PostInputSchema - Article validation
// =============================================================================

describe('PostInputSchema - articles', () => {
  const validArticle = {
    contentType: 'article' as const,
    title: 'My First Article',
    content: 'x'.repeat(150), // > 100 chars
    slug: 'my-first-article',
  };

  it('valid article (title + content 100+ chars) parses successfully', () => {
    const result = PostInputSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('My First Article');
      expect(result.data.contentType).toBe('article');
    }
  });

  it('article with title < 3 chars fails with appropriate error', () => {
    const result = PostInputSchema.safeParse({
      ...validArticle,
      title: 'AB',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleError = result.error.issues.find((i) => i.path.includes('title'));
      expect(titleError).toBeDefined();
      expect(titleError!.message).toContain('at least 3 characters');
    }
  });

  it('article with content < 100 chars fails', () => {
    const result = PostInputSchema.safeParse({
      ...validArticle,
      content: 'Short content',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const contentError = result.error.issues.find((i) => i.path.includes('content'));
      expect(contentError).toBeDefined();
      expect(contentError!.message).toContain('at least 100 characters');
    }
  });
});

// =============================================================================
// PostInputSchema - Tweet validation
// =============================================================================

describe('PostInputSchema - tweets', () => {
  it('valid tweet (content <= 280, contentType tweet) parses', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello world! This is my first tweet on Vauban.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentType).toBe('tweet');
    }
  });

  it('tweet with content > 280 chars fails', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'x'.repeat(281),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const contentError = result.error.issues.find((i) => i.path.includes('content'));
      expect(contentError).toBeDefined();
      expect(contentError!.message).toContain('280 characters or less');
    }
  });
});

// =============================================================================
// PostInputSchema - Thread validation
// =============================================================================

describe('PostInputSchema - threads', () => {
  it('thread type parses (contentType thread)', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'thread',
      content: 'This is a thread starter post',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentType).toBe('thread');
    }
  });
});

// =============================================================================
// PostInputSchema - Cover image
// =============================================================================

describe('PostInputSchema - cover image', () => {
  it('accepts valid URL', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
      coverImage: 'https://example.com/image.png',
    });
    expect(result.success).toBe(true);
  });

  it('accepts IPFS path (/api/ipfs/Qm...)', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
      coverImage: '/api/ipfs/QmTest1234567890',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid cover image value', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
      coverImage: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// PostInputSchema - Defaults
// =============================================================================

describe('PostInputSchema - defaults', () => {
  it('contentType defaults to article', () => {
    const result = PostInputSchema.safeParse({
      title: 'Default Article',
      content: 'x'.repeat(150),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentType).toBe('article');
    }
  });

  it('isPaid defaults to false', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isPaid).toBe(false);
    }
  });

  it('tags defaults to []', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });
});

// =============================================================================
// PostInputSchema - Edge cases
// =============================================================================

describe('PostInputSchema - edge cases', () => {
  it('tags > 10 fails', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const tagsError = result.error.issues.find((i) => i.path.includes('tags'));
      expect(tagsError).toBeDefined();
    }
  });

  it('negative price fails', () => {
    const result = PostInputSchema.safeParse({
      contentType: 'tweet',
      content: 'Hello',
      price: -1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const priceError = result.error.issues.find((i) => i.path.includes('price'));
      expect(priceError).toBeDefined();
    }
  });
});

// =============================================================================
// PostMetadataSchema
// =============================================================================

describe('PostMetadataSchema', () => {
  const validMetadata = {
    id: '1',
    author: '0x' + 'a1'.repeat(32),
    arweaveTxId: 'arweave_tx_123',
    ipfsCid: 'QmTestCid123',
    contentHash: '0x' + 'ab'.repeat(32),
    price: '0',
    isEncrypted: false,
    createdAt: 1700000000,
    updatedAt: 1700000000,
  };

  it('valid metadata parses', () => {
    const result = PostMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
  });

  it('invalid address (missing 0x prefix) fails', () => {
    const result = PostMetadataSchema.safeParse({
      ...validMetadata,
      author: 'a1'.repeat(32), // no 0x prefix
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const authorError = result.error.issues.find((i) => i.path.includes('author'));
      expect(authorError).toBeDefined();
    }
  });

  it('invalid content hash fails', () => {
    const result = PostMetadataSchema.safeParse({
      ...validMetadata,
      contentHash: 'not-a-hash',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hashError = result.error.issues.find((i) => i.path.includes('contentHash'));
      expect(hashError).toBeDefined();
    }
  });
});

// =============================================================================
// Content type conversions
// =============================================================================

describe('contentTypeToNumber', () => {
  it('tweet -> 0', () => {
    expect(contentTypeToNumber('tweet')).toBe(0);
  });

  it('thread -> 1', () => {
    expect(contentTypeToNumber('thread')).toBe(1);
  });

  it('article -> 2', () => {
    expect(contentTypeToNumber('article')).toBe(2);
  });
});

describe('numberToContentType', () => {
  it('0 -> tweet', () => {
    expect(numberToContentType(0)).toBe('tweet');
  });

  it('1 -> thread', () => {
    expect(numberToContentType(1)).toBe('thread');
  });

  it('2 -> article', () => {
    expect(numberToContentType(2)).toBe('article');
  });

  it('unknown -> article (default)', () => {
    expect(numberToContentType(99)).toBe('article');
  });
});

// =============================================================================
// Constants
// =============================================================================

describe('POST_TYPE constants', () => {
  it('POST_TYPE_TWEET = 0', () => {
    expect(POST_TYPE_TWEET).toBe(0);
  });

  it('POST_TYPE_THREAD = 1', () => {
    expect(POST_TYPE_THREAD).toBe(1);
  });

  it('POST_TYPE_ARTICLE = 2', () => {
    expect(POST_TYPE_ARTICLE).toBe(2);
  });
});
