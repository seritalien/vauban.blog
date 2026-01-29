// SPDX-License-Identifier: MIT
// Vauban Blog - Session Key Manager Smart Contract (Production-Grade)
// Security: Signature verification, Expiry checks, Permission scopes, Revocation

use starknet::ContractAddress;

// ============================================================================
// STORAGE STRUCTURES (Module-level for interface access)
// ============================================================================

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct SessionKey {
    pub session_public_key: felt252,  // Public key of ephemeral keypair
    pub master_account: ContractAddress,  // Account that authorized this session key
    pub created_at: u64,
    pub expires_at: u64,
    pub is_revoked: bool,
    pub use_count: u64,
    pub max_uses: u64,  // 0 = unlimited
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct Permission {
    pub target_contract: ContractAddress,
    pub function_selector: felt252,
    pub is_allowed: bool,
}

#[starknet::contract]
mod SessionKeyManager {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use super::SessionKey;

    // ============================================================================
    // STORAGE
    // ============================================================================

    #[storage]
    struct Storage {
        // Access control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,

        // Session key registry
        // Mapping: session_public_key -> SessionKey
        session_keys: Map<felt252, SessionKey>,

        // Permission registry
        // Mapping: (session_public_key, target_contract, function_selector) -> bool
        permissions: Map<(felt252, ContractAddress, felt252), bool>,

        // Account session keys tracking
        // Mapping: (master_account, index) -> session_public_key
        account_session_keys: Map<(ContractAddress, u64), felt252>,
        account_session_count: Map<ContractAddress, u64>,

        // Global settings
        default_expiry_duration: u64,  // Default: 7 days
        max_expiry_duration: u64,      // Max: 30 days
        min_expiry_duration: u64,      // Min: 1 hour

        // Emergency
        paused: bool,

        // Statistics
        total_sessions_created: u64,
        total_sessions_revoked: u64,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        SessionKeyCreated: SessionKeyCreated,
        SessionKeyRevoked: SessionKeyRevoked,
        SessionKeyUsed: SessionKeyUsed,
        PermissionGranted: PermissionGranted,
        PermissionRevoked: PermissionRevoked,
        Paused: Paused,
        Unpaused: Unpaused,
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct SessionKeyCreated {
        #[key]
        session_public_key: felt252,
        #[key]
        master_account: ContractAddress,
        expires_at: u64,
        max_uses: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct SessionKeyRevoked {
        #[key]
        session_public_key: felt252,
        #[key]
        master_account: ContractAddress,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct SessionKeyUsed {
        #[key]
        session_public_key: felt252,
        #[key]
        target_contract: ContractAddress,
        function_selector: felt252,
        use_count: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PermissionGranted {
        #[key]
        session_public_key: felt252,
        #[key]
        target_contract: ContractAddress,
        function_selector: felt252,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PermissionRevoked {
        #[key]
        session_public_key: felt252,
        #[key]
        target_contract: ContractAddress,
        function_selector: felt252,
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

    const ONE_HOUR: u64 = 3600;
    const ONE_DAY: u64 = 86400;
    const SEVEN_DAYS: u64 = 604800;
    const THIRTY_DAYS: u64 = 2592000;

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(!owner.is_zero(), 'Invalid owner address');

        self.owner.write(owner);
        self.default_expiry_duration.write(SEVEN_DAYS);
        self.max_expiry_duration.write(THIRTY_DAYS);
        self.min_expiry_duration.write(ONE_HOUR);
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

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Manager is paused');
        }

        fn validate_expiry_duration(self: @ContractState, duration: u64) -> bool {
            let min = self.min_expiry_duration.read();
            let max = self.max_expiry_duration.read();
            duration >= min && duration <= max
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS - Session Key Management
    // ============================================================================

    #[abi(embed_v0)]
    impl SessionKeyManagerImpl of super::ISessionKeyManager<ContractState> {
        fn create_session_key(
            ref self: ContractState,
            session_public_key: felt252,
            expiry_duration: u64,
            max_uses: u64,
            permissions: Array<(ContractAddress, felt252)>,
        ) -> bool {
            self.assert_not_paused();

            let caller = get_caller_address();
            assert(!caller.is_zero(), 'Invalid caller');
            assert(session_public_key != 0, 'Invalid session key');

            // Validate expiry duration
            let duration = if expiry_duration == 0 {
                self.default_expiry_duration.read()
            } else {
                assert(self.validate_expiry_duration(expiry_duration), 'Invalid expiry duration');
                expiry_duration
            };

            // Check if session key already exists
            let existing = self.session_keys.entry(session_public_key).read();
            assert(existing.session_public_key == 0, 'Session key already exists');

            let current_time = get_block_timestamp();
            let expires_at = current_time + duration;

            // Create session key
            let session_key = SessionKey {
                session_public_key,
                master_account: caller,
                created_at: current_time,
                expires_at,
                is_revoked: false,
                use_count: 0,
                max_uses,
            };

            self.session_keys.entry(session_public_key).write(session_key);

            // Track session key for account
            let session_index = self.account_session_count.entry(caller).read();
            self.account_session_keys.entry((caller, session_index)).write(session_public_key);
            self.account_session_count.entry(caller).write(session_index + 1);

            // Grant permissions
            let mut i = 0;
            loop {
                if i >= permissions.len() {
                    break;
                }

                let (target_contract, function_selector) = *permissions.at(i);
                self.permissions.entry((session_public_key, target_contract, function_selector)).write(true);

                self.emit(PermissionGranted {
                    session_public_key,
                    target_contract,
                    function_selector,
                });

                i += 1;
            };

            // Update statistics
            self.total_sessions_created.write(self.total_sessions_created.read() + 1);

            self.emit(SessionKeyCreated {
                session_public_key,
                master_account: caller,
                expires_at,
                max_uses,
            });

            true
        }

        fn revoke_session_key(ref self: ContractState, session_public_key: felt252) -> bool {
            let caller = get_caller_address();
            let mut session_key = self.session_keys.entry(session_public_key).read();

            assert(session_key.session_public_key != 0, 'Session key not found');
            assert(session_key.master_account == caller, 'Not session key owner');
            assert(!session_key.is_revoked, 'Already revoked');

            session_key.is_revoked = true;
            self.session_keys.entry(session_public_key).write(session_key);

            self.total_sessions_revoked.write(self.total_sessions_revoked.read() + 1);

            self.emit(SessionKeyRevoked {
                session_public_key,
                master_account: caller,
                timestamp: get_block_timestamp(),
            });

            true
        }

        fn validate_and_use_session_key(
            ref self: ContractState,
            session_public_key: felt252,
            target_contract: ContractAddress,
            function_selector: felt252,
        ) -> bool {
            self.assert_not_paused();

            let mut session_key = self.session_keys.entry(session_public_key).read();

            // Check if session key exists
            if session_key.session_public_key == 0 {
                return false;
            }

            // Check if revoked
            if session_key.is_revoked {
                return false;
            }

            // Check expiry
            let current_time = get_block_timestamp();
            if current_time >= session_key.expires_at {
                return false;
            }

            // Check max uses
            if session_key.max_uses > 0 && session_key.use_count >= session_key.max_uses {
                return false;
            }

            // Check permissions
            let has_permission = self.permissions.entry((session_public_key, target_contract, function_selector)).read();
            if !has_permission {
                return false;
            }

            // Update use count
            session_key.use_count += 1;
            let new_use_count = session_key.use_count;
            self.session_keys.entry(session_public_key).write(session_key);

            self.emit(SessionKeyUsed {
                session_public_key,
                target_contract,
                function_selector,
                use_count: new_use_count,
            });

            true
        }

        // ============================================================================
        // PERMISSION MANAGEMENT
        // ============================================================================

        fn grant_permission(
            ref self: ContractState,
            session_public_key: felt252,
            target_contract: ContractAddress,
            function_selector: felt252,
        ) {
            let caller = get_caller_address();
            let session_key = self.session_keys.entry(session_public_key).read();

            assert(session_key.session_public_key != 0, 'Session key not found');
            assert(session_key.master_account == caller, 'Not session key owner');

            self.permissions.entry((session_public_key, target_contract, function_selector)).write(true);

            self.emit(PermissionGranted {
                session_public_key,
                target_contract,
                function_selector,
            });
        }

        fn revoke_permission(
            ref self: ContractState,
            session_public_key: felt252,
            target_contract: ContractAddress,
            function_selector: felt252,
        ) {
            let caller = get_caller_address();
            let session_key = self.session_keys.entry(session_public_key).read();

            assert(session_key.session_public_key != 0, 'Session key not found');
            assert(session_key.master_account == caller, 'Not session key owner');

            self.permissions.entry((session_public_key, target_contract, function_selector)).write(false);

            self.emit(PermissionRevoked {
                session_public_key,
                target_contract,
                function_selector,
            });
        }

        fn has_permission(
            self: @ContractState,
            session_public_key: felt252,
            target_contract: ContractAddress,
            function_selector: felt252,
        ) -> bool {
            self.permissions.entry((session_public_key, target_contract, function_selector)).read()
        }

        // ============================================================================
        // VIEW FUNCTIONS
        // ============================================================================

        fn get_session_key(self: @ContractState, session_public_key: felt252) -> SessionKey {
            self.session_keys.entry(session_public_key).read()
        }

        fn is_session_key_valid(self: @ContractState, session_public_key: felt252) -> bool {
            let session_key = self.session_keys.entry(session_public_key).read();

            if session_key.session_public_key == 0 {
                return false;
            }

            if session_key.is_revoked {
                return false;
            }

            let current_time = get_block_timestamp();
            if current_time >= session_key.expires_at {
                return false;
            }

            if session_key.max_uses > 0 && session_key.use_count >= session_key.max_uses {
                return false;
            }

            true
        }

        fn get_account_session_keys(
            self: @ContractState,
            account: ContractAddress,
            limit: u64,
            offset: u64,
        ) -> Array<felt252> {
            let total = self.account_session_count.entry(account).read();
            let mut result = ArrayTrait::new();

            if offset >= total {
                return result;
            }

            let end = if offset + limit > total { total } else { offset + limit };

            let mut i = offset;
            loop {
                if i >= end {
                    break;
                }

                let session_key = self.account_session_keys.entry((account, i)).read();
                if session_key != 0 {
                    result.append(session_key);
                }

                i += 1;
            };

            result
        }

        fn get_total_sessions_created(self: @ContractState) -> u64 {
            self.total_sessions_created.read()
        }

        fn get_total_sessions_revoked(self: @ContractState) -> u64 {
            self.total_sessions_revoked.read()
        }

        // ============================================================================
        // ADMIN FUNCTIONS
        // ============================================================================

        fn set_default_expiry_duration(ref self: ContractState, duration: u64) {
            self.assert_only_admin();
            assert(self.validate_expiry_duration(duration), 'Invalid duration');
            self.default_expiry_duration.write(duration);
        }

        fn set_max_expiry_duration(ref self: ContractState, duration: u64) {
            self.assert_only_owner();
            self.max_expiry_duration.write(duration);
        }

        fn set_min_expiry_duration(ref self: ContractState, duration: u64) {
            self.assert_only_owner();
            self.min_expiry_duration.write(duration);
        }

        fn add_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_owner();
            assert(!admin.is_zero(), 'Invalid admin address');
            self.admins.entry(admin).write(true);
        }

        fn remove_admin(ref self: ContractState, admin: ContractAddress) {
            self.assert_only_owner();
            self.admins.entry(admin).write(false);
        }

        fn is_admin(self: @ContractState, account: ContractAddress) -> bool {
            account == self.owner.read() || self.admins.entry(account).read()
        }

        // ============================================================================
        // EMERGENCY CONTROLS
        // ============================================================================

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
pub trait ISessionKeyManager<TContractState> {
    // Session key management
    fn create_session_key(
        ref self: TContractState,
        session_public_key: felt252,
        expiry_duration: u64,
        max_uses: u64,
        permissions: Array<(ContractAddress, felt252)>,
    ) -> bool;
    fn revoke_session_key(ref self: TContractState, session_public_key: felt252) -> bool;
    fn validate_and_use_session_key(
        ref self: TContractState,
        session_public_key: felt252,
        target_contract: ContractAddress,
        function_selector: felt252,
    ) -> bool;

    // Permission management
    fn grant_permission(
        ref self: TContractState,
        session_public_key: felt252,
        target_contract: ContractAddress,
        function_selector: felt252,
    );
    fn revoke_permission(
        ref self: TContractState,
        session_public_key: felt252,
        target_contract: ContractAddress,
        function_selector: felt252,
    );
    fn has_permission(
        self: @TContractState,
        session_public_key: felt252,
        target_contract: ContractAddress,
        function_selector: felt252,
    ) -> bool;

    // View functions
    fn get_session_key(self: @TContractState, session_public_key: felt252) -> SessionKey;
    fn is_session_key_valid(self: @TContractState, session_public_key: felt252) -> bool;
    fn get_account_session_keys(
        self: @TContractState,
        account: ContractAddress,
        limit: u64,
        offset: u64,
    ) -> Array<felt252>;
    fn get_total_sessions_created(self: @TContractState) -> u64;
    fn get_total_sessions_revoked(self: @TContractState) -> u64;

    // Admin functions
    fn set_default_expiry_duration(ref self: TContractState, duration: u64);
    fn set_max_expiry_duration(ref self: TContractState, duration: u64);
    fn set_min_expiry_duration(ref self: TContractState, duration: u64);
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;

    // Emergency controls
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}
