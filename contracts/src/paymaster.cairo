// SPDX-License-Identifier: MIT
// Vauban Blog - Paymaster Smart Contract (Production-Grade)
// Security: Balance protection, Rate limiting, Whitelist, Spending caps, Emergency pause

#[starknet::contract]
mod Paymaster {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;

    // ============================================================================
    // STORAGE
    // ============================================================================

    #[storage]
    struct Storage {
        // Access control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,

        // Balance tracking
        balance: u256,  // STRK tokens available for sponsorship

        // Spending limits per user
        user_daily_spend: Map<ContractAddress, u256>,
        user_last_reset: Map<ContractAddress, u64>,
        daily_spend_limit: u256,  // Max STRK per user per 24h

        // Contract-wide limits
        total_sponsored_today: u256,
        last_daily_reset: u64,
        daily_budget: u256,  // Max total STRK per 24h

        // Whitelist for sponsored contracts
        sponsored_contracts: Map<ContractAddress, bool>,

        // Transaction tracking
        sponsored_txs: Map<felt252, u256>,  // tx_hash -> amount paid

        // Rate limiting
        user_last_sponsor_time: Map<ContractAddress, u64>,
        sponsor_cooldown: u64,  // Min seconds between sponsored TXs per user

        // Emergency controls
        paused: bool,
        emergency_admin: ContractAddress,

        // Statistics
        total_sponsored: u256,
        total_tx_count: u64,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        PaymasterFunded: PaymasterFunded,
        GasSponsored: GasSponsored,
        SponsorshipFailed: SponsorshipFailed,
        ContractWhitelisted: ContractWhitelisted,
        ContractRemoved: ContractRemoved,
        DailyBudgetUpdated: DailyBudgetUpdated,
        UserLimitUpdated: UserLimitUpdated,
        Paused: Paused,
        Unpaused: Unpaused,
        EmergencyWithdraw: EmergencyWithdraw,
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PaymasterFunded {
        #[key]
        funder: ContractAddress,
        amount: u256,
        new_balance: u256,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct GasSponsored {
        #[key]
        user: ContractAddress,
        #[key]
        target_contract: ContractAddress,
        tx_hash: felt252,
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct SponsorshipFailed {
        #[key]
        user: ContractAddress,
        reason: felt252,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ContractWhitelisted {
        #[key]
        contract_address: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ContractRemoved {
        #[key]
        contract_address: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct DailyBudgetUpdated {
        old_budget: u256,
        new_budget: u256,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct UserLimitUpdated {
        old_limit: u256,
        new_limit: u256,
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
    struct EmergencyWithdraw {
        #[key]
        admin: ContractAddress,
        amount: u256,
        recipient: ContractAddress,
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

    const SECONDS_PER_DAY: u64 = 86400;
    const DEFAULT_DAILY_BUDGET: u256 = 100_000_000_000_000_000_000; // 100 STRK
    const DEFAULT_USER_LIMIT: u256 = 1_000_000_000_000_000_000; // 1 STRK per user per day
    const DEFAULT_COOLDOWN: u64 = 5; // 5 seconds between sponsored TXs
    const MAX_GAS_AMOUNT: u256 = 10_000_000_000_000_000_000; // 10 STRK max per TX

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        emergency_admin: ContractAddress,
        daily_budget: u256,
        user_limit: u256,
    ) {
        assert(!owner.is_zero(), 'Invalid owner address');
        assert(!emergency_admin.is_zero(), 'Invalid emergency admin');

        self.owner.write(owner);
        self.emergency_admin.write(emergency_admin);
        self.daily_budget.write(if daily_budget > 0 { daily_budget } else { DEFAULT_DAILY_BUDGET });
        self.daily_spend_limit.write(if user_limit > 0 { user_limit } else { DEFAULT_USER_LIMIT });
        self.sponsor_cooldown.write(DEFAULT_COOLDOWN);
        self.paused.write(false);
        self.balance.write(0);
        self.last_daily_reset.write(get_block_timestamp());
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
            assert(!self.paused.read(), 'Paymaster is paused');
        }

        fn check_and_reset_daily_budget(ref self: ContractState) {
            let current_time = get_block_timestamp();
            let last_reset = self.last_daily_reset.read();

            if current_time >= last_reset + SECONDS_PER_DAY {
                self.total_sponsored_today.write(0);
                self.last_daily_reset.write(current_time);
            }
        }

        fn check_and_reset_user_limit(ref self: ContractState, user: ContractAddress) {
            let current_time = get_block_timestamp();
            let last_reset = self.user_last_reset.entry(user).read();

            if current_time >= last_reset + SECONDS_PER_DAY {
                self.user_daily_spend.entry(user).write(0);
                self.user_last_reset.entry(user).write(current_time);
            }
        }

        fn check_user_cooldown(self: @ContractState, user: ContractAddress) -> bool {
            let current_time = get_block_timestamp();
            let last_sponsor = self.user_last_sponsor_time.entry(user).read();
            let cooldown = self.sponsor_cooldown.read();

            if last_sponsor == 0 {
                return true;
            }

            current_time >= last_sponsor + cooldown
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS - Core Sponsorship
    // ============================================================================

    #[abi(embed_v0)]
    impl PaymasterImpl of super::IPaymaster<ContractState> {
        fn sponsor_transaction(
            ref self: ContractState,
            user: ContractAddress,
            target_contract: ContractAddress,
            estimated_fee: u256,
            tx_hash: felt252,
        ) -> bool {
            self.assert_not_paused();

            // Validation checks
            assert(!user.is_zero(), 'Invalid user address');
            assert(!target_contract.is_zero(), 'Invalid contract');
            assert(estimated_fee > 0, 'Fee must be positive');
            assert(estimated_fee <= MAX_GAS_AMOUNT, 'Fee exceeds maximum');

            // Check if already sponsored
            let already_sponsored = self.sponsored_txs.entry(tx_hash).read();
            if already_sponsored > 0 {
                self.emit(SponsorshipFailed {
                    user,
                    reason: 'TX already sponsored',
                });
                return false;
            }

            // Check if target contract is whitelisted
            if !self.sponsored_contracts.entry(target_contract).read() {
                self.emit(SponsorshipFailed {
                    user,
                    reason: 'Contract not whitelisted',
                });
                return false;
            }

            // Check user cooldown
            if !self.check_user_cooldown(user) {
                self.emit(SponsorshipFailed {
                    user,
                    reason: 'Cooldown active',
                });
                return false;
            }

            // Reset daily limits if needed
            self.check_and_reset_daily_budget();
            self.check_and_reset_user_limit(user);

            // Check daily budget
            let today_spent = self.total_sponsored_today.read();
            let budget = self.daily_budget.read();
            if today_spent + estimated_fee > budget {
                self.emit(SponsorshipFailed {
                    user,
                    reason: 'Daily budget exceeded',
                });
                return false;
            }

            // Check user daily limit
            let user_spent = self.user_daily_spend.entry(user).read();
            let user_limit = self.daily_spend_limit.read();
            if user_spent + estimated_fee > user_limit {
                self.emit(SponsorshipFailed {
                    user,
                    reason: 'User daily limit exceeded',
                });
                return false;
            }

            // Check balance
            let current_balance = self.balance.read();
            if current_balance < estimated_fee {
                self.emit(SponsorshipFailed {
                    user,
                    reason: 'Insufficient balance',
                });
                return false;
            }

            // Update state
            self.balance.write(current_balance - estimated_fee);
            self.total_sponsored_today.write(today_spent + estimated_fee);
            self.user_daily_spend.entry(user).write(user_spent + estimated_fee);
            self.user_last_sponsor_time.entry(user).write(get_block_timestamp());
            self.sponsored_txs.entry(tx_hash).write(estimated_fee);
            self.total_sponsored.write(self.total_sponsored.read() + estimated_fee);
            self.total_tx_count.write(self.total_tx_count.read() + 1);

            self.emit(GasSponsored {
                user,
                target_contract,
                tx_hash,
                amount: estimated_fee,
                timestamp: get_block_timestamp(),
            });

            true
        }

        fn fund(ref self: ContractState, amount: u256) {
            let funder = get_caller_address();
            assert(amount > 0, 'Amount must be positive');

            // TODO: Actual STRK token transfer (requires ERC20 integration)
            // In production: Transfer STRK from funder to this contract

            let new_balance = self.balance.read() + amount;
            self.balance.write(new_balance);

            self.emit(PaymasterFunded {
                funder,
                amount,
                new_balance,
            });
        }

        // ============================================================================
        // ADMIN FUNCTIONS - Whitelist Management
        // ============================================================================

        fn whitelist_contract(ref self: ContractState, contract_address: ContractAddress) {
            self.assert_only_admin();
            assert(!contract_address.is_zero(), 'Invalid contract address');

            self.sponsored_contracts.entry(contract_address).write(true);

            self.emit(ContractWhitelisted { contract_address });
        }

        fn remove_contract(ref self: ContractState, contract_address: ContractAddress) {
            self.assert_only_admin();

            self.sponsored_contracts.entry(contract_address).write(false);

            self.emit(ContractRemoved { contract_address });
        }

        fn is_whitelisted(self: @ContractState, contract_address: ContractAddress) -> bool {
            self.sponsored_contracts.entry(contract_address).read()
        }

        // ============================================================================
        // ADMIN FUNCTIONS - Limits & Config
        // ============================================================================

        fn set_daily_budget(ref self: ContractState, new_budget: u256) {
            self.assert_only_admin();
            assert(new_budget > 0, 'Budget must be positive');

            let old_budget = self.daily_budget.read();
            self.daily_budget.write(new_budget);

            self.emit(DailyBudgetUpdated { old_budget, new_budget });
        }

        fn set_user_daily_limit(ref self: ContractState, new_limit: u256) {
            self.assert_only_admin();
            assert(new_limit > 0, 'Limit must be positive');

            let old_limit = self.daily_spend_limit.read();
            self.daily_spend_limit.write(new_limit);

            self.emit(UserLimitUpdated { old_limit, new_limit });
        }

        fn set_cooldown(ref self: ContractState, cooldown_seconds: u64) {
            self.assert_only_admin();
            self.sponsor_cooldown.write(cooldown_seconds);
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

        // ============================================================================
        // EMERGENCY CONTROLS
        // ============================================================================

        fn pause(ref self: ContractState) {
            let caller = get_caller_address();
            assert(
                caller == self.owner.read() || caller == self.emergency_admin.read(),
                'Not authorized'
            );

            self.paused.write(true);
            self.emit(Paused { timestamp: get_block_timestamp() });
        }

        fn unpause(ref self: ContractState) {
            self.assert_only_owner();
            self.paused.write(false);
            self.emit(Unpaused { timestamp: get_block_timestamp() });
        }

        fn emergency_withdraw(ref self: ContractState, amount: u256, recipient: ContractAddress) {
            let caller = get_caller_address();
            assert(
                caller == self.owner.read() || caller == self.emergency_admin.read(),
                'Not authorized'
            );
            assert(!recipient.is_zero(), 'Invalid recipient');

            let current_balance = self.balance.read();
            assert(amount <= current_balance, 'Insufficient balance');

            self.balance.write(current_balance - amount);

            // TODO: Transfer STRK tokens to recipient

            self.emit(EmergencyWithdraw {
                admin: caller,
                amount,
                recipient,
            });
        }

        // ============================================================================
        // VIEW FUNCTIONS
        // ============================================================================

        fn get_balance(self: @ContractState) -> u256 {
            self.balance.read()
        }

        fn get_daily_budget(self: @ContractState) -> u256 {
            self.daily_budget.read()
        }

        fn get_user_daily_limit(self: @ContractState) -> u256 {
            self.daily_spend_limit.read()
        }

        fn get_user_daily_spend(self: @ContractState, user: ContractAddress) -> u256 {
            self.user_daily_spend.entry(user).read()
        }

        fn get_total_sponsored(self: @ContractState) -> u256 {
            self.total_sponsored.read()
        }

        fn get_total_tx_count(self: @ContractState) -> u64 {
            self.total_tx_count.read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }

        fn is_admin(self: @ContractState, account: ContractAddress) -> bool {
            account == self.owner.read() || self.admins.entry(account).read()
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

use starknet::ContractAddress;

#[starknet::interface]
pub trait IPaymaster<TContractState> {
    // Core sponsorship
    fn sponsor_transaction(
        ref self: TContractState,
        user: ContractAddress,
        target_contract: ContractAddress,
        estimated_fee: u256,
        tx_hash: felt252,
    ) -> bool;
    fn fund(ref self: TContractState, amount: u256);

    // Whitelist management
    fn whitelist_contract(ref self: TContractState, contract_address: ContractAddress);
    fn remove_contract(ref self: TContractState, contract_address: ContractAddress);
    fn is_whitelisted(self: @TContractState, contract_address: ContractAddress) -> bool;

    // Limits & config
    fn set_daily_budget(ref self: TContractState, new_budget: u256);
    fn set_user_daily_limit(ref self: TContractState, new_limit: u256);
    fn set_cooldown(ref self: TContractState, cooldown_seconds: u64);
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);

    // Emergency controls
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn emergency_withdraw(ref self: TContractState, amount: u256, recipient: ContractAddress);

    // View functions
    fn get_balance(self: @TContractState) -> u256;
    fn get_daily_budget(self: @TContractState) -> u256;
    fn get_user_daily_limit(self: @TContractState) -> u256;
    fn get_user_daily_spend(self: @TContractState, user: ContractAddress) -> u256;
    fn get_total_sponsored(self: @TContractState) -> u256;
    fn get_total_tx_count(self: @TContractState) -> u64;
    fn is_paused(self: @TContractState) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}
