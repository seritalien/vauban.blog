// Tests for Treasury contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::treasury::{
    ITreasuryDispatcher, ITreasuryDispatcherTrait,
};

// ============================================================================
// TEST HELPERS
// ============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn ADMIN() -> ContractAddress {
    contract_address_const::<'ADMIN'>()
}

fn AUTHOR() -> ContractAddress {
    contract_address_const::<'AUTHOR'>()
}

fn PAYER() -> ContractAddress {
    contract_address_const::<'PAYER'>()
}

fn REFERRER() -> ContractAddress {
    contract_address_const::<'REFERRER'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

fn AUTHORIZED_CONTRACT() -> ContractAddress {
    contract_address_const::<'AUTH_CONTRACT'>()
}

fn COLLABORATOR1() -> ContractAddress {
    contract_address_const::<'COLLAB1'>()
}

fn COLLABORATOR2() -> ContractAddress {
    contract_address_const::<'COLLAB2'>()
}

fn ZERO() -> ContractAddress {
    contract_address_const::<0>()
}

fn deploy() -> ITreasuryDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("Treasury").unwrap().contract_class();
    let mut constructor_args: Array<felt252> = array![];
    OWNER().serialize(ref constructor_args);
    let (address, _) = contract.deploy(@constructor_args).unwrap();
    ITreasuryDispatcher { contract_address: address }
}

fn deploy_with_auth_contract() -> ITreasuryDispatcher {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.authorize_contract(AUTHORIZED_CONTRACT());
    stop_cheat_caller_address(d.contract_address);
    d
}

fn distribute_test_payment(
    d: ITreasuryDispatcher,
    post_id: u64,
    amount: u256,
) {
    start_cheat_caller_address(d.contract_address, AUTHORIZED_CONTRACT());
    d.distribute_payment(post_id, AUTHOR(), amount, PAYER());
    stop_cheat_caller_address(d.contract_address);
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
fn test_constructor_owner_is_admin() {
    let d = deploy();
    assert(d.is_admin(OWNER()), 'Owner not admin');
}

#[test]
fn test_constructor_not_paused() {
    let d = deploy();
    assert(!d.is_paused(), 'Should not be paused');
}

#[test]
fn test_constructor_default_config() {
    let d = deploy();
    let config = d.get_config();
    assert(config.platform_fee_bps == 1000, 'Default fee not 1000');
    assert(config.referral_fee_bps == 500, 'Default referral not 500');
    assert(config.min_withdrawal == 1000000000000000000, 'Default min wrong');
}

#[test]
fn test_constructor_zero_stats() {
    let d = deploy();
    assert(d.get_total_volume() == 0, 'Volume should be 0');
    assert(d.get_payment_count() == 0, 'Count should be 0');
    assert(d.get_platform_balance() == 0, 'Balance should be 0');
}

// ============================================================================
// DISTRIBUTE PAYMENT TESTS
// ============================================================================

#[test]
fn test_distribute_payment_basic() {
    let d = deploy_with_auth_contract();

    let amount: u256 = 10000;
    distribute_test_payment(d, 1, amount);

    // Platform fee = 10000 * 1000 / 10000 = 1000
    // No referrer, so author gets 10000 - 1000 = 9000
    let author_earnings = d.get_earnings(AUTHOR());
    assert(author_earnings.pending == 9000, 'Author should get 9000');
    assert(author_earnings.total_earned == 9000, 'Total earned wrong');

    assert(d.get_platform_balance() == 1000, 'Platform fee wrong');
    assert(d.get_total_volume() == amount, 'Volume wrong');
    assert(d.get_payment_count() == 1, 'Payment count wrong');
}

#[test]
fn test_distribute_payment_with_referrer() {
    let d = deploy_with_auth_contract();

    // Set referrer for PAYER
    start_cheat_caller_address(d.contract_address, PAYER());
    d.set_referrer(REFERRER());
    stop_cheat_caller_address(d.contract_address);

    let amount: u256 = 10000;
    distribute_test_payment(d, 1, amount);

    // Platform fee = 10000 * 1000 / 10000 = 1000
    // Referrer fee = 10000 * 500 / 10000 = 500
    // Author = 10000 - 1000 - 500 = 8500
    let author_earnings = d.get_earnings(AUTHOR());
    assert(author_earnings.pending == 8500, 'Author should get 8500');

    let referrer_earnings = d.get_earnings(REFERRER());
    assert(referrer_earnings.pending == 500, 'Referrer should get 500');

    assert(d.get_platform_balance() == 1000, 'Platform fee wrong');
    assert(d.get_total_referral_fees() == 500, 'Referral fees wrong');
}

#[test]
fn test_distribute_payment_records_payment() {
    let d = deploy_with_auth_contract();

    let amount: u256 = 10000;
    distribute_test_payment(d, 42, amount);

    let payment = d.get_payment(1);
    assert(payment.id == 1, 'Payment ID wrong');
    assert(payment.post_id == 42, 'Post ID wrong');
    assert(payment.amount == amount, 'Amount wrong');
    assert(payment.payer == PAYER(), 'Payer wrong');
}

#[test]
#[should_panic(expected: 'Not authorized contract')]
fn test_distribute_unauthorized_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.distribute_payment(1, AUTHOR(), 10000, PAYER());
}

#[test]
#[should_panic(expected: 'Amount must be positive')]
fn test_distribute_zero_amount_panics() {
    let d = deploy_with_auth_contract();
    start_cheat_caller_address(d.contract_address, AUTHORIZED_CONTRACT());
    d.distribute_payment(1, AUTHOR(), 0, PAYER());
}

#[test]
#[should_panic(expected: 'Invalid author')]
fn test_distribute_zero_author_panics() {
    let d = deploy_with_auth_contract();
    start_cheat_caller_address(d.contract_address, AUTHORIZED_CONTRACT());
    d.distribute_payment(1, ZERO(), 10000, PAYER());
}

// ============================================================================
// WITHDRAW EARNINGS TESTS
// ============================================================================

#[test]
fn test_withdraw_earnings() {
    let d = deploy_with_auth_contract();

    // First need to update min_withdrawal to something small for test
    start_cheat_caller_address(d.contract_address, OWNER());
    d.update_config(1000, 500, 100); // min_withdrawal = 100
    stop_cheat_caller_address(d.contract_address);

    let amount: u256 = 10000;
    distribute_test_payment(d, 1, amount);

    // Author withdraws
    start_cheat_caller_address(d.contract_address, AUTHOR());
    let withdrawn = d.withdraw_earnings();
    stop_cheat_caller_address(d.contract_address);

    assert(withdrawn == 9000, 'Should withdraw 9000');
    let author_earnings = d.get_earnings(AUTHOR());
    assert(author_earnings.pending == 0, 'Pending should be 0');
    assert(author_earnings.total_withdrawn == 9000, 'Total withdrawn wrong');
}

#[test]
#[should_panic(expected: 'Below min withdrawal')]
fn test_withdraw_below_minimum_panics() {
    let d = deploy();
    // Default min_withdrawal is 1e18, user has 0 pending
    start_cheat_caller_address(d.contract_address, USER1());
    d.withdraw_earnings();
}

// ============================================================================
// REVENUE SPLIT TESTS
// ============================================================================

#[test]
fn test_set_revenue_split() {
    let d = deploy_with_auth_contract();

    // Set up revenue split: collab1 gets 30%, collab2 gets 20%
    let collaborators: Array<(ContractAddress, u16)> = array![
        (COLLABORATOR1(), 3000), // 30%
        (COLLABORATOR2(), 2000), // 20%
    ];
    start_cheat_caller_address(d.contract_address, USER1());
    d.set_revenue_split(1, collaborators);
    stop_cheat_caller_address(d.contract_address);

    // Now distribute payment
    let amount: u256 = 10000;
    distribute_test_payment(d, 1, amount);

    // Platform fee = 1000
    // Author share (before splits) = 9000
    // Collab1 = 9000 * 3000 / 10000 = 2700
    // Collab2 = 9000 * 2000 / 10000 = 1800
    // Author remaining = 9000 - 2700 - 1800 = 4500
    let collab1 = d.get_earnings(COLLABORATOR1());
    assert(collab1.pending == 2700, 'Collab1 should get 2700');

    let collab2 = d.get_earnings(COLLABORATOR2());
    assert(collab2.pending == 1800, 'Collab2 should get 1800');

    let author = d.get_earnings(AUTHOR());
    assert(author.pending == 4500, 'Author should get 4500');
}

#[test]
#[should_panic(expected: 'Total exceeds 100%')]
fn test_revenue_split_exceeds_100_panics() {
    let d = deploy();
    let collaborators: Array<(ContractAddress, u16)> = array![
        (COLLABORATOR1(), 6000),
        (COLLABORATOR2(), 5000), // Total = 11000 > 10000
    ];
    start_cheat_caller_address(d.contract_address, USER1());
    d.set_revenue_split(1, collaborators);
}

// ============================================================================
// REFERRAL SYSTEM TESTS
// ============================================================================

#[test]
fn test_set_referrer() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.set_referrer(REFERRER());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_referrer(USER1()) == REFERRER(), 'Referrer not set');
}

#[test]
#[should_panic(expected: 'Referrer already set')]
fn test_set_referrer_already_set_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.set_referrer(REFERRER());
    d.set_referrer(REFERRER()); // Second set should fail
}

#[test]
#[should_panic(expected: 'Cannot refer self')]
fn test_set_referrer_self_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.set_referrer(USER1());
}

#[test]
#[should_panic(expected: 'Invalid referrer')]
fn test_set_referrer_zero_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.set_referrer(ZERO());
}

// ============================================================================
// ADMIN FUNCTION TESTS
// ============================================================================

#[test]
fn test_update_config() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.update_config(500, 200, 5000);
    stop_cheat_caller_address(d.contract_address);

    let config = d.get_config();
    assert(config.platform_fee_bps == 500, 'Platform fee not updated');
    assert(config.referral_fee_bps == 200, 'Referral fee not updated');
    assert(config.min_withdrawal == 5000, 'Min withdrawal not updated');
}

#[test]
#[should_panic(expected: 'Platform fee too high')]
fn test_update_config_fee_too_high_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.update_config(2001, 500, 1000); // > 20%
}

#[test]
#[should_panic(expected: 'Referral fee too high')]
fn test_update_config_referral_too_high_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.update_config(1000, 1001, 1000); // > 10%
}

#[test]
fn test_update_config_at_max_individual_limits() {
    // MAX_PLATFORM_FEE_BPS=2000, MAX_REFERRAL_FEE_BPS=1000
    // Combined max 2000+1000=3000 <= 5000, so this should succeed
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.update_config(2000, 1000, 1000);
    stop_cheat_caller_address(d.contract_address);

    let config = d.get_config();
    assert(config.platform_fee_bps == 2000, 'Fee should be 2000');
    assert(config.referral_fee_bps == 1000, 'Referral should be 1000');
}

#[test]
fn test_authorize_contract() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.authorize_contract(AUTHORIZED_CONTRACT());
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_authorized(AUTHORIZED_CONTRACT()), 'Should be authorized');
}

#[test]
fn test_deauthorize_contract() {
    let d = deploy_with_auth_contract();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.deauthorize_contract(AUTHORIZED_CONTRACT());
    stop_cheat_caller_address(d.contract_address);

    assert(!d.is_authorized(AUTHORIZED_CONTRACT()), 'Should not be authorized');
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
#[should_panic(expected: 'Cannot remove owner')]
fn test_remove_owner_as_admin_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.remove_admin(OWNER());
}

#[test]
fn test_withdraw_platform_fees() {
    let d = deploy_with_auth_contract();
    distribute_test_payment(d, 1, 10000);
    // Platform balance should be 1000

    let recipient = contract_address_const::<'RECIPIENT'>();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.withdraw_platform_fees(recipient, 500);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_platform_balance() == 500, 'Balance should be 500');
}

#[test]
#[should_panic(expected: 'Insufficient balance')]
fn test_withdraw_platform_fees_insufficient_panics() {
    let d = deploy();
    let recipient = contract_address_const::<'RECIPIENT'>();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.withdraw_platform_fees(recipient, 1);
}

// ============================================================================
// EMERGENCY CONTROLS TESTS
// ============================================================================

#[test]
fn test_pause() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_paused(), 'Should be paused');
}

#[test]
fn test_unpause() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    d.unpause();
    stop_cheat_caller_address(d.contract_address);

    assert(!d.is_paused(), 'Should not be paused');
}

#[test]
#[should_panic(expected: 'Treasury is paused')]
fn test_distribute_when_paused_panics() {
    let d = deploy_with_auth_contract();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, AUTHORIZED_CONTRACT());
    d.distribute_payment(1, AUTHOR(), 10000, PAYER());
}

#[test]
#[should_panic(expected: 'Treasury is paused')]
fn test_withdraw_when_paused_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, USER1());
    d.withdraw_earnings();
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
    assert(d.is_admin(USER1()), 'New owner should be admin');
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
fn test_get_total_distributed_to_creators() {
    let d = deploy_with_auth_contract();
    distribute_test_payment(d, 1, 10000);

    // Author share = 9000 (no referrer)
    assert(d.get_total_distributed_to_creators() == 9000, 'Distributed wrong');
}

#[test]
fn test_get_total_platform_fees() {
    let d = deploy_with_auth_contract();
    distribute_test_payment(d, 1, 10000);

    assert(d.get_total_platform_fees() == 1000, 'Platform fees wrong');
}

#[test]
fn test_multiple_payments_accumulate() {
    let d = deploy_with_auth_contract();
    distribute_test_payment(d, 1, 10000);
    distribute_test_payment(d, 2, 20000);

    // Author total: 9000 + 18000 = 27000
    let author = d.get_earnings(AUTHOR());
    assert(author.pending == 27000, 'Author accumulated wrong');
    assert(d.get_total_volume() == 30000, 'Volume wrong');
    assert(d.get_payment_count() == 2, 'Payment count wrong');
}
