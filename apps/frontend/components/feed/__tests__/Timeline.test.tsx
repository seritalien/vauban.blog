import { vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Mocks – mock sub-components to render simple divs
// ---------------------------------------------------------------------------

vi.mock('@/components/feed/TweetCard', () => ({
  default: (props: { id: string; content: string }) => (
    <div data-testid={`tweet-card-${props.id}`}>{props.content}</div>
  ),
}));

vi.mock('@/components/feed/ArticlePreview', () => ({
  default: (props: { id: string; title: string }) => (
    <div data-testid={`article-preview-${props.id}`}>{props.title}</div>
  ),
}));

vi.mock('@/components/feed/ThreadPreview', () => ({
  default: (props: { id: string; content: string }) => (
    <div data-testid={`thread-preview-${props.id}`}>{props.content}</div>
  ),
}));

vi.mock('@/components/feed/QuoteTweet', () => ({
  default: (props: { id: string; content: string }) => (
    <div data-testid={`quote-tweet-${props.id}`}>{props.content}</div>
  ),
}));

vi.mock('@vauban/shared-types', () => ({
  POST_TYPE_TWEET: 0,
  POST_TYPE_THREAD: 1,
  POST_TYPE_ARTICLE: 2,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import Timeline, { type TimelinePost } from '../Timeline';

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<TimelinePost> & { id: string }): TimelinePost {
  return {
    author: '0xAuthor1',
    content: `Content for ${overrides.id}`,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Timeline', () => {
  // ===== Loading =====

  describe('loading', () => {
    it('shows skeleton cards when isLoading=true', () => {
      const { container } = render(
        <Timeline posts={[]} activeTab="for-you" isLoading={true} />,
      );
      // The skeletons use animate-pulse class
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBe(4);
    });
  });

  // ===== Empty =====

  describe('empty', () => {
    it('shows for-you empty message', () => {
      render(<Timeline posts={[]} activeTab="for-you" />);
      expect(screen.getByText('Welcome to Vauban!')).toBeInTheDocument();
    });

    it('shows following empty message', () => {
      render(<Timeline posts={[]} activeTab="following" />);
      expect(screen.getByText('Follow some authors')).toBeInTheDocument();
    });

    it('shows articles empty message', () => {
      render(<Timeline posts={[]} activeTab="articles" />);
      expect(screen.getByText('No articles yet')).toBeInTheDocument();
    });

    it('shows threads empty message', () => {
      render(<Timeline posts={[]} activeTab="threads" />);
      expect(screen.getByText('No threads yet')).toBeInTheDocument();
    });
  });

  // ===== For-you tab =====

  describe('for-you tab', () => {
    it('renders all non-reply posts', () => {
      const posts = [
        makePost({ id: 'p1', postType: 0, contentType: 'tweet' }),
        makePost({ id: 'p2', postType: 0, contentType: 'tweet', parentId: 'p1' }), // reply – hidden
        makePost({ id: 'p3', postType: 2, contentType: 'article' }),
      ];

      render(<Timeline posts={posts} activeTab="for-you" />);
      expect(screen.getByTestId('tweet-card-p1')).toBeInTheDocument();
      expect(screen.queryByTestId('tweet-card-p2')).not.toBeInTheDocument();
      expect(screen.getByTestId('article-preview-p3')).toBeInTheDocument();
    });

    it('hides thread continuations (threadRootId !== id)', () => {
      const posts = [
        makePost({ id: 'root', postType: 1, contentType: 'thread', threadRootId: 'root' }),
        makePost({ id: 'cont', postType: 1, contentType: 'thread', threadRootId: 'root' }),
      ];

      render(<Timeline posts={posts} activeTab="for-you" />);
      expect(screen.getByTestId('thread-preview-root')).toBeInTheDocument();
      expect(screen.queryByTestId('thread-preview-cont')).not.toBeInTheDocument();
    });

    it('sorts by date descending', () => {
      const posts = [
        makePost({ id: 'old', postType: 0, contentType: 'tweet', createdAt: new Date('2024-01-01') }),
        makePost({ id: 'new', postType: 0, contentType: 'tweet', createdAt: new Date('2025-06-01') }),
      ];

      const { container } = render(<Timeline posts={posts} activeTab="for-you" />);
      const elements = container.querySelectorAll('[data-testid]');
      expect(elements[0].getAttribute('data-testid')).toBe('tweet-card-new');
      expect(elements[1].getAttribute('data-testid')).toBe('tweet-card-old');
    });
  });

  // ===== Following tab =====

  describe('following tab', () => {
    it('filters by followedAddresses (case-insensitive)', () => {
      const posts = [
        makePost({ id: 'p1', postType: 0, contentType: 'tweet', author: '0xABC' }),
        makePost({ id: 'p2', postType: 0, contentType: 'tweet', author: '0xDEF' }),
      ];

      render(
        <Timeline
          posts={posts}
          activeTab="following"
          followedAddresses={['0xabc']}
        />,
      );

      expect(screen.getByTestId('tweet-card-p1')).toBeInTheDocument();
      expect(screen.queryByTestId('tweet-card-p2')).not.toBeInTheDocument();
    });

    it('shows empty state when no followed addresses', () => {
      const posts = [
        makePost({ id: 'p1', postType: 0, contentType: 'tweet', author: '0xABC' }),
      ];

      render(
        <Timeline posts={posts} activeTab="following" followedAddresses={[]} />,
      );

      expect(screen.getByText('Follow some authors')).toBeInTheDocument();
    });
  });

  // ===== Articles tab =====

  describe('articles tab', () => {
    it('shows only postType=2 or contentType=article', () => {
      const posts = [
        makePost({ id: 'tweet1', postType: 0, contentType: 'tweet' }),
        makePost({ id: 'art1', postType: 2, contentType: 'article', title: 'My Article' }),
        makePost({ id: 'art2', contentType: 'article', title: 'Another Article' }),
      ];

      render(<Timeline posts={posts} activeTab="articles" />);
      expect(screen.queryByTestId('tweet-card-tweet1')).not.toBeInTheDocument();
      expect(screen.getByTestId('article-preview-art1')).toBeInTheDocument();
      expect(screen.getByTestId('article-preview-art2')).toBeInTheDocument();
    });
  });

  // ===== Threads tab =====

  describe('threads tab', () => {
    it('shows only postType=1 or contentType=thread', () => {
      const posts = [
        makePost({ id: 'tweet1', postType: 0, contentType: 'tweet' }),
        makePost({ id: 'thr1', postType: 1, contentType: 'thread', threadRootId: 'thr1' }),
        makePost({ id: 'thr2', contentType: 'thread', threadRootId: 'thr2' }),
      ];

      render(<Timeline posts={posts} activeTab="threads" />);
      expect(screen.queryByTestId('tweet-card-tweet1')).not.toBeInTheDocument();
      expect(screen.getByTestId('thread-preview-thr1')).toBeInTheDocument();
      expect(screen.getByTestId('thread-preview-thr2')).toBeInTheDocument();
    });
  });

  // ===== Post type routing =====

  describe('post type routing', () => {
    it('tweets render TweetCard', () => {
      const posts = [makePost({ id: 'tw1', postType: 0, contentType: 'tweet' })];
      render(<Timeline posts={posts} activeTab="for-you" />);
      expect(screen.getByTestId('tweet-card-tw1')).toBeInTheDocument();
    });

    it('threads render ThreadPreview', () => {
      const posts = [makePost({ id: 'th1', postType: 1, contentType: 'thread', threadRootId: 'th1' })];
      render(<Timeline posts={posts} activeTab="for-you" />);
      expect(screen.getByTestId('thread-preview-th1')).toBeInTheDocument();
    });

    it('articles render ArticlePreview', () => {
      const posts = [makePost({ id: 'a1', postType: 2, contentType: 'article', title: 'Art' })];
      render(<Timeline posts={posts} activeTab="for-you" />);
      expect(screen.getByTestId('article-preview-a1')).toBeInTheDocument();
    });

    it('quoted posts render QuoteTweet', () => {
      const posts = [
        makePost({
          id: 'q1',
          postType: 0,
          contentType: 'tweet',
          quotedPost: {
            id: 'orig1',
            author: '0xOther',
            content: 'Original content',
            createdAt: new Date(),
          },
        }),
      ];
      render(<Timeline posts={posts} activeTab="for-you" />);
      expect(screen.getByTestId('quote-tweet-q1')).toBeInTheDocument();
    });
  });
});
