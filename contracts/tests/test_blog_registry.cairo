// Tests for BlogRegistry contract
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp_global,
};
use starknet::{ContractAddress, contract_address_const};
use vauban_blog::blog_registry::{
    IBlogRegistryDispatcher, IBlogRegistryDispatcherTrait,
    PostMetadata, PostVersion,
    POST_DRAFT, POST_PENDING_REVIEW, POST_PUBLISHED, POST_REJECTED, POST_ARCHIVED,
    POST_TYPE_TWEET, POST_TYPE_THREAD, POST_TYPE_ARTICLE,
};

// ============================================================================
// TEST HELPERS
// ============================================================================

fn OWNER() -> ContractAddress {
    contract_address_const::<'OWNER'>()
}

fn TREASURY() -> ContractAddress {
    contract_address_const::<'TREASURY'>()
}

fn ADMIN() -> ContractAddress {
    contract_address_const::<'ADMIN'>()
}

fn EDITOR() -> ContractAddress {
    contract_address_const::<'EDITOR'>()
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

fn deploy() -> IBlogRegistryDispatcher {
    start_cheat_block_timestamp_global(1000);
    let contract = declare("BlogRegistry").unwrap().contract_class();
    let mut constructor_args: Array<felt252> = array![];
    OWNER().serialize(ref constructor_args);
    TREASURY().serialize(ref constructor_args);
    let fee: u256 = 250; // 2.5% platform fee
    fee.serialize(ref constructor_args);
    let (address, _) = contract.deploy(@constructor_args).unwrap();
    IBlogRegistryDispatcher { contract_address: address }
}

fn deploy_with_editor() -> IBlogRegistryDispatcher {
    let dispatcher = deploy();
    start_cheat_caller_address(dispatcher.contract_address, OWNER());
    dispatcher.add_editor(EDITOR());
    stop_cheat_caller_address(dispatcher.contract_address);
    dispatcher
}

fn publish_test_post(dispatcher: IBlogRegistryDispatcher, caller: ContractAddress) -> u64 {
    start_cheat_caller_address(dispatcher.contract_address, caller);
    let post_id = dispatcher.publish_post(
        'arweave_tx_1', 'arweave_tx_2',
        'ipfs_cid_1', 'ipfs_cid_2',
        'content_hash',
        0, // price (free)
        false, // not encrypted
    );
    stop_cheat_caller_address(dispatcher.contract_address);
    post_id
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
fn test_constructor_sets_treasury() {
    let d = deploy();
    assert(d.get_treasury() == TREASURY(), 'Treasury not set');
}

#[test]
fn test_constructor_sets_platform_fee() {
    let d = deploy();
    assert(d.get_platform_fee() == 250, 'Fee not set');
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
fn test_constructor_zero_post_count() {
    let d = deploy();
    assert(d.get_post_count() == 0, 'Post count not 0');
}

#[test]
fn test_constructor_default_cooldown() {
    let d = deploy();
    assert(d.get_publish_cooldown() == 60, 'Default cooldown not 60');
}

// ============================================================================
// PUBLISH POST TESTS
// ============================================================================

#[test]
fn test_publish_post_by_admin() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());
    assert(post_id == 1, 'Post ID not 1');
    assert(d.get_post_count() == 1, 'Post count not 1');

    let post = d.get_post(1);
    assert(post.author == OWNER(), 'Wrong author');
    assert(post.status == POST_PUBLISHED, 'Admin post not published');
    assert(post.current_version == 1, 'Version not 1');
    assert(!post.is_deleted, 'Should not be deleted');
    assert(post.post_type == POST_TYPE_ARTICLE, 'Wrong post type');
}

#[test]
fn test_publish_post_by_non_editor_creates_draft() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post(
        'arweave_tx_1', 'arweave_tx_2',
        'ipfs_cid_1', 'ipfs_cid_2',
        'content_hash', 0, false,
    );
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_DRAFT, 'Non-editor should be draft');
}

#[test]
fn test_publish_post_by_editor_publishes_immediately() {
    let d = deploy_with_editor();
    start_cheat_caller_address(d.contract_address, EDITOR());
    let post_id = d.publish_post(
        'arweave_tx_1', 'arweave_tx_2',
        'ipfs_cid_1', 'ipfs_cid_2',
        'content_hash', 0, false,
    );
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_PUBLISHED, 'Editor post not published');
}

#[test]
fn test_publish_creates_version_history() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());
    assert(d.get_post_version_count(post_id) == 1, 'Version count not 1');

    let version = d.get_post_version(post_id, 1);
    assert(version.version == 1, 'Version not 1');
    assert(version.content_hash == 'content_hash', 'Wrong hash');
    assert(version.editor == OWNER(), 'Wrong editor');
}

#[test]
#[should_panic(expected: 'Invalid Arweave TX ID')]
fn test_publish_invalid_arweave_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.publish_post(0, 0, 'ipfs_cid_1', 0, 'hash', 0, false);
}

#[test]
#[should_panic(expected: 'Invalid IPFS CID')]
fn test_publish_invalid_ipfs_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.publish_post('arweave', 0, 0, 0, 'hash', 0, false);
}

#[test]
#[should_panic(expected: 'Invalid content hash')]
fn test_publish_invalid_hash_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.publish_post('arweave', 0, 'ipfs', 0, 0, 0, false);
}

#[test]
fn test_publish_rate_limiting() {
    let d = deploy();
    // First post succeeds
    publish_test_post(d, OWNER());
    // Advance time past cooldown (60s default)
    start_cheat_block_timestamp_global(1000 + 61);
    // Second post succeeds after cooldown
    start_cheat_caller_address(d.contract_address, OWNER());
    let post_id = d.publish_post(
        'arweave2', 0, 'ipfs2', 0, 'hash2', 0, false,
    );
    stop_cheat_caller_address(d.contract_address);
    assert(post_id == 2, 'Second post failed');
}

#[test]
#[should_panic(expected: 'Publish cooldown active')]
fn test_publish_cooldown_panics() {
    let d = deploy();
    publish_test_post(d, OWNER());
    // Try immediately again without advancing time
    start_cheat_caller_address(d.contract_address, OWNER());
    d.publish_post('arweave2', 0, 'ipfs2', 0, 'hash2', 0, false);
}

// ============================================================================
// CONTENT WORKFLOW TESTS
// ============================================================================

#[test]
fn test_submit_for_review() {
    let d = deploy();
    // USER1 creates draft
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post(
        'arweave', 0, 'ipfs', 0, 'hash', 0, false,
    );
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_DRAFT, 'Should be draft');

    // Submit for review
    start_cheat_caller_address(d.contract_address, USER1());
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_PENDING_REVIEW, 'Should be pending');
}

#[test]
fn test_approve_post() {
    let d = deploy_with_editor();
    // USER1 creates and submits
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    // Editor approves
    start_cheat_caller_address(d.contract_address, EDITOR());
    d.approve_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_PUBLISHED, 'Should be published');
    assert(post.reviewer == EDITOR(), 'Wrong reviewer');
}

#[test]
fn test_reject_post() {
    let d = deploy_with_editor();
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, EDITOR());
    d.reject_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_REJECTED, 'Should be rejected');
}

#[test]
fn test_rejected_post_can_resubmit() {
    let d = deploy_with_editor();
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, EDITOR());
    d.reject_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    // Author resubmits
    start_cheat_caller_address(d.contract_address, USER1());
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_PENDING_REVIEW, 'Should be pending again');
}

#[test]
#[should_panic(expected: 'Not post author')]
fn test_submit_for_review_non_author_panics() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());
    // Change status to draft first - but OWNER creates as published...
    // Let's use USER1 who creates as draft, and USER2 tries to submit
    start_cheat_caller_address(d.contract_address, USER1());
    start_cheat_block_timestamp_global(1000 + 61);
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, USER2());
    d.submit_for_review(post_id);
}

#[test]
#[should_panic(expected: 'Caller is not editor')]
fn test_approve_non_editor_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    start_cheat_caller_address(d.contract_address, USER2());
    d.approve_post(post_id);
}

// ============================================================================
// ARCHIVE TESTS
// ============================================================================

#[test]
fn test_archive_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.archive_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_ARCHIVED, 'Should be archived');
}

#[test]
fn test_unarchive_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.archive_post(post_id);
    d.unarchive_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.status == POST_PUBLISHED, 'Should be published');
}

#[test]
#[should_panic(expected: 'Not published')]
fn test_archive_non_published_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    stop_cheat_caller_address(d.contract_address);
    // Post is DRAFT, can't archive
    start_cheat_caller_address(d.contract_address, OWNER());
    d.archive_post(post_id);
}

// ============================================================================
// FEATURE TESTS
// ============================================================================

#[test]
fn test_feature_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.feature_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.featured, 'Should be featured');
}

#[test]
fn test_unfeature_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.feature_post(post_id);
    d.unfeature_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(!post.featured, 'Should not be featured');
}

#[test]
#[should_panic(expected: 'Already featured')]
fn test_double_feature_panics() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());
    start_cheat_caller_address(d.contract_address, OWNER());
    d.feature_post(post_id);
    d.feature_post(post_id);
}

#[test]
fn test_get_featured_posts() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.feature_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let featured = d.get_featured_posts(10);
    assert(featured.len() == 1, 'Should have 1 featured');
}

#[test]
fn test_pending_review_count() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    let post_id = d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
    d.submit_for_review(post_id);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_pending_review_count() == 1, 'Should have 1 pending');
}

// ============================================================================
// UPDATE POST TESTS
// ============================================================================

#[test]
fn test_update_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.update_post(
        post_id, 'new_arweave', 0, 'new_ipfs', 0, 'new_hash',
    );
    stop_cheat_caller_address(d.contract_address);

    assert(result, 'Update should succeed');
    let post = d.get_post(post_id);
    assert(post.content_hash == 'new_hash', 'Hash not updated');
    assert(post.current_version == 2, 'Version not 2');
}

#[test]
#[should_panic(expected: 'Caller is not admin')]
fn test_update_post_non_admin_panics() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, USER1());
    d.update_post(post_id, 'new_arweave', 0, 'new_ipfs', 0, 'new_hash');
}

// ============================================================================
// DELETE POST TESTS
// ============================================================================

#[test]
fn test_delete_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    let result = d.delete_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    assert(result, 'Delete should succeed');
    let post = d.get_post(post_id);
    assert(post.is_deleted, 'Should be deleted');
}

#[test]
#[should_panic(expected: 'Post already deleted')]
fn test_double_delete_panics() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());
    start_cheat_caller_address(d.contract_address, OWNER());
    d.delete_post(post_id);
    d.delete_post(post_id);
}

// ============================================================================
// PURCHASE & ACCESS TESTS
// ============================================================================

#[test]
fn test_free_post_has_access() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());
    assert(d.has_access(post_id, USER1()), 'Free post should have access');
}

#[test]
fn test_author_has_access() {
    let d = deploy();
    // Create paid post
    start_cheat_caller_address(d.contract_address, OWNER());
    let post_id = d.publish_post(
        'arweave', 0, 'ipfs', 0, 'hash', 100, false,
    );
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_access(post_id, OWNER()), 'Author should have access');
}

#[test]
fn test_purchase_post() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    let post_id = d.publish_post(
        'arweave', 0, 'ipfs', 0, 'hash', 100, false,
    );
    stop_cheat_caller_address(d.contract_address);

    // User doesn't have access
    assert(!d.has_access(post_id, USER1()), 'Should not have access');

    // Purchase
    start_cheat_caller_address(d.contract_address, USER1());
    let result = d.purchase_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    assert(result, 'Purchase should succeed');
    assert(d.has_access(post_id, USER1()), 'Should have access after buy');
}

// ============================================================================
// ADMIN MANAGEMENT TESTS
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
#[should_panic(expected: 'Caller is not the owner')]
fn test_add_admin_non_owner_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.add_admin(ADMIN());
}

#[test]
#[should_panic(expected: 'Cannot remove owner')]
fn test_remove_owner_as_admin_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.remove_admin(OWNER());
}

// ============================================================================
// EDITOR MANAGEMENT TESTS
// ============================================================================

#[test]
fn test_add_editor() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.add_editor(EDITOR());
    stop_cheat_caller_address(d.contract_address);

    assert(d.is_editor(EDITOR()), 'Should be editor');
}

#[test]
fn test_remove_editor() {
    let d = deploy_with_editor();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.remove_editor(EDITOR());
    stop_cheat_caller_address(d.contract_address);

    // EDITOR is no longer admin/editor, is_editor should be false
    // (owner and admins are also considered editors via is_editor_or_above)
    assert(!d.is_editor(EDITOR()), 'Should not be editor');
}

#[test]
#[should_panic(expected: 'Already editor')]
fn test_add_editor_already_panics() {
    let d = deploy_with_editor();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.add_editor(EDITOR());
}

// ============================================================================
// WHITELIST TESTS
// ============================================================================

#[test]
fn test_whitelist_user() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    let post_id = d.publish_post(
        'arweave', 0, 'ipfs', 0, 'hash', 100, false,
    );
    d.whitelist_user(post_id, USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(d.has_access(post_id, USER1()), 'Whitelisted should have access');
}

#[test]
fn test_blacklist_user() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    let post_id = d.publish_post(
        'arweave', 0, 'ipfs', 0, 'hash', 100, false,
    );
    d.whitelist_user(post_id, USER1());
    d.blacklist_user(post_id, USER1());
    stop_cheat_caller_address(d.contract_address);

    assert(!d.has_access(post_id, USER1()), 'Blacklisted no access');
}

// ============================================================================
// EMERGENCY CONTROLS TESTS
// ============================================================================

#[test]
fn test_pause_unpause() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    assert(d.is_paused(), 'Should be paused');
    d.unpause();
    assert(!d.is_paused(), 'Should not be paused');
    stop_cheat_caller_address(d.contract_address);
}

#[test]
#[should_panic(expected: 'Contract is paused')]
fn test_publish_when_paused_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.pause();
    d.publish_post('arweave', 0, 'ipfs', 0, 'hash', 0, false);
}

#[test]
#[should_panic(expected: 'Caller is not the owner')]
fn test_pause_non_owner_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, USER1());
    d.pause();
}

// ============================================================================
// TREASURY & FEE TESTS
// ============================================================================

#[test]
fn test_set_treasury() {
    let d = deploy();
    let new_treasury = contract_address_const::<'NEW_TREASURY'>();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_treasury(new_treasury);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_treasury() == new_treasury, 'Treasury not updated');
}

#[test]
fn test_set_platform_fee() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_platform_fee(500); // 5%
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_platform_fee() == 500, 'Fee not updated');
}

#[test]
#[should_panic(expected: 'Fee exceeds maximum')]
fn test_set_platform_fee_too_high_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_platform_fee(5001); // > 50%
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
    assert(d.is_admin(USER1()), 'New owner not admin');
}

#[test]
#[should_panic(expected: 'New owner is zero address')]
fn test_transfer_ownership_zero_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.transfer_ownership(ZERO());
}

// ============================================================================
// RATE LIMITING CONFIG TESTS
// ============================================================================

#[test]
fn test_set_publish_cooldown() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_publish_cooldown(120);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_publish_cooldown() == 120, 'Cooldown not set');
}

#[test]
#[should_panic(expected: 'Cooldown too long')]
fn test_set_cooldown_too_long_panics() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_publish_cooldown(86401); // > 24h
}

// ============================================================================
// VIEW FUNCTION TESTS
// ============================================================================

#[test]
fn test_get_posts_pagination() {
    let d = deploy();
    // Create 3 posts with cooldown between them
    publish_test_post(d, OWNER());
    start_cheat_block_timestamp_global(1000 + 61);
    publish_test_post(d, OWNER());
    start_cheat_block_timestamp_global(1000 + 122);
    publish_test_post(d, OWNER());

    let posts = d.get_posts(2, 0);
    assert(posts.len() == 2, 'Should return 2 posts');

    let posts = d.get_posts(10, 2);
    assert(posts.len() == 1, 'Should return 1 post');
}

#[test]
fn test_get_posts_by_status() {
    let d = deploy();
    publish_test_post(d, OWNER());

    let published = d.get_posts_by_status(POST_PUBLISHED, 10, 0);
    assert(published.len() == 1, 'Should have 1 published');
}

#[test]
fn test_get_post_versions() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.update_post(post_id, 'new_arweave', 0, 'new_ipfs', 0, 'new_hash');
    stop_cheat_caller_address(d.contract_address);

    let versions = d.get_post_versions(post_id, 10, 0);
    assert(versions.len() == 2, 'Should have 2 versions');
}

// ============================================================================
// ROLE REGISTRY INTEGRATION TESTS
// ============================================================================

#[test]
fn test_set_role_registry() {
    let d = deploy();
    let registry = contract_address_const::<'REGISTRY'>();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.set_role_registry(registry);
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_role_registry() == registry, 'Registry not set');
}

// ============================================================================
// EXTENDED POST TYPE TESTS
// ============================================================================

#[test]
fn test_publish_tweet() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    let post_id = d.publish_post_extended(
        'arweave', 0, 'ipfs', 0, 'hash', 0, false,
        POST_TYPE_TWEET, 0, 0,
    );
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.post_type == POST_TYPE_TWEET, 'Wrong type');
}

#[test]
fn test_publish_thread() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    // Create thread root
    let root_id = d.publish_post_extended(
        'arweave', 0, 'ipfs', 0, 'hash', 0, false,
        POST_TYPE_THREAD, 0, 0,
    );
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_thread_post_count(root_id) == 1, 'Thread should have 1 post');

    // Continue thread
    start_cheat_block_timestamp_global(1000 + 61);
    start_cheat_caller_address(d.contract_address, OWNER());
    let post2 = d.publish_post_extended(
        'arweave2', 0, 'ipfs2', 0, 'hash2', 0, false,
        POST_TYPE_THREAD, 0, root_id,
    );
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_thread_post_count(root_id) == 2, 'Thread should have 2 posts');
}

#[test]
fn test_reply_to_post() {
    let d = deploy();
    let parent_id = publish_test_post(d, OWNER());

    start_cheat_block_timestamp_global(1000 + 61);
    start_cheat_caller_address(d.contract_address, OWNER());
    d.publish_post_extended(
        'arweave2', 0, 'ipfs2', 0, 'hash2', 0, false,
        POST_TYPE_TWEET, parent_id, 0,
    );
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_reply_count(parent_id) == 1, 'Should have 1 reply');
}

#[test]
fn test_get_posts_by_type() {
    let d = deploy();
    start_cheat_caller_address(d.contract_address, OWNER());
    d.publish_post_extended(
        'arweave', 0, 'ipfs', 0, 'hash', 0, false,
        POST_TYPE_TWEET, 0, 0,
    );
    stop_cheat_caller_address(d.contract_address);

    assert(d.get_posts_count_by_type(POST_TYPE_TWEET) == 1, 'Should have 1 tweet');
    assert(d.get_posts_count_by_type(POST_TYPE_ARTICLE) == 0, 'Should have 0 articles');
}

// ============================================================================
// PIN POST TESTS
// ============================================================================

#[test]
fn test_pin_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.pin_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(post.is_pinned, 'Should be pinned');
    assert(d.get_pinned_post(OWNER()) == post_id, 'Wrong pinned post');
}

#[test]
fn test_unpin_post() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.pin_post(post_id);
    d.unpin_post(post_id);
    stop_cheat_caller_address(d.contract_address);

    let post = d.get_post(post_id);
    assert(!post.is_pinned, 'Should not be pinned');
    assert(d.get_pinned_post(OWNER()) == 0, 'Should be no pinned post');
}

#[test]
fn test_pin_replaces_previous() {
    let d = deploy();
    let post1 = publish_test_post(d, OWNER());
    start_cheat_block_timestamp_global(1000 + 61);
    let post2 = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, OWNER());
    d.pin_post(post1);
    d.pin_post(post2);
    stop_cheat_caller_address(d.contract_address);

    let p1 = d.get_post(post1);
    let p2 = d.get_post(post2);
    assert(!p1.is_pinned, 'Post 1 should be unpinned');
    assert(p2.is_pinned, 'Post 2 should be pinned');
    assert(d.get_pinned_post(OWNER()) == post2, 'Pinned should be post2');
}

#[test]
#[should_panic(expected: 'Not post author')]
fn test_pin_non_author_panics() {
    let d = deploy();
    let post_id = publish_test_post(d, OWNER());

    start_cheat_caller_address(d.contract_address, USER1());
    d.pin_post(post_id);
}
