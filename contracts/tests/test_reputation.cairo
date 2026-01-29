// Tests for Reputation contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::reputation::{
    IReputationDispatcher, IReputationDispatcherTrait,
    REP_POST_PUBLISHED, REP_POST_FEATURED, REP_COMMENT, REP_LIKE_RECEIVED,
    REP_SUBSCRIBER_GAINED, REP_SPAM_PENALTY,
    BADGE_FIRST_POST, BADGE_PROLIFIC_WRITER, BADGE_FEATURED_AUTHOR,
    BADGE_EARLY_ADOPTER, BADGE_VERIFIED, BADGE_PREMIUM_AUTHOR,
    LEVEL_2_THRESHOLD, LEVEL_3_THRESHOLD,
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

fn AUTHORIZED_CONTRACT() -> ContractAddress {
    contract_address_const::<'AUTH_CONTRACT'>()
}

fn ZERO() -> ContractAddress {
    contract_address_const::<0>()
}

fn deploy() -> IReputationDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("Reputation").unwrap().contract_class();
    let mut constructor_args: Array<felt252> = array![];
    OWNER().serialize(ref constructor_args);
    let (address, _) = contract.deploy(@constructor_args).unwrap();
    IReputationDispatcher { contract_address: address }
}

fn deploy_with_authorized_contract() -> IReputationDispatcher {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.authorize_contract(AUTHORIZED_CONTRACT());
    stop_cheat_caller_address(d.contract_address);
    d
}

fn register_user(d: IReputationDispatcher, user: ContractAddress) {
    start_cheat_caller_address(d.contract_address, OWNER());
    d.register_user(user);
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
fn test_constructor_zero_users() {
    let d = deploy();
    assert(d.get_total_users() == 0, 'Should have 0 users');
}

// ============================================================================
// USER REGISTRATION TESTS
// ============================================================================

#[test]
fn test_register_user() {
    let d = deploy();
    register_user(d, USER1());

    assert(d.get_total_users() == 1, 'Should have 1 user');
    let rep = d.get_reputation(USER1());
    assert(rep.total_points == 0, 'Points should be 0');
    assert(rep.level == 1, 'Level should be 1');
    assert(rep.joined_at == 1000, 'Wrong join time');
}

#[test]
fn test_register_user_already_registered_silent() {
    let d = deploy();
    register_user(d, USER1());
    register_user(d, USER1()); // Should not panic, just return

    assert(d.get_total_users() == 1, 'Should still have 1 user');
}

#[test]
fn test_register_by_authorized_contract() {
    let d = deploy_with_authorized_contract();
    start_cheat_caller_address(d.contract_address, AUTHORIZED_CONTRACT());
    d.register_user(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_total_users() == 1, 'Should have 1 user');
}

#[test]
#[should_panic(expected: 'Not authorized')]
fn test_register_unauthorized_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER2());
    d.register_user(USER1());
}

// ============================================================================
// POINT AWARD TESTS
// ============================================================================

#[test]
fn test_award_post_published() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == REP_POST_PUBLISHED, 'Wrong points');
    let rep = d.get_reputation(USER1());
    assert(rep.post_count == 1, 'Post count should be 1');
}

#[test]
fn test_award_post_featured() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_featured(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == REP_POST_FEATURED, 'Wrong points');
    let rep = d.get_reputation(USER1());
    assert(rep.featured_count == 1, 'Featured count should be 1');
}

#[test]
fn test_award_comment() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_comment(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == REP_COMMENT, 'Wrong points');
    let rep = d.get_reputation(USER1());
    assert(rep.comment_count == 1, 'Comment count should be 1');
}

#[test]
fn test_award_like_received() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_like_received(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == REP_LIKE_RECEIVED, 'Wrong points');
    let rep = d.get_reputation(USER1());
    assert(rep.likes_received == 1, 'Likes count should be 1');
}

#[test]
fn test_award_subscriber_gained() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_subscriber_gained(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == REP_SUBSCRIBER_GAINED, 'Wrong points');
    let rep = d.get_reputation(USER1());
    assert(rep.subscribers == 1, 'Subscriber count should be 1');
}

#[test]
fn test_award_unregistered_user_silent() {
    let d = deploy();
    // Don't register USER1, just try to award
    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == 0, 'Should be 0 - not registered');
}

// ============================================================================
// LEVEL UP TESTS
// ============================================================================

#[test]
fn test_level_up_to_2() {
    let d = deploy();
    register_user(d, USER1());

    // REP_POST_PUBLISHED = 100, LEVEL_2_THRESHOLD = 100
    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_level(USER1()) == 2, 'Should be level 2');
}

#[test]
fn test_level_up_to_3() {
    let d = deploy();
    register_user(d, USER1());

    // Need 500 points for level 3
    // REP_POST_FEATURED = 500
    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_featured(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_level(USER1()) == 3, 'Should be level 3');
}

#[test]
fn test_cumulative_points() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1()); // 100
    d.award_comment(USER1());        // 10
    d.award_like_received(USER1());  // 5
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == 115, 'Should have 115 points');
}

// ============================================================================
// PENALTY TESTS
// ============================================================================

#[test]
fn test_spam_penalty() {
    let d = deploy();
    register_user(d, USER1());

    // Give some points first
    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_featured(USER1()); // 500 points
    d.apply_spam_penalty(USER1());  // -200 points
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == 300, 'Should have 300 points');
}

#[test]
fn test_spam_penalty_doesnt_go_below_zero() {
    let d = deploy();
    register_user(d, USER1());

    // Give small amount, then penalize
    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_comment(USER1()); // 10 points
    d.apply_spam_penalty(USER1()); // -200, but should floor at 0
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_points(USER1()) == 0, 'Should be 0, not negative');
}

#[test]
fn test_penalty_can_reduce_level() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1()); // 100 pts -> level 2
    stop_cheat_caller_address(d.contract_address);
    assert(d.get_level(USER1()) == 2, 'Should be level 2');

    start_cheat_caller_address(d.contract_address, OWNER());
    d.apply_spam_penalty(USER1()); // -200, now 0 pts -> level 1
    stop_cheat_caller_address(d.contract_address);
    assert(d.get_level(USER1()) == 1, 'Should be back to level 1');
}

// ============================================================================
// BADGE TESTS
// ============================================================================

#[test]
fn test_first_post_badge() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_badge(USER1(), BADGE_FIRST_POST), 'Should have first post badge');
}

#[test]
fn test_featured_author_badge() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_featured(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_badge(USER1(), BADGE_FEATURED_AUTHOR), 'Should have featured badge');
}

#[test]
fn test_premium_author_badge() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_subscriber_gained(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_badge(USER1(), BADGE_PREMIUM_AUTHOR), 'Should have premium badge');
}

#[test]
fn test_early_adopter_badge() {
    let d = deploy();
    // Register within launch window (1 month from timestamp 1000)
    register_user(d, USER1());

    assert(d.has_badge(USER1(), BADGE_EARLY_ADOPTER), 'Should have early adopter badge');
}

#[test]
fn test_no_early_adopter_after_window() {
    let d = deploy();
    // Advance past the early adopter window (1 month = 2592000s)
    start_cheat_block_timestamp_global(1000 + 2592001);
    register_user(d, USER1());

    assert(!d.has_badge(USER1(), BADGE_EARLY_ADOPTER), 'Should NOT have early badge');
}

#[test]
fn test_manual_badge_award() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_badge(USER1(), BADGE_VERIFIED);
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_badge(USER1(), BADGE_VERIFIED), 'Should have verified badge');
}

#[test]
fn test_revoke_badge() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_badge(USER1(), BADGE_VERIFIED);
    d.revoke_badge(USER1(), BADGE_VERIFIED);
    stop_cheat_caller_address(d.contract_address);

    assert(!d.has_badge(USER1(), BADGE_VERIFIED), 'Should not have badge');
}

#[test]
fn test_award_badge_already_has_silent() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_badge(USER1(), BADGE_VERIFIED);
    d.award_badge(USER1(), BADGE_VERIFIED); // Should not panic, just return
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_badge(USER1(), BADGE_VERIFIED), 'Should have badge');
}

#[test]
fn test_get_badges_bitmap() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_badge(USER1(), BADGE_VERIFIED);
    d.award_post_published(USER1()); // triggers FIRST_POST badge
    stop_cheat_caller_address(d.contract_address);

    let badges = d.get_badges(USER1());
    assert((badges & BADGE_VERIFIED) != 0, 'Should have verified');
    assert((badges & BADGE_FIRST_POST) != 0, 'Should have first post');
}

// ============================================================================
// ADMIN FUNCTION TESTS
// ============================================================================

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
    let d = deploy_with_authorized_contract();
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
fn test_set_early_adopter_window() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_early_adopter_window(86400); // 1 day
    stop_cheat_caller_address(d.contract_address);
    // Verify: registering after 1 day should not get early adopter badge
    start_cheat_block_timestamp_global(1000 + 86401);
    register_user(d, USER1());
    assert(!d.has_badge(USER1(), BADGE_EARLY_ADOPTER), 'Should NOT have early badge');
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
#[should_panic(expected: 'Reputation is paused')]
fn test_register_when_paused_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    d.register_user(USER1());
}

#[test]
#[should_panic(expected: 'Reputation is paused')]
fn test_award_when_paused_panics() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    d.award_post_published(USER1());
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_unpause_non_owner_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, ADMIN());
    d.unpause();
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
fn test_get_total_points_distributed() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(
        d.get_total_points_distributed() == REP_POST_PUBLISHED,
        'Wrong total distributed',
    );
}

#[test]
fn test_get_action() {
    let d = deploy();
    register_user(d, USER1());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.award_post_published(USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_action_count() == 1, 'Should have 1 action');
    let action = d.get_action(1);
    assert(action.user == USER1(), 'Wrong user in action');
    assert(action.points == REP_POST_PUBLISHED, 'Wrong points in action');
    assert(!action.is_penalty, 'Should not be penalty');
}
