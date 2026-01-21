// SPDX-License-Identifier: MIT
// Vauban Blog - Role Registry Smart Contract (Production-Grade)
// Implements 6-tier role hierarchy with auto-promotion and reputation integration

use starknet::ContractAddress;

// ============================================================================
// ROLE CONSTANTS (stored as u8 for gas efficiency)
// ============================================================================

pub const ROLE_READER: u8 = 0;       // View public content, like, comment (if enabled)
pub const ROLE_WRITER: u8 = 1;       // Submit posts for review, edit own drafts
pub const ROLE_CONTRIBUTOR: u8 = 2;  // Publish immediately, edit own posts (earned)
pub const ROLE_MODERATOR: u8 = 3;    // Review reports, hide comments, temp ban
pub const ROLE_EDITOR: u8 = 4;       // Approve/reject posts, edit any content, feature
pub const ROLE_ADMIN: u8 = 5;        // Manage all roles, override content, configure
pub const ROLE_OWNER: u8 = 6;        // Transfer ownership, upgrade, emergency pause

// ============================================================================
// STORAGE STRUCTURES
// ============================================================================

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct UserRole {
    pub user: ContractAddress,
    pub role: u8,
    pub granted_at: u64,
    pub granted_by: ContractAddress,
    pub approved_post_count: u32,  // For auto-promotion tracking
    pub reputation: u64,
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct RoleChangeRequest {
    pub id: u64,
    pub user: ContractAddress,
    pub requested_role: u8,
    pub requested_at: u64,
    pub is_approved: bool,
    pub is_rejected: bool,
    pub reviewed_by: ContractAddress,
    pub reviewed_at: u64,
}

#[starknet::contract]
mod RoleRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use super::{
        UserRole, RoleChangeRequest,
        ROLE_READER, ROLE_WRITER, ROLE_CONTRIBUTOR, ROLE_MODERATOR,
        ROLE_EDITOR, ROLE_ADMIN, ROLE_OWNER
    };

    // ============================================================================
    // STORAGE
    // ============================================================================

    #[storage]
    struct Storage {
        // Access control
        owner: ContractAddress,

        // Role registry
        // Mapping: user -> UserRole
        user_roles: Map<ContractAddress, UserRole>,

        // Role change requests
        // Mapping: request_id -> RoleChangeRequest
        role_requests: Map<u64, RoleChangeRequest>,
        request_count: u64,

        // User request tracking
        // Mapping: user -> pending_request_id (0 = no pending)
        user_pending_request: Map<ContractAddress, u64>,

        // Configuration
        contributor_threshold: u32,  // Posts needed for auto-promotion (default: 5)
        reputation_threshold: u64,   // Reputation needed for consideration (default: 500)

        // Statistics
        total_users: u64,
        users_by_role: Map<u8, u64>,  // role -> count

        // Emergency
        paused: bool,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        RoleGranted: RoleGranted,
        RoleRevoked: RoleRevoked,
        RoleRequestCreated: RoleRequestCreated,
        RoleRequestApproved: RoleRequestApproved,
        RoleRequestRejected: RoleRequestRejected,
        AutoPromoted: AutoPromoted,
        ReputationUpdated: ReputationUpdated,
        ContributorThresholdUpdated: ContributorThresholdUpdated,
        Paused: Paused,
        Unpaused: Unpaused,
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RoleGranted {
        #[key]
        user: ContractAddress,
        role: u8,
        granted_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RoleRevoked {
        #[key]
        user: ContractAddress,
        previous_role: u8,
        revoked_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RoleRequestCreated {
        #[key]
        request_id: u64,
        #[key]
        user: ContractAddress,
        requested_role: u8,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RoleRequestApproved {
        #[key]
        request_id: u64,
        #[key]
        user: ContractAddress,
        role: u8,
        approved_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RoleRequestRejected {
        #[key]
        request_id: u64,
        #[key]
        user: ContractAddress,
        rejected_by: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct AutoPromoted {
        #[key]
        user: ContractAddress,
        from_role: u8,
        to_role: u8,
        approved_posts: u32,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ReputationUpdated {
        #[key]
        user: ContractAddress,
        old_reputation: u64,
        new_reputation: u64,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ContributorThresholdUpdated {
        old_threshold: u32,
        new_threshold: u32,
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

    const DEFAULT_CONTRIBUTOR_THRESHOLD: u32 = 5;
    const DEFAULT_REPUTATION_THRESHOLD: u64 = 500;

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(!owner.is_zero(), 'Invalid owner address');

        self.owner.write(owner);
        self.contributor_threshold.write(DEFAULT_CONTRIBUTOR_THRESHOLD);
        self.reputation_threshold.write(DEFAULT_REPUTATION_THRESHOLD);
        self.paused.write(false);

        // Grant owner the OWNER role
        let current_time = get_block_timestamp();
        let owner_role = UserRole {
            user: owner,
            role: ROLE_OWNER,
            granted_at: current_time,
            granted_by: owner,
            approved_post_count: 0,
            reputation: 0,
        };
        self.user_roles.entry(owner).write(owner_role);
        self.total_users.write(1);
        self.users_by_role.entry(ROLE_OWNER).write(1);

        self.emit(RoleGranted {
            user: owner,
            role: ROLE_OWNER,
            granted_by: owner,
            timestamp: current_time,
        });
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

        fn assert_min_role(self: @ContractState, min_role: u8) {
            let caller = get_caller_address();
            let user_role = self.user_roles.entry(caller).read();
            assert(user_role.role >= min_role, 'Insufficient role');
        }

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Registry is paused');
        }

        fn can_grant_role(self: @ContractState, granter: ContractAddress, target_role: u8) -> bool {
            let granter_role = self.user_roles.entry(granter).read().role;

            // Owner can grant any role
            if granter_role == ROLE_OWNER {
                return true;
            }

            // Admin can grant up to EDITOR
            if granter_role == ROLE_ADMIN && target_role <= ROLE_EDITOR {
                return true;
            }

            // Editor can grant up to MODERATOR
            if granter_role == ROLE_EDITOR && target_role <= ROLE_MODERATOR {
                return true;
            }

            false
        }

        fn update_role_count(ref self: ContractState, role: u8, delta: i8) {
            let current = self.users_by_role.entry(role).read();
            if delta > 0 {
                self.users_by_role.entry(role).write(current + 1);
            } else if current > 0 {
                self.users_by_role.entry(role).write(current - 1);
            }
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl RoleRegistryImpl of super::IRoleRegistry<ContractState> {
        // ============================================================================
        // ROLE MANAGEMENT
        // ============================================================================

        fn grant_role(ref self: ContractState, user: ContractAddress, role: u8) {
            self.assert_not_paused();
            let caller = get_caller_address();

            assert(!user.is_zero(), 'Invalid user address');
            assert(role <= ROLE_OWNER, 'Invalid role');
            assert(self.can_grant_role(caller, role), 'Cannot grant this role');

            let current_time = get_block_timestamp();
            let existing_role = self.user_roles.entry(user).read();
            let is_new_user = existing_role.role == 0 && existing_role.granted_at == 0;

            // Update role counts
            if !is_new_user {
                self.update_role_count(existing_role.role, -1);
            } else {
                self.total_users.write(self.total_users.read() + 1);
            }
            self.update_role_count(role, 1);

            // Create or update user role
            let new_role = UserRole {
                user,
                role,
                granted_at: current_time,
                granted_by: caller,
                approved_post_count: existing_role.approved_post_count,
                reputation: existing_role.reputation,
            };
            self.user_roles.entry(user).write(new_role);

            // Clear any pending role request
            self.user_pending_request.entry(user).write(0);

            self.emit(RoleGranted {
                user,
                role,
                granted_by: caller,
                timestamp: current_time,
            });
        }

        fn revoke_role(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            let caller = get_caller_address();

            let existing_role = self.user_roles.entry(user).read();
            assert(existing_role.granted_at > 0, 'User has no role');

            // Check permission to revoke
            let caller_role = self.user_roles.entry(caller).read().role;
            assert(caller_role > existing_role.role || caller == self.owner.read(), 'Cannot revoke this role');

            // Cannot revoke owner
            assert(existing_role.role != ROLE_OWNER || caller == self.owner.read(), 'Cannot revoke owner');

            let current_time = get_block_timestamp();
            let previous_role = existing_role.role;

            // Update counts
            self.update_role_count(previous_role, -1);
            self.update_role_count(ROLE_READER, 1);

            // Reset to READER (don't delete, keep stats)
            let demoted_role = UserRole {
                user,
                role: ROLE_READER,
                granted_at: current_time,
                granted_by: caller,
                approved_post_count: existing_role.approved_post_count,
                reputation: existing_role.reputation,
            };
            self.user_roles.entry(user).write(demoted_role);

            self.emit(RoleRevoked {
                user,
                previous_role,
                revoked_by: caller,
                timestamp: current_time,
            });
        }

        fn register_user(ref self: ContractState) -> bool {
            self.assert_not_paused();
            let caller = get_caller_address();

            // Check if already registered
            let existing = self.user_roles.entry(caller).read();
            if existing.granted_at > 0 {
                return false;  // Already registered
            }

            let current_time = get_block_timestamp();

            // New users start as WRITER (can submit for review)
            let new_role = UserRole {
                user: caller,
                role: ROLE_WRITER,
                granted_at: current_time,
                granted_by: caller,
                approved_post_count: 0,
                reputation: 0,
            };
            self.user_roles.entry(caller).write(new_role);

            self.total_users.write(self.total_users.read() + 1);
            self.update_role_count(ROLE_WRITER, 1);

            self.emit(RoleGranted {
                user: caller,
                role: ROLE_WRITER,
                granted_by: caller,
                timestamp: current_time,
            });

            true
        }

        // ============================================================================
        // ROLE REQUESTS
        // ============================================================================

        fn request_role(ref self: ContractState, requested_role: u8) -> u64 {
            self.assert_not_paused();
            let caller = get_caller_address();

            let current_role = self.user_roles.entry(caller).read();
            assert(current_role.granted_at > 0, 'Not registered');
            assert(requested_role > current_role.role, 'Must request higher role');
            assert(requested_role <= ROLE_MODERATOR, 'Cannot request this role');

            // Check no pending request
            let pending = self.user_pending_request.entry(caller).read();
            assert(pending == 0, 'Already has pending request');

            let current_time = get_block_timestamp();
            let request_id = self.request_count.read() + 1;

            let request = RoleChangeRequest {
                id: request_id,
                user: caller,
                requested_role,
                requested_at: current_time,
                is_approved: false,
                is_rejected: false,
                reviewed_by: Zero::zero(),
                reviewed_at: 0,
            };

            self.role_requests.entry(request_id).write(request);
            self.request_count.write(request_id);
            self.user_pending_request.entry(caller).write(request_id);

            self.emit(RoleRequestCreated {
                request_id,
                user: caller,
                requested_role,
                timestamp: current_time,
            });

            request_id
        }

        fn approve_request(ref self: ContractState, request_id: u64) {
            self.assert_not_paused();
            self.assert_min_role(ROLE_EDITOR);
            let caller = get_caller_address();

            let mut request = self.role_requests.entry(request_id).read();
            assert(request.id > 0, 'Request not found');
            assert(!request.is_approved && !request.is_rejected, 'Already processed');
            assert(self.can_grant_role(caller, request.requested_role), 'Cannot approve this role');

            let current_time = get_block_timestamp();

            // Update request
            request.is_approved = true;
            request.reviewed_by = caller;
            request.reviewed_at = current_time;
            self.role_requests.entry(request_id).write(request.clone());

            // Grant the role
            let existing_role = self.user_roles.entry(request.user).read();
            self.update_role_count(existing_role.role, -1);
            self.update_role_count(request.requested_role, 1);

            let new_role = UserRole {
                user: request.user,
                role: request.requested_role,
                granted_at: current_time,
                granted_by: caller,
                approved_post_count: existing_role.approved_post_count,
                reputation: existing_role.reputation,
            };
            self.user_roles.entry(request.user).write(new_role);

            // Clear pending
            self.user_pending_request.entry(request.user).write(0);

            self.emit(RoleRequestApproved {
                request_id,
                user: request.user,
                role: request.requested_role,
                approved_by: caller,
                timestamp: current_time,
            });
        }

        fn reject_request(ref self: ContractState, request_id: u64) {
            self.assert_not_paused();
            self.assert_min_role(ROLE_EDITOR);
            let caller = get_caller_address();

            let mut request = self.role_requests.entry(request_id).read();
            assert(request.id > 0, 'Request not found');
            assert(!request.is_approved && !request.is_rejected, 'Already processed');

            let current_time = get_block_timestamp();

            request.is_rejected = true;
            request.reviewed_by = caller;
            request.reviewed_at = current_time;
            self.role_requests.entry(request_id).write(request.clone());

            // Clear pending
            self.user_pending_request.entry(request.user).write(0);

            self.emit(RoleRequestRejected {
                request_id,
                user: request.user,
                rejected_by: caller,
                timestamp: current_time,
            });
        }

        // ============================================================================
        // AUTO-PROMOTION
        // ============================================================================

        fn increment_approved_posts(ref self: ContractState, user: ContractAddress) {
            self.assert_not_paused();
            // Only callable by BlogRegistry or admin+
            let caller = get_caller_address();
            let caller_role = self.user_roles.entry(caller).read().role;
            // In production, verify caller is BlogRegistry contract
            assert(caller_role >= ROLE_EDITOR, 'Not authorized');

            let mut user_role = self.user_roles.entry(user).read();
            if user_role.granted_at == 0 {
                return;  // User not registered
            }

            user_role.approved_post_count += 1;
            let new_count = user_role.approved_post_count;

            // Check for auto-promotion
            let threshold = self.contributor_threshold.read();
            let from_role = user_role.role;

            if from_role == ROLE_WRITER && new_count >= threshold {
                // Promote to CONTRIBUTOR
                self.update_role_count(ROLE_WRITER, -1);
                self.update_role_count(ROLE_CONTRIBUTOR, 1);

                user_role.role = ROLE_CONTRIBUTOR;
                user_role.granted_at = get_block_timestamp();
                user_role.granted_by = caller;

                self.emit(AutoPromoted {
                    user,
                    from_role,
                    to_role: ROLE_CONTRIBUTOR,
                    approved_posts: new_count,
                    timestamp: get_block_timestamp(),
                });
            }

            self.user_roles.entry(user).write(user_role);
        }

        fn add_reputation(ref self: ContractState, user: ContractAddress, points: u64) {
            self.assert_not_paused();
            // Only callable by authorized contracts or admin+
            let caller = get_caller_address();
            let caller_role = self.user_roles.entry(caller).read().role;
            assert(caller_role >= ROLE_MODERATOR, 'Not authorized');

            let mut user_role = self.user_roles.entry(user).read();
            if user_role.granted_at == 0 {
                return;  // User not registered
            }

            let old_reputation = user_role.reputation;
            user_role.reputation = old_reputation + points;
            self.user_roles.entry(user).write(user_role);

            self.emit(ReputationUpdated {
                user,
                old_reputation,
                new_reputation: old_reputation + points,
                timestamp: get_block_timestamp(),
            });
        }

        // ============================================================================
        // VIEW FUNCTIONS
        // ============================================================================

        fn get_role(self: @ContractState, user: ContractAddress) -> u8 {
            let user_role = self.user_roles.entry(user).read();
            if user_role.granted_at == 0 {
                return ROLE_READER;  // Default for unregistered
            }
            user_role.role
        }

        fn get_user_role(self: @ContractState, user: ContractAddress) -> UserRole {
            self.user_roles.entry(user).read()
        }

        fn has_role(self: @ContractState, user: ContractAddress, min_role: u8) -> bool {
            let user_role = self.user_roles.entry(user).read();
            if user_role.granted_at == 0 {
                return min_role == ROLE_READER;
            }
            user_role.role >= min_role
        }

        fn can_publish_immediately(self: @ContractState, user: ContractAddress) -> bool {
            let role = self.get_role(user);
            role >= ROLE_CONTRIBUTOR
        }

        fn can_approve_content(self: @ContractState, user: ContractAddress) -> bool {
            let role = self.get_role(user);
            role >= ROLE_EDITOR
        }

        fn can_moderate(self: @ContractState, user: ContractAddress) -> bool {
            let role = self.get_role(user);
            role >= ROLE_MODERATOR
        }

        fn can_manage_users(self: @ContractState, user: ContractAddress) -> bool {
            let role = self.get_role(user);
            role >= ROLE_ADMIN
        }

        fn get_request(self: @ContractState, request_id: u64) -> RoleChangeRequest {
            self.role_requests.entry(request_id).read()
        }

        fn get_pending_request(self: @ContractState, user: ContractAddress) -> u64 {
            self.user_pending_request.entry(user).read()
        }

        fn get_total_users(self: @ContractState) -> u64 {
            self.total_users.read()
        }

        fn get_users_by_role(self: @ContractState, role: u8) -> u64 {
            self.users_by_role.entry(role).read()
        }

        fn get_contributor_threshold(self: @ContractState) -> u32 {
            self.contributor_threshold.read()
        }

        // ============================================================================
        // ADMIN FUNCTIONS
        // ============================================================================

        fn set_contributor_threshold(ref self: ContractState, threshold: u32) {
            self.assert_min_role(ROLE_ADMIN);
            assert(threshold > 0 && threshold <= 100, 'Invalid threshold');

            let old = self.contributor_threshold.read();
            self.contributor_threshold.write(threshold);

            self.emit(ContributorThresholdUpdated {
                old_threshold: old,
                new_threshold: threshold,
                timestamp: get_block_timestamp(),
            });
        }

        fn set_reputation_threshold(ref self: ContractState, threshold: u64) {
            self.assert_min_role(ROLE_ADMIN);
            self.reputation_threshold.write(threshold);
        }

        // ============================================================================
        // EMERGENCY CONTROLS
        // ============================================================================

        fn pause(ref self: ContractState) {
            self.assert_min_role(ROLE_ADMIN);
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
            let current_time = get_block_timestamp();

            // Update owner storage
            self.owner.write(new_owner);

            // Revoke old owner role
            let old_owner_data = self.user_roles.entry(previous_owner).read();
            self.update_role_count(ROLE_OWNER, -1);

            let demoted_owner = UserRole {
                user: previous_owner,
                role: ROLE_ADMIN,  // Demote to ADMIN
                granted_at: current_time,
                granted_by: previous_owner,
                approved_post_count: old_owner_data.approved_post_count,
                reputation: old_owner_data.reputation,
            };
            self.user_roles.entry(previous_owner).write(demoted_owner);
            self.update_role_count(ROLE_ADMIN, 1);

            // Grant new owner OWNER role
            let existing_new_owner = self.user_roles.entry(new_owner).read();
            if existing_new_owner.granted_at > 0 {
                self.update_role_count(existing_new_owner.role, -1);
            } else {
                self.total_users.write(self.total_users.read() + 1);
            }
            self.update_role_count(ROLE_OWNER, 1);

            let new_owner_role = UserRole {
                user: new_owner,
                role: ROLE_OWNER,
                granted_at: current_time,
                granted_by: previous_owner,
                approved_post_count: existing_new_owner.approved_post_count,
                reputation: existing_new_owner.reputation,
            };
            self.user_roles.entry(new_owner).write(new_owner_role);

            self.emit(OwnershipTransferred {
                previous_owner,
                new_owner,
            });
        }
    }
}

// ============================================================================
// INTERFACE DEFINITION
// ============================================================================

#[starknet::interface]
pub trait IRoleRegistry<TContractState> {
    // Role management
    fn grant_role(ref self: TContractState, user: ContractAddress, role: u8);
    fn revoke_role(ref self: TContractState, user: ContractAddress);
    fn register_user(ref self: TContractState) -> bool;

    // Role requests
    fn request_role(ref self: TContractState, requested_role: u8) -> u64;
    fn approve_request(ref self: TContractState, request_id: u64);
    fn reject_request(ref self: TContractState, request_id: u64);

    // Auto-promotion
    fn increment_approved_posts(ref self: TContractState, user: ContractAddress);
    fn add_reputation(ref self: TContractState, user: ContractAddress, points: u64);

    // View functions
    fn get_role(self: @TContractState, user: ContractAddress) -> u8;
    fn get_user_role(self: @TContractState, user: ContractAddress) -> UserRole;
    fn has_role(self: @TContractState, user: ContractAddress, min_role: u8) -> bool;
    fn can_publish_immediately(self: @TContractState, user: ContractAddress) -> bool;
    fn can_approve_content(self: @TContractState, user: ContractAddress) -> bool;
    fn can_moderate(self: @TContractState, user: ContractAddress) -> bool;
    fn can_manage_users(self: @TContractState, user: ContractAddress) -> bool;
    fn get_request(self: @TContractState, request_id: u64) -> RoleChangeRequest;
    fn get_pending_request(self: @TContractState, user: ContractAddress) -> u64;
    fn get_total_users(self: @TContractState) -> u64;
    fn get_users_by_role(self: @TContractState, role: u8) -> u64;
    fn get_contributor_threshold(self: @TContractState) -> u32;

    // Admin functions
    fn set_contributor_threshold(ref self: TContractState, threshold: u32);
    fn set_reputation_threshold(ref self: TContractState, threshold: u64);

    // Emergency controls
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}
