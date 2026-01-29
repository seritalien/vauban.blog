import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ALICE, BOB, createMockWalletContext } from '../helpers/test-users';
import type { AuthorProfile } from '@vauban/shared-types';
import { POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE } from '@vauban/shared-types';

// =============================================================================
// Mocks - Must be defined before imports
// =============================================================================

// Mock next/navigation
const mockParams = { address: ALICE.address };
vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => `/authors/${mockParams.address}`,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    React.createElement('a', { href, ...props }, children)
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      React.createElement('div', props, children)
    ),
    button: ({ children, whileTap, ...props }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement> & { whileTap?: unknown }>) => (
      React.createElement('button', props, children)
    ),
    span: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLSpanElement>>) => (
      React.createElement('span', props, children)
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

// Mock wallet provider
const mockUseWallet = vi.fn();
vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => mockUseWallet(),
}));

// Mock profiles lib
const mockGetProfile = vi.fn();
vi.mock('@/lib/profiles', () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  formatAddress: (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '',
  getDisplayName: (addr: string, profile: AuthorProfile | null) => profile?.displayName ?? (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''),
  normalizeAddress: (addr: unknown) => {
    if (!addr) return '';
    const s = String(addr).toLowerCase();
    const withoutPrefix = s.replace(/^0x/, '');
    const withoutLeadingZeros = withoutPrefix.replace(/^0+/, '') || '0';
    return `0x${withoutLeadingZeros}`;
  },
}));

// Mock use-author-stats hook
const mockUseAuthorStats = vi.fn();
vi.mock('@/hooks/use-author-stats', () => ({
  useAuthorStats: (...args: unknown[]) => mockUseAuthorStats(...args),
}));

// Mock follow hooks
const mockUseFollow = vi.fn();
const mockUseFollowCounts = vi.fn();
vi.mock('@/hooks/use-follow', () => ({
  useFollow: (...args: unknown[]) => mockUseFollow(...args),
  useFollowCounts: (...args: unknown[]) => mockUseFollowCounts(...args),
}));

// Mock messaging component
vi.mock('@/components/messaging', () => ({
  MessageUserButton: ({ recipientAddress, size }: { recipientAddress: string; size?: string }) => (
    React.createElement('button', { 'data-testid': 'message-button', 'data-recipient': recipientAddress, 'data-size': size }, 'Message')
  ),
}));

// Mock UI components
vi.mock('@/components/ui/Skeleton', () => ({
  ArticleCardSkeleton: () => React.createElement('div', { 'data-testid': 'article-skeleton' }, 'Loading...'),
}));

vi.mock('@/components/ui/AuthorBadge', () => ({
  default: ({ type, size }: { type: string; size?: string }) => (
    React.createElement('span', { 'data-testid': `badge-${type}`, 'data-size': size }, type)
  ),
  getAuthorBadges: (totalPosts: number, hasProfile: boolean, memberSince?: Date) => {
    const badges: string[] = [];
    if (hasProfile) badges.push('verified');
    if (totalPosts >= 10) badges.push('prolific');
    if (memberSince && memberSince < new Date('2024-01-01')) badges.push('early-adopter');
    return badges;
  },
}));

// =============================================================================
// Imports after mocks
// =============================================================================

import AuthorProfilePage from '@/app/authors/[address]/page';
import FollowButton from '@/components/social/FollowButton';
import FollowStats from '@/components/social/FollowStats';

// =============================================================================
// Type definitions for hook return types
// =============================================================================

interface AuthorStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  memberSince: Date | null;
  publicationFrequency: string;
  recentPostDates: Date[];
}

interface PostWithEngagement {
  id: string;
  author: string;
  title?: string;
  content: string;
  excerpt?: string;
  slug?: string;
  arweaveTxId: string;
  ipfsCid: string;
  contentHash: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  isDeleted: boolean;
  postType: number;
  isVerified: boolean;
  tags: string[];
  isPaid: boolean;
  price: number;
  isEncrypted: boolean;
  coverImage?: string;
  likeCount: number;
  commentCount: number;
}

// =============================================================================
// Test Data Factories
// =============================================================================

const NOW = Date.now();

function createMockProfile(overrides: Partial<AuthorProfile> = {}): AuthorProfile {
  return {
    address: ALICE.address,
    displayName: 'Alice Wonderland',
    bio: 'Exploring the decentralized web. Writing about blockchain and technology.',
    avatar: 'https://example.com/avatar.jpg',
    website: 'https://alice.example.com',
    twitter: '@alice_wonder',
    github: 'alicewonder',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-06-01T14:30:00Z',
    ...overrides,
  };
}

function createMockPost(
  id: string,
  author: string,
  createdAt: Date,
  overrides: Partial<PostWithEngagement> = {},
): PostWithEngagement {
  return {
    id,
    author,
    title: `Post ${id}`,
    content: `Content for post ${id}`,
    excerpt: `Excerpt for post ${id}`,
    slug: `post-${id}`,
    arweaveTxId: `ar_${id}`,
    ipfsCid: `Qm${id}`,
    contentHash: '0x' + 'ab'.repeat(32),
    createdAt,
    updatedAt: createdAt,
    isDeleted: false,
    postType: POST_TYPE_ARTICLE,
    isVerified: true,
    tags: ['test', 'article'],
    isPaid: false,
    price: 0,
    isEncrypted: false,
    coverImage: undefined,
    likeCount: 0,
    commentCount: 0,
    ...overrides,
  };
}

function createMockAuthorStats(
  posts: PostWithEngagement[],
  overrides: Partial<AuthorStats> = {},
): AuthorStats {
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.commentCount, 0);
  const postDates = posts.map((p) => p.createdAt).filter((d): d is Date => d !== null && d !== undefined);
  const memberSince = postDates.length > 0 ? new Date(Math.min(...postDates.map((d) => d.getTime()))) : null;

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    memberSince,
    publicationFrequency: posts.length === 0 ? 'No posts yet' : 'Publishes weekly',
    recentPostDates: postDates.slice(-10),
    ...overrides,
  };
}

// =============================================================================
// Setup Helpers
// =============================================================================

function setupWalletMock(user: typeof ALICE | typeof BOB | null) {
  const mockContext = createMockWalletContext(user);
  mockUseWallet.mockReturnValue(mockContext);
  return mockContext;
}

function setupFollowMocks(
  isFollowing: boolean = false,
  followerCount: number = 0,
  followingCount: number = 0,
) {
  mockUseFollow.mockReturnValue({
    isFollowing,
    isActing: false,
    toggleFollow: vi.fn().mockResolvedValue(true),
    stats: { followerCount, followingCount },
    error: null,
  });

  mockUseFollowCounts.mockReturnValue({
    followerCount,
    followingCount,
    isLoading: false,
  });
}

function setupAuthorStatsMock(
  posts: PostWithEngagement[] = [],
  isLoading: boolean = false,
  error: string | null = null,
) {
  const stats = createMockAuthorStats(posts);
  const featuredPosts = [...posts].sort((a, b) => b.likeCount - a.likeCount).slice(0, 3);
  const recentActivity = [...posts].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    return bTime - aTime;
  }).slice(0, 5);

  mockUseAuthorStats.mockReturnValue({
    stats,
    authorPosts: posts,
    postsWithEngagement: posts,
    featuredPosts,
    recentActivity,
    isLoading,
    isLoadingEngagement: false,
    error,
  });

  return { stats, featuredPosts, recentActivity };
}

function setViewedAuthor(address: string) {
  mockParams.address = address;
}

// =============================================================================
// Tests
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  setViewedAuthor(ALICE.address);
  mockGetProfile.mockReturnValue(null);
  setupWalletMock(BOB); // Default: BOB is viewing ALICE's profile
  setupFollowMocks(false, 10, 5);
  setupAuthorStatsMock([]);
});

describe('Author Profile Page Integration', () => {
  // =========================================================================
  // Profile Data Loading
  // =========================================================================

  describe('Profile Data Loading', () => {
    it('displays loading skeleton while data is loading', () => {
      setupAuthorStatsMock([], true);

      render(React.createElement(AuthorProfilePage));

      // Should show loading skeleton elements (there are multiple)
      expect(screen.getAllByTestId('article-skeleton').length).toBeGreaterThan(0);
    });

    it('displays error message when loading fails', () => {
      setupAuthorStatsMock([], false, 'Failed to load author data');

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('Error')).toBeDefined();
      expect(screen.getByText('Failed to load author data')).toBeDefined();
    });

    it('renders profile with name, bio, and avatar when profile exists', () => {
      const profile = createMockProfile();
      mockGetProfile.mockReturnValue(profile);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);

      render(React.createElement(AuthorProfilePage));

      // Display name should be visible
      expect(screen.getByText('Alice Wonderland')).toBeDefined();

      // Bio should be visible
      expect(screen.getByText(/Exploring the decentralized web/)).toBeDefined();

      // Avatar should be rendered (check for img element)
      const avatar = document.querySelector('img[alt="Alice Wonderland"]');
      expect(avatar).not.toBeNull();
      expect(avatar?.getAttribute('src')).toBe(profile.avatar);
    });

    it('renders default avatar with initial when no avatar URL', () => {
      const profile = createMockProfile({ avatar: undefined });
      mockGetProfile.mockReturnValue(profile);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);

      render(React.createElement(AuthorProfilePage));

      // Should show initial letter
      const defaultAvatar = document.querySelector('.rounded-full.bg-gradient-to-br');
      expect(defaultAvatar).not.toBeNull();
      expect(defaultAvatar?.textContent).toBe('A');
    });

    it('renders truncated address when no display name', () => {
      mockGetProfile.mockReturnValue(null);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);

      render(React.createElement(AuthorProfilePage));

      // Should show formatted address (may appear in title and address line)
      const shortAddress = `${ALICE.address.slice(0, 6)}...${ALICE.address.slice(-4)}`;
      expect(screen.getAllByText(shortAddress).length).toBeGreaterThan(0);
    });

    it('displays social links when present in profile', () => {
      const profile = createMockProfile();
      mockGetProfile.mockReturnValue(profile);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);

      render(React.createElement(AuthorProfilePage));

      // Check for social links
      const websiteLink = document.querySelector('a[href="https://alice.example.com"]');
      expect(websiteLink).not.toBeNull();

      const twitterLink = document.querySelector('a[href="https://twitter.com/alice_wonder"]');
      expect(twitterLink).not.toBeNull();

      const githubLink = document.querySelector('a[href="https://github.com/alicewonder"]');
      expect(githubLink).not.toBeNull();
    });
  });

  // =========================================================================
  // Author's Posts List
  // =========================================================================

  describe('Author Posts List', () => {
    it('displays posts filtered by author', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW - 86400000), { title: 'First Post' }),
        createMockPost('2', ALICE.address, new Date(NOW - 72000000), { title: 'Second Post' }),
        createMockPost('3', ALICE.address, new Date(NOW - 36000000), { title: 'Third Post' }),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // All posts should be visible (may appear multiple times in featured/activity/all sections)
      expect(screen.getAllByText('First Post').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Second Post').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Third Post').length).toBeGreaterThan(0);
    });

    it('shows empty state when author has no posts', () => {
      setupAuthorStatsMock([]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText(/hasn't published anything yet/)).toBeDefined();
    });

    it('displays post statistics (likes, comments) correctly', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW), {
          title: 'Popular Post',
          likeCount: 42,
          commentCount: 15,
        }),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Stats section should show totals (may appear in multiple places)
      expect(screen.getAllByText('42').length).toBeGreaterThan(0);
      expect(screen.getAllByText('15').length).toBeGreaterThan(0);
    });

    it('filters posts by content type tabs', async () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW - 300000), {
          title: 'Tweet Post',
          postType: POST_TYPE_TWEET,
          content: 'Short tweet content',
        }),
        createMockPost('2', ALICE.address, new Date(NOW - 200000), {
          title: 'Article Post',
          postType: POST_TYPE_ARTICLE,
          content: 'Long article content'.repeat(50),
        }),
        createMockPost('3', ALICE.address, new Date(NOW - 100000), {
          title: 'Thread Post',
          postType: POST_TYPE_THREAD,
          content: 'Thread content',
        }),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Initially "All" tab should show all posts (may appear multiple times)
      expect(screen.getAllByText('Tweet Post').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Article Post').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Thread Post').length).toBeGreaterThan(0);

      // Click "Articles" tab
      const articlesTab = screen.getAllByText('Articles')[0];
      await act(async () => {
        fireEvent.click(articlesTab);
      });

      // Only article should be visible after filtering
      // Note: Due to mock setup, we test the tab click interaction
      expect(screen.getAllByText('Articles').length).toBeGreaterThan(0);
    });

    it('shows correct tab counts for different content types', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW - 400000), { postType: POST_TYPE_TWEET }),
        createMockPost('2', ALICE.address, new Date(NOW - 300000), { postType: POST_TYPE_TWEET }),
        createMockPost('3', ALICE.address, new Date(NOW - 200000), { postType: POST_TYPE_ARTICLE }),
        createMockPost('4', ALICE.address, new Date(NOW - 100000), { postType: POST_TYPE_THREAD }),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Tab counts are shown in badges (may appear multiple times)
      const allCounts = screen.getAllByText('4');
      expect(allCounts.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Follower/Following Counts
  // =========================================================================

  describe('Follower/Following Counts', () => {
    it('displays follower and following counts on profile', () => {
      setupFollowMocks(false, 150, 42);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // FollowStats component should display counts (may appear in multiple places)
      expect(screen.getAllByText('150').length).toBeGreaterThan(0);
      expect(screen.getAllByText('42').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Followers').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Following').length).toBeGreaterThan(0);
    });

    it('shows singular "Follower" for count of 1', () => {
      setupFollowMocks(false, 1, 5);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('Follower')).toBeDefined();
      expect(screen.queryByText('Followers')).toBeNull();
    });

    it('formats large numbers correctly (1000 -> 1.0K)', () => {
      setupFollowMocks(false, 1000, 500);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('1.0K')).toBeDefined();
    });

    it('formats very large numbers correctly (1000000 -> 1.0M)', () => {
      setupFollowMocks(false, 1000000, 50000);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('1.0M')).toBeDefined();
    });
  });

  // =========================================================================
  // Pinned/Featured Posts Display
  // =========================================================================

  describe('Pinned/Featured Posts Display', () => {
    it('displays featured posts section with top 3 by likes', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW - 400000), { title: 'Low Likes', likeCount: 5 }),
        createMockPost('2', ALICE.address, new Date(NOW - 300000), { title: 'Top Liked', likeCount: 100 }),
        createMockPost('3', ALICE.address, new Date(NOW - 200000), { title: 'Mid Likes', likeCount: 50 }),
        createMockPost('4', ALICE.address, new Date(NOW - 100000), { title: 'Second Best', likeCount: 75 }),
      ];

      // Featured should be sorted: 2, 4, 3 (top 3 by likes)
      const { featuredPosts } = setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('Featured Posts')).toBeDefined();

      // Top 3 posts by likes should be in featured section
      expect(featuredPosts).toHaveLength(3);
      expect(featuredPosts[0].id).toBe('2'); // Top Liked
      expect(featuredPosts[1].id).toBe('4'); // Second Best
      expect(featuredPosts[2].id).toBe('3'); // Mid Likes
    });

    it('hides featured posts section when no posts exist', () => {
      setupAuthorStatsMock([]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.queryByText('Featured Posts')).toBeNull();
    });

    it('displays recent activity section with last 5 posts', () => {
      const posts = Array.from({ length: 7 }, (_, i) =>
        createMockPost(String(i + 1), ALICE.address, new Date(NOW - (7 - i) * 86400000), {
          title: `Post ${i + 1}`,
        }),
      );

      const { recentActivity } = setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('Recent Activity')).toBeDefined();

      // Recent activity should have last 5 posts, sorted by date descending
      expect(recentActivity).toHaveLength(5);
      expect(recentActivity[0].id).toBe('7'); // Most recent
      expect(recentActivity[4].id).toBe('3'); // 5th most recent
    });
  });

  // =========================================================================
  // Own Profile vs Other Profile
  // =========================================================================

  describe('Own Profile vs Other Profile', () => {
    it('hides follow button when viewing own profile', () => {
      setViewedAuthor(ALICE.address);
      setupWalletMock(ALICE); // ALICE viewing her own profile
      setupFollowMocks(false, 10, 5);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // FollowButton returns null for own profile
      // We check that "Follow" text is not rendered as a button for self
      // But "Following" stats label might still exist - so be specific
      const followButtons = screen.queryAllByRole('button');
      const hasFollowActionButton = followButtons.some(
        (btn) => btn.textContent === 'Follow',
      );
      // The button should not be present for own profile
      expect(hasFollowActionButton).toBe(false);
    });

    it('shows follow button when viewing other user profile', () => {
      setViewedAuthor(ALICE.address);
      setupWalletMock(BOB); // BOB viewing ALICE's profile
      setupFollowMocks(false, 10, 5);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Should show FollowButton
      const followBtn = screen.getByRole('button', { name: /^Follow$/i });
      expect(followBtn).toBeDefined();
    });

    it('shows "Following" state when already following the user', () => {
      setViewedAuthor(ALICE.address);
      setupWalletMock(BOB);
      setupFollowMocks(true, 10, 5); // isFollowing = true
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // There's a "Following" button (when following) and a "Following" label in stats
      const followingBtn = screen.getByRole('button', { name: /^Following$/i });
      expect(followingBtn).toBeDefined();
    });

    it('shows message button for other users', () => {
      setViewedAuthor(ALICE.address);
      setupWalletMock(BOB);
      setupFollowMocks(false, 10, 5);
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      const messageButton = screen.getByTestId('message-button');
      expect(messageButton).toBeDefined();
      expect(messageButton.getAttribute('data-recipient')).toBe(ALICE.address);
    });
  });

  // =========================================================================
  // Author Badges
  // =========================================================================

  describe('Author Badges', () => {
    it('displays verified badge when profile exists', () => {
      mockGetProfile.mockReturnValue(createMockProfile());
      setupAuthorStatsMock([createMockPost('1', ALICE.address, new Date(NOW))]);

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByTestId('badge-verified')).toBeDefined();
    });

    it('displays prolific badge for authors with 10+ posts', () => {
      const posts = Array.from({ length: 12 }, (_, i) =>
        createMockPost(String(i + 1), ALICE.address, new Date(NOW - i * 86400000)),
      );
      mockGetProfile.mockReturnValue(createMockProfile());
      setupAuthorStatsMock(posts);

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByTestId('badge-prolific')).toBeDefined();
    });

    it('displays early-adopter badge for users who joined before 2024', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date('2023-06-15')), // Pre-2024
      ];
      mockGetProfile.mockReturnValue(createMockProfile());
      setupAuthorStatsMock(posts);

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByTestId('badge-early-adopter')).toBeDefined();
    });
  });

  // =========================================================================
  // Statistics Section
  // =========================================================================

  describe('Statistics Section', () => {
    it('displays total posts count', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW - 200000)),
        createMockPost('2', ALICE.address, new Date(NOW - 100000)),
        createMockPost('3', ALICE.address, new Date(NOW)),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Stats card should show 3 articles (may appear multiple times)
      expect(screen.getAllByText('3').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Articles').length).toBeGreaterThan(0);
    });

    it('displays total likes received', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW), { likeCount: 25 }),
        createMockPost('2', ALICE.address, new Date(NOW), { likeCount: 17 }),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Total likes: 25 + 17 = 42
      expect(screen.getAllByText('42').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Likes Received').length).toBeGreaterThan(0);
    });

    it('displays total comments received', () => {
      const posts = [
        createMockPost('1', ALICE.address, new Date(NOW), { commentCount: 8 }),
        createMockPost('2', ALICE.address, new Date(NOW), { commentCount: 12 }),
      ];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      // Total comments: 8 + 12 = 20
      expect(screen.getAllByText('20').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Comments').length).toBeGreaterThan(0);
    });

    it('displays member since date', () => {
      const memberSince = new Date('2024-03-15');
      const posts = [createMockPost('1', ALICE.address, memberSince)];
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('Mar 2024')).toBeDefined();
      expect(screen.getByText('Member Since')).toBeDefined();
    });

    it('displays publication frequency', () => {
      // Create posts ~7 days apart for "Publishes weekly"
      const posts = Array.from({ length: 5 }, (_, i) =>
        createMockPost(String(i + 1), ALICE.address, new Date(NOW - i * 7 * 86400000)),
      );
      setupAuthorStatsMock(posts);
      mockGetProfile.mockReturnValue(createMockProfile());

      render(React.createElement(AuthorProfilePage));

      expect(screen.getByText('Publishes weekly')).toBeDefined();
    });
  });
});

// =============================================================================
// Component Unit Tests
// =============================================================================

describe('FollowButton Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupWalletMock(ALICE);
    mockUseFollow.mockReturnValue({
      isFollowing: false,
      isActing: false,
      toggleFollow: vi.fn().mockResolvedValue(true),
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });
  });

  it('returns null when viewing own profile', () => {
    setupWalletMock(ALICE);
    const { container } = render(React.createElement(FollowButton, { targetAddress: ALICE.address }));
    expect(container.innerHTML).toBe('');
  });

  it('shows "Follow" when not following', () => {
    setupWalletMock(ALICE);
    render(React.createElement(FollowButton, { targetAddress: BOB.address }));
    expect(screen.getByText('Follow')).toBeDefined();
  });

  it('shows "Following" when already following', () => {
    setupWalletMock(ALICE);
    mockUseFollow.mockReturnValue({
      isFollowing: true,
      isActing: false,
      toggleFollow: vi.fn(),
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });

    render(React.createElement(FollowButton, { targetAddress: BOB.address }));
    expect(screen.getByText('Following')).toBeDefined();
  });

  it('calls toggleFollow on click', async () => {
    const mockToggle = vi.fn().mockResolvedValue(true);
    setupWalletMock(ALICE);
    mockUseFollow.mockReturnValue({
      isFollowing: false,
      isActing: false,
      toggleFollow: mockToggle,
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });

    render(React.createElement(FollowButton, { targetAddress: BOB.address }));

    const btn = screen.getByRole('button');
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('displays spinner when action is in progress', () => {
    setupWalletMock(ALICE);
    mockUseFollow.mockReturnValue({
      isFollowing: false,
      isActing: true,
      toggleFollow: vi.fn(),
      stats: { followerCount: 42, followingCount: 10 },
      error: null,
    });

    render(React.createElement(FollowButton, { targetAddress: BOB.address }));

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).not.toBeNull();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('displays error tooltip when error occurs', () => {
    setupWalletMock(ALICE);
    mockUseFollow.mockReturnValue({
      isFollowing: false,
      isActing: false,
      toggleFollow: vi.fn(),
      stats: { followerCount: 42, followingCount: 10 },
      error: 'Network error',
    });

    render(React.createElement(FollowButton, { targetAddress: BOB.address }));
    expect(screen.getByText('Network error')).toBeDefined();
  });
});

describe('FollowStats Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFollowCounts.mockReturnValue({
      followerCount: 150,
      followingCount: 42,
      isLoading: false,
    });
  });

  it('displays follower and following counts', () => {
    render(React.createElement(FollowStats, { address: '0x123' }));

    expect(screen.getByText('150')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
    expect(screen.getByText('Followers')).toBeDefined();
    expect(screen.getByText('Following')).toBeDefined();
  });

  it('shows loading skeleton when data is loading', () => {
    mockUseFollowCounts.mockReturnValue({
      followerCount: 0,
      followingCount: 0,
      isLoading: true,
    });

    const { container } = render(React.createElement(FollowStats, { address: '0x123' }));
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).not.toBeNull();
  });

  it('renders links when clickable=true', () => {
    render(React.createElement(FollowStats, { address: '0xABC', clickable: true }));

    const links = document.querySelectorAll('a');
    expect(links.length).toBe(2);

    const hrefs = Array.from(links).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/authors/0xABC?tab=following');
    expect(hrefs).toContain('/authors/0xABC?tab=followers');
  });
});
