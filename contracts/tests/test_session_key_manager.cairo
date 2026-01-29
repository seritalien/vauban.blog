// Tests for SessionKeyManager contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::session_key_manager::{
    ISessionKeyManagerDispatcher, ISessionKeyManagerDispatcherTrait,
    SessionKey,
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

const SESSION_KEY_1: felt252 = 'session_key_1';
const SESSION_KEY_2: felt252 = 'session_key_2';
const FUNCTION_SELECTOR: felt252 = 'add_comment';
const SEVEN_DAYS: u64 = 604800;
const ONE_HOUR: u64 = 3600;

fn deploy() -> ISessionKeyManagerDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("SessionKeyManager").unwrap().contract_class();
    let mut constructor_args: Array<felt252> = array![];
    OWNER().serialize(ref constructor_args);
    let (address, _) = contract.deploy(@constructor_args).unwrap();
    ISessionKeyManagerDispatcher { contract_address: address }
}

fn create_test_session_key(
    d: ISessionKeyManagerDispatcher,
    caller: ContractAddress,
    session_key: felt252,
) -> bool {
    start_cheat_caller_address(d.contract_address, caller);
    let permissions: Array<(ContractAddress, felt252)> = array![
        (TARGET_CONTRACT(), FUNCTION_SELECTOR),
    ];
    let result = d.create_session_key(session_key, SEVEN_DAYS, 0, permissions);
    stop_cheat_caller_address(d.contract_address);
    result
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
fn test_constructor_not_paused() {
    let d = deploy();
    assert(!d.is_paused(), 'Should not be paused');
}

#[test]
fn test_constructor_zero_sessions() {
    let d = deploy();
    assert(d.get_total_sessions_created() == 0, 'Should be 0 sessions');
}

// ============================================================================
// CREATE SESSION KEY TESTS
// ============================================================================

#[test]
fn test_create_session_key() {
    let d = deploy();
    let result = create_test_session_key(d, USER1(), SESSION_KEY_1);
    assert(result, 'Create should succeed');
    assert(d.get_total_sessions_created() == 1, 'Should be 1 session');
}

#[test]
fn test_session_key_properties() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    let sk = d.get_session_key(SESSION_KEY_1);
    assert(sk.session_public_key == SESSION_KEY_1, 'Wrong session key');
    assert(sk.master_account == USER1(), 'Wrong master account');
    assert(sk.expires_at == 1000 + SEVEN_DAYS, 'Wrong expiry');
    assert(!sk.is_revoked, 'Should not be revoked');
    assert(sk.use_count == 0, 'Use count should be 0');
    assert(sk.max_uses == 0, 'Max uses should be 0');
}

#[test]
fn test_session_key_with_max_uses() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![
        (TARGET_CONTRACT(), FUNCTION_SELECTOR),
    ];
    d.create_session_key(SESSION_KEY_1, SEVEN_DAYS, 5, permissions);
    stop_cheat_caller_address(d.contract_address);

    let sk = d.get_session_key(SESSION_KEY_1);
    assert(sk.max_uses == 5, 'Max uses should be 5');
}

#[test]
fn test_session_key_default_expiry() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(SESSION_KEY_1, 0, 0, permissions); // 0 = use default
    stop_cheat_caller_address(d.contract_address);

    let sk = d.get_session_key(SESSION_KEY_1);
    assert(sk.expires_at == 1000 + SEVEN_DAYS, 'Should use default expiry');
}

#[test]
fn test_session_key_is_valid() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    assert(d.is_session_key_valid(SESSION_KEY_1), 'Should be valid');
}

#[test]
fn test_nonexistent_session_key_invalid() {
    let d = deploy();
    assert(!d.is_session_key_valid('nonexistent'), 'Should be invalid');
}

#[test]
#[should_panic(expected: 'Session key already exists')]
fn test_create_duplicate_session_key_panics() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);
    create_test_session_key(d, USER1(), SESSION_KEY_1);
}

#[test]
#[should_panic(expected: 'Invalid session key')]
fn test_create_zero_session_key_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(0, SEVEN_DAYS, 0, permissions);
}

#[test]
#[should_panic(expected: 'Invalid expiry duration')]
fn test_create_session_key_too_short_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(SESSION_KEY_1, 60, 0, permissions); // 60s < 1h min
}

// ============================================================================
// REVOKE SESSION KEY TESTS
// ============================================================================

#[test]
fn test_revoke_session_key() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER1());
    let result = d.revoke_session_key(SESSION_KEY_1);
    stop_cheat_caller_address(d.contract_address);

    assert(result, 'Revoke should succeed');
    assert(!d.is_session_key_valid(SESSION_KEY_1), 'Should be invalid');
    assert(d.get_total_sessions_revoked() == 1, 'Should be 1 revoked');
}

#[test]
#[should_panic(expected: 'Session key not found')]
fn test_revoke_nonexistent_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.revoke_session_key('nonexistent');
}

#[test]
#[should_panic(expected: 'Not session key owner')]
fn test_revoke_not_owner_panics() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER2());
    d.revoke_session_key(SESSION_KEY_1);
}

#[test]
#[should_panic(expected: 'Already revoked')]
fn test_revoke_already_revoked_panics() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER1());
    d.revoke_session_key(SESSION_KEY_1);
    d.revoke_session_key(SESSION_KEY_1);
}

// ============================================================================
// VALIDATE AND USE TESTS
// ============================================================================

#[test]
fn test_validate_and_use() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    let result = d.validate_and_use_session_key(
        SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR,
    );
    assert(result, 'Should validate');

    let sk = d.get_session_key(SESSION_KEY_1);
    assert(sk.use_count == 1, 'Use count should be 1');
}

#[test]
fn test_validate_no_permission_returns_false() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    let other_contract = contract_address_const::<'OTHER'>();
    let result = d.validate_and_use_session_key(
        SESSION_KEY_1, other_contract, FUNCTION_SELECTOR,
    );
    assert(!result, 'Should fail - no permission');
}

#[test]
fn test_validate_revoked_returns_false() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER1());
    d.revoke_session_key(SESSION_KEY_1);
    stop_cheat_caller_address(d.contract_address);

    let result = d.validate_and_use_session_key(
        SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR,
    );
    assert(!result, 'Should fail - revoked');
}

#[test]
fn test_validate_expired_returns_false() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    // Advance past expiry
    start_cheat_block_timestamp_global(1000 + SEVEN_DAYS + 1);

    let result = d.validate_and_use_session_key(
        SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR,
    );
    assert(!result, 'Should fail - expired');
}

#[test]
fn test_validate_max_uses_exceeded_returns_false() {
    let d = deploy();
    // Create session key with max 2 uses
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![
        (TARGET_CONTRACT(), FUNCTION_SELECTOR),
    ];
    d.create_session_key(SESSION_KEY_1, SEVEN_DAYS, 2, permissions);
    stop_cheat_caller_address(d.contract_address);

    // Use twice
    d.validate_and_use_session_key(SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR);
    d.validate_and_use_session_key(SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR);

    // Third use should fail
    let result = d.validate_and_use_session_key(
        SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR,
    );
    assert(!result, 'Should fail - max uses');
}

#[test]
fn test_validate_nonexistent_returns_false() {
    let d = deploy();
    let result = d.validate_and_use_session_key(
        'nonexistent', TARGET_CONTRACT(), FUNCTION_SELECTOR,
    );
    assert(!result, 'Should fail - not found');
}

// ============================================================================
// PERMISSION MANAGEMENT TESTS
// ============================================================================

#[test]
fn test_grant_permission() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    let other_selector: felt252 = 'like_post';
    start_cheat_caller_address(d.contract_address, USER1());
    d.grant_permission(SESSION_KEY_1, TARGET_CONTRACT(), other_selector);
    stop_cheat_caller_address(d.contract_address);

    assert(
        d.has_permission(SESSION_KEY_1, TARGET_CONTRACT(), other_selector),
        'Should have permission',
    );
}

#[test]
fn test_revoke_permission() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER1());
    d.revoke_permission(SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR);
    stop_cheat_caller_address(d.contract_address);

    assert(
        !d.has_permission(SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR),
        'Should not have permission',
    );
}

#[test]
#[should_panic(expected: 'Not session key owner')]
fn test_grant_permission_non_owner_panics() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER2());
    d.grant_permission(SESSION_KEY_1, TARGET_CONTRACT(), 'selector');
}

#[test]
fn test_has_permission() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    assert(
        d.has_permission(SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR),
        'Should have permission',
    );
    assert(
        !d.has_permission(SESSION_KEY_1, TARGET_CONTRACT(), 'other_selector'),
        'Should not have permission',
    );
}

// ============================================================================
// VIEW FUNCTION TESTS
// ============================================================================

#[test]
fn test_get_account_session_keys() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER1());
    let permissions2: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(SESSION_KEY_2, SEVEN_DAYS, 0, permissions2);
    stop_cheat_caller_address(d.contract_address);

    let keys = d.get_account_session_keys(USER1(), 10, 0);
    assert(keys.len() == 2, 'Should have 2 keys');
}

#[test]
fn test_get_account_session_keys_pagination() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, USER1());
    let permissions2: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(SESSION_KEY_2, SEVEN_DAYS, 0, permissions2);
    stop_cheat_caller_address(d.contract_address);

    let keys = d.get_account_session_keys(USER1(), 1, 0);
    assert(keys.len() == 1, 'Should return 1 key');

    let keys2 = d.get_account_session_keys(USER1(), 10, 1);
    assert(keys2.len() == 1, 'Should return 1 key offset');
}

// ============================================================================
// ADMIN FUNCTION TESTS
// ============================================================================

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
fn test_set_default_expiry_duration() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_default_expiry_duration(ONE_HOUR * 24); // 1 day
    stop_cheat_caller_address(d.contract_address);
    // Verify by creating session key with default
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(SESSION_KEY_1, 0, 0, permissions); // 0 = default
    stop_cheat_caller_address(d.contract_address);

    let sk = d.get_session_key(SESSION_KEY_1);
    assert(sk.expires_at == 1000 + ONE_HOUR * 24, 'Should use new default');
}

#[test]
fn test_set_max_expiry_duration() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_max_expiry_duration(ONE_HOUR * 48); // 2 days
    stop_cheat_caller_address(d.contract_address);
    // Verify: creating a session key with duration > 2 days should fail
}

#[test]
fn test_set_min_expiry_duration() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_min_expiry_duration(60); // 1 minute
    stop_cheat_caller_address(d.contract_address);
    // Now creating with 60s should work (was previously too short)
    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![];
    let result = d.create_session_key(SESSION_KEY_1, 60, 0, permissions);
    stop_cheat_caller_address(d.contract_address);
    assert(result, 'Should succeed with new min');
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
#[should_panic(expected: 'Manager is paused')]
fn test_create_session_key_when_paused_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, USER1());
    let permissions: Array<(ContractAddress, felt252)> = array![];
    d.create_session_key(SESSION_KEY_1, SEVEN_DAYS, 0, permissions);
}

#[test]
#[should_panic(expected: 'Manager is paused')]
fn test_validate_when_paused_panics() {
    let d = deploy();
    create_test_session_key(d, USER1(), SESSION_KEY_1);

    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    d.validate_and_use_session_key(SESSION_KEY_1, TARGET_CONTRACT(), FUNCTION_SELECTOR);
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

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_transfer_ownership_non_owner_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.transfer_ownership(USER2());
}
