# Smart Contracts

This document provides detailed documentation for the Cairo smart contracts powering Vauban Blog.

---

## Overview

Vauban Blog uses 7 interconnected smart contracts deployed on Madara L3 (Starknet-compatible):

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CONTRACT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────┐                                              │
│  │   RoleRegistry    │◄───────────────────────────────────┐        │
│  │ (Central Auth)    │                                     │        │
│  └─────────┬─────────┘                                     │        │
│            │                                               │        │
│            │ queries                                       │        │
│            ▼                                               │        │
│  ┌─────────────────────────────────────────────────────────┴─────┐ │
│  │                                                                │ │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐     │ │
│  │  │ BlogRegistry  │  │    Social     │  │  Reputation   │     │ │
│  │  │   (Posts)     │  │  (Comments)   │  │   (Points)    │     │ │
│  │  └───────┬───────┘  └───────┬───────┘  └───────────────┘     │ │
│  │          │                  │                                 │ │
│  │          └────────┬─────────┘                                 │ │
│  │                   │                                           │ │
│  │                   ▼                                           │ │
│  │           ┌───────────────┐                                   │ │
│  │           │   Treasury    │                                   │ │
│  │           │  (Payments)   │                                   │ │
│  │           └───────────────┘                                   │ │
│  │                                                                │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌───────────────┐  ┌───────────────────────┐                       │
│  │   Paymaster   │  │  SessionKeyManager    │                       │
│  │ (Gas Sponsor) │  │ (Account Abstraction) │                       │
│  └───────────────┘  └───────────────────────┘                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Contract Deployment Order

Contracts must be deployed in this order due to dependencies:

```
1. RoleRegistry        (standalone - no dependencies)
2. SessionKeyManager   (depends on RoleRegistry)
3. Paymaster           (depends on RoleRegistry)
4. Reputation          (depends on RoleRegistry)
5. Treasury            (depends on RoleRegistry)
6. BlogRegistry        (depends on RoleRegistry, Treasury, Reputation)
7. Social              (depends on RoleRegistry, BlogRegistry, Paymaster)
```

Post-deployment configuration:
- Whitelist `Social` contract in `Paymaster`
- Set `BlogRegistry` address in `Social`
- Set `Treasury` address in `BlogRegistry`

---

## RoleRegistry

**Purpose**: Centralized role management for the entire platform.

**Location**: `contracts/src/role_registry.cairo`

### Storage

```cairo
@storage_var
fn owner() -> ContractAddress;

@storage_var
fn roles(user: ContractAddress) -> u8;

@storage_var
fn role_granted_at(user: ContractAddress) -> u64;

@storage_var
fn role_granted_by(user: ContractAddress) -> ContractAddress;

@storage_var
fn approved_post_count(user: ContractAddress) -> u32;

@storage_var
fn contributor_threshold() -> u32;  // Default: 5

@storage_var
fn paused() -> bool;
```

### Role Constants

```cairo
const ROLE_READER: u8 = 0;
const ROLE_WRITER: u8 = 1;
const ROLE_CONTRIBUTOR: u8 = 2;
const ROLE_MODERATOR: u8 = 3;
const ROLE_EDITOR: u8 = 4;
const ROLE_ADMIN: u8 = 5;
const ROLE_OWNER: u8 = 6;
```

### Functions

```cairo
// Read functions
#[view]
fn get_role(user: ContractAddress) -> u8;

#[view]
fn get_role_info(user: ContractAddress) -> UserRoleInfo;

#[view]
fn has_permission(user: ContractAddress, action: felt252) -> bool;

#[view]
fn get_contributor_threshold() -> u32;

// Write functions
#[external]
fn grant_role(user: ContractAddress, role: u8);  // Admin+ only

#[external]
fn revoke_role(user: ContractAddress);  // Admin+ only

#[external]
fn set_contributor_threshold(threshold: u32);  // Owner only

#[external]
fn increment_approved_posts(user: ContractAddress);  // BlogRegistry only

#[external]
fn transfer_ownership(new_owner: ContractAddress);  // Owner only

#[external]
fn pause();  // Owner only

#[external]
fn unpause();  // Owner only
```

### Permission Mapping

```cairo
// Permission string to minimum role level
fn get_minimum_role(action: felt252) -> u8 {
    match action {
        'view_public' => ROLE_READER,
        'comment' => ROLE_READER,
        'like' => ROLE_READER,
        'submit_for_review' => ROLE_WRITER,
        'publish_immediately' => ROLE_CONTRIBUTOR,
        'view_reports' => ROLE_MODERATOR,
        'resolve_reports' => ROLE_MODERATOR,
        'temp_ban' => ROLE_MODERATOR,
        'approve_content' => ROLE_EDITOR,
        'reject_content' => ROLE_EDITOR,
        'feature_posts' => ROLE_EDITOR,
        'manage_users' => ROLE_ADMIN,
        'manage_roles' => ROLE_ADMIN,
        'withdraw_funds' => ROLE_OWNER,
        'upgrade_contracts' => ROLE_OWNER,
        _ => ROLE_OWNER,  // Unknown actions require owner
    }
}
```

---

## BlogRegistry

**Purpose**: Article storage, publishing workflow, and content management.

**Location**: `contracts/src/blog_registry.cairo`

### Storage

```cairo
@storage_var
fn role_registry() -> ContractAddress;

@storage_var
fn treasury() -> ContractAddress;

@storage_var
fn reputation() -> ContractAddress;

@storage_var
fn posts(post_id: u256) -> Post;

@storage_var
fn post_count() -> u256;

@storage_var
fn slug_to_post_id(slug_hash: felt252) -> u256;

@storage_var
fn author_posts(author: ContractAddress, index: u256) -> u256;

@storage_var
fn author_post_count(author: ContractAddress) -> u256;

@storage_var
fn featured_posts(index: u256) -> u256;

@storage_var
fn featured_count() -> u256;

@storage_var
fn publish_cooldown() -> u64;  // Seconds between publishes

@storage_var
fn last_publish_time(author: ContractAddress) -> u64;
```

### Post Status Constants

```cairo
const POST_DRAFT: u8 = 0;
const POST_PENDING_REVIEW: u8 = 1;
const POST_PUBLISHED: u8 = 2;
const POST_REJECTED: u8 = 3;
const POST_ARCHIVED: u8 = 4;
```

### Post Structure

```cairo
struct Post {
    id: u256,
    author: ContractAddress,
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    content_hash: felt252,
    title: ByteArray,
    slug: ByteArray,
    status: u8,
    is_paid: bool,
    price: u256,
    created_at: u64,
    updated_at: u64,
    published_at: u64,
    reviewer: ContractAddress,
    reviewed_at: u64,
    rejection_reason: ByteArray,
    revision_count: u32,
    featured: bool,
    featured_at: u64,
    like_count: u32,
    comment_count: u32,
}
```

### Functions

```cairo
// Publishing
#[external]
fn publish_post(
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    content_hash: felt252,
    title: ByteArray,
    slug: ByteArray,
    is_paid: bool,
    price: u256
) -> u256;

// Workflow
#[external]
fn submit_for_review(post_id: u256);  // Writer+

#[external]
fn approve_post(post_id: u256);  // Editor+

#[external]
fn reject_post(post_id: u256, reason: ByteArray);  // Editor+

#[external]
fn request_revision(post_id: u256, feedback: ByteArray);  // Editor+

// Content management
#[external]
fn update_post(
    post_id: u256,
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    content_hash: felt252
);  // Author or Editor+

#[external]
fn archive_post(post_id: u256);  // Author or Admin+

// Featuring
#[external]
fn feature_post(post_id: u256);  // Editor+

#[external]
fn unfeature_post(post_id: u256);  // Editor+

// Queries
#[view]
fn get_post(post_id: u256) -> Post;

#[view]
fn get_post_by_slug(slug: ByteArray) -> Post;

#[view]
fn get_posts(limit: u64, offset: u64) -> Array<Post>;

#[view]
fn get_posts_by_author(author: ContractAddress, limit: u64, offset: u64) -> Array<Post>;

#[view]
fn get_posts_by_status(status: u8, limit: u64, offset: u64) -> Array<Post>;

#[view]
fn get_featured_posts(limit: u64) -> Array<Post>;

#[view]
fn get_post_count() -> u256;
```

### Publishing Workflow

```
publish_post() called
        │
        ├─► If caller is Contributor+ (role >= 2)
        │       └─► Status = PUBLISHED (immediate)
        │
        └─► If caller is Writer (role == 1)
                └─► Status = DRAFT
                        │
                        ▼
                submit_for_review()
                        │
                        ▼
                Status = PENDING_REVIEW
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
      approve_post  request_rev  reject_post
            │           │           │
            ▼           ▼           ▼
       PUBLISHED   DRAFT+notify  REJECTED
```

---

## Social

**Purpose**: Comments, likes, reports, and moderation.

**Location**: `contracts/src/social.cairo`

### Storage

```cairo
@storage_var
fn role_registry() -> ContractAddress;

@storage_var
fn blog_registry() -> ContractAddress;

@storage_var
fn paymaster() -> ContractAddress;

@storage_var
fn comments(comment_id: u256) -> Comment;

@storage_var
fn comment_count() -> u256;

@storage_var
fn post_comments(post_id: u256, index: u256) -> u256;

@storage_var
fn post_comment_count(post_id: u256) -> u256;

@storage_var
fn likes(post_id: u256, user: ContractAddress) -> bool;

@storage_var
fn like_counts(post_id: u256) -> u32;

@storage_var
fn reports(report_id: u256) -> Report;

@storage_var
fn report_count() -> u256;

@storage_var
fn user_bans(user: ContractAddress) -> BanInfo;
```

### Structures

```cairo
struct Comment {
    id: u256,
    post_id: u256,
    author: ContractAddress,
    content: ByteArray,
    parent_id: u256,
    created_at: u64,
    is_hidden: bool,
    hidden_by: ContractAddress,
    hidden_at: u64,
}

struct Report {
    id: u256,
    reporter: ContractAddress,
    target_type: u8,
    target_id: u256,
    reason: u8,
    details: ByteArray,
    created_at: u64,
    status: u8,
    resolved_by: ContractAddress,
    resolution_note: ByteArray,
    resolved_at: u64,
}

struct BanInfo {
    is_banned: bool,
    banned_at: u64,
    banned_until: u64,
    banned_by: ContractAddress,
    reason: ByteArray,
}
```

### Functions

```cairo
// Comments
#[external]
fn add_comment(post_id: u256, content: ByteArray, parent_id: u256) -> u256;

#[external]
fn hide_comment(comment_id: u256);  // Moderator+

#[external]
fn unhide_comment(comment_id: u256);  // Moderator+

// Likes
#[external]
fn like_post(post_id: u256);

#[external]
fn unlike_post(post_id: u256);

// Reports
#[external]
fn report_content(target_type: u8, target_id: u256, reason: u8, details: ByteArray);

#[external]
fn resolve_report(report_id: u256, action: u8, note: ByteArray);  // Moderator+

// Bans
#[external]
fn temp_ban_user(user: ContractAddress, duration_hours: u64, reason: ByteArray);  // Moderator+

#[external]
fn perma_ban_user(user: ContractAddress, reason: ByteArray);  // Admin+

#[external]
fn unban_user(user: ContractAddress);  // Admin+

// Queries
#[view]
fn get_comments(post_id: u256, limit: u64, offset: u64) -> Array<Comment>;

#[view]
fn get_comment(comment_id: u256) -> Comment;

#[view]
fn get_like_count(post_id: u256) -> u32;

#[view]
fn has_liked(user: ContractAddress, post_id: u256) -> bool;

#[view]
fn get_pending_reports(limit: u64, offset: u64) -> Array<Report>;

#[view]
fn is_user_banned(user: ContractAddress) -> bool;

#[view]
fn get_ban_info(user: ContractAddress) -> BanInfo;
```

---

## Treasury

**Purpose**: Revenue distribution and withdrawals.

**Location**: `contracts/src/treasury.cairo`

### Storage

```cairo
@storage_var
fn role_registry() -> ContractAddress;

@storage_var
fn platform_fee() -> u8;  // Percentage (default 10)

@storage_var
fn referral_fee() -> u8;  // Percentage (default 5)

@storage_var
fn earnings(user: ContractAddress) -> Earnings;

@storage_var
fn total_platform_revenue() -> u256;

@storage_var
fn total_distributed() -> u256;
```

### Structures

```cairo
struct Earnings {
    total_earned: u256,
    total_withdrawn: u256,
    pending: u256,
}
```

### Functions

```cairo
// Distribution
#[external]
fn distribute_payment(
    post_id: u256,
    amount: u256,
    payer: ContractAddress,
    referrer: ContractAddress
);  // BlogRegistry only

// Withdrawals
#[external]
fn withdraw_earnings();  // Any user

#[external]
fn withdraw_platform_funds(amount: u256, recipient: ContractAddress);  // Owner only

// Configuration
#[external]
fn set_platform_fee(fee: u8);  // Owner only

#[external]
fn set_referral_fee(fee: u8);  // Owner only

// Queries
#[view]
fn get_earnings(user: ContractAddress) -> Earnings;

#[view]
fn get_platform_fee() -> u8;

#[view]
fn get_referral_fee() -> u8;

#[view]
fn get_total_platform_revenue() -> u256;
```

### Revenue Distribution Logic

```cairo
fn distribute_payment(
    post_id: u256,
    amount: u256,
    payer: ContractAddress,
    referrer: ContractAddress
) {
    let post = IBlogRegistry.get_post(post_id);
    let author = post.author;

    // Calculate splits
    let platform_amount = amount * platform_fee / 100;
    let referral_amount = if referrer != 0 {
        amount * referral_fee / 100
    } else {
        0
    };
    let author_amount = amount - platform_amount - referral_amount;

    // Update earnings
    self._add_earnings(author, author_amount);
    self._add_platform_revenue(platform_amount);
    if referrer != 0 {
        self._add_earnings(referrer, referral_amount);
    }

    // Transfer tokens from payer
    IERC20.transfer_from(payer, self, amount);

    emit PaymentDistributed { post_id, author, author_amount, platform_amount, referral_amount };
}
```

---

## Reputation

**Purpose**: Track user reputation points and badges.

**Location**: `contracts/src/reputation.cairo`

### Storage

```cairo
@storage_var
fn role_registry() -> ContractAddress;

@storage_var
fn reputation(user: ContractAddress) -> UserReputation;

@storage_var
fn authorized_callers(contract: ContractAddress) -> bool;
```

### Constants

```cairo
// Point values
const POINTS_POST_PUBLISHED: u64 = 100;
const POINTS_POST_FEATURED: u64 = 500;
const POINTS_COMMENT: u64 = 10;
const POINTS_LIKE_RECEIVED: u64 = 5;
const POINTS_SUBSCRIBER: u64 = 50;
const POINTS_VALID_REPORT: u64 = 25;
const PENALTY_SPAM: i64 = -200;

// Level thresholds
const LEVEL_1_MAX: u64 = 99;      // Newcomer
const LEVEL_2_MAX: u64 = 499;     // Active Writer
const LEVEL_3_MAX: u64 = 1999;    // Established
const LEVEL_4_MAX: u64 = 9999;    // Veteran
// Level 5: 10000+                 // Legend

// Badge bits
const BADGE_FIRST_POST: u8 = 0;
const BADGE_PROLIFIC_WRITER: u8 = 1;
const BADGE_CENTURY_CLUB: u8 = 2;
const BADGE_FEATURED_AUTHOR: u8 = 3;
const BADGE_CONVERSATIONALIST: u8 = 4;
const BADGE_BELOVED: u8 = 5;
const BADGE_EARLY_ADOPTER: u8 = 6;
const BADGE_VERIFIED: u8 = 7;
const BADGE_TOP_WRITER: u8 = 8;
const BADGE_PREMIUM_AUTHOR: u8 = 9;
const BADGE_TRUSTED: u8 = 10;
const BADGE_GUARDIAN: u8 = 11;
```

### Structures

```cairo
struct UserReputation {
    total_points: u64,
    level: u8,
    badges: u256,  // Bitmap
    joined_at: u64,
    post_count: u32,
    comment_count: u32,
    like_count: u32,
}
```

### Functions

```cairo
// Point management
#[external]
fn add_points(user: ContractAddress, points: u64, reason: felt252);  // Authorized contracts

#[external]
fn remove_points(user: ContractAddress, points: u64, reason: felt252);  // Authorized contracts

// Badge management
#[external]
fn award_badge(user: ContractAddress, badge_bit: u8);  // Authorized contracts or Admin+

#[external]
fn revoke_badge(user: ContractAddress, badge_bit: u8);  // Admin+

// Stats tracking
#[external]
fn increment_post_count(user: ContractAddress);  // BlogRegistry only

#[external]
fn increment_comment_count(user: ContractAddress);  // Social only

#[external]
fn increment_like_count(user: ContractAddress);  // Social only

// Queries
#[view]
fn get_reputation(user: ContractAddress) -> UserReputation;

#[view]
fn get_level(user: ContractAddress) -> u8;

#[view]
fn has_badge(user: ContractAddress, badge_bit: u8) -> bool;

#[view]
fn get_badges(user: ContractAddress) -> Array<u8>;
```

### Level Calculation

```cairo
fn calculate_level(points: u64) -> u8 {
    if points >= 10000 {
        5  // Legend
    } else if points >= 2000 {
        4  // Veteran
    } else if points >= 500 {
        3  // Established
    } else if points >= 100 {
        2  // Active Writer
    } else {
        1  // Newcomer
    }
}
```

---

## Paymaster

**Purpose**: Sponsor gas fees for social interactions.

**Location**: `contracts/src/paymaster.cairo`

### Storage

```cairo
@storage_var
fn role_registry() -> ContractAddress;

@storage_var
fn whitelisted_contracts(contract: ContractAddress) -> bool;

@storage_var
fn total_sponsored() -> u256;

@storage_var
fn daily_limit() -> u256;

@storage_var
fn daily_sponsored(day: u64) -> u256;
```

### Functions

```cairo
// Sponsorship
#[external]
fn sponsor_transaction(tx_hash: felt252, gas_cost: u256);  // Whitelisted contracts only

// Configuration
#[external]
fn whitelist_contract(contract: ContractAddress);  // Admin+

#[external]
fn remove_contract(contract: ContractAddress);  // Admin+

#[external]
fn set_daily_limit(limit: u256);  // Owner only

// Funding
#[external]
fn deposit();  // Anyone (payable)

#[external]
fn withdraw(amount: u256, recipient: ContractAddress);  // Owner only

// Queries
#[view]
fn is_whitelisted(contract: ContractAddress) -> bool;

#[view]
fn get_balance() -> u256;

#[view]
fn get_total_sponsored() -> u256;

#[view]
fn get_daily_sponsored() -> u256;

#[view]
fn can_sponsor(gas_cost: u256) -> bool;
```

---

## SessionKeyManager

**Purpose**: Manage delegated session keys for gasless UX.

**Location**: `contracts/src/session_key_manager.cairo`

### Storage

```cairo
@storage_var
fn role_registry() -> ContractAddress;

@storage_var
fn session_keys(user: ContractAddress, session_key: ContractAddress) -> SessionKey;

@storage_var
fn user_session_count(user: ContractAddress) -> u32;

@storage_var
fn nonces(session_key: ContractAddress) -> u256;

@storage_var
fn default_duration() -> u64;  // Seconds (default: 7 days)
```

### Structures

```cairo
struct SessionKey {
    user: ContractAddress,
    key: ContractAddress,
    created_at: u64,
    expires_at: u64,
    allowed_contracts: Array<ContractAddress>,
    is_revoked: bool,
}
```

### Functions

```cairo
// Key management
#[external]
fn register_session_key(
    session_key: ContractAddress,
    duration: u64,
    allowed_contracts: Array<ContractAddress>
);  // User

#[external]
fn revoke_session_key(session_key: ContractAddress);  // User

#[external]
fn revoke_all_session_keys();  // User

// Validation
#[view]
fn is_valid_session_key(
    user: ContractAddress,
    session_key: ContractAddress,
    target_contract: ContractAddress
) -> bool;

#[view]
fn get_session_key(user: ContractAddress, session_key: ContractAddress) -> SessionKey;

#[view]
fn get_user_session_keys(user: ContractAddress) -> Array<SessionKey>;

// Nonce
#[view]
fn get_nonce(session_key: ContractAddress) -> u256;

#[external]
fn increment_nonce(session_key: ContractAddress);  // Internal
```

---

## Security Considerations

### Access Control

All contracts implement role-based access control:

```cairo
fn assert_role(caller: ContractAddress, min_role: u8) {
    let role = IRoleRegistry.get_role(caller);
    assert(role >= min_role, 'Insufficient permissions');
}

fn assert_not_paused() {
    assert(!IRoleRegistry.is_paused(), 'Contract is paused');
}
```

### Reentrancy Protection

All state-changing functions use reentrancy guards:

```cairo
@storage_var
fn reentrancy_guard() -> bool;

fn enter_reentrancy_guard() {
    assert(!self.reentrancy_guard.read(), 'ReentrancyGuard: reentrant call');
    self.reentrancy_guard.write(true);
}

fn exit_reentrancy_guard() {
    self.reentrancy_guard.write(false);
}
```

### Input Validation

All inputs are validated:

```cairo
fn validate_post_input(
    arweave_tx_id: ByteArray,
    ipfs_cid: ByteArray,
    title: ByteArray,
    slug: ByteArray
) {
    assert(arweave_tx_id.len() > 0, 'Empty arweave_tx_id');
    assert(ipfs_cid.len() > 0, 'Empty ipfs_cid');
    assert(title.len() > 0 && title.len() <= 100, 'Invalid title length');
    assert(slug.len() > 0 && slug.len() <= 100, 'Invalid slug length');
}
```

### Rate Limiting

Publishing is rate-limited:

```cairo
fn check_rate_limit(author: ContractAddress) {
    let last_publish = self.last_publish_time.read(author);
    let cooldown = self.publish_cooldown.read();
    let current_time = get_block_timestamp();

    assert(current_time >= last_publish + cooldown, 'Rate limit exceeded');
    self.last_publish_time.write(author, current_time);
}
```

---

## Testing

### Running Tests

```bash
cd contracts
snforge test
```

### Test Categories

```bash
# Role tests
snforge test test_grant_role
snforge test test_revoke_role
snforge test test_auto_promotion

# Blog tests
snforge test test_publish_post
snforge test test_submit_for_review
snforge test test_approve_post
snforge test test_reject_post

# Social tests
snforge test test_add_comment
snforge test test_like_post
snforge test test_report_content
snforge test test_temp_ban

# Treasury tests
snforge test test_distribute_payment
snforge test test_withdraw_earnings

# Reputation tests
snforge test test_add_points
snforge test test_award_badge
snforge test test_level_up
```

### Test Patterns

```cairo
#[test]
fn test_publish_post() {
    // Setup
    let (role_registry, blog_registry) = setup_contracts();
    let author = deploy_account();

    // Grant writer role
    role_registry.grant_role(author, ROLE_WRITER);

    // Act
    start_prank(CheatTarget::One(blog_registry.contract_address), author);
    let post_id = blog_registry.publish_post(...);
    stop_prank(CheatTarget::One(blog_registry.contract_address));

    // Assert
    let post = blog_registry.get_post(post_id);
    assert(post.author == author, 'Wrong author');
    assert(post.status == POST_DRAFT, 'Wrong status for writer');
}
```

---

## Deployment

### Local Deployment

```bash
cd contracts
scarb build
bash scripts/deploy.sh --network http://localhost:9944
```

### Testnet Deployment

```bash
bash scripts/deploy.sh \
  --network https://starknet-sepolia.infura.io/v3/YOUR_KEY \
  --account ~/.starknet_accounts/deployer.json
```

### Deployment Script

See `contracts/scripts/deploy.sh` for full deployment automation.

### Post-Deployment Verification

```bash
# Verify RoleRegistry
starkli call $ROLE_REGISTRY get_role $OWNER_ADDRESS --rpc $RPC_URL

# Verify BlogRegistry
starkli call $BLOG_REGISTRY get_post_count --rpc $RPC_URL

# Verify Social
starkli call $SOCIAL get_comment_count --rpc $RPC_URL
```

---

## Upgradeability

Contracts support upgradeability via class hash replacement:

```cairo
#[external]
fn upgrade(new_class_hash: ClassHash) {
    assert_role(get_caller_address(), ROLE_OWNER);
    replace_class_syscall(new_class_hash);
    emit Upgraded { new_class_hash };
}
```

**Upgrade process**:
1. Deploy new contract class
2. Test on testnet
3. Call `upgrade(new_class_hash)` on mainnet
4. Verify new functionality

**Warning**: Upgrades are irreversible. Always test thoroughly.
