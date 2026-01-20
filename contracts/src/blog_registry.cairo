// SPDX-License-Identifier: MIT
// Vauban Blog - BlogRegistry Smart Contract (Production-Grade)
// Security: Reentrancy guards, Access control, Input validation, Pausable, Rate limiting

#[starknet::contract]
mod BlogRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    // ============================================================================
    // STORAGE STRUCTURES
    // ============================================================================

    #[derive(Drop, Serde, starknet::Store)]
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
    }

    // Version history entry - stores previous versions of a post
    #[derive(Drop, Serde, starknet::Store)]
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

    #[storage]
    struct Storage {
        // Access Control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,

        // Core Data
        posts: Map<u64, PostMetadata>,
        post_count: u64,
        post_purchases: Map<(u64, ContractAddress), bool>,

        // Version History: (post_id, version_number) -> PostVersion
        post_versions: Map<(u64, u64), PostVersion>,

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
        OwnershipTransferred: OwnershipTransferred,
        AdminAdded: AdminAdded,
        AdminRemoved: AdminRemoved,
        Paused: Paused,
        Unpaused: Unpaused,
        TreasuryUpdated: TreasuryUpdated,
        PlatformFeeUpdated: PlatformFeeUpdated,
        UserWhitelisted: UserWhitelisted,
        UserBlacklisted: UserBlacklisted,
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
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl BlogRegistryImpl of super::IBlogRegistry<ContractState> {
        // ========================================================================
        // ADMIN FUNCTIONS
        // ========================================================================

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
            // Security checks
            self.assert_only_admin();
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();

            // Rate limiting (anti-spam)
            self.check_publish_cooldown(caller);

            // Input validation
            self.validate_post_inputs(arweave_tx_id_1, ipfs_cid_1, content_hash, price);

            // Checks-Effects-Interactions pattern: Effects
            let post_id = self.post_count.read() + 1;
            let now = get_block_timestamp();
            let initial_version: u64 = 1;

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

            // Events (audit trail)
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
    }
}

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

use starknet::ContractAddress;

#[starknet::interface]
trait IBlogRegistry<TContractState> {
    // Admin functions
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

    // User functions
    fn purchase_post(ref self: TContractState, post_id: u64) -> bool;

    // Public view functions
    fn get_post(self: @TContractState, post_id: u64) -> BlogRegistry::PostMetadata;
    fn get_post_count(self: @TContractState) -> u64;
    fn get_posts(self: @TContractState, limit: u64, offset: u64) -> Array<BlogRegistry::PostMetadata>;
    fn has_access(self: @TContractState, post_id: u64, user: ContractAddress) -> bool;

    // Version history
    fn get_post_version(self: @TContractState, post_id: u64, version: u64) -> BlogRegistry::PostVersion;
    fn get_post_version_count(self: @TContractState, post_id: u64) -> u64;
    fn get_post_versions(self: @TContractState, post_id: u64, limit: u64, offset: u64) -> Array<BlogRegistry::PostVersion>;

    // Admin management
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;

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
}
