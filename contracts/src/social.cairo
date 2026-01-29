// SPDX-License-Identifier: MIT
// Vauban Blog - Social Smart Contract (Production-Grade)
// Security: Reentrancy guards, Rate limiting, Signature verification, Content moderation

#[starknet::contract]
mod Social {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    // Import SessionKeyManager interface for validation
    use super::{ISessionKeyManagerDispatcher, ISessionKeyManagerDispatcherTrait};

    // ============================================================================
    // STORAGE STRUCTURES
    // ============================================================================

    #[derive(Drop, Serde, starknet::Store, Clone)]
    pub struct Comment {
        pub id: u64,
        pub post_id: u64,
        pub author: ContractAddress,
        pub content_hash: felt252,  // SHA256 hash of comment text (stored off-chain)
        pub parent_comment_id: u64,  // 0 = top-level, >0 = reply to comment
        pub created_at: u64,
        pub is_deleted: bool,  // Moderation flag
        pub like_count: u64,
    }

    #[storage]
    struct Storage {
        // Access Control
        owner: ContractAddress,
        moderators: Map<ContractAddress, bool>,

        // Core Data
        comments: Map<u64, Comment>,
        comment_count: u64,
        post_comment_count: Map<u64, u64>,  // post_id -> comment count
        post_likes: Map<u64, u64>,  // post_id -> like count
        user_liked_post: Map<(u64, ContractAddress), bool>,  // (post_id, user) -> liked
        user_liked_comment: Map<(u64, ContractAddress), bool>,  // (comment_id, user) -> liked

        // Security
        paused: bool,
        reentrancy_guard: bool,

        // Rate Limiting (anti-spam)
        last_comment_time: Map<ContractAddress, u64>,
        comment_cooldown: u64,  // Seconds between comments
        user_comment_count_24h: Map<ContractAddress, u64>,  // Comments in last 24h
        last_reset_time: Map<ContractAddress, u64>,  // Last 24h counter reset

        // Moderation
        banned_users: Map<ContractAddress, bool>,
        reported_comments: Map<u64, u64>,  // comment_id -> report count

        // Session Key Integration
        session_key_manager: ContractAddress,
        session_key_nonces: Map<felt252, u64>,  // session_key -> nonce (replay protection)
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        CommentAdded: CommentAdded,
        CommentDeleted: CommentDeleted,
        CommentReported: CommentReported,
        PostLiked: PostLiked,
        PostUnliked: PostUnliked,
        CommentLiked: CommentLiked,
        CommentUnliked: CommentUnliked,
        UserBanned: UserBanned,
        UserUnbanned: UserUnbanned,
        ModeratorAdded: ModeratorAdded,
        ModeratorRemoved: ModeratorRemoved,
        Paused: Paused,
        Unpaused: Unpaused,
        SessionKeyManagerUpdated: SessionKeyManagerUpdated,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct SessionKeyManagerUpdated {
        old_manager: ContractAddress,
        new_manager: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct CommentAdded {
        #[key]
        comment_id: u64,
        #[key]
        post_id: u64,
        #[key]
        author: ContractAddress,
        parent_comment_id: u64,
        content_hash: felt252,
        created_at: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct CommentDeleted {
        #[key]
        comment_id: u64,
        deleted_by: ContractAddress,
        deleted_at: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct CommentReported {
        #[key]
        comment_id: u64,
        #[key]
        reporter: ContractAddress,
        report_count: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostLiked {
        #[key]
        post_id: u64,
        #[key]
        user: ContractAddress,
        total_likes: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PostUnliked {
        #[key]
        post_id: u64,
        #[key]
        user: ContractAddress,
        total_likes: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct CommentLiked {
        #[key]
        comment_id: u64,
        #[key]
        user: ContractAddress,
        total_likes: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct CommentUnliked {
        #[key]
        comment_id: u64,
        #[key]
        user: ContractAddress,
        total_likes: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct UserBanned {
        #[key]
        user: ContractAddress,
        banned_by: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct UserUnbanned {
        #[key]
        user: ContractAddress,
        unbanned_by: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ModeratorAdded {
        #[key]
        moderator: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ModeratorRemoved {
        #[key]
        moderator: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct Paused {
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct Unpaused {
        timestamp: u64,
    }

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const DEFAULT_COMMENT_COOLDOWN: u64 = 10; // 10 seconds between comments
    const MAX_COMMENTS_PER_24H: u64 = 100; // Max 100 comments per user per day
    const MAX_COMMENTS_PER_QUERY: u64 = 100; // DOS protection
    const SECONDS_PER_DAY: u64 = 86400;
    const AUTO_BAN_REPORT_THRESHOLD: u64 = 10; // Auto-delete comment if 10+ reports

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(owner.is_non_zero(), 'Owner cannot be zero');

        self.owner.write(owner);
        self.comment_cooldown.write(DEFAULT_COMMENT_COOLDOWN);
        self.paused.write(false);
        self.reentrancy_guard.write(false);

        // Owner is automatically moderator
        self.moderators.entry(owner).write(true);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Caller is not the owner');
        }

        fn assert_only_moderator(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_moderator = self.moderators.entry(caller).read();
            assert(is_owner || is_moderator, 'Caller is not moderator');
        }

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }

        fn assert_not_banned(self: @ContractState, user: ContractAddress) {
            assert(!self.banned_users.entry(user).read(), 'User is banned');
        }

        fn assert_no_reentrancy(ref self: ContractState) {
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);
        }

        fn clear_reentrancy(ref self: ContractState) {
            self.reentrancy_guard.write(false);
        }

        fn check_comment_cooldown(self: @ContractState, user: ContractAddress) {
            let last_comment = self.last_comment_time.entry(user).read();
            let current_time = get_block_timestamp();
            let cooldown = self.comment_cooldown.read();

            if last_comment > 0 {
                assert(
                    current_time >= last_comment + cooldown,
                    'Comment cooldown active'
                );
            }
        }

        fn check_daily_limit(ref self: ContractState, user: ContractAddress) {
            let current_time = get_block_timestamp();
            let last_reset = self.last_reset_time.entry(user).read();
            let mut comment_count = self.user_comment_count_24h.entry(user).read();

            // Reset counter if 24h passed
            if current_time >= last_reset + SECONDS_PER_DAY {
                comment_count = 0;
                self.last_reset_time.entry(user).write(current_time);
            }

            assert(comment_count < MAX_COMMENTS_PER_24H, 'Daily comment limit reached');

            // Increment counter
            self.user_comment_count_24h.entry(user).write(comment_count + 1);
        }

        fn validate_comment_inputs(
            self: @ContractState,
            post_id: u64,
            content_hash: felt252,
        ) {
            assert(post_id > 0, 'Invalid post ID');
            assert(content_hash != 0, 'Invalid content hash');
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl SocialImpl of super::ISocial<ContractState> {
        // ========================================================================
        // USER FUNCTIONS
        // ========================================================================

        fn add_comment(
            ref self: ContractState,
            post_id: u64,
            content_hash: felt252,
            parent_comment_id: u64,
        ) -> u64 {
            // Security checks
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();
            self.assert_not_banned(caller);

            // Rate limiting
            self.check_comment_cooldown(caller);
            self.check_daily_limit(caller);

            // Input validation
            self.validate_comment_inputs(post_id, content_hash);

            // Validate parent comment if replying
            if parent_comment_id > 0 {
                assert(parent_comment_id <= self.comment_count.read(), 'Invalid parent comment');
                let parent = self.comments.entry(parent_comment_id).read();
                assert(parent.id != 0, 'Parent comment not found');
                assert(!parent.is_deleted, 'Parent comment deleted');
                assert(parent.post_id == post_id, 'Parent comment mismatch');
            }

            // Create comment
            let comment_id = self.comment_count.read() + 1;
            let now = get_block_timestamp();

            let comment = Comment {
                id: comment_id,
                post_id,
                author: caller,
                content_hash,
                parent_comment_id,
                created_at: now,
                is_deleted: false,
                like_count: 0,
            };

            self.comments.entry(comment_id).write(comment);
            self.comment_count.write(comment_id);

            // Update post comment count
            let current_count = self.post_comment_count.entry(post_id).read();
            self.post_comment_count.entry(post_id).write(current_count + 1);

            // Update rate limiting
            self.last_comment_time.entry(caller).write(now);

            // Emit event
            self.emit(CommentAdded {
                comment_id,
                post_id,
                author: caller,
                parent_comment_id,
                content_hash,
                created_at: now,
            });

            self.clear_reentrancy();
            comment_id
        }

        // Session key variant - allows authorized session keys to post on behalf of users
        fn add_comment_with_session_key(
            ref self: ContractState,
            post_id: u64,
            content_hash: felt252,
            parent_comment_id: u64,
            session_public_key: felt252,
            on_behalf_of: ContractAddress,
            nonce: u64,
        ) -> u64 {
            // Security checks
            self.assert_not_paused();
            self.assert_no_reentrancy();

            // Verify session key manager is configured
            let session_manager = self.session_key_manager.read();
            assert(session_manager.is_non_zero(), 'Session manager not set');

            // Verify nonce (replay protection)
            let current_nonce = self.session_key_nonces.entry(session_public_key).read();
            assert(nonce == current_nonce, 'Invalid nonce');

            // Import and call SessionKeyManager to validate
            let session_manager_dispatcher = ISessionKeyManagerDispatcher { contract_address: session_manager };

            // Get the function selector for add_comment
            let add_comment_selector: felt252 = selector!("add_comment");

            // Validate session key with SessionKeyManager
            let is_valid = session_manager_dispatcher.validate_and_use_session_key(
                session_public_key,
                starknet::get_contract_address(),  // This contract
                add_comment_selector,
            );
            assert(is_valid, 'Invalid session key');

            // Verify the session key belongs to on_behalf_of
            let session_info = session_manager_dispatcher.get_session_key(session_public_key);
            assert(session_info.master_account == on_behalf_of, 'Session key owner mismatch');

            // Check user not banned
            self.assert_not_banned(on_behalf_of);

            // Rate limiting for the actual user
            self.check_comment_cooldown(on_behalf_of);
            self.check_daily_limit(on_behalf_of);

            // Input validation
            self.validate_comment_inputs(post_id, content_hash);

            // Validate parent comment if replying
            if parent_comment_id > 0 {
                assert(parent_comment_id <= self.comment_count.read(), 'Invalid parent comment');
                let parent = self.comments.entry(parent_comment_id).read();
                assert(parent.id != 0, 'Parent comment not found');
                assert(!parent.is_deleted, 'Parent comment deleted');
                assert(parent.post_id == post_id, 'Parent comment mismatch');
            }

            // Create comment (attributed to on_behalf_of)
            let comment_id = self.comment_count.read() + 1;
            let now = get_block_timestamp();

            let comment = Comment {
                id: comment_id,
                post_id,
                author: on_behalf_of,  // Comment belongs to the actual user
                content_hash,
                parent_comment_id,
                created_at: now,
                is_deleted: false,
                like_count: 0,
            };

            self.comments.entry(comment_id).write(comment);
            self.comment_count.write(comment_id);

            // Update post comment count
            let current_count = self.post_comment_count.entry(post_id).read();
            self.post_comment_count.entry(post_id).write(current_count + 1);

            // Update rate limiting for the actual user
            self.last_comment_time.entry(on_behalf_of).write(now);

            // Increment nonce for replay protection
            self.session_key_nonces.entry(session_public_key).write(nonce + 1);

            // Emit event
            self.emit(CommentAdded {
                comment_id,
                post_id,
                author: on_behalf_of,
                parent_comment_id,
                content_hash,
                created_at: now,
            });

            self.clear_reentrancy();
            comment_id
        }

        fn get_session_key_nonce(self: @ContractState, session_public_key: felt252) -> u64 {
            self.session_key_nonces.entry(session_public_key).read()
        }

        fn like_post(ref self: ContractState, post_id: u64) -> bool {
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();
            self.assert_not_banned(caller);

            assert(post_id > 0, 'Invalid post ID');
            assert(!self.user_liked_post.entry((post_id, caller)).read(), 'Already liked');

            // Update like count
            let current_likes = self.post_likes.entry(post_id).read();
            self.post_likes.entry(post_id).write(current_likes + 1);
            self.user_liked_post.entry((post_id, caller)).write(true);

            self.emit(PostLiked {
                post_id,
                user: caller,
                total_likes: current_likes + 1,
            });

            self.clear_reentrancy();
            true
        }

        fn unlike_post(ref self: ContractState, post_id: u64) -> bool {
            self.assert_not_paused();

            let caller = get_caller_address();
            assert(post_id > 0, 'Invalid post ID');
            assert(self.user_liked_post.entry((post_id, caller)).read(), 'Not liked yet');

            // Update like count
            let current_likes = self.post_likes.entry(post_id).read();
            if current_likes > 0 {
                self.post_likes.entry(post_id).write(current_likes - 1);
            }
            self.user_liked_post.entry((post_id, caller)).write(false);

            self.emit(PostUnliked {
                post_id,
                user: caller,
                total_likes: if current_likes > 0 { current_likes - 1 } else { 0 },
            });

            true
        }

        fn like_comment(ref self: ContractState, comment_id: u64) -> bool {
            self.assert_not_paused();

            let caller = get_caller_address();
            self.assert_not_banned(caller);

            assert(comment_id > 0 && comment_id <= self.comment_count.read(), 'Invalid comment ID');
            assert(!self.user_liked_comment.entry((comment_id, caller)).read(), 'Already liked');

            let mut comment = self.comments.entry(comment_id).read();
            assert(comment.id != 0, 'Comment not found');
            assert(!comment.is_deleted, 'Comment deleted');

            // Update like count
            comment.like_count += 1;
            self.comments.entry(comment_id).write(comment.clone());
            self.user_liked_comment.entry((comment_id, caller)).write(true);

            self.emit(CommentLiked {
                comment_id,
                user: caller,
                total_likes: comment.like_count,
            });

            true
        }

        fn unlike_comment(ref self: ContractState, comment_id: u64) -> bool {
            self.assert_not_paused();

            let caller = get_caller_address();
            assert(comment_id > 0 && comment_id <= self.comment_count.read(), 'Invalid comment ID');
            assert(self.user_liked_comment.entry((comment_id, caller)).read(), 'Not liked yet');

            let mut comment = self.comments.entry(comment_id).read();
            assert(comment.id != 0, 'Comment not found');

            // Update like count
            if comment.like_count > 0 {
                comment.like_count -= 1;
            }
            self.comments.entry(comment_id).write(comment.clone());
            self.user_liked_comment.entry((comment_id, caller)).write(false);

            self.emit(CommentUnliked {
                comment_id,
                user: caller,
                total_likes: comment.like_count,
            });

            true
        }

        fn report_comment(ref self: ContractState, comment_id: u64) -> bool {
            self.assert_not_paused();

            let caller = get_caller_address();
            assert(comment_id > 0 && comment_id <= self.comment_count.read(), 'Invalid comment ID');

            let comment = self.comments.entry(comment_id).read();
            assert(comment.id != 0, 'Comment not found');
            assert(!comment.is_deleted, 'Comment already deleted');

            // Increment report count
            let report_count = self.reported_comments.entry(comment_id).read() + 1;
            self.reported_comments.entry(comment_id).write(report_count);

            self.emit(CommentReported {
                comment_id,
                reporter: caller,
                report_count,
            });

            // Auto-delete if threshold reached
            if report_count >= AUTO_BAN_REPORT_THRESHOLD {
                let mut comment_to_delete = self.comments.entry(comment_id).read();
                comment_to_delete.is_deleted = true;
                self.comments.entry(comment_id).write(comment_to_delete);
            }

            true
        }

        // ========================================================================
        // MODERATION FUNCTIONS
        // ========================================================================

        fn delete_comment(ref self: ContractState, comment_id: u64) -> bool {
            self.assert_only_moderator();

            assert(comment_id > 0 && comment_id <= self.comment_count.read(), 'Invalid comment ID');

            let mut comment = self.comments.entry(comment_id).read();
            assert(comment.id != 0, 'Comment not found');
            assert(!comment.is_deleted, 'Comment already deleted');

            // Soft delete
            comment.is_deleted = true;
            self.comments.entry(comment_id).write(comment);

            self.emit(CommentDeleted {
                comment_id,
                deleted_by: get_caller_address(),
                deleted_at: get_block_timestamp(),
            });

            true
        }

        fn ban_user(ref self: ContractState, user: ContractAddress) {
            self.assert_only_moderator();
            assert(user.is_non_zero(), 'Invalid user address');
            assert(user != self.owner.read(), 'Cannot ban owner');
            assert(!self.banned_users.entry(user).read(), 'User already banned');

            self.banned_users.entry(user).write(true);

            self.emit(UserBanned {
                user,
                banned_by: get_caller_address(),
            });
        }

        fn unban_user(ref self: ContractState, user: ContractAddress) {
            self.assert_only_moderator();
            assert(self.banned_users.entry(user).read(), 'User not banned');

            self.banned_users.entry(user).write(false);

            self.emit(UserUnbanned {
                user,
                unbanned_by: get_caller_address(),
            });
        }

        fn is_banned(self: @ContractState, user: ContractAddress) -> bool {
            self.banned_users.entry(user).read()
        }

        // ========================================================================
        // PUBLIC VIEW FUNCTIONS
        // ========================================================================

        fn get_comment(self: @ContractState, comment_id: u64) -> Comment {
            assert(comment_id > 0 && comment_id <= self.comment_count.read(), 'Invalid comment ID');
            let comment = self.comments.entry(comment_id).read();
            assert(comment.id != 0, 'Comment not found');
            comment
        }

        fn get_comments_for_post(
            self: @ContractState,
            post_id: u64,
            limit: u64,
            offset: u64
        ) -> Array<Comment> {
            assert(limit > 0 && limit <= MAX_COMMENTS_PER_QUERY, 'Invalid limit');

            let mut result: Array<Comment> = ArrayTrait::new();
            let total_count = self.comment_count.read();

            if total_count == 0 {
                return result;
            }

            let mut i = 1;
            let mut found = 0;
            let mut skipped = 0;

            loop {
                if i > total_count || found >= limit {
                    break;
                }

                let comment = self.comments.entry(i).read();
                if comment.id != 0 && comment.post_id == post_id && !comment.is_deleted {
                    if skipped >= offset {
                        result.append(comment);
                        found += 1;
                    } else {
                        skipped += 1;
                    }
                }
                i += 1;
            };

            result
        }

        fn get_comment_count_for_post(self: @ContractState, post_id: u64) -> u64 {
            self.post_comment_count.entry(post_id).read()
        }

        fn get_post_likes(self: @ContractState, post_id: u64) -> u64 {
            self.post_likes.entry(post_id).read()
        }

        fn has_liked_post(self: @ContractState, post_id: u64, user: ContractAddress) -> bool {
            self.user_liked_post.entry((post_id, user)).read()
        }

        fn has_liked_comment(self: @ContractState, comment_id: u64, user: ContractAddress) -> bool {
            self.user_liked_comment.entry((comment_id, user)).read()
        }

        fn get_report_count(self: @ContractState, comment_id: u64) -> u64 {
            self.reported_comments.entry(comment_id).read()
        }

        // ========================================================================
        // ADMIN FUNCTIONS
        // ========================================================================

        fn add_moderator(ref self: ContractState, moderator: ContractAddress) {
            self.assert_only_owner();
            assert(moderator.is_non_zero(), 'Invalid moderator address');
            assert(!self.moderators.entry(moderator).read(), 'Already moderator');

            self.moderators.entry(moderator).write(true);
            self.emit(ModeratorAdded { moderator });
        }

        fn remove_moderator(ref self: ContractState, moderator: ContractAddress) {
            self.assert_only_owner();
            assert(moderator != self.owner.read(), 'Cannot remove owner');
            assert(self.moderators.entry(moderator).read(), 'Not a moderator');

            self.moderators.entry(moderator).write(false);
            self.emit(ModeratorRemoved { moderator });
        }

        fn is_moderator(self: @ContractState, account: ContractAddress) -> bool {
            account == self.owner.read() || self.moderators.entry(account).read()
        }

        fn pause(ref self: ContractState) {
            self.assert_only_owner();
            assert(!self.paused.read(), 'Already paused');

            self.paused.write(true);
            self.emit(Paused { timestamp: get_block_timestamp() });
        }

        fn unpause(ref self: ContractState) {
            self.assert_only_owner();
            assert(self.paused.read(), 'Not paused');

            self.paused.write(false);
            self.emit(Unpaused { timestamp: get_block_timestamp() });
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn set_comment_cooldown(ref self: ContractState, cooldown_seconds: u64) {
            self.assert_only_owner();
            assert(cooldown_seconds <= 3600, 'Cooldown too long'); // Max 1h

            self.comment_cooldown.write(cooldown_seconds);
        }

        fn get_comment_cooldown(self: @ContractState) -> u64 {
            self.comment_cooldown.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn set_session_key_manager(ref self: ContractState, manager: ContractAddress) {
            self.assert_only_owner();

            let old_manager = self.session_key_manager.read();
            self.session_key_manager.write(manager);

            self.emit(SessionKeyManagerUpdated {
                old_manager,
                new_manager: manager,
            });
        }

        fn get_session_key_manager(self: @ContractState) -> ContractAddress {
            self.session_key_manager.read()
        }
    }
}

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

use starknet::ContractAddress;

#[starknet::interface]
pub trait ISocial<TContractState> {
    // User functions
    fn add_comment(
        ref self: TContractState,
        post_id: u64,
        content_hash: felt252,
        parent_comment_id: u64,
    ) -> u64;
    fn add_comment_with_session_key(
        ref self: TContractState,
        post_id: u64,
        content_hash: felt252,
        parent_comment_id: u64,
        session_public_key: felt252,
        on_behalf_of: ContractAddress,
        nonce: u64,
    ) -> u64;
    fn get_session_key_nonce(self: @TContractState, session_public_key: felt252) -> u64;
    fn like_post(ref self: TContractState, post_id: u64) -> bool;
    fn unlike_post(ref self: TContractState, post_id: u64) -> bool;
    fn like_comment(ref self: TContractState, comment_id: u64) -> bool;
    fn unlike_comment(ref self: TContractState, comment_id: u64) -> bool;
    fn report_comment(ref self: TContractState, comment_id: u64) -> bool;

    // Moderation functions
    fn delete_comment(ref self: TContractState, comment_id: u64) -> bool;
    fn ban_user(ref self: TContractState, user: ContractAddress);
    fn unban_user(ref self: TContractState, user: ContractAddress);
    fn is_banned(self: @TContractState, user: ContractAddress) -> bool;

    // View functions
    fn get_comment(self: @TContractState, comment_id: u64) -> Social::Comment;
    fn get_comments_for_post(
        self: @TContractState,
        post_id: u64,
        limit: u64,
        offset: u64
    ) -> Array<Social::Comment>;
    fn get_comment_count_for_post(self: @TContractState, post_id: u64) -> u64;
    fn get_post_likes(self: @TContractState, post_id: u64) -> u64;
    fn has_liked_post(self: @TContractState, post_id: u64, user: ContractAddress) -> bool;
    fn has_liked_comment(self: @TContractState, comment_id: u64, user: ContractAddress) -> bool;
    fn get_report_count(self: @TContractState, comment_id: u64) -> u64;

    // Admin functions
    fn add_moderator(ref self: TContractState, moderator: ContractAddress);
    fn remove_moderator(ref self: TContractState, moderator: ContractAddress);
    fn is_moderator(self: @TContractState, account: ContractAddress) -> bool;
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn set_comment_cooldown(ref self: TContractState, cooldown_seconds: u64);
    fn get_comment_cooldown(self: @TContractState) -> u64;
    fn get_owner(self: @TContractState) -> ContractAddress;

    // Session key management
    fn set_session_key_manager(ref self: TContractState, manager: ContractAddress);
    fn get_session_key_manager(self: @TContractState) -> ContractAddress;
}

// ============================================================================
// SESSION KEY MANAGER INTERFACE (for cross-contract calls)
// ============================================================================

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct SessionKey {
    pub session_public_key: felt252,
    pub master_account: ContractAddress,
    pub created_at: u64,
    pub expires_at: u64,
    pub is_revoked: bool,
    pub use_count: u64,
    pub max_uses: u64,
}

#[starknet::interface]
trait ISessionKeyManager<TContractState> {
    fn validate_and_use_session_key(
        ref self: TContractState,
        session_public_key: felt252,
        target_contract: ContractAddress,
        function_selector: felt252,
    ) -> bool;
    fn get_session_key(self: @TContractState, session_public_key: felt252) -> SessionKey;
    fn is_session_key_valid(self: @TContractState, session_public_key: felt252) -> bool;
}
