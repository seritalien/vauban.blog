// Tests for Paymaster contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::paymaster::{IPaymasterDispatcher, IPaymasterDispatcherTrait};

// ============================================================================
// TEST HELPERS
// ============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn EMERGENCY_ADMIN() -> ContractAddress {
    contract_address_const::<'EMERGENCY_ADMIN'>()
}

fn ADMIN() -> ContractAddress {
    contract_address_const::<'ADMIN'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

fn USER2() -> ContractAddress {
    contract_address_const::<'USER2'>()
}

fn TARGET_CONTRACT() -> ContractAddress {
    contract_address_const::<'TARGET'>()
}

fn ZERO() -> ContractAddress {
    contract_address_const::<0>()
}

fn deploy() -> IPaymasterDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("Paymaster").unwrap().contract_class();
    let mut constructor_args: Array<felt252> = array![];
    OWNER().serialize(ref constructor_args);
    EMERGENCY_ADMIN().serialize(ref constructor_args);
    let daily_budget: u256 = 100_000_000_000_000_000_000; // 100 STRK
    daily_budget.serialize(ref constructor_args);
    let user_limit: u256 = 1_000_000_000_000_000_000; // 1 STRK
    user_limit.serialize(ref constructor_args);
    let (address, _) = contract.deploy(@constructor_args).unwrap();
    IPaymasterDispatcher { contract_address: address }
}

fn deploy_funded_with_whitelist() -> IPaymasterDispatcher {
    let d = deploy();
    // Fund the paymaster
    start_cheat_caller_address(d.contract_address, OWNER());
    d.fund(50_000_000_000_000_000_000); // 50 STRK
    // Whitelist target contract
    d.whitelist_contract(TARGET_CONTRACT());
    stop_cheat_caller_address(d.contract_address);
    d
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

#[test]
fn test_constructor_sets_owner() {
    let d = deploy();
    assert(d.get_owner() == OWNER(), 'Owner not set');
}

#[test]
fn test_constructor_sets_daily_budget() {
    let d = deploy();
    assert(d.get_daily_budget() == 100_000_000_000_000_000_000, 'Budget not set');
}

#[test]
fn test_constructor_sets_user_limit() {
    let d = deploy();
    assert(d.get_user_daily_limit() == 1_000_000_000_000_000_000, 'User limit not set');
}

#[test]
fn test_constructor_not_paused() {
    let d = deploy();
    assert(!d.is_paused(), 'Should not be paused');
}

#[test]
fn test_constructor_zero_balance() {
    let d = deploy();
    assert(d.get_balance() == 0, 'Balance should be 0');
}

// ============================================================================
// FUND TESTS
// ============================================================================

#[test]
fn test_fund() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.fund(1_000_000_000_000_000_000);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_balance() == 1_000_000_000_000_000_000, 'Balance wrong');
}

#[test]
#[should_panic(expected: 'Amount must be positive')]
fn test_fund_zero_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.fund(0);
}

// ============================================================================
// SPONSOR TRANSACTION TESTS
// ============================================================================

#[test]
fn test_sponsor_transaction_success() {
    let d = deploy_funded_with_whitelist();

    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.sponsor_transaction(
        USER1(), TARGET_CONTRACT(), 100_000_000_000_000_000, 'tx_hash_1',
    );
    stop_cheat_caller_address(d.contract_address);

    assert(result, 'Sponsor should succeed');
    assert(d.get_total_tx_count() == 1, 'TX count should be 1');
}

#[test]
fn test_sponsor_not_whitelisted_returns_false() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.fund(10_000_000_000_000_000_000);
    stop_cheat_caller_address(d.contract_address);

    // Target contract is NOT whitelisted
    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.sponsor_transaction(
        USER1(), TARGET_CONTRACT(), 100_000_000_000_000_000, 'tx_hash_1',
    );
    stop_cheat_caller_address(d.contract_address);

    assert(!result, 'Should fail - not whitelisted');
}

#[test]
fn test_sponsor_already_sponsored_returns_false() {
    let d = deploy_funded_with_whitelist();

    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 100_000_000_000_000_000, 'tx_hash_1');
    // Try same tx_hash again
    let result = d.sponsor_transaction(
        USER1(), TARGET_CONTRACT(), 100_000_000_000_000_000, 'tx_hash_1',
    );
    stop_cheat_caller_address(d.contract_address);

    assert(!result, 'Should fail - already sponsored');
}

#[test]
fn test_sponsor_insufficient_balance_returns_false() {
    let d = deploy();
    // Fund with tiny amount
    start_cheat_caller_address(d.contract_address, OWNER());
    d.fund(1); // 1 wei
    d.whitelist_contract(TARGET_CONTRACT());
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.sponsor_transaction(
        USER1(), TARGET_CONTRACT(), 100_000_000_000_000_000, 'tx_hash_1',
    );
    stop_cheat_caller_address(d.contract_address);

    assert(!result, 'Should fail - insufficient');
}

#[test]
#[should_panic(expected: 'Fee must be positive')]
fn test_sponsor_zero_fee_panics() {
    let d = deploy_funded_with_whitelist();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 0, 'tx_hash');
}

#[test]
fn test_sponsor_cooldown_returns_false() {
    let d = deploy_funded_with_whitelist();

    // First TX succeeds
    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 100_000_000, 'tx_1');
    stop_cheat_caller_address(d.contract_address);

    // Second TX immediately (within 5s cooldown) fails
    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 100_000_000, 'tx_2');
    stop_cheat_caller_address(d.contract_address);

    assert(!result, 'Should fail - cooldown');
}

#[test]
fn test_sponsor_after_cooldown_succeeds() {
    let d = deploy_funded_with_whitelist();

    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 100_000_000, 'tx_1');
    stop_cheat_caller_address(d.contract_address);

    // Advance past cooldown (5s default)
    start_cheat_block_timestamp_global(1000 + 6);
    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 100_000_000, 'tx_2');
    stop_cheat_caller_address(d.contract_address);

    assert(result, 'Should succeed after cooldown');
}

#[test]
fn test_sponsor_updates_balance() {
    let d = deploy_funded_with_whitelist();
    let initial_balance = d.get_balance();

    let fee: u256 = 100_000_000_000_000_000;
    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), fee, 'tx_hash');
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_balance() == initial_balance - fee, 'Balance not reduced');
}

// ============================================================================
// WHITELIST MANAGEMENT TESTS
// ============================================================================

#[test]
fn test_whitelist_contract() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.whitelist_contract(TARGET_CONTRACT());
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_whitelisted(TARGET_CONTRACT()), 'Should be whitelisted');
}

#[test]
fn test_remove_contract() {
    let d = deploy_funded_with_whitelist();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.remove_contract(TARGET_CONTRACT());
    stop_cheat_caller_address(d.contract_address);

    assert(!d.is_whitelisted(TARGET_CONTRACT()), 'Should not be whitelisted');
}

#[test]
#[should_panic(expected: 'Caller is not admin')]
fn test_whitelist_non_admin_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.whitelist_contract(TARGET_CONTRACT());
}

// ============================================================================
// ADMIN FUNCTIONS TESTS
// ============================================================================

#[test]
fn test_set_daily_budget() {
    let d = deploy();
    let new_budget: u256 = 200_000_000_000_000_000_000;
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_daily_budget(new_budget);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_daily_budget() == new_budget, 'Budget not updated');
}

#[test]
fn test_set_user_daily_limit() {
    let d = deploy();
    let new_limit: u256 = 5_000_000_000_000_000_000;
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_user_daily_limit(new_limit);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_user_daily_limit() == new_limit, 'Limit not updated');
}

#[test]
fn test_set_cooldown() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_cooldown(10);
    stop_cheat_caller_address(d.contract_address);
    // No getter for cooldown, but we verify the admin function doesn't panic
}

#[test]
fn test_add_admin() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.add_admin(ADMIN());
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_admin(ADMIN()), 'Should be admin');
}

#[test]
fn test_remove_admin() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.add_admin(ADMIN());
    d.remove_admin(ADMIN());
    stop_cheat_caller_address(d.contract_address);

    assert(!d.is_admin(ADMIN()), 'Should not be admin');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_add_admin_non_owner_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.add_admin(ADMIN());
}

// ============================================================================
// EMERGENCY CONTROLS TESTS
// ============================================================================

#[test]
fn test_pause_by_owner() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_paused(), 'Should be paused');
}

#[test]
fn test_pause_by_emergency_admin() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, EMERGENCY_ADMIN());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_paused(), 'Should be paused');
}

#[test]
fn test_unpause_by_owner() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    d.unpause();
    stop_cheat_caller_address(d.contract_address);

    assert(!d.is_paused(), 'Should not be paused');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_unpause_by_emergency_admin_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, EMERGENCY_ADMIN());
    d.unpause();
}

#[test]
#[should_panic(expected: 'Not authorized')]
fn test_pause_non_authorized_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.pause();
}

#[test]
#[should_panic(expected: 'Paymaster is paused')]
fn test_sponsor_when_paused_panics() {
    let d = deploy_funded_with_whitelist();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), 100_000, 'tx_hash');
}

#[test]
fn test_emergency_withdraw() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.fund(10_000_000_000_000_000_000);
    stop_cheat_caller_address(d.contract_address);

    let recipient = contract_address_const::<'RECIPIENT'>();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.emergency_withdraw(5_000_000_000_000_000_000, recipient);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_balance() == 5_000_000_000_000_000_000, 'Balance wrong after withdraw');
}

#[test]
fn test_emergency_withdraw_by_emergency_admin() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.fund(10_000_000_000_000_000_000);
    stop_cheat_caller_address(d.contract_address);

    let recipient = contract_address_const::<'RECIPIENT'>();
    start_cheat_caller_address(d.contract_address, EMERGENCY_ADMIN());
    d.emergency_withdraw(5_000_000_000_000_000_000, recipient);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_balance() == 5_000_000_000_000_000_000, 'Balance wrong');
}

#[test]
#[should_panic(expected: 'Insufficient balance')]
fn test_emergency_withdraw_insufficient_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.emergency_withdraw(1, OWNER());
}

// ============================================================================
// OWNERSHIP TESTS
// ============================================================================

#[test]
fn test_transfer_ownership() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.transfer_ownership(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_owner() == USER1(), 'Owner not transferred');
}

#[test]
#[should_panic(expected: 'Invalid new owner')]
fn test_transfer_ownership_zero_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.transfer_ownership(ZERO());
}

// ============================================================================
// VIEW FUNCTION TESTS
// ============================================================================

#[test]
fn test_get_total_sponsored() {
    let d = deploy_funded_with_whitelist();

    let fee: u256 = 100_000_000;
    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), fee, 'tx_1');
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_total_sponsored() == fee, 'Total sponsored wrong');
    assert(d.get_total_tx_count() == 1, 'TX count wrong');
}

#[test]
fn test_get_user_daily_spend() {
    let d = deploy_funded_with_whitelist();

    let fee: u256 = 100_000_000;
    start_cheat_caller_address(d.contract_address, OWNER());
    d.sponsor_transaction(USER1(), TARGET_CONTRACT(), fee, 'tx_1');
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_user_daily_spend(USER1()) == fee, 'User spend wrong');
}
