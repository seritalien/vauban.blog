// SPDX-License-Identifier: MIT
// Vauban Blog - Treasury Smart Contract (Production-Grade)
// Manages revenue distribution with creator-first economics (85% to authors)

use starknet::ContractAddress;

// ============================================================================
// STORAGE STRUCTURES
// ============================================================================

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct RevenueConfig {
    pub platform_fee_bps: u16,      // Default 1000 = 10%
    pub referral_fee_bps: u16,      // Default 500 = 5%
    pub min_withdrawal: u256,        // Minimum amount to withdraw
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct Earnings {
    pub total_earned: u256,
    pub total_withdrawn: u256,
    pub pending: u256,
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct PaymentRecord {
    pub id: u64,
    pub post_id: u64,
    pub payer: ContractAddress,
    pub amount: u256,
    pub author_share: u256,
    pub platform_share: u256,
    pub referrer_share: u256,
    pub referrer: ContractAddress,
    pub timestamp: u64,
}

#[derive(Drop, Serde, starknet::Store, Clone)]
pub struct RevenueSplit {
    pub collaborator: ContractAddress,
    pub share_bps: u16,  // Basis points (10000 = 100%)
}

#[starknet::contract]
mod Treasury {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{Map, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
    use core::num::traits::Zero;
    use super::{RevenueConfig, Earnings, PaymentRecord, RevenueSplit};

    // ============================================================================
    // STORAGE
    // ============================================================================

    #[storage]
    struct Storage {
        // Access Control
        owner: ContractAddress,
        admins: Map<ContractAddress, bool>,

        // Authorized contracts that can distribute payments
        authorized_contracts: Map<ContractAddress, bool>,

        // Revenue configuration
        config: RevenueConfig,

        // User earnings
        earnings: Map<ContractAddress, Earnings>,

        // Payment history
        payments: Map<u64, PaymentRecord>,
        payment_count: u64,

        // Post-specific revenue splits (for collaborations)
        // (post_id, collaborator_index) -> RevenueSplit
        post_splits: Map<(u64, u64), RevenueSplit>,
        post_split_count: Map<u64, u64>,

        // Referral tracking
        referrals: Map<ContractAddress, ContractAddress>,  // user -> referrer

        // Platform treasury balance
        platform_balance: u256,

        // Statistics
        total_volume: u256,
        total_distributed_to_creators: u256,
        total_platform_fees: u256,
        total_referral_fees: u256,

        // Emergency
        paused: bool,
        reentrancy_guard: bool,
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    #[event]
    #[derive(Drop, Serde, starknet::Event)]
    enum Event {
        PaymentDistributed: PaymentDistributed,
        EarningsWithdrawn: EarningsWithdrawn,
        RevenueSplitSet: RevenueSplitSet,
        ReferrerSet: ReferrerSet,
        ConfigUpdated: ConfigUpdated,
        ContractAuthorized: ContractAuthorized,
        ContractDeauthorized: ContractDeauthorized,
        PlatformWithdrawal: PlatformWithdrawal,
        Paused: Paused,
        Unpaused: Unpaused,
        OwnershipTransferred: OwnershipTransferred,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PaymentDistributed {
        #[key]
        payment_id: u64,
        #[key]
        post_id: u64,
        #[key]
        payer: ContractAddress,
        amount: u256,
        author_share: u256,
        platform_share: u256,
        referrer_share: u256,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct EarningsWithdrawn {
        #[key]
        user: ContractAddress,
        amount: u256,
        timestamp: u64,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct RevenueSplitSet {
        #[key]
        post_id: u64,
        collaborator: ContractAddress,
        share_bps: u16,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ReferrerSet {
        #[key]
        user: ContractAddress,
        #[key]
        referrer: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ConfigUpdated {
        platform_fee_bps: u16,
        referral_fee_bps: u16,
        min_withdrawal: u256,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ContractAuthorized {
        #[key]
        contract_address: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct ContractDeauthorized {
        #[key]
        contract_address: ContractAddress,
    }

    #[derive(Drop, Serde, starknet::Event)]
    struct PlatformWithdrawal {
        #[key]
        recipient: ContractAddress,
        amount: u256,
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

    const MAX_PLATFORM_FEE_BPS: u16 = 2000;    // Max 20% platform fee
    const MAX_REFERRAL_FEE_BPS: u16 = 1000;    // Max 10% referral fee
    const DEFAULT_PLATFORM_FEE_BPS: u16 = 1000; // 10%
    const DEFAULT_REFERRAL_FEE_BPS: u16 = 500;  // 5%
    const BPS_DENOMINATOR: u256 = 10000;        // 100% in basis points
    const MIN_WITHDRAWAL_DEFAULT: u256 = 1000000000000000000; // 1 token (18 decimals)

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        assert(!owner.is_zero(), 'Invalid owner address');

        self.owner.write(owner);
        self.admins.entry(owner).write(true);

        // Set default configuration
        let config = RevenueConfig {
            platform_fee_bps: DEFAULT_PLATFORM_FEE_BPS,
            referral_fee_bps: DEFAULT_REFERRAL_FEE_BPS,
            min_withdrawal: MIN_WITHDRAWAL_DEFAULT,
        };
        self.config.write(config);

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

        fn assert_only_admin(self: @ContractState) {
            let caller = get_caller_address();
            let is_owner = caller == self.owner.read();
            let is_admin = self.admins.entry(caller).read();
            assert(is_owner || is_admin, 'Caller is not admin');
        }

        fn assert_authorized_contract(self: @ContractState) {
            let caller = get_caller_address();
            assert(
                self.authorized_contracts.entry(caller).read() || caller == self.owner.read(),
                'Not authorized contract'
            );
        }

        fn assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Treasury is paused');
        }

        fn assert_no_reentrancy(ref self: ContractState) {
            assert(!self.reentrancy_guard.read(), 'Reentrancy detected');
            self.reentrancy_guard.write(true);
        }

        fn clear_reentrancy(ref self: ContractState) {
            self.reentrancy_guard.write(false);
        }

        fn add_earnings(ref self: ContractState, user: ContractAddress, amount: u256) {
            let mut user_earnings = self.earnings.entry(user).read();
            user_earnings.total_earned = user_earnings.total_earned + amount;
            user_earnings.pending = user_earnings.pending + amount;
            self.earnings.entry(user).write(user_earnings);
        }
    }

    // ============================================================================
    // EXTERNAL FUNCTIONS
    // ============================================================================

    #[abi(embed_v0)]
    impl TreasuryImpl of super::ITreasury<ContractState> {
        // ========================================================================
        // PAYMENT DISTRIBUTION
        // ========================================================================

        /// Distribute payment for a post purchase
        /// Called by BlogRegistry when a post is purchased
        fn distribute_payment(
            ref self: ContractState,
            post_id: u64,
            author: ContractAddress,
            amount: u256,
            payer: ContractAddress,
        ) {
            self.assert_not_paused();
            self.assert_authorized_contract();
            self.assert_no_reentrancy();

            assert(amount > 0, 'Amount must be positive');
            assert(!author.is_zero(), 'Invalid author');

            let config = self.config.read();
            let now = get_block_timestamp();

            // Calculate shares
            let platform_fee: u256 = (amount * config.platform_fee_bps.into()) / BPS_DENOMINATOR;

            // Check if payer has a referrer
            let referrer = self.referrals.entry(payer).read();
            let referrer_fee: u256 = if !referrer.is_zero() {
                (amount * config.referral_fee_bps.into()) / BPS_DENOMINATOR
            } else {
                0
            };

            // Author gets the rest
            let author_share = amount - platform_fee - referrer_fee;

            // Check for revenue splits on this post
            let split_count = self.post_split_count.entry(post_id).read();

            if split_count == 0 {
                // No splits, all to author
                self.add_earnings(author, author_share);
            } else {
                // Distribute according to splits
                let mut distributed: u256 = 0;
                let mut i: u64 = 0;
                loop {
                    if i >= split_count {
                        break;
                    }
                    let split = self.post_splits.entry((post_id, i)).read();
                    let collaborator_share = (author_share * split.share_bps.into()) / BPS_DENOMINATOR;
                    self.add_earnings(split.collaborator, collaborator_share);
                    distributed = distributed + collaborator_share;
                    i += 1;
                };

                // Remaining goes to author
                let remaining = author_share - distributed;
                if remaining > 0 {
                    self.add_earnings(author, remaining);
                }
            }

            // Add platform fee to platform balance
            self.platform_balance.write(self.platform_balance.read() + platform_fee);

            // Add referrer earnings if applicable
            if !referrer.is_zero() && referrer_fee > 0 {
                self.add_earnings(referrer, referrer_fee);
                self.total_referral_fees.write(self.total_referral_fees.read() + referrer_fee);
            }

            // Record payment
            let payment_id = self.payment_count.read() + 1;
            let payment = PaymentRecord {
                id: payment_id,
                post_id,
                payer,
                amount,
                author_share,
                platform_share: platform_fee,
                referrer_share: referrer_fee,
                referrer,
                timestamp: now,
            };
            self.payments.entry(payment_id).write(payment);
            self.payment_count.write(payment_id);

            // Update statistics
            self.total_volume.write(self.total_volume.read() + amount);
            self.total_distributed_to_creators.write(
                self.total_distributed_to_creators.read() + author_share
            );
            self.total_platform_fees.write(self.total_platform_fees.read() + platform_fee);

            self.emit(PaymentDistributed {
                payment_id,
                post_id,
                payer,
                amount,
                author_share,
                platform_share: platform_fee,
                referrer_share: referrer_fee,
                timestamp: now,
            });

            self.clear_reentrancy();
        }

        /// Withdraw earned revenue
        fn withdraw_earnings(ref self: ContractState) -> u256 {
            self.assert_not_paused();
            self.assert_no_reentrancy();

            let caller = get_caller_address();
            let mut user_earnings = self.earnings.entry(caller).read();
            let config = self.config.read();

            assert(user_earnings.pending >= config.min_withdrawal, 'Below min withdrawal');

            let amount = user_earnings.pending;
            user_earnings.total_withdrawn = user_earnings.total_withdrawn + amount;
            user_earnings.pending = 0;
            self.earnings.entry(caller).write(user_earnings);

            // TODO: Actual token transfer to caller
            // In production: IERC20(strk_token).transfer(caller, amount)

            self.emit(EarningsWithdrawn {
                user: caller,
                amount,
                timestamp: get_block_timestamp(),
            });

            self.clear_reentrancy();
            amount
        }

        // ========================================================================
        // REVENUE SPLITS
        // ========================================================================

        /// Set revenue split for a post (author only)
        fn set_revenue_split(
            ref self: ContractState,
            post_id: u64,
            collaborators: Array<(ContractAddress, u16)>,
        ) {
            self.assert_not_paused();

            // Note: In production, verify caller is the post author via BlogRegistry

            // Validate total doesn't exceed 100%
            let mut total_bps: u32 = 0;
            let mut i = 0;
            loop {
                if i >= collaborators.len() {
                    break;
                }
                let (addr, bps) = *collaborators.at(i);
                assert(!addr.is_zero(), 'Invalid collaborator');
                assert(bps > 0 && bps <= 10000, 'Invalid share');
                total_bps = total_bps + bps.into();
                i += 1;
            };
            assert(total_bps <= 10000, 'Total exceeds 100%');

            // Store splits
            let mut j: u64 = 0;
            loop {
                if j >= collaborators.len().into() {
                    break;
                }
                let (addr, bps) = *collaborators.at(j.try_into().unwrap());
                let split = RevenueSplit {
                    collaborator: addr,
                    share_bps: bps,
                };
                self.post_splits.entry((post_id, j)).write(split);

                self.emit(RevenueSplitSet {
                    post_id,
                    collaborator: addr,
                    share_bps: bps,
                });

                j += 1;
            };
            self.post_split_count.entry(post_id).write(j);
        }

        // ========================================================================
        // REFERRAL SYSTEM
        // ========================================================================

        /// Set referrer for a user (one-time)
        fn set_referrer(ref self: ContractState, referrer: ContractAddress) {
            let caller = get_caller_address();

            // Can only set once
            let existing = self.referrals.entry(caller).read();
            assert(existing.is_zero(), 'Referrer already set');
            assert(!referrer.is_zero(), 'Invalid referrer');
            assert(referrer != caller, 'Cannot refer self');

            self.referrals.entry(caller).write(referrer);

            self.emit(ReferrerSet {
                user: caller,
                referrer,
            });
        }

        fn get_referrer(self: @ContractState, user: ContractAddress) -> ContractAddress {
            self.referrals.entry(user).read()
        }

        // ========================================================================
        // VIEW FUNCTIONS
        // ========================================================================

        fn get_earnings(self: @ContractState, user: ContractAddress) -> Earnings {
            self.earnings.entry(user).read()
        }

        fn get_payment(self: @ContractState, payment_id: u64) -> PaymentRecord {
            self.payments.entry(payment_id).read()
        }

        fn get_payment_count(self: @ContractState) -> u64 {
            self.payment_count.read()
        }

        fn get_config(self: @ContractState) -> RevenueConfig {
            self.config.read()
        }

        fn get_platform_balance(self: @ContractState) -> u256 {
            self.platform_balance.read()
        }

        fn get_total_volume(self: @ContractState) -> u256 {
            self.total_volume.read()
        }

        fn get_total_distributed_to_creators(self: @ContractState) -> u256 {
            self.total_distributed_to_creators.read()
        }

        fn get_total_platform_fees(self: @ContractState) -> u256 {
            self.total_platform_fees.read()
        }

        fn get_total_referral_fees(self: @ContractState) -> u256 {
            self.total_referral_fees.read()
        }

        // ========================================================================
        // ADMIN FUNCTIONS
        // ========================================================================

        fn update_config(
            ref self: ContractState,
            platform_fee_bps: u16,
            referral_fee_bps: u16,
            min_withdrawal: u256,
        ) {
            self.assert_only_admin();

            assert(platform_fee_bps <= MAX_PLATFORM_FEE_BPS, 'Platform fee too high');
            assert(referral_fee_bps <= MAX_REFERRAL_FEE_BPS, 'Referral fee too high');
            assert(platform_fee_bps + referral_fee_bps <= 5000, 'Total fees too high'); // Max 50%

            let config = RevenueConfig {
                platform_fee_bps,
                referral_fee_bps,
                min_withdrawal,
            };
            self.config.write(config);

            self.emit(ConfigUpdated {
                platform_fee_bps,
                referral_fee_bps,
                min_withdrawal,
            });
        }

        fn authorize_contract(ref self: ContractState, contract_address: ContractAddress) {
            self.assert_only_admin();
            assert(!contract_address.is_zero(), 'Invalid contract');

            self.authorized_contracts.entry(contract_address).write(true);
            self.emit(ContractAuthorized { contract_address });
        }

        fn deauthorize_contract(ref self: ContractState, contract_address: ContractAddress) {
            self.assert_only_admin();

            self.authorized_contracts.entry(contract_address).write(false);
            self.emit(ContractDeauthorized { contract_address });
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

        /// Withdraw platform fees to treasury wallet
        fn withdraw_platform_fees(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            self.assert_only_owner();
            self.assert_no_reentrancy();

            assert(!recipient.is_zero(), 'Invalid recipient');
            assert(amount <= self.platform_balance.read(), 'Insufficient balance');

            self.platform_balance.write(self.platform_balance.read() - amount);

            // TODO: Actual token transfer
            // In production: IERC20(strk_token).transfer(recipient, amount)

            self.emit(PlatformWithdrawal {
                recipient,
                amount,
                timestamp: get_block_timestamp(),
            });

            self.clear_reentrancy();
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
pub trait ITreasury<TContractState> {
    // Payment distribution
    fn distribute_payment(
        ref self: TContractState,
        post_id: u64,
        author: ContractAddress,
        amount: u256,
        payer: ContractAddress,
    );
    fn withdraw_earnings(ref self: TContractState) -> u256;

    // Revenue splits
    fn set_revenue_split(
        ref self: TContractState,
        post_id: u64,
        collaborators: Array<(ContractAddress, u16)>,
    );

    // Referral system
    fn set_referrer(ref self: TContractState, referrer: ContractAddress);
    fn get_referrer(self: @TContractState, user: ContractAddress) -> ContractAddress;

    // View functions
    fn get_earnings(self: @TContractState, user: ContractAddress) -> Earnings;
    fn get_payment(self: @TContractState, payment_id: u64) -> PaymentRecord;
    fn get_payment_count(self: @TContractState) -> u64;
    fn get_config(self: @TContractState) -> RevenueConfig;
    fn get_platform_balance(self: @TContractState) -> u256;
    fn get_total_volume(self: @TContractState) -> u256;
    fn get_total_distributed_to_creators(self: @TContractState) -> u256;
    fn get_total_platform_fees(self: @TContractState) -> u256;
    fn get_total_referral_fees(self: @TContractState) -> u256;

    // Admin functions
    fn update_config(
        ref self: TContractState,
        platform_fee_bps: u16,
        referral_fee_bps: u16,
        min_withdrawal: u256,
    );
    fn authorize_contract(ref self: TContractState, contract_address: ContractAddress);
    fn deauthorize_contract(ref self: TContractState, contract_address: ContractAddress);
    fn is_authorized(self: @TContractState, contract_address: ContractAddress) -> bool;
    fn add_admin(ref self: TContractState, admin: ContractAddress);
    fn remove_admin(ref self: TContractState, admin: ContractAddress);
    fn is_admin(self: @TContractState, account: ContractAddress) -> bool;
    fn withdraw_platform_fees(ref self: TContractState, recipient: ContractAddress, amount: u256);

    // Emergency controls
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn get_owner(self: @TContractState) -> ContractAddress;
    fn transfer_ownership(ref self: TContractState, new_owner: ContractAddress);
}
