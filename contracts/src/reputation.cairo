// SPDX-License-Identifier: MIT
// Vauban Blog - Reputation Smart Contract (Production-Grade)
// Implements gamification with points, levels, and badges

use starknet::ContractAddress;

// ============================================================================
// REPUTATION POINT CONSTANTS
// ============================================================================

pub const REP_POST_PUBLISHED: u64 = 100;
pub const REP_POST_FEATURED: u64 = 500;
pub const REP_COMMENT: u64 = 10;
pub const REP_LIKE_RECEIVED: u64 = 5;
pub const REP_SUBSCRIBER_GAINED: u64 = 50;
pub const REP_REPORT_VALID: u64 = 25;
pub const REP_SPAM_PENALTY: u64 = 200;  // Subtracted

// ============================================================================
// BADGE CONSTANTS (stored as bitmap for gas efficiency)
// ============================================================================

pub const BADGE_FIRST_POST: u256 = 1;           // Bit 0: Published first article
pub const BADGE_PROLIFIC_WRITER: u256 = 2;      // Bit 1: 10+ posts
pub const BADGE_CENTURY_CLUB: u256 = 4;         // Bit 2: 100+ posts
pub const BADGE_FEATURED_AUTHOR: u256 = 8;      // Bit 3: Had a featured article
pub const BADGE_CONVERSATIONALIST: u256 = 16;   // Bit 4: 100+ comments
pub const BADGE_BELOVED: u256 = 32;             // Bit 5: 1000+ likes received
pub const BADGE_EARLY_ADOPTER: u256 = 64;       // Bit 6: Joined in first month
pub const BADGE_VERIFIED: u256 = 128;           // Bit 7: Completed verification
pub const BADGE_TOP_WRITER: u256 = 256;         // Bit 8: Monthly top 10
pub const BADGE_PREMIUM_AUTHOR: u256 = 512;     // Bit 9: Has paid subscribers
pub const BADGE_TRUSTED: u256 = 1024;           // Bit 10: Contributor role earned
pub const BADGE_GUARDIAN: u256 = 2048;          // Bit 11: Active moderator

// ============================================================================
// LEVEL THRESHOLDS
// ============================================================================

pub const LEVEL_1_THRESHOLD: u64 = 0;      // Newcomer
pub const LEVEL_2_THRESHOLD: u64 = 100;    // Active Writer
pub const LEVEL_3_THRESHOLD: u64 = 500;    // Established
pub const LEVEL_4_THRESHOLD: u64 = 2000;   // Veteran
pub const LEVEL_5_THRESHOLD: u64 = 10000;  // Legend

// ============================================================================
// STORAGE STRUCTURES
// ============================================================================

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct UserReputation {
    pub user: ContractAddress,
    pub total_points: u64,
    pub level: u8,
    pub badges: u256,  // Bitmap for badges
    pub joined_at: u64,
    pub post_count: u32,
    pub comment_count: u32,
    pub likes_received: u32,
    pub subscribers: u32,
    pub featured_count: u32,
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct ReputationAction {
    pub id: u64,
    pub user: ContractAddress,
    pub action_type: u8,  // 0=post, 1=comment, 2=like_received, 3=subscriber, 4=featured, 5=penalty
    pub points: u64,
    pub is_penalty: bool,
    pub timestamp: u64,
}

#[starknet::contract]
mod Reputation {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use super::{
        UserReputation, ReputationAction,
        REP_POST_PUBLISHED, REP_POST_FEATURED, REP_COMMENT, REP_LIKE_RECEIVED,
        REP_SUBSCRIBER_GAINED, REP_SPAM_PENALTY,
        BADGE_FIRST_POST, BADGE_PROLIFIC_WRITER, BADGE_CENTURY_CLUB,
        BADGE_FEATURED_AUTHOR, BADGE_CONVERSATIONALIST, BADGE_BELOVED,
        BADGE_EARLY_ADOPTER, BADGE_PREMIUM_AUTHOR,
        LEVEL_2_THRESHOLD, LEVEL_3_THRESHOLD,
        LEVEL_4_THRESHOLD, LEVEL_5_THRESHOLD
    };

    // ============================================================================
    // STORAGE
    // ============================================================================

    #[storage]
    struct Storage {
        // Access Control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,
        authorized_contracts: Map<ContractAddress, bool>,

        // User reputation data
        reputations: Map<ContractAddress, UserReputation>,

        // Action history (for audit/display)
        actions: Map<u64, ReputationAction>,
        action_count: u64,
        user_action_count: Map<ContractAddress, u64>,

        // Leaderboard tracking
        top_users: Map<u64, ContractAddress>,  // rank -> user
        top_users_count: u64,

        // Platform launch timestamp (for early adopter badge)
        launch_timestamp: u64,
        early_adopter_window: u64,  // Seconds after launch to qualify

        // Statistics
        total_users: u64,
        total_points_distributed: u64,

        // Emergency
        paused: bool,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        PointsAwarded: PointsAwarded,
        PointsDeducted: PointsDeducted,
        BadgeEarned: BadgeEarned,
        LevelUp: LevelUp,
        UserRegistered: UserRegistered,
        ContractAuthorized: ContractAuthorized,
        Paused: Paused,
        Unpaused: Unpaused,
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PointsAwarded {
        #[key]
        user: ContractAddress,
        points: u64,
        action_type: u8,
        new_total: u64,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PointsDeducted {
        #[key]
        user: ContractAddress,
        points: u64,
        reason: felt252,
        new_total: u64,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct BadgeEarned {
        #[key]
        user: ContractAddress,
        badge: u256,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct LevelUp {
        #[key]
        user: ContractAddress,
        old_level: u8,
        new_level: u8,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct UserRegistered {
        #[key]
        user: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ContractAuthorized {
        #[key]
        contract_address: ContractAddress,
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
    struct OwnershipTransferred {
        #[key]
        previous_owner: ContractAddress,
        #[key]
        new_owner: ContractAddress,
    }

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    const ONE_MONTH: u64 = 2592000;  // 30 days in seconds
    const ACTION_POST: u8 = 0;
    const ACTION_COMMENT: u8 = 1;
    const ACTION_LIKE_RECEIVED: u8 = 2;
    const ACTION_SUBSCRIBER: u8 = 3;
    const ACTION_FEATURED: u8 = 4;
    const ACTION_PENALTY: u8 = 5;

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(!owner.is_zero(), 'Invalid owner address');

        self.owner.write(owner);
        self.admins.entry(owner).write(true);
        self.launch_timestamp.write(get_block_timestamp());
        self.early_adopter_window.write(ONE_MONTH);
        self.paused.write(false);
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

        fn assert_only_admin(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_admin = self.admins.entry(caller).read();
            assert(is_owner || is_admin, 'Caller is not admin');
        }

        fn assert_authorized(self: @ContractState) {
            let caller = get_caller_address();
            assert(
                self.authorized_contracts.entry(caller).read()
                    || self.admins.entry(caller).read()
                    || caller == self.owner.read(),
                'Not authorized'
            );
        }

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Reputation is paused');
        }

        fn calculate_level(self: @ContractState, points: u64) -> u8 {
            if points >= LEVEL_5_THRESHOLD {
                5
            } else if points >= LEVEL_4_THRESHOLD {
                4
            } else if points >= LEVEL_3_THRESHOLD {
                3
            } else if points >= LEVEL_2_THRESHOLD {
                2
            } else {
                1
            }
        }

        fn check_and_award_badges(ref self: ContractState, user: ContractAddress) {
            let mut rep = self.reputations.entry(user).read();
            let old_badges = rep.badges;
            let now = get_block_timestamp();

            // First Post badge
            if rep.post_count >= 1 && (rep.badges & BADGE_FIRST_POST) == 0 {
                rep.badges = rep.badges | BADGE_FIRST_POST;
                self.emit(BadgeEarned { user, badge: BADGE_FIRST_POST, timestamp: now });
            }

            // Prolific Writer (10+ posts)
            if rep.post_count >= 10 && (rep.badges & BADGE_PROLIFIC_WRITER) == 0 {
                rep.badges = rep.badges | BADGE_PROLIFIC_WRITER;
                self.emit(BadgeEarned { user, badge: BADGE_PROLIFIC_WRITER, timestamp: now });
            }

            // Century Club (100+ posts)
            if rep.post_count >= 100 && (rep.badges & BADGE_CENTURY_CLUB) == 0 {
                rep.badges = rep.badges | BADGE_CENTURY_CLUB;
                self.emit(BadgeEarned { user, badge: BADGE_CENTURY_CLUB, timestamp: now });
            }

            // Featured Author
            if rep.featured_count >= 1 && (rep.badges & BADGE_FEATURED_AUTHOR) == 0 {
                rep.badges = rep.badges | BADGE_FEATURED_AUTHOR;
                self.emit(BadgeEarned { user, badge: BADGE_FEATURED_AUTHOR, timestamp: now });
            }

            // Conversationalist (100+ comments)
            if rep.comment_count >= 100 && (rep.badges & BADGE_CONVERSATIONALIST) == 0 {
                rep.badges = rep.badges | BADGE_CONVERSATIONALIST;
                self.emit(BadgeEarned { user, badge: BADGE_CONVERSATIONALIST, timestamp: now });
            }

            // Beloved (1000+ likes)
            if rep.likes_received >= 1000 && (rep.badges & BADGE_BELOVED) == 0 {
                rep.badges = rep.badges | BADGE_BELOVED;
                self.emit(BadgeEarned { user, badge: BADGE_BELOVED, timestamp: now });
            }

            // Early Adopter
            let launch = self.launch_timestamp.read();
            let window = self.early_adopter_window.read();
            if rep.joined_at <= launch + window && (rep.badges & BADGE_EARLY_ADOPTER) == 0 {
                rep.badges = rep.badges | BADGE_EARLY_ADOPTER;
                self.emit(BadgeEarned { user, badge: BADGE_EARLY_ADOPTER, timestamp: now });
            }

            // Premium Author (has subscribers)
            if rep.subscribers >= 1 && (rep.badges & BADGE_PREMIUM_AUTHOR) == 0 {
                rep.badges = rep.badges | BADGE_PREMIUM_AUTHOR;
                self.emit(BadgeEarned { user, badge: BADGE_PREMIUM_AUTHOR, timestamp: now });
            }

            if rep.badges != old_badges {
                self.reputations.entry(user).write(rep);
            }
        }

        fn record_action(
            ref self: ContractState,
            user: ContractAddress,
            action_type: u8,
            points: u64,
            is_penalty: bool,
        ) {
            let action_id = self.action_count.read() + 1;
            let action = ReputationAction {
                id: action_id,
                user,
                action_type,
                points,
                is_penalty,
                timestamp: get_block_timestamp(),
            };
            self.actions.entry(action_id).write(action);
            self.action_count.write(action_id);

            let user_count = self.user_action_count.entry(user).read();
            self.user_action_count.entry(user).write(user_count + 1);
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl ReputationImpl of super::IReputation<ContractState> {
        // ========================================================================
        // USER REGISTRATION
        // ========================================================================

        fn register_user(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let existing = self.reputations.entry(user).read();
            if existing.joined_at > 0 {
                return;  // Already registered
            }

            let now = get_block_timestamp();
            let reputation = UserReputation {
                user,
                total_points: 0,
                level: 1,
                badges: 0,
                joined_at: now,
                post_count: 0,
                comment_count: 0,
                likes_received: 0,
                subscribers: 0,
                featured_count: 0,
            };
            self.reputations.entry(user).write(reputation);
            self.total_users.write(self.total_users.read() + 1);

            // Check for early adopter badge
            self.check_and_award_badges(user);

            self.emit(UserRegistered { user, timestamp: now });
        }

        // ========================================================================
        // POINT AWARDS
        // ========================================================================

        fn award_post_published(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let mut rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;  // Not registered
            }

            let old_level = rep.level;
            rep.total_points = rep.total_points + REP_POST_PUBLISHED;
            rep.post_count = rep.post_count + 1;
            rep.level = self.calculate_level(rep.total_points);
            self.reputations.entry(user).write(rep.clone());

            self.record_action(user, ACTION_POST, REP_POST_PUBLISHED, false);
            self.total_points_distributed.write(
                self.total_points_distributed.read() + REP_POST_PUBLISHED
            );

            self.emit(PointsAwarded {
                user,
                points: REP_POST_PUBLISHED,
                action_type: ACTION_POST,
                new_total: rep.total_points,
                timestamp: get_block_timestamp(),
            });

            if rep.level > old_level {
                self.emit(LevelUp {
                    user,
                    old_level,
                    new_level: rep.level,
                    timestamp: get_block_timestamp(),
                });
            }

            self.check_and_award_badges(user);
        }

        fn award_post_featured(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let mut rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            let old_level = rep.level;
            rep.total_points = rep.total_points + REP_POST_FEATURED;
            rep.featured_count = rep.featured_count + 1;
            rep.level = self.calculate_level(rep.total_points);
            self.reputations.entry(user).write(rep.clone());

            self.record_action(user, ACTION_FEATURED, REP_POST_FEATURED, false);
            self.total_points_distributed.write(
                self.total_points_distributed.read() + REP_POST_FEATURED
            );

            self.emit(PointsAwarded {
                user,
                points: REP_POST_FEATURED,
                action_type: ACTION_FEATURED,
                new_total: rep.total_points,
                timestamp: get_block_timestamp(),
            });

            if rep.level > old_level {
                self.emit(LevelUp {
                    user,
                    old_level,
                    new_level: rep.level,
                    timestamp: get_block_timestamp(),
                });
            }

            self.check_and_award_badges(user);
        }

        fn award_comment(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let mut rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            let old_level = rep.level;
            rep.total_points = rep.total_points + REP_COMMENT;
            rep.comment_count = rep.comment_count + 1;
            rep.level = self.calculate_level(rep.total_points);
            self.reputations.entry(user).write(rep.clone());

            self.record_action(user, ACTION_COMMENT, REP_COMMENT, false);

            self.emit(PointsAwarded {
                user,
                points: REP_COMMENT,
                action_type: ACTION_COMMENT,
                new_total: rep.total_points,
                timestamp: get_block_timestamp(),
            });

            if rep.level > old_level {
                self.emit(LevelUp {
                    user,
                    old_level,
                    new_level: rep.level,
                    timestamp: get_block_timestamp(),
                });
            }

            self.check_and_award_badges(user);
        }

        fn award_like_received(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let mut rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            rep.total_points = rep.total_points + REP_LIKE_RECEIVED;
            rep.likes_received = rep.likes_received + 1;
            rep.level = self.calculate_level(rep.total_points);
            self.reputations.entry(user).write(rep.clone());

            self.emit(PointsAwarded {
                user,
                points: REP_LIKE_RECEIVED,
                action_type: ACTION_LIKE_RECEIVED,
                new_total: rep.total_points,
                timestamp: get_block_timestamp(),
            });

            self.check_and_award_badges(user);
        }

        fn award_subscriber_gained(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let mut rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            rep.total_points = rep.total_points + REP_SUBSCRIBER_GAINED;
            rep.subscribers = rep.subscribers + 1;
            rep.level = self.calculate_level(rep.total_points);
            self.reputations.entry(user).write(rep.clone());

            self.emit(PointsAwarded {
                user,
                points: REP_SUBSCRIBER_GAINED,
                action_type: ACTION_SUBSCRIBER,
                new_total: rep.total_points,
                timestamp: get_block_timestamp(),
            });

            self.check_and_award_badges(user);
        }

        // ========================================================================
        // PENALTIES
        // ========================================================================

        fn apply_spam_penalty(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            self.assert_authorized();

            let mut rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            let old_level = rep.level;

            // Don't go below 0
            if rep.total_points >= REP_SPAM_PENALTY {
                rep.total_points = rep.total_points - REP_SPAM_PENALTY;
            } else {
                rep.total_points = 0;
            }
            rep.level = self.calculate_level(rep.total_points);
            self.reputations.entry(user).write(rep.clone());

            self.record_action(user, ACTION_PENALTY, REP_SPAM_PENALTY, true);

            self.emit(PointsDeducted {
                user,
                points: REP_SPAM_PENALTY,
                reason: 'Spam violation',
                new_total: rep.total_points,
                timestamp: get_block_timestamp(),
            });

            if rep.level < old_level {
                self.emit(LevelUp {
                    user,
                    old_level,
                    new_level: rep.level,
                    timestamp: get_block_timestamp(),
                });
            }
        }

        // ========================================================================
        // BADGE MANAGEMENT
        // ========================================================================

        fn award_badge(ref self: ContractState, user: ContractAddress, badge: u256) {
            self.assert_only_admin();

            let rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            let current_badges = rep.badges;
            if (current_badges & badge) != 0 {
                // Already has badge
                return;
            }

            // Award the badge
            let new_rep = UserReputation {
                user: rep.user,
                total_points: rep.total_points,
                level: rep.level,
                badges: current_badges | badge,
                joined_at: rep.joined_at,
                post_count: rep.post_count,
                comment_count: rep.comment_count,
                likes_received: rep.likes_received,
                subscribers: rep.subscribers,
                featured_count: rep.featured_count,
            };
            self.reputations.entry(user).write(new_rep);

            self.emit(BadgeEarned {
                user,
                badge,
                timestamp: get_block_timestamp(),
            });
        }

        fn revoke_badge(ref self: ContractState, user: ContractAddress, badge: u256) {
            self.assert_only_admin();

            let rep = self.reputations.entry(user).read();
            if rep.joined_at == 0 {
                return;
            }

            let current_badges = rep.badges;
            if (current_badges & badge) == 0 {
                // Doesn't have badge
                return;
            }

            // Revoke the badge
            let new_rep = UserReputation {
                user: rep.user,
                total_points: rep.total_points,
                level: rep.level,
                badges: current_badges & ~badge,
                joined_at: rep.joined_at,
                post_count: rep.post_count,
                comment_count: rep.comment_count,
                likes_received: rep.likes_received,
                subscribers: rep.subscribers,
                featured_count: rep.featured_count,
            };
            self.reputations.entry(user).write(new_rep);
        }

        fn has_badge(self: @ContractState, user: ContractAddress, badge: u256) -> bool {
            let rep = self.reputations.entry(user).read();
            (rep.badges & badge) != 0
        }

        // ========================================================================
        // VIEW FUNCTIONS
        // ========================================================================

        fn get_reputation(self: @ContractState, user: ContractAddress) -> UserReputation {
            self.reputations.entry(user).read()
        }

        fn get_level(self: @ContractState, user: ContractAddress) -> u8 {
            self.reputations.entry(user).read().level
        }

        fn get_points(self: @ContractState, user: ContractAddress) -> u64 {
            self.reputations.entry(user).read().total_points
        }

        fn get_badges(self: @ContractState, user: ContractAddress) -> u256 {
            self.reputations.entry(user).read().badges
        }

        fn get_total_users(self: @ContractState) -> u64 {
            self.total_users.read()
        }

        fn get_total_points_distributed(self: @ContractState) -> u64 {
            self.total_points_distributed.read()
        }

        fn get_action(self: @ContractState, action_id: u64) -> ReputationAction {
            self.actions.entry(action_id).read()
        }

        fn get_action_count(self: @ContractState) -> u64 {
            self.action_count.read()
        }

        // ========================================================================
        // ADMIN FUNCTIONS
        // ========================================================================

        fn authorize_contract(ref self: ContractState, contract_address: ContractAddress) {
            self.assert_only_admin();
            assert(!contract_address.is_zero(), 'Invalid contract');
            self.authorized_contracts.entry(contract_address).write(true);
            self.emit(ContractAuthorized { contract_address });
        }

        fn deauthorize_contract(ref self: ContractState, contract_address: ContractAddress) {
            self.assert_only_admin();
            self.authorized_contracts.entry(contract_address).write(false);
        }

        fn is_authorized(self: @ContractState, contract_address: ContractAddress) -> bool {
            self.authorized_contracts.entry(contract_address).read()
        }

        fn add_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_owner();
            assert(!admin.is_zero(), 'Invalid admin');
            self.admins.entry(admin).write(true);
        }

        fn remove_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_owner();
            assert(admin != self.owner.read(), 'Cannot remove owner');
            self.admins.entry(admin).write(false);
        }

        fn is_admin(self: @ContractState, account: ContractAddress) -> bool {
            account == self.owner.read() || self.admins.entry(account).read()
        }

        fn set_early_adopter_window(ref self: ContractState, window_seconds: u64) {
            self.assert_only_owner();
            self.early_adopter_window.write(window_seconds);
        }

        // ========================================================================
        // EMERGENCY CONTROLS
        // ========================================================================

        fn pause(ref self: ContractState) {
            self.assert_only_admin();
            self.paused.write(true);
            self.emit(Paused { timestamp: get_block_timestamp() });
        }

        fn unpause(ref self: ContractState) {
            self.assert_only_owner();
            self.paused.write(false);
            self.emit(Unpaused { timestamp: get_block_timestamp() });
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn transfer_ownership(ref self: ContractState, new_owner: ContractAddress) {
            self.assert_only_owner();
            assert(!new_owner.is_zero(), 'Invalid new owner');

            let previous_owner = self.owner.read();
            self.owner.write(new_owner);
            self.admins.entry(new_owner).write(true);

            self.emit(OwnershipTransferred { previous_owner, new_owner });
        }
    }
}

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

#[starknet::interface]
pub trait IReputation<TContractState> {
    // User registration
    fn register_user(ref self: TContractState, user: ContractAddress);

    // Point awards
    fn award_post_published(ref self: TContractState, user: ContractAddress);
    fn award_post_featured(ref self: TContractState, user: ContractAddress);
    fn award_comment(ref self: TContractState, user: ContractAddress);
    fn award_like_received(ref self: TContractState, user: ContractAddress);
    fn award_subscriber_gained(ref self: TContractState, user: ContractAddress);

    // Penalties
    fn apply_spam_penalty(ref self: TContractState, user: ContractAddress);

    // Badge management
    fn award_badge(ref self: TContractState, user: ContractAddress, badge: u256);
    fn revoke_badge(ref self: TContractState, user: ContractAddress, badge: u256);
    fn has_badge(self: @TContractState, user: ContractAddress, badge: u256) -> bool;

    // View functions
    fn get_reputation(self: @TContractState, user: ContractAddress) -> UserReputation;
    fn get_level(self: @TContractState, user: ContractAddress) -> u8;
    fn get_points(self: @TContractState, user: ContractAddress) -> u64;
    fn get_badges(self: @TContractState, user: ContractAddress) -> u256;
    fn get_total_users(self: @TContractState) -> u64;
    fn get_total_points_distributed(self: @TContractState) -> u64;
    fn get_action(self: @TContractState, action_id: u64) -> ReputationAction;
    fn get_action_count(self: @TContractState) -> u64;

    // Admin functions
    fn authorize_contract(ref self: TContractState, contract_address: ContractAddress);
    fn deauthorize_contract(ref self: TContractState, contract_address: ContractAddress);
    fn is_authorized(self: @TContractState, contract_address: ContractAddress) -> bool;
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;
    fn set_early_adopter_window(ref self: TContractState, window_seconds: u64);

    // Emergency controls
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}
