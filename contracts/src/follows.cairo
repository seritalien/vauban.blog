// SPDX-License-Identifier: MIT
// Vauban Blog - Follows Smart Contract
// Manages follow/unfollow relationships between users

#[starknet::contract]
mod Follows {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    // ============================================================================
    // STORAGE
    // ============================================================================

    #[storage]
    struct Storage {
        // Access Control
        owner: ContractAddress,

        // Follow relationships: (follower, followed) -> is_following
        follows: Map<(ContractAddress, ContractAddress), bool>,

        // Follower counts
        follower_count: Map<ContractAddress, u64>,   // user -> number of followers
        following_count: Map<ContractAddress, u64>,  // user -> number of users they follow

        // Indexed lists for pagination (stored as arrays via maps)
        // followers_of[user][index] = follower_address
        followers_of: Map<(ContractAddress, u64), ContractAddress>,
        // following_of[user][index] = followed_address
        following_of: Map<(ContractAddress, u64), ContractAddress>,

        // Reverse index for removal: (user, other) -> index in list
        follower_index: Map<(ContractAddress, ContractAddress), u64>,
        following_index: Map<(ContractAddress, ContractAddress), u64>,

        // Security
        paused: bool,
        reentrancy_guard: bool,

        // Rate limiting
        last_follow_time: Map<ContractAddress, u64>,
        follow_cooldown: u64,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        Followed: Followed,
        Unfollowed: Unfollowed,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct Followed {
        #[key]
        follower: ContractAddress,
        #[key]
        followed: ContractAddress,
        follower_total_following: u64,
        followed_total_followers: u64,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct Unfollowed {
        #[key]
        follower: ContractAddress,
        #[key]
        followed: ContractAddress,
        follower_total_following: u64,
        followed_total_followers: u64,
        timestamp: u64,
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

    const DEFAULT_FOLLOW_COOLDOWN: u64 = 1; // 1 second between follows
    const MAX_QUERY_LIMIT: u64 = 100; // Max users per query (DOS protection)

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(owner.is_non_zero(), 'Owner cannot be zero');

        self.owner.write(owner);
        self.follow_cooldown.write(DEFAULT_FOLLOW_COOLDOWN);
        self.paused.write(false);
        self.reentrancy_guard.write(false);
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

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract is paused');
        }

        fn assert_no_reentrancy(ref self: ContractState) {
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);
        }

        fn clear_reentrancy(ref self: ContractState) {
            self.reentrancy_guard.write(false);
        }

        fn check_follow_cooldown(self: @ContractState, user: ContractAddress) {
            let last_follow = self.last_follow_time.entry(user).read();
            let current_time = get_block_timestamp();
            let cooldown = self.follow_cooldown.read();

            if last_follow > 0 {
                assert(
                    current_time >= last_follow + cooldown,
                    'Follow cooldown active'
                );
            }
        }

        // Add follower to the followed user's follower list
        fn add_to_followers_list(
            ref self: ContractState,
            followed: ContractAddress,
            follower: ContractAddress
        ) {
            let current_count = self.follower_count.entry(followed).read();
            // Store at index = current_count (0-indexed)
            self.followers_of.entry((followed, current_count)).write(follower);
            // Store reverse index for removal
            self.follower_index.entry((followed, follower)).write(current_count);
        }

        // Add followed to the follower's following list
        fn add_to_following_list(
            ref self: ContractState,
            follower: ContractAddress,
            followed: ContractAddress
        ) {
            let current_count = self.following_count.entry(follower).read();
            // Store at index = current_count (0-indexed)
            self.following_of.entry((follower, current_count)).write(followed);
            // Store reverse index for removal
            self.following_index.entry((follower, followed)).write(current_count);
        }

        // Remove from followers list (swap with last element)
        fn remove_from_followers_list(
            ref self: ContractState,
            followed: ContractAddress,
            follower: ContractAddress
        ) {
            let index_to_remove = self.follower_index.entry((followed, follower)).read();
            let last_index = self.follower_count.entry(followed).read() - 1;

            if index_to_remove != last_index {
                // Swap with last element
                let last_follower = self.followers_of.entry((followed, last_index)).read();
                self.followers_of.entry((followed, index_to_remove)).write(last_follower);
                self.follower_index.entry((followed, last_follower)).write(index_to_remove);
            }

            // Clear the last slot
            self.followers_of.entry((followed, last_index)).write(Zero::zero());
            self.follower_index.entry((followed, follower)).write(0);
        }

        // Remove from following list (swap with last element)
        fn remove_from_following_list(
            ref self: ContractState,
            follower: ContractAddress,
            followed: ContractAddress
        ) {
            let index_to_remove = self.following_index.entry((follower, followed)).read();
            let last_index = self.following_count.entry(follower).read() - 1;

            if index_to_remove != last_index {
                // Swap with last element
                let last_followed = self.following_of.entry((follower, last_index)).read();
                self.following_of.entry((follower, index_to_remove)).write(last_followed);
                self.following_index.entry((follower, last_followed)).write(index_to_remove);
            }

            // Clear the last slot
            self.following_of.entry((follower, last_index)).write(Zero::zero());
            self.following_index.entry((follower, followed)).write(0);
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl FollowsImpl of super::IFollows<ContractState> {
        // ========================================================================
        // USER FUNCTIONS
        // ========================================================================

        fn follow(ref self: ContractState, user_to_follow: ContractAddress) -> bool {
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();

            // Validations
            assert(user_to_follow.is_non_zero(), 'Cannot follow zero address');
            assert(caller != user_to_follow, 'Cannot follow yourself');
            assert(
                !self.follows.entry((caller, user_to_follow)).read(),
                'Already following'
            );

            // Rate limiting
            self.check_follow_cooldown(caller);

            let now = get_block_timestamp();

            // Update follow relationship
            self.follows.entry((caller, user_to_follow)).write(true);

            // Add to indexed lists
            self.add_to_followers_list(user_to_follow, caller);
            self.add_to_following_list(caller, user_to_follow);

            // Update counts
            let new_follower_count = self.follower_count.entry(user_to_follow).read() + 1;
            let new_following_count = self.following_count.entry(caller).read() + 1;
            self.follower_count.entry(user_to_follow).write(new_follower_count);
            self.following_count.entry(caller).write(new_following_count);

            // Update rate limiting
            self.last_follow_time.entry(caller).write(now);

            // Emit event
            self.emit(Followed {
                follower: caller,
                followed: user_to_follow,
                follower_total_following: new_following_count,
                followed_total_followers: new_follower_count,
                timestamp: now,
            });

            self.clear_reentrancy();
            true
        }

        fn unfollow(ref self: ContractState, user_to_unfollow: ContractAddress) -> bool {
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();

            // Validations
            assert(user_to_unfollow.is_non_zero(), 'Cannot unfollow zero address');
            assert(
                self.follows.entry((caller, user_to_unfollow)).read(),
                'Not following this user'
            );

            let now = get_block_timestamp();

            // Remove from indexed lists BEFORE updating counts
            self.remove_from_followers_list(user_to_unfollow, caller);
            self.remove_from_following_list(caller, user_to_unfollow);

            // Update follow relationship
            self.follows.entry((caller, user_to_unfollow)).write(false);

            // Update counts
            let current_follower_count = self.follower_count.entry(user_to_unfollow).read();
            let current_following_count = self.following_count.entry(caller).read();

            let new_follower_count = if current_follower_count > 0 {
                current_follower_count - 1
            } else {
                0
            };
            let new_following_count = if current_following_count > 0 {
                current_following_count - 1
            } else {
                0
            };

            self.follower_count.entry(user_to_unfollow).write(new_follower_count);
            self.following_count.entry(caller).write(new_following_count);

            // Emit event
            self.emit(Unfollowed {
                follower: caller,
                followed: user_to_unfollow,
                follower_total_following: new_following_count,
                followed_total_followers: new_follower_count,
                timestamp: now,
            });

            self.clear_reentrancy();
            true
        }

        // ========================================================================
        // VIEW FUNCTIONS
        // ========================================================================

        fn is_following(
            self: @ContractState,
            follower: ContractAddress,
            followed: ContractAddress
        ) -> bool {
            self.follows.entry((follower, followed)).read()
        }

        fn get_follower_count(self: @ContractState, user: ContractAddress) -> u64 {
            self.follower_count.entry(user).read()
        }

        fn get_following_count(self: @ContractState, user: ContractAddress) -> u64 {
            self.following_count.entry(user).read()
        }

        fn get_followers(
            self: @ContractState,
            user: ContractAddress,
            limit: u64,
            offset: u64
        ) -> Array<ContractAddress> {
            assert(limit > 0 && limit <= MAX_QUERY_LIMIT, 'Invalid limit');

            let mut result: Array<ContractAddress> = ArrayTrait::new();
            let total_count = self.follower_count.entry(user).read();

            if total_count == 0 || offset >= total_count {
                return result;
            }

            let mut i = offset;
            let end = if offset + limit > total_count {
                total_count
            } else {
                offset + limit
            };

            loop {
                if i >= end {
                    break;
                }

                let follower = self.followers_of.entry((user, i)).read();
                if follower.is_non_zero() {
                    result.append(follower);
                }
                i += 1;
            };

            result
        }

        fn get_following(
            self: @ContractState,
            user: ContractAddress,
            limit: u64,
            offset: u64
        ) -> Array<ContractAddress> {
            assert(limit > 0 && limit <= MAX_QUERY_LIMIT, 'Invalid limit');

            let mut result: Array<ContractAddress> = ArrayTrait::new();
            let total_count = self.following_count.entry(user).read();

            if total_count == 0 || offset >= total_count {
                return result;
            }

            let mut i = offset;
            let end = if offset + limit > total_count {
                total_count
            } else {
                offset + limit
            };

            loop {
                if i >= end {
                    break;
                }

                let followed = self.following_of.entry((user, i)).read();
                if followed.is_non_zero() {
                    result.append(followed);
                }
                i += 1;
            };

            result
        }

        // ========================================================================
        // ADMIN FUNCTIONS
        // ========================================================================

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

        fn set_follow_cooldown(ref self: ContractState, cooldown_seconds: u64) {
            self.assert_only_owner();
            assert(cooldown_seconds <= 3600, 'Cooldown too long'); // Max 1h

            self.follow_cooldown.write(cooldown_seconds);
        }

        fn get_follow_cooldown(self: @ContractState) -> u64 {
            self.follow_cooldown.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

use starknet::ContractAddress;

#[starknet::interface]
trait IFollows<TContractState> {
    // User functions
    fn follow(ref self: TContractState, user_to_follow: ContractAddress) -> bool;
    fn unfollow(ref self: TContractState, user_to_unfollow: ContractAddress) -> bool;

    // View functions
    fn is_following(
        self: @TContractState,
        follower: ContractAddress,
        followed: ContractAddress
    ) -> bool;
    fn get_follower_count(self: @TContractState, user: ContractAddress) -> u64;
    fn get_following_count(self: @TContractState, user: ContractAddress) -> u64;
    fn get_followers(
        self: @TContractState,
        user: ContractAddress,
        limit: u64,
        offset: u64
    ) -> Array<ContractAddress>;
    fn get_following(
        self: @TContractState,
        user: ContractAddress,
        limit: u64,
        offset: u64
    ) -> Array<ContractAddress>;

    // Admin functions
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn set_follow_cooldown(ref self: TContractState, cooldown_seconds: u64);
    fn get_follow_cooldown(self: @TContractState) -> u64;
    fn get_owner(self: @TContractState) -> ContractAddress;
}
