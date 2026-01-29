// Tests for RoleRegistry contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::role_registry::{
    IRoleRegistryDispatcher, IRoleRegistryDispatcherTrait,
    ROLE_READER, ROLE_WRITER, ROLE_CONTRIBUTOR, ROLE_MODERATOR,
    ROLE_EDITOR, ROLE_ADMIN, ROLE_OWNER
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

fn EDITOR() -> ContractAddress {
    contract_address_const::<'EDITOR'>()
}

fn MODERATOR() -> ContractAddress {
    contract_address_const::<'MODERATOR'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

fn USER2() -> ContractAddress {
    contract_address_const::<'USER2'>()
}

fn ZERO() -> ContractAddress {
    contract_address_const::<0>()
}

fn deploy() -> IRoleRegistryDispatcher {
    // Set non-zero timestamp so granted_at != 0 (needed for registration checks)
    start_cheat_block_timestamp_global(1000);
    let contract = declare("RoleRegistry").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![OWNER().into()]).unwrap();
    IRoleRegistryDispatcher { contract_address: address }
}

fn deploy_and_setup_roles() -> IRoleRegistryDispatcher {
    let contract = deploy();

    // Owner grants admin role
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(ADMIN(), ROLE_ADMIN);
    stop_cheat_caller_address(contract.contract_address);

    // Admin grants editor role
    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.grant_role(EDITOR(), ROLE_EDITOR);
    stop_cheat_caller_address(contract.contract_address);

    // Editor grants moderator role
    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.grant_role(MODERATOR(), ROLE_MODERATOR);
    stop_cheat_caller_address(contract.contract_address);

    contract
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

#[test]
fn test_constructor_sets_owner() {
    let contract = deploy();
    assert(contract.get_owner() == OWNER(), 'Owner mismatch');
}

#[test]
fn test_constructor_grants_owner_role() {
    let contract = deploy();
    assert(contract.get_role(OWNER()) == ROLE_OWNER, 'Owner role mismatch');
}

#[test]
fn test_constructor_initializes_stats() {
    let contract = deploy();
    assert(contract.get_total_users() == 1, 'Total users should be 1');
    assert(contract.get_users_by_role(ROLE_OWNER) == 1, 'Owner count should be 1');
}

#[test]
fn test_constructor_sets_default_threshold() {
    let contract = deploy();
    assert(contract.get_contributor_threshold() == 5, 'Threshold should be 5');
}

// ============================================================================
// ROLE GRANTING TESTS
// ============================================================================

#[test]
fn test_owner_can_grant_admin() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(ADMIN(), ROLE_ADMIN);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(ADMIN()) == ROLE_ADMIN, 'Admin role mismatch');
    assert(contract.get_users_by_role(ROLE_ADMIN) == 1, 'Admin count mismatch');
}

#[test]
fn test_owner_can_grant_any_role() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(USER1(), ROLE_EDITOR);
    contract.grant_role(USER2(), ROLE_MODERATOR);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(USER1()) == ROLE_EDITOR, 'User1 role mismatch');
    assert(contract.get_role(USER2()) == ROLE_MODERATOR, 'User2 role mismatch');
}

#[test]
fn test_admin_can_grant_up_to_editor() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.grant_role(USER1(), ROLE_EDITOR);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(USER1()) == ROLE_EDITOR, 'Editor role mismatch');
}

#[test]
#[should_panic(expected: 'Cannot grant this role')]
fn test_admin_cannot_grant_admin() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.grant_role(USER1(), ROLE_ADMIN);
}

#[test]
fn test_editor_can_grant_up_to_moderator() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.grant_role(USER1(), ROLE_MODERATOR);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(USER1()) == ROLE_MODERATOR, 'Moderator role mismatch');
}

#[test]
#[should_panic(expected: 'Cannot grant this role')]
fn test_editor_cannot_grant_editor() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.grant_role(USER1(), ROLE_EDITOR);
}

#[test]
#[should_panic(expected: 'Cannot grant this role')]
fn test_moderator_cannot_grant_roles() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, MODERATOR());
    contract.grant_role(USER1(), ROLE_WRITER);
}

#[test]
#[should_panic(expected: 'Invalid user address')]
fn test_grant_role_to_zero_address_fails() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(ZERO(), ROLE_WRITER);
}

#[test]
#[should_panic(expected: 'Invalid role')]
fn test_grant_invalid_role_fails() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(USER1(), 100);
}

// ============================================================================
// USER REGISTRATION TESTS
// ============================================================================

#[test]
fn test_user_can_register() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    let result = contract.register_user();
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Registration should succeed');
    assert(contract.get_role(USER1()) == ROLE_WRITER, 'Should be WRITER');
    assert(contract.get_total_users() == 2, 'Total users should be 2');
}

#[test]
fn test_already_registered_user_returns_false() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    let result = contract.register_user();  // Second registration
    stop_cheat_caller_address(contract.contract_address);

    assert(!result, 'Should return false');
}

// ============================================================================
// ROLE REVOCATION TESTS
// ============================================================================

#[test]
fn test_owner_can_revoke_role() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.revoke_role(ADMIN());
    stop_cheat_caller_address(contract.contract_address);

    // Revoked users become READER
    assert(contract.get_role(ADMIN()) == ROLE_READER, 'Should be READER');
}

#[test]
fn test_admin_can_revoke_lower_roles() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.revoke_role(EDITOR());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(EDITOR()) == ROLE_READER, 'Should be READER');
}

#[test]
#[should_panic(expected: 'Cannot revoke this role')]
fn test_admin_cannot_revoke_equal_role() {
    let contract = deploy_and_setup_roles();

    // Grant another admin
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(USER1(), ROLE_ADMIN);
    stop_cheat_caller_address(contract.contract_address);

    // Admin tries to revoke another admin
    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.revoke_role(USER1());
}

#[test]
#[should_panic(expected: 'User has no role')]
fn test_revoke_unregistered_user_fails() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.revoke_role(USER1());
}

// ============================================================================
// ROLE REQUEST TESTS
// ============================================================================

#[test]
fn test_user_can_request_role() {
    let contract = deploy();

    // Register user first
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    let request_id = contract.request_role(ROLE_MODERATOR);
    stop_cheat_caller_address(contract.contract_address);

    assert(request_id == 1, 'Request ID should be 1');
    assert(contract.get_pending_request(USER1()) == 1, 'Pending request should be 1');
}

#[test]
#[should_panic(expected: 'Not registered')]
fn test_unregistered_user_cannot_request_role() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.request_role(ROLE_MODERATOR);
}

#[test]
#[should_panic(expected: 'Must request higher role')]
fn test_cannot_request_same_or_lower_role() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();  // Becomes WRITER
    contract.request_role(ROLE_WRITER);  // Same role
}

#[test]
#[should_panic(expected: 'Cannot request this role')]
fn test_cannot_request_high_roles() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    contract.request_role(ROLE_EDITOR);  // Too high for self-request
}

#[test]
#[should_panic(expected: 'Already has pending request')]
fn test_cannot_have_multiple_pending_requests() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    contract.request_role(ROLE_CONTRIBUTOR);
    contract.request_role(ROLE_MODERATOR);  // Second request should fail
}

// ============================================================================
// REQUEST APPROVAL TESTS
// ============================================================================

#[test]
fn test_editor_can_approve_request() {
    let contract = deploy_and_setup_roles();

    // User registers and requests role
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    let request_id = contract.request_role(ROLE_CONTRIBUTOR);
    stop_cheat_caller_address(contract.contract_address);

    // Editor approves
    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.approve_request(request_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(USER1()) == ROLE_CONTRIBUTOR, 'Should be CONTRIBUTOR');
    assert(contract.get_pending_request(USER1()) == 0, 'Pending should be 0');
}

#[test]
#[should_panic(expected: 'Request not found')]
fn test_approve_nonexistent_request_fails() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.approve_request(999);
}

#[test]
#[should_panic(expected: 'Already processed')]
fn test_approve_already_approved_fails() {
    let contract = deploy_and_setup_roles();

    // User registers and requests role
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    let request_id = contract.request_role(ROLE_CONTRIBUTOR);
    stop_cheat_caller_address(contract.contract_address);

    // Approve twice
    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.approve_request(request_id);
    contract.approve_request(request_id);
}

// ============================================================================
// REQUEST REJECTION TESTS
// ============================================================================

#[test]
fn test_editor_can_reject_request() {
    let contract = deploy_and_setup_roles();

    // User registers and requests role
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    let request_id = contract.request_role(ROLE_CONTRIBUTOR);
    stop_cheat_caller_address(contract.contract_address);

    // Editor rejects
    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.reject_request(request_id);
    stop_cheat_caller_address(contract.contract_address);

    // Role should remain WRITER
    assert(contract.get_role(USER1()) == ROLE_WRITER, 'Should remain WRITER');
    assert(contract.get_pending_request(USER1()) == 0, 'Pending should be 0');

    let request = contract.get_request(request_id);
    assert(request.is_rejected, 'Should be rejected');
}

// ============================================================================
// AUTO-PROMOTION TESTS
// ============================================================================

#[test]
fn test_auto_promotion_to_contributor() {
    let contract = deploy_and_setup_roles();

    // Register user as writer
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(USER1()) == ROLE_WRITER, 'Should be WRITER');

    // Increment approved posts (called by editor/admin)
    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.increment_approved_posts(USER1());  // 1
    contract.increment_approved_posts(USER1());  // 2
    contract.increment_approved_posts(USER1());  // 3
    contract.increment_approved_posts(USER1());  // 4
    contract.increment_approved_posts(USER1());  // 5 -> auto-promote
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_role(USER1()) == ROLE_CONTRIBUTOR, 'Should be CONTRIBUTOR');
}

#[test]
fn test_no_auto_promotion_below_threshold() {
    let contract = deploy_and_setup_roles();

    // Register user
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    stop_cheat_caller_address(contract.contract_address);

    // Only 4 approved posts (threshold is 5)
    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.increment_approved_posts(USER1());
    contract.increment_approved_posts(USER1());
    contract.increment_approved_posts(USER1());
    contract.increment_approved_posts(USER1());
    stop_cheat_caller_address(contract.contract_address);

    // Should still be WRITER
    assert(contract.get_role(USER1()) == ROLE_WRITER, 'Should still be WRITER');
}

// ============================================================================
// REPUTATION TESTS
// ============================================================================

#[test]
fn test_add_reputation() {
    let contract = deploy_and_setup_roles();

    // Register user
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    stop_cheat_caller_address(contract.contract_address);

    // Add reputation (by moderator+)
    start_cheat_caller_address(contract.contract_address, MODERATOR());
    contract.add_reputation(USER1(), 100);
    stop_cheat_caller_address(contract.contract_address);

    let user_role = contract.get_user_role(USER1());
    assert(user_role.reputation == 100, 'Reputation should be 100');
}

// ============================================================================
// VIEW FUNCTION TESTS
// ============================================================================

#[test]
fn test_has_role() {
    let contract = deploy_and_setup_roles();

    // ADMIN has role >= EDITOR
    assert(contract.has_role(ADMIN(), ROLE_EDITOR), 'Admin has editor+');
    assert(contract.has_role(ADMIN(), ROLE_MODERATOR), 'Admin has moderator+');
    assert(contract.has_role(ADMIN(), ROLE_ADMIN), 'Admin has admin+');
    assert(!contract.has_role(ADMIN(), ROLE_OWNER), 'Admin not owner');
}

#[test]
fn test_can_publish_immediately() {
    let contract = deploy_and_setup_roles();

    // Register a writer
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    stop_cheat_caller_address(contract.contract_address);

    // Writer cannot publish immediately
    assert(!contract.can_publish_immediately(USER1()), 'Writer cannot publish');

    // Editor can
    assert(contract.can_publish_immediately(EDITOR()), 'Editor can publish');
}

#[test]
fn test_can_approve_content() {
    let contract = deploy_and_setup_roles();

    assert(!contract.can_approve_content(MODERATOR()), 'Mod cannot approve');
    assert(contract.can_approve_content(EDITOR()), 'Editor can approve');
    assert(contract.can_approve_content(ADMIN()), 'Admin can approve');
}

#[test]
fn test_can_moderate() {
    let contract = deploy_and_setup_roles();

    // Register a writer
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.register_user();
    stop_cheat_caller_address(contract.contract_address);

    assert(!contract.can_moderate(USER1()), 'Writer cannot moderate');
    assert(contract.can_moderate(MODERATOR()), 'Mod can moderate');
    assert(contract.can_moderate(EDITOR()), 'Editor can moderate');
}

#[test]
fn test_get_users_by_role_counts() {
    let contract = deploy_and_setup_roles();

    assert(contract.get_users_by_role(ROLE_OWNER) == 1, 'Owner count');
    assert(contract.get_users_by_role(ROLE_ADMIN) == 1, 'Admin count');
    assert(contract.get_users_by_role(ROLE_EDITOR) == 1, 'Editor count');
    assert(contract.get_users_by_role(ROLE_MODERATOR) == 1, 'Moderator count');
}

// ============================================================================
// ADMIN FUNCTION TESTS
// ============================================================================

#[test]
fn test_set_contributor_threshold() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.set_contributor_threshold(10);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_contributor_threshold() == 10, 'Threshold should be 10');
}

#[test]
#[should_panic(expected: 'Invalid threshold')]
fn test_set_contributor_threshold_invalid() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.set_contributor_threshold(0);  // Invalid
}

#[test]
#[should_panic(expected: 'Insufficient role')]
fn test_non_admin_cannot_set_threshold() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, EDITOR());
    contract.set_contributor_threshold(10);
}

// ============================================================================
// EMERGENCY CONTROL TESTS
// ============================================================================

#[test]
fn test_admin_can_pause() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.is_paused(), 'Should be paused');
}

#[test]
fn test_only_owner_can_unpause() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.unpause();
    stop_cheat_caller_address(contract.contract_address);

    assert(!contract.is_paused(), 'Should not be paused');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_admin_cannot_unpause() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.pause();
    contract.unpause();  // Should fail
}

#[test]
#[should_panic(expected: 'Registry is paused')]
fn test_cannot_grant_role_when_paused() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.grant_role(USER1(), ROLE_WRITER);
}

// ============================================================================
// OWNERSHIP TRANSFER TESTS
// ============================================================================

#[test]
fn test_transfer_ownership() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.transfer_ownership(USER1());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_owner() == USER1(), 'New owner mismatch');
    assert(contract.get_role(USER1()) == ROLE_OWNER, 'New owner role');
    assert(contract.get_role(OWNER()) == ROLE_ADMIN, 'Old owner demoted');
}

#[test]
#[should_panic(expected: 'Invalid new owner')]
fn test_transfer_ownership_to_zero_fails() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.transfer_ownership(ZERO());
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_transfer_ownership() {
    let contract = deploy_and_setup_roles();

    start_cheat_caller_address(contract.contract_address, ADMIN());
    contract.transfer_ownership(USER1());
}

// ============================================================================
// UNREGISTERED USER TESTS
// ============================================================================

#[test]
fn test_unregistered_user_is_reader() {
    let contract = deploy();

    // Unregistered user should be treated as READER
    assert(contract.get_role(USER1()) == ROLE_READER, 'Should be READER');
}

#[test]
fn test_unregistered_user_has_reader_role() {
    let contract = deploy();

    assert(contract.has_role(USER1(), ROLE_READER), 'Has READER');
    assert(!contract.has_role(USER1(), ROLE_WRITER), 'Not WRITER');
}
