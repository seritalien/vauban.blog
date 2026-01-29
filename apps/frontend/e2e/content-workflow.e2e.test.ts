// @vitest-environment node

/**
 * E2E Tests for Content Workflow (Draft -> Review -> Published/Rejected)
 *
 * Tests the post lifecycle: draft creation, review submission,
 * approval/rejection, featuring, and archiving.
 *
 * Prerequisites:
 * - Madara devnet running (docker-compose up)
 * - Contracts deployed (.deployments.json exists)
 *
 * Run with: pnpm test:e2e
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Account } from 'starknet';
import {
  getDeployerAccount,
  getUserAccount,
  getProvider,
  getBlockNumber,
  disablePublishCooldown,
  publishArticle,
  getPostStatus,
  submitForReview,
  approvePost,
  rejectPost,
  featurePost,
  unfeaturePost,
  archivePost,
  unarchivePost,
  getPost,
  waitForState,
  RPC_URL,
  USER_A,
} from './utils/blockchain';

const BLOCKCHAIN_TIMEOUT = 60_000;

// Post status constants from the contract
const POST_DRAFT = 0;
const POST_PENDING_REVIEW = 1;
const POST_PUBLISHED = 2;
const POST_REJECTED = 3;
const POST_ARCHIVED = 4;

describe('Content Workflow E2E', () => {
  let deployer: Account;
  let userA: Account;

  beforeAll(async () => {
    const provider = getProvider();
    try {
      const blockNumber = await getBlockNumber();
      console.log(`Connected to Madara at ${RPC_URL}, block #${blockNumber}`);
    } catch (error) {
      throw new Error(`Cannot connect to Madara at ${RPC_URL}. Is it running? Error: ${error}`);
    }

    deployer = getDeployerAccount();
    userA = getUserAccount(USER_A);

    await disablePublishCooldown(deployer);
  }, BLOCKCHAIN_TIMEOUT);

  it('should create a draft when non-admin publishes', async () => {
    const { postId } = await publishArticle(userA);

    const status = await getPostStatus(postId);
    // Non-admin creates a draft
    expect(status).toBe(POST_DRAFT);
  }, BLOCKCHAIN_TIMEOUT);

  it('should submit draft for review', async () => {
    const { postId } = await publishArticle(userA);
    expect(await getPostStatus(postId)).toBe(POST_DRAFT);

    await submitForReview(userA, postId);

    const status = await getPostStatus(postId);
    expect(status).toBe(POST_PENDING_REVIEW);
  }, BLOCKCHAIN_TIMEOUT);

  it('should allow admin to approve a post', async () => {
    const { postId } = await publishArticle(userA);
    await submitForReview(userA, postId);
    expect(await getPostStatus(postId)).toBe(POST_PENDING_REVIEW);

    await approvePost(deployer, postId);

    const status = await getPostStatus(postId);
    expect(status).toBe(POST_PUBLISHED);
  }, BLOCKCHAIN_TIMEOUT);

  it('should allow admin to reject a post', async () => {
    const { postId } = await publishArticle(userA);
    await submitForReview(userA, postId);
    expect(await getPostStatus(postId)).toBe(POST_PENDING_REVIEW);

    await rejectPost(deployer, postId);

    const status = await getPostStatus(postId);
    expect(status).toBe(POST_REJECTED);
  }, BLOCKCHAIN_TIMEOUT);

  it('should allow resubmitting a rejected post', async () => {
    const { postId } = await publishArticle(userA);
    await submitForReview(userA, postId);
    await rejectPost(deployer, postId);
    expect(await getPostStatus(postId)).toBe(POST_REJECTED);

    // Resubmit
    await submitForReview(userA, postId);
    expect(await getPostStatus(postId)).toBe(POST_PENDING_REVIEW);

    // Approve this time
    await approvePost(deployer, postId);
    expect(await getPostStatus(postId)).toBe(POST_PUBLISHED);
  }, BLOCKCHAIN_TIMEOUT);

  it('should feature and unfeature a post', async () => {
    // Admin publishes directly (gets PUBLISHED status)
    const { postId } = await publishArticle(deployer);
    expect(await getPostStatus(postId)).toBe(POST_PUBLISHED);

    await featurePost(deployer, postId);
    const postAfterFeature = await getPost(postId);
    expect(Number(postAfterFeature.id)).toBe(postId);
    // featured flag is at index 17
    // Verify featured state by checking the post data

    await unfeaturePost(deployer, postId);
    // Should succeed without error
  }, BLOCKCHAIN_TIMEOUT);

  it('should archive and unarchive a post', async () => {
    const { postId } = await publishArticle(deployer);
    expect(await getPostStatus(postId)).toBe(POST_PUBLISHED);

    await archivePost(deployer, postId);
    const archivedStatus = await waitForState(() => getPostStatus(postId), POST_ARCHIVED, 20000);
    expect(archivedStatus).toBe(POST_ARCHIVED);

    await unarchivePost(deployer, postId);
    const unarchivedStatus = await waitForState(() => getPostStatus(postId), POST_PUBLISHED, 20000);
    expect(unarchivedStatus).toBe(POST_PUBLISHED);
  }, BLOCKCHAIN_TIMEOUT);
});
