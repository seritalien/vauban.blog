import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// =============================================================================
// FILE 11: Feed Page Tests
// =============================================================================

// Mock sub-components
vi.mock('@/components/feed', () => ({
  FeedTabs: ({ activeTab, onTabChange, counts }: any) => (
    <div data-testid="feed-tabs" data-active-tab={activeTab}>
      <span data-testid="count-forYou">{counts?.forYou ?? 0}</span>
      <span data-testid="count-following">{counts?.following ?? 0}</span>
      <span data-testid="count-articles">{counts?.articles ?? 0}</span>
      <span data-testid="count-threads">{counts?.threads ?? 0}</span>
      <button data-testid="tab-for-you" onClick={() => onTabChange('for-you')}>For You</button>
      <button data-testid="tab-articles" onClick={() => onTabChange('articles')}>Articles</button>
    </div>
  ),
  Timeline: ({ posts, activeTab, isLoading, followedAddresses }: any) => (
    <div data-testid="timeline" data-tab={activeTab} data-loading={isLoading}>
      <span data-testid="post-count">{posts.length}</span>
      <span data-testid="followed-count">{followedAddresses?.length ?? 0}</span>
      {posts.map((p: any) => (
        <div key={p.id} data-testid={`post-${p.id}`} data-content-type={p.contentType}>
          {p.content}
        </div>
      ))}
    </div>
  ),
  Composer: ({ onPostSuccess }: any) => (
    <div data-testid="composer">
      <button data-testid="post-btn" onClick={() => onPostSuccess('new-post-1')}>Post</button>
    </div>
  ),
  ThreadComposer: ({ onSuccess, onCancel }: any) => (
    <div data-testid="thread-composer">
      <button data-testid="thread-post-btn" onClick={() => onSuccess('thread-1')}>Post Thread</button>
      <button data-testid="thread-cancel-btn" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// Mock hooks
const mockUsePosts = vi.fn();
vi.mock('@/hooks/use-posts', () => ({
  usePosts: (...args: unknown[]) => mockUsePosts(...args),
}));

const mockUseFollowStats = vi.fn();
vi.mock('@/hooks/use-follow', () => ({
  useFollowStats: (...args: unknown[]) => mockUseFollowStats(...args),
}));

const mockUseWallet = vi.fn();
vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => mockUseWallet(),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Import the page component (after mocks are set up)
import FeedPage from '../page';
// Import for toTimelinePost testing - we test the conversion logic directly
import { POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE } from '@vauban/shared-types';

// =============================================================================
// Helpers
// =============================================================================

function createMockPost(overrides: Record<string, unknown> = {}) {
  return {
    id: '1',
    author: '0xAlice',
    content: 'Hello world',
    title: undefined,
    slug: undefined,
    excerpt: undefined,
    preview: undefined,
    coverImage: undefined,
    tags: [],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    arweaveTxId: 'ar_1',
    ipfsCid: 'QmTest1',
    contentHash: '0x' + 'ab'.repeat(32),
    isVerified: true,
    postType: POST_TYPE_TWEET,
    likesCount: 0,
    commentsCount: 0,
    replyCount: 0,
    isPaid: false,
    price: 0,
    ...overrides,
  };
}

function setupDefaults(postsOverride?: Record<string, unknown>, followingAddresses: string[] = []) {
  mockUseWallet.mockReturnValue({
    address: '0xAlice',
    account: { address: '0xAlice' },
    isConnected: true,
    isConnecting: false,
    isDevMode: false,
    network: 'devnet',
    networkConfig: { chainId: '0x0', name: 'Devnet', rpcUrl: '/api/rpc', explorerUrl: '' },
    wallet: null,
    walletName: 'Mock',
    connectWallet: vi.fn(),
    connectDevAccount: vi.fn(),
    disconnectWallet: vi.fn(),
    switchNetwork: vi.fn(),
    getExplorerUrl: vi.fn(),
    getAccountUrl: vi.fn(),
  });

  mockUsePosts.mockReturnValue({
    posts: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    error: null,
    refetch: vi.fn(),
    loadMore: vi.fn(),
    ...postsOverride,
  });

  mockUseFollowStats.mockReturnValue({
    stats: { followerCount: 0, followingCount: 0 },
    followers: [],
    following: followingAddresses,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    loadMoreFollowers: vi.fn(),
    loadMoreFollowing: vi.fn(),
    hasMoreFollowers: false,
    hasMoreFollowing: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaults();
});

// =============================================================================
// Tests
// =============================================================================

describe('FeedPage', () => {
  it('renders page with all sections (header, tabs, composer, timeline)', () => {
    setupDefaults({ posts: [createMockPost()] });

    render(<FeedPage />);

    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByTestId('feed-tabs')).toBeDefined();
    expect(screen.getByTestId('composer')).toBeDefined();
    expect(screen.getByTestId('timeline')).toBeDefined();
  });

  it('error state shows error message', () => {
    setupDefaults({ error: 'Failed to connect to blockchain' });

    render(<FeedPage />);

    expect(screen.getByText('Error loading feed')).toBeDefined();
    expect(screen.getByText('Failed to connect to blockchain')).toBeDefined();
  });

  it('toTimelinePost: converts VerifiedPost correctly - tweet by postType', () => {
    const post = createMockPost({ postType: POST_TYPE_TWEET, content: 'Short tweet' });

    setupDefaults({ posts: [post] });
    render(<FeedPage />);

    const postEl = screen.getByTestId('post-1');
    expect(postEl.getAttribute('data-content-type')).toBe('tweet');
  });

  it('toTimelinePost: converts thread correctly', () => {
    const post = createMockPost({ postType: POST_TYPE_THREAD, content: 'Thread post' });

    setupDefaults({ posts: [post] });
    render(<FeedPage />);

    const postEl = screen.getByTestId('post-1');
    expect(postEl.getAttribute('data-content-type')).toBe('thread');
  });

  it('toTimelinePost: converts article correctly', () => {
    const post = createMockPost({
      postType: POST_TYPE_ARTICLE,
      title: 'My Article',
      content: 'Long article content'.repeat(20),
    });

    setupDefaults({ posts: [post] });
    render(<FeedPage />);

    const postEl = screen.getByTestId('post-1');
    expect(postEl.getAttribute('data-content-type')).toBe('article');
  });

  it('toTimelinePost: infers tweet for short untitled post', () => {
    // No title, <= 280 chars, postType is article but should be inferred as tweet
    const post = createMockPost({
      postType: POST_TYPE_ARTICLE,
      title: undefined,
      content: 'Short post without title',
    });

    setupDefaults({ posts: [post] });
    render(<FeedPage />);

    const postEl = screen.getByTestId('post-1');
    // The toTimelinePost function checks: !post.title && post.content.length <= 280
    expect(postEl.getAttribute('data-content-type')).toBe('tweet');
  });

  it('tab filtering counts are correct', () => {
    const posts = [
      createMockPost({ id: '1', postType: POST_TYPE_TWEET, content: 'Tweet 1' }),
      createMockPost({ id: '2', postType: POST_TYPE_ARTICLE, title: 'Article 1', content: 'x'.repeat(300) }),
      createMockPost({ id: '3', postType: POST_TYPE_THREAD, content: 'Thread 1' }),
      createMockPost({ id: '4', postType: POST_TYPE_ARTICLE, title: 'Article 2', content: 'x'.repeat(300) }),
    ];

    setupDefaults({ posts });
    render(<FeedPage />);

    // forYou: all non-reply posts = 4
    expect(screen.getByTestId('count-forYou').textContent).toBe('4');
    // articles: postType=2 = 2
    expect(screen.getByTestId('count-articles').textContent).toBe('2');
    // threads: postType=1 = 1
    expect(screen.getByTestId('count-threads').textContent).toBe('1');
    // following: no followed addresses = 0
    expect(screen.getByTestId('count-following').textContent).toBe('0');
  });

  it('thread composer toggle button works', async () => {
    setupDefaults({ posts: [createMockPost()] });

    render(<FeedPage />);

    // Initially, composer is visible, thread composer is not
    expect(screen.getByTestId('composer')).toBeDefined();
    expect(screen.queryByTestId('thread-composer')).toBeNull();

    // Click "Create a thread" button
    const threadBtn = screen.getByText('Create a thread');
    await act(async () => {
      fireEvent.click(threadBtn);
    });

    // Now thread composer should be visible, regular composer hidden
    expect(screen.getByTestId('thread-composer')).toBeDefined();
    expect(screen.queryByTestId('composer')).toBeNull();

    // Cancel thread composer
    const cancelBtn = screen.getByTestId('thread-cancel-btn');
    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    // Back to regular composer
    expect(screen.getByTestId('composer')).toBeDefined();
    expect(screen.queryByTestId('thread-composer')).toBeNull();
  });

  it('post success triggers refetch (via setTimeout)', async () => {
    vi.useFakeTimers();
    const refetchMock = vi.fn();
    setupDefaults({ posts: [createMockPost()], refetch: refetchMock });

    render(<FeedPage />);

    // Click the mock post button
    const postBtn = screen.getByTestId('post-btn');
    await act(async () => {
      fireEvent.click(postBtn);
    });

    // refetch is called after 2000ms delay
    expect(refetchMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(refetchMock).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('load more button appears when hasMore is true', () => {
    setupDefaults({
      posts: [createMockPost()],
      hasMore: true,
      isLoading: false,
    });

    render(<FeedPage />);

    expect(screen.getByText('Charger plus')).toBeDefined();
  });

  it('load more button hidden when no posts or hasMore is false', () => {
    setupDefaults({ posts: [], hasMore: false });

    render(<FeedPage />);

    expect(screen.queryByText('Charger plus')).toBeNull();
  });

  it('followedAddresses passed to Timeline', () => {
    const followedAddresses = ['0xBob', '0xCharlie'];
    setupDefaults({ posts: [createMockPost()] }, followedAddresses);

    render(<FeedPage />);

    const timeline = screen.getByTestId('timeline');
    expect(screen.getByTestId('followed-count').textContent).toBe('2');
  });
});
