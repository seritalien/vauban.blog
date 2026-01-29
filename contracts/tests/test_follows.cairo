// Tests for Follows contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::follows::{IFollowsDispatcher, IFollowsDispatcherTrait};

// ============================================================================
// TEST HELPERS
// ============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn USER1() -> ContractAddress {
    contract_address_const::<'USER1'>()
}

fn USER2() -> ContractAddress {
    contract_address_const::<'USER2'>()
}

fn USER3() -> ContractAddress {
    contract_address_const::<'USER3'>()
}

fn USER4() -> ContractAddress {
    contract_address_const::<'USER4'>()
}

fn ZERO() -> ContractAddress {
    contract_address_const::<0>()
}

fn deploy() -> IFollowsDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("Follows").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![OWNER().into()]).unwrap();
    IFollowsDispatcher { contract_address: address }
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
fn test_constructor_not_paused() {
    let contract = deploy();
    assert(!contract.is_paused(), 'Should not be paused');
}

#[test]
fn test_constructor_default_cooldown() {
    let contract = deploy();
    assert(contract.get_follow_cooldown() == 1, 'Cooldown should be 1');
}

// NOTE: Constructor zero-owner validation is tested implicitly —
// snforge doesn't support catching constructor deployment panics in tests.
// The assertion exists in the constructor: assert(!owner.is_zero(), 'Owner cannot be zero');

// ============================================================================
// FOLLOW TESTS
// ============================================================================

#[test]
fn test_follow_basic() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    let result = contract.follow(USER2());
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Follow should return true');
    assert(contract.is_following(USER1(), USER2()), 'Should be following');
    assert(contract.get_following_count(USER1()) == 1, 'Following count should be 1');
    assert(contract.get_follower_count(USER2()) == 1, 'Follower count should be 1');
}

#[test]
#[should_panic(expected: 'Cannot follow yourself')]
fn test_follow_self_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER1());
}

#[test]
#[should_panic(expected: 'Cannot follow zero address')]
fn test_follow_zero_address_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(ZERO());
}

#[test]
#[should_panic(expected: 'Already following')]
fn test_follow_already_following_panics() {
    let contract = deploy();

    // Disable cooldown so we can follow twice quickly
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    contract.follow(USER2());  // Should panic
}

// ============================================================================
// UNFOLLOW TESTS
// ============================================================================

#[test]
fn test_unfollow_basic() {
    let contract = deploy();

    // Disable cooldown for testing
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    let result = contract.unfollow(USER2());
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Unfollow should return true');
    assert(!contract.is_following(USER1(), USER2()), 'Should not be following');
    assert(contract.get_following_count(USER1()) == 0, 'Following count should be 0');
    assert(contract.get_follower_count(USER2()) == 0, 'Follower count should be 0');
}

#[test]
#[should_panic(expected: 'Not following this user')]
fn test_unfollow_not_following_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.unfollow(USER2());
}

#[test]
#[should_panic(expected: 'Cannot unfollow zero address')]
fn test_unfollow_zero_address_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.unfollow(ZERO());
}

// ============================================================================
// VIEW FUNCTION TESTS
// ============================================================================

#[test]
fn test_is_following() {
    let contract = deploy();

    assert(!contract.is_following(USER1(), USER2()), 'Not following initially');

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.is_following(USER1(), USER2()), 'Should be following');
    assert(!contract.is_following(USER2(), USER1()), 'Reverse not following');
}

#[test]
fn test_get_follower_count() {
    let contract = deploy();

    // Disable cooldown for batch follows
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    // USER1, USER2, USER3 all follow USER4
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER2());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER3());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_follower_count(USER4()) == 3, 'Follower count should be 3');
}

#[test]
fn test_get_following_count() {
    let contract = deploy();

    // Disable cooldown for batch follows
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    // USER1 follows USER2, USER3, USER4
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    contract.follow(USER3());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_following_count(USER1()) == 3, 'Following count should be 3');
}

#[test]
fn test_get_followers_pagination() {
    let contract = deploy();

    // Disable cooldown
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    // USER1, USER2, USER3 follow USER4
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER2());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER3());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    // Get first 2 followers
    let followers = contract.get_followers(USER4(), 2, 0);
    assert(followers.len() == 2, 'Should return 2 followers');

    // Get with offset
    let followers_offset = contract.get_followers(USER4(), 10, 2);
    assert(followers_offset.len() == 1, 'Should return 1 follower');

    // Offset beyond count
    let followers_empty = contract.get_followers(USER4(), 10, 10);
    assert(followers_empty.len() == 0, 'Should be empty');
}

#[test]
fn test_get_following_pagination() {
    let contract = deploy();

    // Disable cooldown
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    // USER1 follows USER2, USER3, USER4
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    contract.follow(USER3());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    // Get first 2 following
    let following = contract.get_following(USER1(), 2, 0);
    assert(following.len() == 2, 'Should return 2 following');

    // Get with offset
    let following_offset = contract.get_following(USER1(), 10, 1);
    assert(following_offset.len() == 2, 'Should return 2 following');
}

// ============================================================================
// ADMIN TESTS
// ============================================================================

#[test]
fn test_pause_unpause() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.pause();
    assert(contract.is_paused(), 'Should be paused');

    contract.unpause();
    assert(!contract.is_paused(), 'Should not be paused');
    stop_cheat_caller_address(contract.contract_address);
}

#[test]
#[should_panic(expected: 'Contract is paused')]
fn test_follow_when_paused_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
}

#[test]
#[should_panic(expected: 'Contract is paused')]
fn test_unfollow_when_paused_panics() {
    let contract = deploy();

    // Follow first, then pause, then try to unfollow
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.unfollow(USER2());
}

#[test]
fn test_set_follow_cooldown() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(60);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_follow_cooldown() == 60, 'Cooldown should be 60');
}

#[test]
#[should_panic(expected: 'Cooldown too long')]
fn test_set_follow_cooldown_too_long() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(3601);  // > 1 hour
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_pause_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.pause();
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_set_cooldown_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.set_follow_cooldown(10);
}

#[test]
#[should_panic(expected: 'Already paused')]
fn test_double_pause_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.pause();
    contract.pause();  // Should panic
}

#[test]
#[should_panic(expected: 'Not paused')]
fn test_unpause_when_not_paused_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.unpause();  // Should panic
}

// ============================================================================
// EDGE CASES
// ============================================================================

#[test]
fn test_unfollow_updates_indices() {
    let contract = deploy();

    // Disable cooldown
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    // USER1, USER2, USER3 follow USER4
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER2());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER3());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_follower_count(USER4()) == 3, 'Should have 3 followers');

    // USER1 unfollows (removes from beginning — swap-with-last)
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.unfollow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_follower_count(USER4()) == 2, 'Should have 2 followers');
    assert(!contract.is_following(USER1(), USER4()), 'USER1 not following');
    assert(contract.is_following(USER2(), USER4()), 'USER2 still following');
    assert(contract.is_following(USER3(), USER4()), 'USER3 still following');

    // Verify pagination still works after swap
    let followers = contract.get_followers(USER4(), 10, 0);
    assert(followers.len() == 2, 'Should return 2 followers');
}

#[test]
fn test_follow_multiple_users() {
    let contract = deploy();

    // Disable cooldown
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    // USER1 follows USER2, USER3, USER4
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    contract.follow(USER3());
    contract.follow(USER4());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_following_count(USER1()) == 3, 'Should follow 3');
    assert(contract.is_following(USER1(), USER2()), 'Follows USER2');
    assert(contract.is_following(USER1(), USER3()), 'Follows USER3');
    assert(contract.is_following(USER1(), USER4()), 'Follows USER4');

    // Each followed user should have 1 follower
    assert(contract.get_follower_count(USER2()) == 1, 'USER2 has 1 follower');
    assert(contract.get_follower_count(USER3()) == 1, 'USER3 has 1 follower');
    assert(contract.get_follower_count(USER4()) == 1, 'USER4 has 1 follower');
}

#[test]
fn test_follow_unfollow_refollow() {
    let contract = deploy();

    // Disable cooldown
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_follow_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.follow(USER2());
    assert(contract.is_following(USER1(), USER2()), 'Following after follow');

    contract.unfollow(USER2());
    assert(!contract.is_following(USER1(), USER2()), 'Not following after unfollow');
    assert(contract.get_following_count(USER1()) == 0, 'Count 0 after unfollow');

    contract.follow(USER2());
    assert(contract.is_following(USER1(), USER2()), 'Following after refollow');
    assert(contract.get_following_count(USER1()) == 1, 'Count 1 after refollow');
    stop_cheat_caller_address(contract.contract_address);
}

#[test]
#[should_panic(expected: 'Invalid limit')]
fn test_get_followers_zero_limit_panics() {
    let contract = deploy();
    contract.get_followers(USER1(), 0, 0);
}

#[test]
#[should_panic(expected: 'Invalid limit')]
fn test_get_followers_exceeds_max_limit_panics() {
    let contract = deploy();
    contract.get_followers(USER1(), 101, 0);
}
