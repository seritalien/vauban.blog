// Tests for Social contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::social::{ISocialDispatcher, ISocialDispatcherTrait};

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

fn ZERO() -> ContractAddress {
    contract_address_const::<0>()
}

fn CONTENT_HASH_1() -> felt252 {
    'content_hash_1'
}

fn CONTENT_HASH_2() -> felt252 {
    'content_hash_2'
}

fn deploy() -> ISocialDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("Social").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![OWNER().into()]).unwrap();
    ISocialDispatcher { contract_address: address }
}

fn deploy_and_disable_cooldown() -> ISocialDispatcher {
    let contract = deploy();
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_comment_cooldown(0);
    stop_cheat_caller_address(contract.contract_address);
    contract
}

// ============================================================================
// COMMENT TESTS
// ============================================================================

#[test]
fn test_add_comment() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    assert(comment_id == 1, 'Comment ID should be 1');
    assert(contract.get_comment_count_for_post(1) == 1, 'Count should be 1');

    let comment = contract.get_comment(1);
    assert(comment.post_id == 1, 'Post ID mismatch');
    assert(comment.author == USER1(), 'Author mismatch');
    assert(comment.content_hash == CONTENT_HASH_1(), 'Content hash mismatch');
    assert(comment.parent_comment_id == 0, 'No parent');
    assert(!comment.is_deleted, 'Not deleted');
}

#[test]
#[should_panic(expected: 'Invalid content hash')]
fn test_add_comment_empty_hash_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.add_comment(1, 0, 0);
}

#[test]
fn test_add_reply_comment() {
    let contract = deploy_and_disable_cooldown();

    // Add parent comment
    start_cheat_caller_address(contract.contract_address, USER1());
    let parent_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Add reply
    start_cheat_caller_address(contract.contract_address, USER2());
    let reply_id = contract.add_comment(1, CONTENT_HASH_2(), parent_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(reply_id == 2, 'Reply ID should be 2');
    let reply = contract.get_comment(reply_id);
    assert(reply.parent_comment_id == parent_id, 'Parent ID mismatch');
}

#[test]
fn test_get_comments_for_post() {
    let contract = deploy_and_disable_cooldown();

    // Add 3 comments
    start_cheat_caller_address(contract.contract_address, USER1());
    contract.add_comment(1, CONTENT_HASH_1(), 0);
    contract.add_comment(1, CONTENT_HASH_2(), 0);
    contract.add_comment(1, 'hash_3', 0);
    stop_cheat_caller_address(contract.contract_address);

    let comments = contract.get_comments_for_post(1, 10, 0);
    assert(comments.len() == 3, 'Should return 3 comments');

    // Pagination: limit 2
    let page1 = contract.get_comments_for_post(1, 2, 0);
    assert(page1.len() == 2, 'Page 1 should have 2');

    // Pagination: offset 2
    let page2 = contract.get_comments_for_post(1, 10, 2);
    assert(page2.len() == 1, 'Page 2 should have 1');
}

#[test]
fn test_delete_comment() {
    let contract = deploy();

    // Add comment
    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Owner deletes
    start_cheat_caller_address(contract.contract_address, OWNER());
    let result = contract.delete_comment(comment_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Delete should succeed');
    let comment = contract.get_comment(comment_id);
    assert(comment.is_deleted, 'Should be deleted');
}

#[test]
#[should_panic(expected: 'Caller is not moderator')]
fn test_non_moderator_cannot_delete() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Non-moderator, non-owner user cannot delete (even the comment author)
    start_cheat_caller_address(contract.contract_address, USER2());
    contract.delete_comment(comment_id);
}

// ============================================================================
// LIKE TESTS
// ============================================================================

#[test]
fn test_like_post() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    let result = contract.like_post(1);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Like should succeed');
    assert(contract.get_post_likes(1) == 1, 'Like count should be 1');
    assert(contract.has_liked_post(1, USER1()), 'User1 liked post');
}

#[test]
fn test_unlike_post() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.like_post(1);
    let result = contract.unlike_post(1);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Unlike should succeed');
    assert(contract.get_post_likes(1) == 0, 'Like count should be 0');
    assert(!contract.has_liked_post(1, USER1()), 'User1 not liked');
}

#[test]
#[should_panic(expected: 'Already liked')]
fn test_double_like_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.like_post(1);
    contract.like_post(1);  // Should panic
}

#[test]
#[should_panic(expected: 'Not liked yet')]
fn test_unlike_not_liked_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.unlike_post(1);
}

#[test]
fn test_like_comment() {
    let contract = deploy();

    // Add a comment first
    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Like the comment
    start_cheat_caller_address(contract.contract_address, USER2());
    let result = contract.like_comment(comment_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Comment like should succeed');
    assert(contract.has_liked_comment(comment_id, USER2()), 'User2 liked comment');

    let comment = contract.get_comment(comment_id);
    assert(comment.like_count == 1, 'Comment like count should be 1');
}

#[test]
fn test_unlike_comment() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER2());
    contract.like_comment(comment_id);
    let result = contract.unlike_comment(comment_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Unlike comment should succeed');
    assert(!contract.has_liked_comment(comment_id, USER2()), 'User2 not liked');
}

#[test]
fn test_multiple_users_like_post() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.like_post(1);
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER2());
    contract.like_post(1);
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER3());
    contract.like_post(1);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_post_likes(1) == 3, 'Like count should be 3');
}

// ============================================================================
// MODERATION TESTS
// ============================================================================

#[test]
fn test_ban_user() {
    let contract = deploy_and_disable_cooldown();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.ban_user(USER1());
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.is_banned(USER1()), 'User1 should be banned');
}

#[test]
#[should_panic(expected: 'User is banned')]
fn test_banned_user_cannot_comment() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.ban_user(USER1());
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.add_comment(1, CONTENT_HASH_1(), 0);
}

#[test]
fn test_unban_user() {
    let contract = deploy_and_disable_cooldown();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.ban_user(USER1());
    contract.unban_user(USER1());
    stop_cheat_caller_address(contract.contract_address);

    assert(!contract.is_banned(USER1()), 'User1 should not be banned');

    // Unbanned user can comment
    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    assert(comment_id == 1, 'Comment should succeed');
}

#[test]
fn test_report_comment() {
    let contract = deploy();

    // Add comment
    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Report
    start_cheat_caller_address(contract.contract_address, USER2());
    let result = contract.report_comment(comment_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Report should succeed');
    assert(contract.get_report_count(comment_id) == 1, 'Report count should be 1');
}

#[test]
fn test_moderator_can_delete() {
    let contract = deploy();

    // Add moderator
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.add_moderator(USER2());
    stop_cheat_caller_address(contract.contract_address);

    // Add comment
    start_cheat_caller_address(contract.contract_address, USER1());
    let comment_id = contract.add_comment(1, CONTENT_HASH_1(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Moderator deletes
    start_cheat_caller_address(contract.contract_address, USER2());
    let result = contract.delete_comment(comment_id);
    stop_cheat_caller_address(contract.contract_address);

    assert(result, 'Moderator delete should succeed');
}

#[test]
fn test_add_remove_moderator() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.add_moderator(USER1());
    assert(contract.is_moderator(USER1()), 'Should be moderator');

    contract.remove_moderator(USER1());
    assert(!contract.is_moderator(USER1()), 'Should not be moderator');
    stop_cheat_caller_address(contract.contract_address);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_add_moderator() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.add_moderator(USER2());
}

#[test]
#[should_panic(expected: 'Caller is not moderator')]
fn test_non_moderator_cannot_ban() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.ban_user(USER2());
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
fn test_comment_when_paused_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.add_comment(1, CONTENT_HASH_1(), 0);
}

#[test]
#[should_panic(expected: 'Contract is paused')]
fn test_like_when_paused_panics() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.pause();
    stop_cheat_caller_address(contract.contract_address);

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.like_post(1);
}

#[test]
fn test_set_comment_cooldown() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.set_comment_cooldown(60);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_comment_cooldown() == 60, 'Cooldown should be 60');
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_non_owner_cannot_pause() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.pause();
}

#[test]
fn test_get_owner() {
    let contract = deploy();
    assert(contract.get_owner() == OWNER(), 'Owner mismatch');
}

// ============================================================================
// EDGE CASES
// ============================================================================

#[test]
fn test_different_posts_independent_comments() {
    let contract = deploy_and_disable_cooldown();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.add_comment(1, CONTENT_HASH_1(), 0);
    contract.add_comment(1, CONTENT_HASH_2(), 0);
    contract.add_comment(2, 'hash_post2', 0);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_comment_count_for_post(1) == 2, 'Post 1 has 2 comments');
    assert(contract.get_comment_count_for_post(2) == 1, 'Post 2 has 1 comment');
}

#[test]
fn test_different_posts_independent_likes() {
    let contract = deploy();

    start_cheat_caller_address(contract.contract_address, USER1());
    contract.like_post(1);
    contract.like_post(2);
    stop_cheat_caller_address(contract.contract_address);

    assert(contract.get_post_likes(1) == 1, 'Post 1 has 1 like');
    assert(contract.get_post_likes(2) == 1, 'Post 2 has 1 like');
    assert(contract.get_post_likes(3) == 0, 'Post 3 has 0 likes');
}

#[test]
fn test_deleted_comment_filtered_from_list() {
    let contract = deploy_and_disable_cooldown();

    start_cheat_caller_address(contract.contract_address, USER1());
    let id1 = contract.add_comment(1, CONTENT_HASH_1(), 0);
    contract.add_comment(1, CONTENT_HASH_2(), 0);
    stop_cheat_caller_address(contract.contract_address);

    // Delete first comment
    start_cheat_caller_address(contract.contract_address, OWNER());
    contract.delete_comment(id1);
    stop_cheat_caller_address(contract.contract_address);

    // Deleted comments are filtered out by get_comments_for_post
    let comments = contract.get_comments_for_post(1, 10, 0);
    assert(comments.len() == 1, 'Should return 1 non-deleted');
}
