# API Reference

This document covers the HTTP API endpoints and smart contract interfaces.

---

## HTTP API

### Base URL

```
Development: http://localhost:3000/api
Production:  https://vauban.blog/api
```

### Authentication

**M2M (Machine-to-Machine) endpoints** require an API key:

```http
X-API-Key: your-api-key-here
```

**User endpoints** use wallet signatures via starknetkit.

---

## M2M Publishing API

### POST /api/m2m/publish

Publish an article programmatically (for automated publishing, CI/CD, AI agents).

**Headers**
```http
Content-Type: application/json
X-API-Key: your-api-key
```

**Request Body**
```json
{
  "title": "My Article Title",
  "content": "# Markdown content here\n\nWith full **formatting** support.",
  "slug": "my-article-title",
  "tags": ["web3", "tutorial"],
  "coverImage": "https://example.com/image.png",
  "excerpt": "A brief summary of the article...",
  "isPaid": false,
  "price": "0",
  "authorAddress": "0x1234..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Article title (max 100 chars) |
| `content` | string | Yes | Markdown content |
| `slug` | string | No | URL slug (auto-generated if omitted) |
| `tags` | string[] | No | Array of tags (max 5) |
| `coverImage` | string | No | Cover image URL or IPFS CID |
| `excerpt` | string | No | Summary (max 300 chars) |
| `isPaid` | boolean | No | Whether content is paywalled |
| `price` | string | No | Price in wei (if isPaid=true) |
| `authorAddress` | string | No | Override author (admin only) |

**Response (Success)**
```json
{
  "success": true,
  "postId": "42",
  "arweaveTxId": "abc123...",
  "ipfsCid": "Qm...",
  "contentHash": "0x...",
  "slug": "my-article-title",
  "url": "https://vauban.blog/articles/my-article-title"
}
```

**Response (Error)**
```json
{
  "success": false,
  "error": "Invalid API key",
  "code": "UNAUTHORIZED"
}
```

**Error Codes**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `RATE_LIMITED` | 429 | Too many requests |
| `STORAGE_ERROR` | 502 | IPFS/Arweave upload failed |
| `CONTRACT_ERROR` | 502 | Blockchain transaction failed |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

**Example: cURL**
```bash
curl -X POST https://vauban.blog/api/m2m/publish \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "title": "Hello World",
    "content": "# Hello\n\nThis is my first post.",
    "tags": ["introduction"]
  }'
```

**Example: TypeScript**
```typescript
const response = await fetch('https://vauban.blog/api/m2m/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.VAUBAN_API_KEY!,
  },
  body: JSON.stringify({
    title: 'Hello World',
    content: '# Hello\n\nThis is my first post.',
    tags: ['introduction'],
  }),
});

const result = await response.json();
console.log(result.url); // https://vauban.blog/articles/hello-world
```

---

### GET /api/m2m/status/:postId

Check the status of a published post.

**Headers**
```http
X-API-Key: your-api-key
```

**Response**
```json
{
  "postId": "42",
  "status": "published",
  "arweaveStatus": "confirmed",
  "ipfsStatus": "pinned",
  "blockNumber": 12345,
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### POST /api/m2m/batch

Publish multiple articles in one request.

**Request Body**
```json
{
  "articles": [
    {
      "title": "Article 1",
      "content": "Content 1..."
    },
    {
      "title": "Article 2",
      "content": "Content 2..."
    }
  ]
}
```

**Response**
```json
{
  "success": true,
  "results": [
    { "success": true, "postId": "42", "slug": "article-1" },
    { "success": true, "postId": "43", "slug": "article-2" }
  ],
  "totalSuccess": 2,
  "totalFailed": 0
}
```

---

## IPFS Proxy API

### GET /api/ipfs/:cid

Proxy endpoint for IPFS content (handles CORS, caching).

**Parameters**
- `cid` - IPFS Content Identifier

**Response**
- Content-Type based on file type
- Cache-Control headers
- CORS headers

**Example**
```bash
curl https://vauban.blog/api/ipfs/QmXyz...
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/m2m/publish` | 10 requests | 1 minute |
| `/api/m2m/batch` | 2 requests | 1 minute |
| `/api/m2m/status` | 60 requests | 1 minute |
| `/api/ipfs/*` | 100 requests | 1 minute |

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1705312200
```

---

## Smart Contract Interfaces

### Contract Addresses

After deployment, addresses are in `.deployments.json`:

```json
{
  "contracts": {
    "RoleRegistry": "0x...",
    "BlogRegistry": "0x...",
    "Social": "0x...",
    "Treasury": "0x...",
    "Reputation": "0x...",
    "Paymaster": "0x...",
    "SessionKeyManager": "0x..."
  }
}
```

---

## RoleRegistry Contract

Manages the 7-tier role system.

### Read Functions

#### `get_role(user: ContractAddress) -> u8`

Get a user's role level.

```typescript
const role = await roleRegistry.get_role(userAddress);
// Returns: 0 (Reader), 1 (Writer), 2 (Contributor), etc.
```

#### `has_permission(user: ContractAddress, action: felt252) -> bool`

Check if user can perform a specific action.

```typescript
const canApprove = await roleRegistry.has_permission(
  userAddress,
  starknet.shortString.encodeShortString('approve_content')
);
```

#### `get_role_info(user: ContractAddress) -> UserRole`

Get full role information.

```typescript
const info = await roleRegistry.get_role_info(userAddress);
// Returns: { role, granted_at, granted_by, approved_posts, reputation, is_active }
```

### Write Functions

#### `grant_role(user: ContractAddress, role: u8)`

Grant a role to a user. Requires Admin (5) or higher.

```typescript
await roleRegistry.grant_role(userAddress, 4); // Grant Editor role
```

#### `revoke_role(user: ContractAddress)`

Revoke user's role (reset to Reader). Requires Admin (5) or higher.

```typescript
await roleRegistry.revoke_role(userAddress);
```

#### `promote_to_contributor(user: ContractAddress)`

Internal function for auto-promotion. Called by BlogRegistry.

### Events

```cairo
event RoleGranted {
    user: ContractAddress,
    role: u8,
    granted_by: ContractAddress,
    timestamp: u64,
}

event RoleRevoked {
    user: ContractAddress,
    previous_role: u8,
    revoked_by: ContractAddress,
    timestamp: u64,
}

event ContributorPromoted {
    user: ContractAddress,
    approved_posts: u32,
    timestamp: u64,
}
```

---

## BlogRegistry Contract

Manages article publishing and metadata.

### Data Structures

```cairo
struct Post {
    id: u256,
    author: ContractAddress,
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    content_hash: felt252,        // SHA256 of content
    title: ByteArray,
    slug: ByteArray,
    status: u8,                   // 0=draft, 1=pending, 2=published, 3=rejected, 4=archived
    is_paid: bool,
    price: u256,
    created_at: u64,
    updated_at: u64,
    published_at: u64,
    reviewer: ContractAddress,
    reviewed_at: u64,
    rejection_reason: ByteArray,
    featured: bool,
    featured_at: u64,
    like_count: u32,
    comment_count: u32,
}
```

### Read Functions

#### `get_post(post_id: u256) -> Post`

Get full post metadata.

```typescript
const post = await blogRegistry.get_post(42n);
```

#### `get_post_by_slug(slug: ByteArray) -> Post`

Get post by URL slug.

```typescript
const post = await blogRegistry.get_post_by_slug('my-article');
```

#### `get_posts(limit: u64, offset: u64) -> Array<Post>`

Get paginated posts (published only).

```typescript
const posts = await blogRegistry.get_posts(10n, 0n);
```

#### `get_posts_by_author(author: ContractAddress, limit: u64, offset: u64) -> Array<Post>`

Get posts by specific author.

```typescript
const posts = await blogRegistry.get_posts_by_author(authorAddress, 10n, 0n);
```

#### `get_posts_by_status(status: u8, limit: u64, offset: u64) -> Array<Post>`

Get posts by status. Editor+ only for non-published.

```typescript
const pendingPosts = await blogRegistry.get_posts_by_status(1, 10n, 0n);
```

#### `get_featured_posts(limit: u64) -> Array<Post>`

Get featured articles.

```typescript
const featured = await blogRegistry.get_featured_posts(3n);
```

#### `get_post_count() -> u256`

Get total post count.

```typescript
const count = await blogRegistry.get_post_count();
```

### Write Functions

#### `publish_post(...) -> u256`

Publish a new post. Returns post ID.

```typescript
const postId = await blogRegistry.publish_post(
  arweaveTxId,      // ByteArray
  ipfsCid,          // ByteArray
  contentHash,      // felt252
  title,            // ByteArray
  slug,             // ByteArray
  isPaid,           // bool
  price             // u256
);
```

#### `submit_for_review(post_id: u256)`

Submit a draft for editorial review. Writer+ only.

```typescript
await blogRegistry.submit_for_review(42n);
```

#### `approve_post(post_id: u256)`

Approve a pending post. Editor+ only.

```typescript
await blogRegistry.approve_post(42n);
```

#### `reject_post(post_id: u256, reason: ByteArray)`

Reject a post with reason. Editor+ only.

```typescript
await blogRegistry.reject_post(42n, 'Does not meet quality standards.');
```

#### `request_revision(post_id: u256, feedback: ByteArray)`

Request revisions on a pending post. Editor+ only.

```typescript
await blogRegistry.request_revision(42n, 'Please add sources for claims.');
```

#### `feature_post(post_id: u256)`

Feature a published post. Editor+ only.

```typescript
await blogRegistry.feature_post(42n);
```

#### `unfeature_post(post_id: u256)`

Remove featured status. Editor+ only.

```typescript
await blogRegistry.unfeature_post(42n);
```

#### `update_post(post_id: u256, arweave_tx_id: ByteArray, ipfs_cid: ByteArray, content_hash: felt252)`

Update post content. Author (own posts) or Editor+ (any post).

```typescript
await blogRegistry.update_post(42n, newArweaveTxId, newIpfsCid, newContentHash);
```

#### `archive_post(post_id: u256)`

Archive a post. Author (own posts) or Admin+.

```typescript
await blogRegistry.archive_post(42n);
```

### Events

```cairo
event PostPublished {
    post_id: u256,
    author: ContractAddress,
    slug: ByteArray,
    is_paid: bool,
    timestamp: u64,
}

event PostSubmitted {
    post_id: u256,
    author: ContractAddress,
    timestamp: u64,
}

event PostApproved {
    post_id: u256,
    reviewer: ContractAddress,
    timestamp: u64,
}

event PostRejected {
    post_id: u256,
    reviewer: ContractAddress,
    reason: ByteArray,
    timestamp: u64,
}

event PostFeatured {
    post_id: u256,
    featured_by: ContractAddress,
    timestamp: u64,
}

event PostUpdated {
    post_id: u256,
    updated_by: ContractAddress,
    timestamp: u64,
}
```

---

## Social Contract

Manages comments, likes, and reports.

### Data Structures

```cairo
struct Comment {
    id: u256,
    post_id: u256,
    author: ContractAddress,
    content: ByteArray,
    parent_id: u256,           // 0 for top-level, comment_id for reply
    created_at: u64,
    is_hidden: bool,
    hidden_by: ContractAddress,
    hidden_at: u64,
}

struct Report {
    id: u256,
    reporter: ContractAddress,
    target_type: u8,           // 0=post, 1=comment, 2=user
    target_id: u256,
    reason: u8,                // 0=spam, 1=harassment, 2=misinfo, 3=copyright, 4=other
    details: ByteArray,
    created_at: u64,
    status: u8,                // 0=pending, 1=resolved, 2=dismissed
    resolved_by: ContractAddress,
    resolution_note: ByteArray,
    resolved_at: u64,
}
```

### Read Functions

#### `get_comments(post_id: u256, limit: u64, offset: u64) -> Array<Comment>`

Get comments for a post.

```typescript
const comments = await social.get_comments(42n, 20n, 0n);
```

#### `get_comment(comment_id: u256) -> Comment`

Get a specific comment.

```typescript
const comment = await social.get_comment(123n);
```

#### `get_like_count(post_id: u256) -> u32`

Get like count for a post.

```typescript
const likes = await social.get_like_count(42n);
```

#### `has_liked(user: ContractAddress, post_id: u256) -> bool`

Check if user has liked a post.

```typescript
const hasLiked = await social.has_liked(userAddress, 42n);
```

#### `get_pending_reports(limit: u64, offset: u64) -> Array<Report>`

Get pending reports. Moderator+ only.

```typescript
const reports = await social.get_pending_reports(20n, 0n);
```

#### `is_user_banned(user: ContractAddress) -> bool`

Check if user is currently banned.

```typescript
const isBanned = await social.is_user_banned(userAddress);
```

### Write Functions

#### `add_comment(post_id: u256, content: ByteArray, parent_id: u256) -> u256`

Add a comment. Returns comment ID.

```typescript
// Top-level comment
const commentId = await social.add_comment(42n, 'Great article!', 0n);

// Reply to comment
const replyId = await social.add_comment(42n, 'I agree!', commentId);
```

#### `like_post(post_id: u256)`

Like a post.

```typescript
await social.like_post(42n);
```

#### `unlike_post(post_id: u256)`

Remove like from a post.

```typescript
await social.unlike_post(42n);
```

#### `report_content(target_type: u8, target_id: u256, reason: u8, details: ByteArray)`

Report content for moderation.

```typescript
await social.report_content(
  0,              // target_type: post
  42n,            // target_id: post ID
  1,              // reason: harassment
  'Contains personal attacks'
);
```

#### `resolve_report(report_id: u256, action: u8, note: ByteArray)`

Resolve a report. Moderator+ only.

```typescript
await social.resolve_report(
  123n,           // report_id
  1,              // action: resolved (0=dismissed, 1=resolved)
  'Content hidden and user warned.'
);
```

#### `hide_comment(comment_id: u256)`

Hide a comment. Moderator+ only.

```typescript
await social.hide_comment(123n);
```

#### `unhide_comment(comment_id: u256)`

Unhide a comment. Moderator+ only.

```typescript
await social.unhide_comment(123n);
```

#### `temp_ban_user(user: ContractAddress, duration_hours: u64, reason: ByteArray)`

Temporarily ban a user. Moderator+ only.

```typescript
await social.temp_ban_user(userAddress, 72n, 'Repeated policy violations.');
```

### Events

```cairo
event CommentAdded {
    comment_id: u256,
    post_id: u256,
    author: ContractAddress,
    parent_id: u256,
    timestamp: u64,
}

event PostLiked {
    post_id: u256,
    user: ContractAddress,
    timestamp: u64,
}

event PostUnliked {
    post_id: u256,
    user: ContractAddress,
    timestamp: u64,
}

event ContentReported {
    report_id: u256,
    reporter: ContractAddress,
    target_type: u8,
    target_id: u256,
    reason: u8,
    timestamp: u64,
}

event ReportResolved {
    report_id: u256,
    resolved_by: ContractAddress,
    action: u8,
    timestamp: u64,
}

event UserBanned {
    user: ContractAddress,
    banned_by: ContractAddress,
    duration_hours: u64,
    reason: ByteArray,
    timestamp: u64,
}
```

---

## Treasury Contract

Manages revenue distribution and withdrawals.

### Data Structures

```cairo
struct Earnings {
    user: ContractAddress,
    total_earned: u256,
    total_withdrawn: u256,
    pending: u256,
}

struct RevenueConfig {
    platform_fee: u8,      // Default 10%
    referral_fee: u8,      // Default 5%
}
```

### Read Functions

#### `get_earnings(user: ContractAddress) -> Earnings`

Get user's earnings summary.

```typescript
const earnings = await treasury.get_earnings(userAddress);
// { total_earned, total_withdrawn, pending }
```

#### `get_platform_fee() -> u8`

Get current platform fee percentage.

```typescript
const fee = await treasury.get_platform_fee(); // e.g., 10
```

#### `get_total_revenue() -> u256`

Get total platform revenue. Admin+ only.

```typescript
const revenue = await treasury.get_total_revenue();
```

### Write Functions

#### `distribute_payment(post_id: u256, amount: u256, payer: ContractAddress)`

Distribute payment for content purchase. Called internally.

#### `withdraw_earnings()`

Withdraw pending earnings to caller's wallet.

```typescript
await treasury.withdraw_earnings();
```

#### `set_platform_fee(fee_percentage: u8)`

Set platform fee. Owner only.

```typescript
await treasury.set_platform_fee(10); // 10%
```

#### `withdraw_platform_funds(amount: u256, recipient: ContractAddress)`

Withdraw platform treasury. Owner only.

```typescript
await treasury.withdraw_platform_funds(1000000000000000000n, recipientAddress);
```

### Events

```cairo
event PaymentDistributed {
    post_id: u256,
    author: ContractAddress,
    author_amount: u256,
    platform_amount: u256,
    referrer_amount: u256,
    timestamp: u64,
}

event EarningsWithdrawn {
    user: ContractAddress,
    amount: u256,
    timestamp: u64,
}

event PlatformFeeUpdated {
    old_fee: u8,
    new_fee: u8,
    updated_by: ContractAddress,
    timestamp: u64,
}
```

---

## Reputation Contract

Manages reputation points and badges.

### Read Functions

#### `get_reputation(user: ContractAddress) -> UserReputation`

Get user's reputation info.

```typescript
const rep = await reputation.get_reputation(userAddress);
// { total_points, level, badges, joined_at, post_count, comment_count, like_count }
```

#### `get_level(user: ContractAddress) -> u8`

Get user's reputation level (1-5).

```typescript
const level = await reputation.get_level(userAddress);
```

#### `has_badge(user: ContractAddress, badge_bit: u8) -> bool`

Check if user has a specific badge.

```typescript
const hasFirstPost = await reputation.has_badge(userAddress, 0); // First Post badge
```

### Write Functions

#### `add_points(user: ContractAddress, points: u64, reason: felt252)`

Add reputation points. Called by other contracts.

#### `award_badge(user: ContractAddress, badge_bit: u8)`

Award a badge. Called internally or by Admin.

```typescript
await reputation.award_badge(userAddress, 3); // Featured Author badge
```

### Events

```cairo
event PointsAdded {
    user: ContractAddress,
    points: u64,
    reason: felt252,
    new_total: u64,
    timestamp: u64,
}

event LevelUp {
    user: ContractAddress,
    new_level: u8,
    total_points: u64,
    timestamp: u64,
}

event BadgeAwarded {
    user: ContractAddress,
    badge_bit: u8,
    timestamp: u64,
}
```

---

## SDK Usage

### JavaScript/TypeScript

```typescript
import { Contract, RpcProvider, Account } from 'starknet';
import { BlogRegistryAbi, SocialAbi, RoleRegistryAbi } from '@vauban/web3-utils';

// Setup provider
const provider = new RpcProvider({ nodeUrl: 'http://localhost:9944' });

// Create contract instances
const blogRegistry = new Contract(
  BlogRegistryAbi,
  '0x123...', // Contract address
  provider
);

// Connect account for write operations
const account = new Account(provider, accountAddress, privateKey);
const connectedBlogRegistry = blogRegistry.connect(account);

// Read post
const post = await blogRegistry.get_post(42n);

// Publish post
const result = await connectedBlogRegistry.publish_post(
  arweaveTxId,
  ipfsCid,
  contentHash,
  title,
  slug,
  false, // isPaid
  0n     // price
);
```

### React Hooks

```typescript
import { useContract, useAccount } from '@starknet-react/core';
import { useMemo } from 'react';

function usePost(postId: bigint) {
  const { contract: blogRegistry } = useContract({
    address: BLOG_REGISTRY_ADDRESS,
    abi: BlogRegistryAbi,
  });

  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    blogRegistry?.get_post(postId).then(setPost);
  }, [blogRegistry, postId]);

  return post;
}
```

---

## Error Handling

### Contract Errors

All contracts use descriptive error messages:

```cairo
// Access control
'Caller is not owner'
'Caller is not admin'
'Insufficient permissions'

// Validation
'Invalid post ID'
'Post not found'
'Comment not found'
'User is banned'

// State
'Contract is paused'
'Post already published'
'Already liked'
```

### Handling Errors in TypeScript

```typescript
try {
  await blogRegistry.publish_post(...);
} catch (error) {
  if (error.message.includes('Insufficient permissions')) {
    // User doesn't have required role
  } else if (error.message.includes('Contract is paused')) {
    // Platform is paused for maintenance
  } else {
    // Unknown error
    console.error('Publish failed:', error);
  }
}
```

---

## Webhooks (Future)

Planned webhook events for integrations:

| Event | Payload |
|-------|---------|
| `post.published` | Post metadata |
| `post.approved` | Post ID, reviewer |
| `comment.added` | Comment, post ID |
| `report.created` | Report details |
| `user.banned` | User, duration, reason |

Configure webhooks in platform settings (Admin only).
