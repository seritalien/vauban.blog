// SPDX-License-Identifier: MIT
// Vauban Blog - BlogRegistry Smart Contract (Production-Grade)
// Security: Reentrancy guards, Access control, Input validation, Pausable, Rate limiting
// Features: Content workflow (draft/review/publish), Featured posts, Role-based permissions
// Extended: PostType (Tweet/Thread/Article), Replies, Pinned posts for Twitter-like functionality

use starknet::ContractAddress;

// ============================================================================
// POST STATUS CONSTANTS
// ============================================================================

pub const POST_DRAFT: u8 = 0;           // Not submitted, only author can see
pub const POST_PENDING_REVIEW: u8 = 1;  // Submitted for editor review
pub const POST_PUBLISHED: u8 = 2;       // Live and visible to all
pub const POST_REJECTED: u8 = 3;        // Rejected by editor, needs revision
pub const POST_ARCHIVED: u8 = 4;        // Hidden but not deleted

// ============================================================================
// POST TYPE CONSTANTS (for eXtended functionality)
// ============================================================================

pub const POST_TYPE_TWEET: u8 = 0;      // Short content < 280 chars, inline display
pub const POST_TYPE_THREAD: u8 = 1;     // Multiple connected posts
pub const POST_TYPE_ARTICLE: u8 = 2;    // Long-form content with full page display

// ============================================================================
// STORAGE STRUCTURES (Module-level for interface access)
// ============================================================================

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct PostMetadata {
    pub id: u64,
    pub author: ContractAddress,
    // Storage IDs split into two felt252s (31 chars each = 62 chars total)
    pub arweave_tx_id_1: felt252,
    pub arweave_tx_id_2: felt252,
    pub ipfs_cid_1: felt252,
    pub ipfs_cid_2: felt252,
    pub content_hash: felt252,
    pub price: u256,
    pub is_encrypted: bool,
    pub created_at: u64,
    pub updated_at: u64,
    pub is_deleted: bool,  // Soft delete flag
    pub current_version: u64,  // Current version number (starts at 1)
    // Content workflow fields
    pub status: u8,  // POST_DRAFT, POST_PENDING_REVIEW, POST_PUBLISHED, POST_REJECTED, POST_ARCHIVED
    pub reviewer: ContractAddress,  // Who reviewed (approved/rejected) this post
    pub reviewed_at: u64,  // When the review decision was made
    // Featured post fields
    pub featured: bool,
    pub featured_at: u64,
    pub featured_by: ContractAddress,
    // eXtended fields (Twitter-like functionality)
    pub post_type: u8,        // POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE
    pub parent_id: u64,       // 0 if no parent (not a reply), otherwise the post being replied to
    pub thread_root_id: u64,  // 0 if standalone, otherwise the root post of the thread
    pub is_pinned: bool,      // Author can pin to their profile
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct PostVersion {
    pub version: u64,
    pub arweave_tx_id_1: felt252,
    pub arweave_tx_id_2: felt252,
    pub ipfs_cid_1: felt252,
    pub ipfs_cid_2: felt252,
    pub content_hash: felt252,
    pub created_at: u64,  // When this version was created
    pub editor: ContractAddress,  // Who made this edit
}

#[starknet::contract]
mod BlogRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use super::{
        PostMetadata, PostVersion,
        POST_DRAFT, POST_PENDING_REVIEW, POST_PUBLISHED, POST_REJECTED, POST_ARCHIVED,
        POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE
    };

    #[storage]
    struct Storage {
        // Access Control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,
        editors: Map<ContractAddress, bool>,  // NEW: Can approve/reject posts

        // Core Data
        posts: Map<u64, PostMetadata>,
        post_count: u64,
        post_purchases: Map<(u64, ContractAddress), bool>,

        // Version History: (post_id, version_number) -> PostVersion
        post_versions: Map<(u64, u64), PostVersion>,

        // Content Workflow Tracking
        posts_by_status: Map<(u8, u64), u64>,  // (status, index) -> post_id
        posts_by_status_count: Map<u8, u64>,   // status -> count
        pending_review_count: u64,              // Quick access to pending count
        featured_posts: Map<u64, u64>,          // index -> post_id (ordered by featured_at)
        featured_count: u64,

        // Role Registry (optional integration)
        role_registry: ContractAddress,

        // Security
        paused: bool,
        reentrancy_guard: bool,

        // Rate Limiting (anti-spam)
        last_publish_time: Map<ContractAddress, u64>,
        publish_cooldown: u64,  // Seconds between publishes

        // Treasury
        treasury: ContractAddress,
        platform_fee_percentage: u256,  // Basis points (100 = 1%)

        // Access Control List for paid posts
        post_whitelist: Map<(u64, ContractAddress), bool>,  // (post_id, user) -> whitelisted

        // eXtended functionality (Twitter-like)
        // Thread tracking: thread_root_id -> (index) -> post_id (ordered by creation)
        thread_posts: Map<(u64, u64), u64>,
        thread_post_count: Map<u64, u64>,  // thread_root_id -> count of posts in thread
        // Replies tracking: parent_id -> (index) -> post_id
        post_replies: Map<(u64, u64), u64>,
        post_reply_count: Map<u64, u64>,   // parent_id -> count of replies
        // Posts by type tracking
        posts_by_type: Map<(u8, u64), u64>,  // (post_type, index) -> post_id
        posts_by_type_count: Map<u8, u64>,   // post_type -> count
        // Pinned posts per author
        pinned_post: Map<ContractAddress, u64>,  // author -> pinned post_id (only one)
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        PostPublished: PostPublished,
        PostUpdated: PostUpdated,
        PostVersionCreated: PostVersionCreated,
        PostDeleted: PostDeleted,
        PostPurchased: PostPurchased,
        // Content workflow events
        PostCreatedAsDraft: PostCreatedAsDraft,
        PostSubmittedForReview: PostSubmittedForReview,
        PostApproved: PostApproved,
        PostRejected: PostRejected,
        PostArchived: PostArchived,
        PostUnarchived: PostUnarchived,
        PostFeatured: PostFeatured,
        PostUnfeatured: PostUnfeatured,
        // Admin events
        OwnershipTransferred: OwnershipTransferred,
        AdminAdded: AdminAdded,
        AdminRemoved: AdminRemoved,
        EditorAdded: EditorAdded,
        EditorRemoved: EditorRemoved,
        Paused: Paused,
        Unpaused: Unpaused,
        TreasuryUpdated: TreasuryUpdated,
        PlatformFeeUpdated: PlatformFeeUpdated,
        UserWhitelisted: UserWhitelisted,
        UserBlacklisted: UserBlacklisted,
        RoleRegistryUpdated: RoleRegistryUpdated,
        // eXtended events (Twitter-like)
        PostPinned: PostPinned,
        PostUnpinned: PostUnpinned,
        ReplyAdded: ReplyAdded,
        ThreadStarted: ThreadStarted,
        ThreadContinued: ThreadContinued,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostPublished {
        #[key]
        post_id: u64,
        #[key]
        author: ContractAddress,
        arweave_tx_id_1: felt252,
        arweave_tx_id_2: felt252,
        ipfs_cid_1: felt252,
        ipfs_cid_2: felt252,
        price: u256,
        created_at: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostUpdated {
        #[key]
        post_id: u64,
        version: u64,
        updated_at: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostVersionCreated {
        #[key]
        post_id: u64,
        #[key]
        version: u64,
        editor: ContractAddress,
        arweave_tx_id_1: felt252,
        arweave_tx_id_2: felt252,
        ipfs_cid_1: felt252,
        ipfs_cid_2: felt252,
        content_hash: felt252,
        created_at: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostDeleted {
        #[key]
        post_id: u64,
        deleted_at: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostPurchased {
        #[key]
        post_id: u64,
        #[key]
        buyer: ContractAddress,
        price: u256,
        platform_fee: u256,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct OwnershipTransferred {
        #[key]
        previous_owner: ContractAddress,
        #[key]
        new_owner: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct AdminAdded {
        #[key]
        admin: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct AdminRemoved {
        #[key]
        admin: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct Paused {
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct Unpaused {
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct TreasuryUpdated {
        #[key]
        old_treasury: ContractAddress,
        #[key]
        new_treasury: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PlatformFeeUpdated {
        old_fee: u256,
        new_fee: u256,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct UserWhitelisted {
        #[key]
        post_id: u64,
        #[key]
        user: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct UserBlacklisted {
        #[key]
        post_id: u64,
        #[key]
        user: ContractAddress,
    }

    // Content workflow events
    #[derive(Drop, Serde, starknet::Event)]
    struct PostCreatedAsDraft {
        #[key]
        post_id: u64,
        #[key]
        author: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostSubmittedForReview {
        #[key]
        post_id: u64,
        #[key]
        author: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostApproved {
        #[key]
        post_id: u64,
        #[key]
        reviewer: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostRejected {
        #[key]
        post_id: u64,
        #[key]
        reviewer: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostArchived {
        #[key]
        post_id: u64,
        archived_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostUnarchived {
        #[key]
        post_id: u64,
        unarchived_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostFeatured {
        #[key]
        post_id: u64,
        featured_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostUnfeatured {
        #[key]
        post_id: u64,
        unfeatured_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct EditorAdded {
        #[key]
        editor: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct EditorRemoved {
        #[key]
        editor: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RoleRegistryUpdated {
        #[key]
        old_registry: ContractAddress,
        #[key]
        new_registry: ContractAddress,
    }

    // eXtended events (Twitter-like)
    #[derive(Drop, Serde, starknet::Event)]
    struct PostPinned {
        #[key]
        post_id: u64,
        #[key]
        author: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostUnpinned {
        #[key]
        post_id: u64,
        #[key]
        author: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ReplyAdded {
        #[key]
        post_id: u64,
        #[key]
        parent_id: u64,
        #[key]
        author: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ThreadStarted {
        #[key]
        thread_root_id: u64,
        #[key]
        author: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ThreadContinued {
        #[key]
        thread_root_id: u64,
        #[key]
        post_id: u64,
        author: ContractAddress,
        position: u64,  // Position in thread (1, 2, 3, etc.)
        timestamp: u64,
    }

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const MAX_PLATFORM_FEE: u256 = 5000; // 50% max (basis points)
    const DEFAULT_PUBLISH_COOLDOWN: u64 = 60; // 60 seconds between publishes (anti-spam)
    const MAX_PRICE: u256 = 1000000000000000000000000; // 1M STRK max price
    const MAX_POSTS_PER_QUERY: u64 = 100; // Prevent DOS via large queries

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        treasury: ContractAddress,
        platform_fee_percentage: u256,
    ) {
        // Validate inputs
        assert(owner.is_non_zero(), 'Owner cannot be zero');
        assert(treasury.is_non_zero(), 'Treasury cannot be zero');
        assert(platform_fee_percentage <= MAX_PLATFORM_FEE, 'Fee exceeds maximum');

        self.owner.write(owner);
        self.treasury.write(treasury);
        self.platform_fee_percentage.write(platform_fee_percentage);
        self.publish_cooldown.write(DEFAULT_PUBLISH_COOLDOWN);
        self.paused.write(false);
        self.reentrancy_guard.write(false);

        // Owner is automatically admin
        self.admins.entry(owner).write(true);
    }

    // ============================================================================
    // MODIFIERS (as internal functions)
    // ============================================================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Caller is not the owner');
        }

        fn assert_only_admin(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_admin = self.admins.entry(caller).read();
            assert(is_owner || is_admin, 'Caller is not admin');
        }

        fn assert_only_editor_or_admin(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_admin = self.admins.entry(caller).read();
            let is_editor = self.editors.entry(caller).read();
            assert(is_owner || is_admin || is_editor, 'Caller is not editor');
        }

        fn is_editor_or_above(self: @ContractState, account: ContractAddress) -> bool {
            account == self.owner.read()
                || self.admins.entry(account).read()
                || self.editors.entry(account).read()
        }

        fn can_publish_immediately(self: @ContractState, account: ContractAddress) -> bool {
            // Editors and admins can publish immediately
            self.is_editor_or_above(account)
        }

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }

        fn assert_paused(self: @ContractState) {
            assert(self.paused.read(), 'Contract is not paused');
        }

        fn assert_no_reentrancy(ref self: ContractState) {
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);
        }

        fn clear_reentrancy(ref self: ContractState) {
            self.reentrancy_guard.write(false);
        }

        fn validate_post_inputs(
            self: @ContractState,
            arweave_tx_id_1: felt252,
            ipfs_cid_1: felt252,
            content_hash: felt252,
            price: u256,
        ) {
            // Only check first part is non-zero (second part can be zero for short IDs)
            assert(arweave_tx_id_1 != 0, 'Invalid Arweave TX ID');
            assert(ipfs_cid_1 != 0, 'Invalid IPFS CID');
            assert(content_hash != 0, 'Invalid content hash');
            assert(price <= MAX_PRICE, 'Price exceeds maximum');
        }

        fn check_publish_cooldown(self: @ContractState, publisher: ContractAddress) {
            let last_publish = self.last_publish_time.entry(publisher).read();
            let current_time = get_block_timestamp();
            let cooldown = self.publish_cooldown.read();

            if last_publish > 0 {
                assert(
                    current_time >= last_publish + cooldown,
                    'Publish cooldown active'
                );
            }
        }

        fn calculate_platform_fee(self: @ContractState, amount: u256) -> u256 {
            let fee_percentage = self.platform_fee_percentage.read();
            (amount * fee_percentage) / 10000 // Basis points calculation
        }

        fn add_to_status_index(ref self: ContractState, status: u8, post_id: u64) {
            let index = self.posts_by_status_count.entry(status).read();
            self.posts_by_status.entry((status, index)).write(post_id);
            self.posts_by_status_count.entry(status).write(index + 1);

            if status == POST_PENDING_REVIEW {
                self.pending_review_count.write(self.pending_review_count.read() + 1);
            }
        }

        fn decrement_pending_count(ref self: ContractState) {
            let current = self.pending_review_count.read();
            if current > 0 {
                self.pending_review_count.write(current - 1);
            }
        }

        fn add_to_type_index(ref self: ContractState, post_type: u8, post_id: u64) {
            let index = self.posts_by_type_count.entry(post_type).read();
            self.posts_by_type.entry((post_type, index)).write(post_id);
            self.posts_by_type_count.entry(post_type).write(index + 1);
        }

        fn add_reply_to_parent(ref self: ContractState, parent_id: u64, post_id: u64) {
            let index = self.post_reply_count.entry(parent_id).read();
            self.post_replies.entry((parent_id, index)).write(post_id);
            self.post_reply_count.entry(parent_id).write(index + 1);
        }

        fn add_post_to_thread(ref self: ContractState, thread_root_id: u64, post_id: u64) {
            let index = self.thread_post_count.entry(thread_root_id).read();
            self.thread_posts.entry((thread_root_id, index)).write(post_id);
            self.thread_post_count.entry(thread_root_id).write(index + 1);
        }

        fn validate_post_type(self: @ContractState, post_type: u8) {
            assert(
                post_type == POST_TYPE_TWEET || post_type == POST_TYPE_THREAD || post_type == POST_TYPE_ARTICLE,
                'Invalid post type'
            );
        }

        fn validate_parent_exists(self: @ContractState, parent_id: u64) {
            if parent_id > 0 {
                let parent = self.posts.entry(parent_id).read();
                assert(parent.id != 0, 'Parent post not found');
                assert(!parent.is_deleted, 'Parent post is deleted');
            }
        }

        fn validate_thread_root_exists(self: @ContractState, thread_root_id: u64) {
            if thread_root_id > 0 {
                let root = self.posts.entry(thread_root_id).read();
                assert(root.id != 0, 'Thread root not found');
                assert(!root.is_deleted, 'Thread root is deleted');
                assert(root.post_type == POST_TYPE_THREAD, 'Not a thread root');
            }
        }

    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl BlogRegistryImpl of super::IBlogRegistry<ContractState> {
        // ========================================================================
        // ADMIN FUNCTIONS
        // ========================================================================

        /// Create a new post - editors/admins publish immediately, others create drafts
        /// For backwards compatibility, this creates an ARTICLE type post with no parent/thread
        fn publish_post(
            ref self: ContractState,
            arweave_tx_id_1: felt252,
            arweave_tx_id_2: felt252,
            ipfs_cid_1: felt252,
            ipfs_cid_2: felt252,
            content_hash: felt252,
            price: u256,
            is_encrypted: bool,
        ) -> u64 {
            // Delegate to extended function with article defaults
            self.publish_post_extended(
                arweave_tx_id_1,
                arweave_tx_id_2,
                ipfs_cid_1,
                ipfs_cid_2,
                content_hash,
                price,
                is_encrypted,
                POST_TYPE_ARTICLE,  // Default to article for backwards compatibility
                0,  // No parent
                0,  // No thread root
            )
        }

        /// Create a new post with extended fields (post type, parent, thread)
        fn publish_post_extended(
            ref self: ContractState,
            arweave_tx_id_1: felt252,
            arweave_tx_id_2: felt252,
            ipfs_cid_1: felt252,
            ipfs_cid_2: felt252,
            content_hash: felt252,
            price: u256,
            is_encrypted: bool,
            post_type: u8,
            parent_id: u64,
            thread_root_id: u64,
        ) -> u64 {
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();
            let can_publish = self.can_publish_immediately(caller);

            // Rate limiting (anti-spam)
            self.check_publish_cooldown(caller);

            // Input validation
            self.validate_post_inputs(arweave_tx_id_1, ipfs_cid_1, content_hash, price);
            self.validate_post_type(post_type);

            // Validate parent and thread if specified
            self.validate_parent_exists(parent_id);
            self.validate_thread_root_exists(thread_root_id);

            let post_id = self.post_count.read() + 1;
            let now = get_block_timestamp();
            let initial_version: u64 = 1;

            // Determine initial status based on caller's permissions
            let initial_status = if can_publish { POST_PUBLISHED } else { POST_DRAFT };

            let post = PostMetadata {
                id: post_id,
                author: caller,
                arweave_tx_id_1,
                arweave_tx_id_2,
                ipfs_cid_1,
                ipfs_cid_2,
                content_hash,
                price,
                is_encrypted,
                created_at: now,
                updated_at: now,
                is_deleted: false,
                current_version: initial_version,
                // Content workflow fields
                status: initial_status,
                reviewer: Zero::zero(),
                reviewed_at: 0,
                // Featured fields
                featured: false,
                featured_at: 0,
                featured_by: Zero::zero(),
                // eXtended fields
                post_type,
                parent_id,
                thread_root_id,
                is_pinned: false,
            };

            // Store initial version in history
            let version_entry = PostVersion {
                version: initial_version,
                arweave_tx_id_1,
                arweave_tx_id_2,
                ipfs_cid_1,
                ipfs_cid_2,
                content_hash,
                created_at: now,
                editor: caller,
            };

            self.posts.entry(post_id).write(post);
            self.post_versions.entry((post_id, initial_version)).write(version_entry);
            self.post_count.write(post_id);
            self.last_publish_time.entry(caller).write(now);

            // Track by status
            self.add_to_status_index(initial_status, post_id);

            // Track by post type
            self.add_to_type_index(post_type, post_id);

            // Track replies and threads
            if parent_id > 0 {
                self.add_reply_to_parent(parent_id, post_id);
                self.emit(ReplyAdded {
                    post_id,
                    parent_id,
                    author: caller,
                    timestamp: now,
                });
            }

            if thread_root_id > 0 {
                let position = self.thread_post_count.entry(thread_root_id).read() + 1;
                self.add_post_to_thread(thread_root_id, post_id);
                self.emit(ThreadContinued {
                    thread_root_id,
                    post_id,
                    author: caller,
                    position,
                    timestamp: now,
                });
            } else if post_type == POST_TYPE_THREAD {
                // This is a new thread root - track it in its own thread index
                self.add_post_to_thread(post_id, post_id);
                self.emit(ThreadStarted {
                    thread_root_id: post_id,
                    author: caller,
                    timestamp: now,
                });
            }

            // Emit appropriate events based on status
            if initial_status == POST_PUBLISHED {
                self.emit(PostPublished {
                    post_id,
                    author: caller,
                    arweave_tx_id_1,
                    arweave_tx_id_2,
                    ipfs_cid_1,
                    ipfs_cid_2,
                    price,
                    created_at: now,
                });
            } else {
                self.emit(PostCreatedAsDraft {
                    post_id,
                    author: caller,
                    timestamp: now,
                });
            }

            self.emit(PostVersionCreated {
                post_id,
                version: initial_version,
                editor: caller,
                arweave_tx_id_1,
                arweave_tx_id_2,
                ipfs_cid_1,
                ipfs_cid_2,
                content_hash,
                created_at: now,
            });

            self.clear_reentrancy();
            post_id
        }

        // ========================================================================
        // CONTENT WORKFLOW FUNCTIONS
        // ========================================================================

        /// Submit a draft post for editor review
        fn submit_for_review(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.author == caller, 'Not post author');
            assert(post.status == POST_DRAFT || post.status == POST_REJECTED, 'Invalid status');
            assert(!post.is_deleted, 'Post is deleted');

            let now = get_block_timestamp();
            post.status = POST_PENDING_REVIEW;
            post.updated_at = now;
            self.posts.entry(post_id).write(post);

            self.add_to_status_index(POST_PENDING_REVIEW, post_id);

            self.emit(PostSubmittedForReview {
                post_id,
                author: caller,
                timestamp: now,
            });
        }

        /// Editor approves a post for publication
        fn approve_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();
            self.assert_only_editor_or_admin();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.status == POST_PENDING_REVIEW, 'Not pending review');
            assert(!post.is_deleted, 'Post is deleted');

            let now = get_block_timestamp();
            post.status = POST_PUBLISHED;
            post.reviewer = caller;
            post.reviewed_at = now;
            post.updated_at = now;
            self.posts.entry(post_id).write(post.clone());

            self.decrement_pending_count();
            self.add_to_status_index(POST_PUBLISHED, post_id);

            self.emit(PostApproved {
                post_id,
                reviewer: caller,
                timestamp: now,
            });

            self.emit(PostPublished {
                post_id,
                author: post.author,
                arweave_tx_id_1: post.arweave_tx_id_1,
                arweave_tx_id_2: post.arweave_tx_id_2,
                ipfs_cid_1: post.ipfs_cid_1,
                ipfs_cid_2: post.ipfs_cid_2,
                price: post.price,
                created_at: now,
            });
        }

        /// Editor rejects a post
        fn reject_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();
            self.assert_only_editor_or_admin();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.status == POST_PENDING_REVIEW, 'Not pending review');

            let now = get_block_timestamp();
            post.status = POST_REJECTED;
            post.reviewer = caller;
            post.reviewed_at = now;
            post.updated_at = now;
            self.posts.entry(post_id).write(post);

            self.decrement_pending_count();
            self.add_to_status_index(POST_REJECTED, post_id);

            self.emit(PostRejected {
                post_id,
                reviewer: caller,
                timestamp: now,
            });
        }

        /// Archive a published post (hide without deleting)
        fn archive_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();
            self.assert_only_editor_or_admin();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.status == POST_PUBLISHED, 'Not published');

            let now = get_block_timestamp();
            post.status = POST_ARCHIVED;
            post.updated_at = now;
            self.posts.entry(post_id).write(post);

            self.add_to_status_index(POST_ARCHIVED, post_id);

            self.emit(PostArchived {
                post_id,
                archived_by: caller,
                timestamp: now,
            });
        }

        /// Unarchive an archived post back to published
        fn unarchive_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();
            self.assert_only_editor_or_admin();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.status == POST_ARCHIVED, 'Not archived');

            let now = get_block_timestamp();
            post.status = POST_PUBLISHED;
            post.updated_at = now;
            self.posts.entry(post_id).write(post);

            self.add_to_status_index(POST_PUBLISHED, post_id);

            self.emit(PostUnarchived {
                post_id,
                unarchived_by: caller,
                timestamp: now,
            });
        }

        // ========================================================================
        // FEATURED POSTS
        // ========================================================================

        /// Feature a published post
        fn feature_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();
            self.assert_only_editor_or_admin();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.status == POST_PUBLISHED, 'Not published');
            assert(!post.featured, 'Already featured');

            let now = get_block_timestamp();
            post.featured = true;
            post.featured_at = now;
            post.featured_by = caller;
            self.posts.entry(post_id).write(post);

            // Add to featured list
            let idx = self.featured_count.read();
            self.featured_posts.entry(idx).write(post_id);
            self.featured_count.write(idx + 1);

            self.emit(PostFeatured {
                post_id,
                featured_by: caller,
                timestamp: now,
            });
        }

        /// Remove featured status from a post
        fn unfeature_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();
            self.assert_only_editor_or_admin();

            let caller = get_caller_address();
            let mut post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.featured, 'Not featured');

            let now = get_block_timestamp();
            post.featured = false;
            post.featured_at = 0;
            post.featured_by = Zero::zero();
            self.posts.entry(post_id).write(post);

            self.emit(PostUnfeatured {
                post_id,
                unfeatured_by: caller,
                timestamp: now,
            });
        }

        /// Get featured posts
        fn get_featured_posts(self: @ContractState, limit: u64) -> Array<PostMetadata> {
            let mut result = ArrayTrait::new();
            let total = self.featured_count.read();
            let actual_limit = if limit > total { total } else { limit };

            let mut i: u64 = 0;
            loop {
                if i >= actual_limit {
                    break;
                }
                let post_id = self.featured_posts.entry(total - 1 - i).read();
                if post_id > 0 {
                    let post = self.posts.entry(post_id).read();
                    if post.featured && post.status == POST_PUBLISHED && !post.is_deleted {
                        result.append(post);
                    }
                }
                i += 1;
            };

            result
        }

        /// Get pending review count
        fn get_pending_review_count(self: @ContractState) -> u64 {
            self.pending_review_count.read()
        }

        /// Get posts by status with pagination
        fn get_posts_by_status(
            self: @ContractState,
            status: u8,
            limit: u64,
            offset: u64
        ) -> Array<PostMetadata> {
            assert(status <= POST_ARCHIVED, 'Invalid status');
            assert(limit > 0 && limit <= MAX_POSTS_PER_QUERY, 'Invalid limit');

            let mut result = ArrayTrait::new();
            let total = self.posts_by_status_count.entry(status).read();

            if offset >= total {
                return result;
            }

            let end = if offset + limit > total { total } else { offset + limit };
            let mut i = offset;

            loop {
                if i >= end {
                    break;
                }
                let post_id = self.posts_by_status.entry((status, i)).read();
                if post_id > 0 {
                    let post = self.posts.entry(post_id).read();
                    // Only return if status still matches (might have changed)
                    if post.status == status && !post.is_deleted {
                        result.append(post);
                    }
                }
                i += 1;
            };

            result
        }

        fn update_post(
            ref self: ContractState,
            post_id: u64,
            arweave_tx_id_1: felt252,
            arweave_tx_id_2: felt252,
            ipfs_cid_1: felt252,
            ipfs_cid_2: felt252,
            content_hash: felt252,
        ) -> bool {
            self.assert_only_admin();
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();

            // Validation
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');
            self.validate_post_inputs(arweave_tx_id_1, ipfs_cid_1, content_hash, 0);

            let mut post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');
            assert(!post.is_deleted, 'Post is deleted');

            // Increment version
            let current_time = get_block_timestamp();
            let new_version = post.current_version + 1;

            // Store new version in history
            let version_entry = PostVersion {
                version: new_version,
                arweave_tx_id_1,
                arweave_tx_id_2,
                ipfs_cid_1,
                ipfs_cid_2,
                content_hash,
                created_at: current_time,
                editor: caller,
            };
            self.post_versions.entry((post_id, new_version)).write(version_entry);

            // Update post to point to new content
            post.arweave_tx_id_1 = arweave_tx_id_1;
            post.arweave_tx_id_2 = arweave_tx_id_2;
            post.ipfs_cid_1 = ipfs_cid_1;
            post.ipfs_cid_2 = ipfs_cid_2;
            post.content_hash = content_hash;
            post.updated_at = current_time;
            post.current_version = new_version;

            self.posts.entry(post_id).write(post);

            // Emit events
            self.emit(PostUpdated {
                post_id,
                version: new_version,
                updated_at: current_time,
            });

            self.emit(PostVersionCreated {
                post_id,
                version: new_version,
                editor: caller,
                arweave_tx_id_1,
                arweave_tx_id_2,
                ipfs_cid_1,
                ipfs_cid_2,
                content_hash,
                created_at: current_time,
            });

            self.clear_reentrancy();
            true
        }

        fn delete_post(ref self: ContractState, post_id: u64) -> bool {
            self.assert_only_admin();
            self.assert_not_paused();

            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');

            let mut post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');
            assert(!post.is_deleted, 'Post already deleted');

            // Soft delete
            let current_time = get_block_timestamp();
            post.is_deleted = true;
            post.updated_at = current_time;
            self.posts.entry(post_id).write(post);

            self.emit(PostDeleted {
                post_id,
                deleted_at: current_time,
            });

            true
        }

        // ========================================================================
        // USER FUNCTIONS
        // ========================================================================

        fn purchase_post(ref self: ContractState, post_id: u64) -> bool {
            self.assert_not_paused();
            self.assert_no_reentrancy();

            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');

            let post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');
            assert(!post.is_deleted, 'Post is deleted');
            assert(post.price > 0, 'Post is free');

            let buyer = get_caller_address();
            assert(!self.has_access(post_id, buyer), 'Already has access');

            // Calculate fees
            let platform_fee = self.calculate_platform_fee(post.price);
            let _author_payment = post.price - platform_fee;

            // TODO: Actual STRK token transfer (requires ERC20 integration)
            // For now, mark as purchased (Paymaster handles payment in parallel)
            // In production:
            // 1. Transfer (price - fee) to post.author
            // 2. Transfer fee to treasury
            // 3. Verify transfers succeeded

            self.post_purchases.entry((post_id, buyer)).write(true);

            self.emit(PostPurchased {
                post_id,
                buyer,
                price: post.price,
                platform_fee,
                timestamp: get_block_timestamp(),
            });

            self.clear_reentrancy();
            true
        }

        // ========================================================================
        // PUBLIC VIEW FUNCTIONS
        // ========================================================================

        fn get_post(self: @ContractState, post_id: u64) -> PostMetadata {
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');
            let post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');
            post
        }

        fn get_post_count(self: @ContractState) -> u64 {
            self.post_count.read()
        }

        fn get_posts(
            self: @ContractState,
            limit: u64,
            offset: u64
        ) -> Array<PostMetadata> {
            // DOS protection: limit max query size
            assert(limit > 0 && limit <= MAX_POSTS_PER_QUERY, 'Invalid limit');

            let mut result: Array<PostMetadata> = ArrayTrait::new();
            let total_count = self.post_count.read();

            if offset >= total_count {
                return result;
            }

            let start_id = offset + 1;
            let end_id = if offset + limit > total_count {
                total_count
            } else {
                offset + limit
            };

            let mut i = start_id;
            loop {
                if i > end_id {
                    break;
                }
                let post = self.posts.entry(i).read();
                // Only return non-deleted posts
                if post.id != 0 && !post.is_deleted {
                    result.append(post);
                }
                i += 1;
            };

            result
        }

        fn has_access(self: @ContractState, post_id: u64, user: ContractAddress) -> bool {
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');

            let post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');

            // Deleted posts have no access
            if post.is_deleted {
                return false;
            }

            // Free posts or post author always has access
            if post.price == 0 || user == post.author {
                return true;
            }

            // Check whitelist (admin can grant access)
            if self.post_whitelist.entry((post_id, user)).read() {
                return true;
            }

            // Check if purchased
            self.post_purchases.entry((post_id, user)).read()
        }

        // ========================================================================
        // VERSION HISTORY
        // ========================================================================

        fn get_post_version(
            self: @ContractState,
            post_id: u64,
            version: u64
        ) -> PostVersion {
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');
            let post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');
            assert(version > 0 && version <= post.current_version, 'Invalid version');

            self.post_versions.entry((post_id, version)).read()
        }

        fn get_post_version_count(self: @ContractState, post_id: u64) -> u64 {
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');
            let post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');
            post.current_version
        }

        fn get_post_versions(
            self: @ContractState,
            post_id: u64,
            limit: u64,
            offset: u64
        ) -> Array<PostVersion> {
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');
            assert(limit > 0 && limit <= MAX_POSTS_PER_QUERY, 'Invalid limit');

            let post = self.posts.entry(post_id).read();
            assert(post.id != 0, 'Post does not exist');

            let mut result: Array<PostVersion> = ArrayTrait::new();
            let total_versions = post.current_version;

            if offset >= total_versions {
                return result;
            }

            // Return versions from newest to oldest
            let start_version = if total_versions > offset {
                total_versions - offset
            } else {
                0
            };

            let end_version = if start_version > limit {
                start_version - limit + 1
            } else {
                1
            };

            let mut v = start_version;
            while v >= end_version {
                let version_data = self.post_versions.entry((post_id, v)).read();
                if version_data.version != 0 {
                    result.append(version_data);
                }
                if v == 0 {
                    break;
                }
                v -= 1;
            };

            result
        }

        // ========================================================================
        // ADMIN MANAGEMENT
        // ========================================================================

        fn add_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_owner();
            assert(admin.is_non_zero(), 'Invalid admin address');
            assert(!self.admins.entry(admin).read(), 'Already admin');

            self.admins.entry(admin).write(true);
            self.emit(AdminAdded { admin });
        }

        fn remove_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_owner();
            assert(admin != self.owner.read(), 'Cannot remove owner');
            assert(self.admins.entry(admin).read(), 'Not an admin');

            self.admins.entry(admin).write(false);
            self.emit(AdminRemoved { admin });
        }

        fn is_admin(self: @ContractState, account: ContractAddress) -> bool {
            account == self.owner.read() || self.admins.entry(account).read()
        }

        // ========================================================================
        // EDITOR MANAGEMENT
        // ========================================================================

        fn add_editor(ref self: ContractState, editor: ContractAddress) {
            self.assert_only_admin();
            assert(editor.is_non_zero(), 'Invalid editor address');
            assert(!self.editors.entry(editor).read(), 'Already editor');

            self.editors.entry(editor).write(true);
            self.emit(EditorAdded { editor });
        }

        fn remove_editor(ref self: ContractState, editor: ContractAddress) {
            self.assert_only_admin();
            assert(self.editors.entry(editor).read(), 'Not an editor');

            self.editors.entry(editor).write(false);
            self.emit(EditorRemoved { editor });
        }

        fn is_editor(self: @ContractState, account: ContractAddress) -> bool {
            self.is_editor_or_above(account)
        }

        // ========================================================================
        // ROLE REGISTRY INTEGRATION
        // ========================================================================

        fn set_role_registry(ref self: ContractState, registry: ContractAddress) {
            self.assert_only_owner();
            let old = self.role_registry.read();
            self.role_registry.write(registry);
            self.emit(RoleRegistryUpdated {
                old_registry: old,
                new_registry: registry,
            });
        }

        fn get_role_registry(self: @ContractState) -> ContractAddress {
            self.role_registry.read()
        }

        // ========================================================================
        // ACCESS CONTROL (WHITELIST)
        // ========================================================================

        fn whitelist_user(ref self: ContractState, post_id: u64, user: ContractAddress) {
            self.assert_only_admin();
            assert(user.is_non_zero(), 'Invalid user address');
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');

            self.post_whitelist.entry((post_id, user)).write(true);
            self.emit(UserWhitelisted { post_id, user });
        }

        fn blacklist_user(ref self: ContractState, post_id: u64, user: ContractAddress) {
            self.assert_only_admin();
            assert(post_id > 0 && post_id <= self.post_count.read(), 'Invalid post ID');

            self.post_whitelist.entry((post_id, user)).write(false);
            self.post_purchases.entry((post_id, user)).write(false);
            self.emit(UserBlacklisted { post_id, user });
        }

        // ========================================================================
        // EMERGENCY CONTROLS
        // ========================================================================

        fn pause(ref self: ContractState) {
            self.assert_only_owner();
            self.assert_not_paused();

            self.paused.write(true);
            self.emit(Paused { timestamp: get_block_timestamp() });
        }

        fn unpause(ref self: ContractState) {
            self.assert_only_owner();
            self.assert_paused();

            self.paused.write(false);
            self.emit(Unpaused { timestamp: get_block_timestamp() });
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        // ========================================================================
        // TREASURY & FEES
        // ========================================================================

        fn set_treasury(ref self: ContractState, new_treasury: ContractAddress) {
            self.assert_only_owner();
            assert(new_treasury.is_non_zero(), 'Invalid treasury address');

            let old_treasury = self.treasury.read();
            self.treasury.write(new_treasury);

            self.emit(TreasuryUpdated {
                old_treasury,
                new_treasury,
            });
        }

        fn set_platform_fee(ref self: ContractState, new_fee: u256) {
            self.assert_only_owner();
            assert(new_fee <= MAX_PLATFORM_FEE, 'Fee exceeds maximum');

            let old_fee = self.platform_fee_percentage.read();
            self.platform_fee_percentage.write(new_fee);

            self.emit(PlatformFeeUpdated {
                old_fee,
                new_fee,
            });
        }

        fn get_treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        fn get_platform_fee(self: @ContractState) -> u256 {
            self.platform_fee_percentage.read()
        }

        // ========================================================================
        // OWNERSHIP
        // ========================================================================

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            self.assert_only_owner();
            assert(new_owner.is_non_zero(), 'New owner is zero address');

            let previous_owner = self.owner.read();
            self.owner.write(new_owner);

            // New owner is automatically admin
            self.admins.entry(new_owner).write(true);

            self.emit(OwnershipTransferred {
                previous_owner,
                new_owner,
            });
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        // ========================================================================
        // RATE LIMITING CONFIG
        // ========================================================================

        fn set_publish_cooldown(ref self: ContractState, cooldown_seconds: u64) {
            self.assert_only_owner();
            assert(cooldown_seconds <= 86400, 'Cooldown too long'); // Max 24h

            self.publish_cooldown.write(cooldown_seconds);
        }

        fn get_publish_cooldown(self: @ContractState) -> u64 {
            self.publish_cooldown.read()
        }

        // ========================================================================
        // EXTENDED FUNCTIONS (Twitter-like)
        // ========================================================================

        /// Pin a post to the author's profile (only one pinned post allowed)
        fn pin_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();

            let caller = get_caller_address();
            let post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.author == caller, 'Not post author');
            assert(!post.is_deleted, 'Post is deleted');
            assert(post.status == POST_PUBLISHED, 'Post not published');

            // Unpin previous post if any
            let previously_pinned = self.pinned_post.entry(caller).read();
            if previously_pinned > 0 && previously_pinned != post_id {
                let mut old_post = self.posts.entry(previously_pinned).read();
                old_post.is_pinned = false;
                self.posts.entry(previously_pinned).write(old_post);
            }

            // Pin the new post
            let mut updated_post = post;
            updated_post.is_pinned = true;
            self.posts.entry(post_id).write(updated_post);
            self.pinned_post.entry(caller).write(post_id);

            let now = get_block_timestamp();
            self.emit(PostPinned {
                post_id,
                author: caller,
                timestamp: now,
            });
        }

        /// Unpin a post from the author's profile
        fn unpin_post(ref self: ContractState, post_id: u64) {
            self.assert_not_paused();

            let caller = get_caller_address();
            let post = self.posts.entry(post_id).read();

            assert(post.id != 0, 'Post does not exist');
            assert(post.author == caller, 'Not post author');
            assert(post.is_pinned, 'Post is not pinned');

            let mut updated_post = post;
            updated_post.is_pinned = false;
            self.posts.entry(post_id).write(updated_post);
            self.pinned_post.entry(caller).write(0);

            let now = get_block_timestamp();
            self.emit(PostUnpinned {
                post_id,
                author: caller,
                timestamp: now,
            });
        }

        /// Get the pinned post for an author
        fn get_pinned_post(self: @ContractState, author: ContractAddress) -> u64 {
            self.pinned_post.entry(author).read()
        }

        /// Get posts by type with pagination
        fn get_posts_by_type(
            self: @ContractState,
            post_type: u8,
            limit: u64,
            offset: u64
        ) -> Array<PostMetadata> {
            assert(post_type <= POST_TYPE_ARTICLE, 'Invalid post type');
            assert(limit > 0 && limit <= MAX_POSTS_PER_QUERY, 'Invalid limit');

            let mut result = ArrayTrait::new();
            let total = self.posts_by_type_count.entry(post_type).read();

            if offset >= total {
                return result;
            }

            let end = if offset + limit > total { total } else { offset + limit };
            let mut i = offset;

            loop {
                if i >= end {
                    break;
                }
                let post_id = self.posts_by_type.entry((post_type, i)).read();
                if post_id > 0 {
                    let post = self.posts.entry(post_id).read();
                    if post.post_type == post_type && !post.is_deleted && post.status == POST_PUBLISHED {
                        result.append(post);
                    }
                }
                i += 1;
            };

            result
        }

        /// Get replies to a post with pagination
        fn get_post_replies(
            self: @ContractState,
            parent_id: u64,
            limit: u64,
            offset: u64
        ) -> Array<PostMetadata> {
            assert(parent_id > 0 && parent_id <= self.post_count.read(), 'Invalid parent ID');
            assert(limit > 0 && limit <= MAX_POSTS_PER_QUERY, 'Invalid limit');

            let mut result = ArrayTrait::new();
            let total = self.post_reply_count.entry(parent_id).read();

            if offset >= total {
                return result;
            }

            let end = if offset + limit > total { total } else { offset + limit };
            let mut i = offset;

            loop {
                if i >= end {
                    break;
                }
                let post_id = self.post_replies.entry((parent_id, i)).read();
                if post_id > 0 {
                    let post = self.posts.entry(post_id).read();
                    if !post.is_deleted && post.status == POST_PUBLISHED {
                        result.append(post);
                    }
                }
                i += 1;
            };

            result
        }

        /// Get reply count for a post
        fn get_reply_count(self: @ContractState, parent_id: u64) -> u64 {
            self.post_reply_count.entry(parent_id).read()
        }

        /// Get posts in a thread with pagination
        fn get_thread_posts(
            self: @ContractState,
            thread_root_id: u64,
            limit: u64,
            offset: u64
        ) -> Array<PostMetadata> {
            assert(thread_root_id > 0 && thread_root_id <= self.post_count.read(), 'Invalid thread root ID');
            assert(limit > 0 && limit <= MAX_POSTS_PER_QUERY, 'Invalid limit');

            let mut result = ArrayTrait::new();
            let total = self.thread_post_count.entry(thread_root_id).read();

            if offset >= total {
                return result;
            }

            let end = if offset + limit > total { total } else { offset + limit };
            let mut i = offset;

            loop {
                if i >= end {
                    break;
                }
                let post_id = self.thread_posts.entry((thread_root_id, i)).read();
                if post_id > 0 {
                    let post = self.posts.entry(post_id).read();
                    if !post.is_deleted && post.status == POST_PUBLISHED {
                        result.append(post);
                    }
                }
                i += 1;
            };

            result
        }

        /// Get post count in a thread
        fn get_thread_post_count(self: @ContractState, thread_root_id: u64) -> u64 {
            self.thread_post_count.entry(thread_root_id).read()
        }

        /// Get count of posts by type
        fn get_posts_count_by_type(self: @ContractState, post_type: u8) -> u64 {
            self.posts_by_type_count.entry(post_type).read()
        }
    }
}

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

#[starknet::interface]
pub trait IBlogRegistry<TContractState> {
    // Post creation and management
    fn publish_post(
        ref self: TContractState,
        arweave_tx_id_1: felt252,
        arweave_tx_id_2: felt252,
        ipfs_cid_1: felt252,
        ipfs_cid_2: felt252,
        content_hash: felt252,
        price: u256,
        is_encrypted: bool,
    ) -> u64;
    fn update_post(
        ref self: TContractState,
        post_id: u64,
        arweave_tx_id_1: felt252,
        arweave_tx_id_2: felt252,
        ipfs_cid_1: felt252,
        ipfs_cid_2: felt252,
        content_hash: felt252,
    ) -> bool;
    fn delete_post(ref self: TContractState, post_id: u64) -> bool;

    // Content workflow
    fn submit_for_review(ref self: TContractState, post_id: u64);
    fn approve_post(ref self: TContractState, post_id: u64);
    fn reject_post(ref self: TContractState, post_id: u64);
    fn archive_post(ref self: TContractState, post_id: u64);
    fn unarchive_post(ref self: TContractState, post_id: u64);

    // Featured posts
    fn feature_post(ref self: TContractState, post_id: u64);
    fn unfeature_post(ref self: TContractState, post_id: u64);
    fn get_featured_posts(self: @TContractState, limit: u64) -> Array<PostMetadata>;
    fn get_pending_review_count(self: @TContractState) -> u64;
    fn get_posts_by_status(self: @TContractState, status: u8, limit: u64, offset: u64) -> Array<PostMetadata>;

    // User functions
    fn purchase_post(ref self: TContractState, post_id: u64) -> bool;

    // Public view functions
    fn get_post(self: @TContractState, post_id: u64) -> PostMetadata;
    fn get_post_count(self: @TContractState) -> u64;
    fn get_posts(self: @TContractState, limit: u64, offset: u64) -> Array<PostMetadata>;
    fn has_access(self: @TContractState, post_id: u64, user: ContractAddress) -> bool;

    // Version history
    fn get_post_version(self: @TContractState, post_id: u64, version: u64) -> PostVersion;
    fn get_post_version_count(self: @TContractState, post_id: u64) -> u64;
    fn get_post_versions(self: @TContractState, post_id: u64, limit: u64, offset: u64) -> Array<PostVersion>;

    // Admin management
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;

    // Editor management
    fn add_editor(ref self: TContractState, editor: ContractAddress);
    fn remove_editor(ref self: TContractState, editor: ContractAddress);
    fn is_editor(self: @TContractState, account: ContractAddress) -> bool;

    // Role registry integration
    fn set_role_registry(ref self: TContractState, registry: ContractAddress);
    fn get_role_registry(self: @TContractState) -> ContractAddress;

    // Access control
    fn whitelist_user(ref self: TContractState, post_id: u64, user: ContractAddress);
    fn blacklist_user(ref self: TContractState, post_id: u64, user: ContractAddress);

    // Emergency controls
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;

    // Treasury & fees
    fn set_treasury(ref self: TContractState, new_treasury: ContractAddress);
    fn set_platform_fee(ref self: TContractState, new_fee: u256);
    fn get_treasury(self: @TContractState) -> ContractAddress;
    fn get_platform_fee(self: @TContractState) -> u256;

    // Ownership
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
    fn get_owner(self: @TContractState) -> ContractAddress;

    // Rate limiting
    fn set_publish_cooldown(ref self: TContractState, cooldown_seconds: u64);
    fn get_publish_cooldown(self: @TContractState) -> u64;

    // Extended functions (Twitter-like)
    fn publish_post_extended(
        ref self: TContractState,
        arweave_tx_id_1: felt252,
        arweave_tx_id_2: felt252,
        ipfs_cid_1: felt252,
        ipfs_cid_2: felt252,
        content_hash: felt252,
        price: u256,
        is_encrypted: bool,
        post_type: u8,
        parent_id: u64,
        thread_root_id: u64,
    ) -> u64;
    fn pin_post(ref self: TContractState, post_id: u64);
    fn unpin_post(ref self: TContractState, post_id: u64);
    fn get_pinned_post(self: @TContractState, author: ContractAddress) -> u64;
    fn get_posts_by_type(
        self: @TContractState,
        post_type: u8,
        limit: u64,
        offset: u64
    ) -> Array<PostMetadata>;
    fn get_post_replies(
        self: @TContractState,
        parent_id: u64,
        limit: u64,
        offset: u64
    ) -> Array<PostMetadata>;
    fn get_reply_count(self: @TContractState, parent_id: u64) -> u64;
    fn get_thread_posts(
        self: @TContractState,
        thread_root_id: u64,
        limit: u64,
        offset: u64
    ) -> Array<PostMetadata>;
    fn get_thread_post_count(self: @TContractState, thread_root_id: u64) -> u64;
    fn get_posts_count_by_type(self: @TContractState, post_type: u8) -> u64;
}
