import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock contract instances returned by `new Contract(...)`
// ---------------------------------------------------------------------------

const mockBlogRegistryContract: Record<string, ReturnType<typeof vi.fn>> = {
  approve_post: vi.fn(),
  reject_post: vi.fn(),
  get_posts_by_status: vi.fn(),
  get_pending_review_count: vi.fn(),
};

const mockSocialContract: Record<string, ReturnType<typeof vi.fn>> = {
  delete_comment: vi.fn(),
  ban_user: vi.fn(),
  unban_user: vi.fn(),
  report_comment: vi.fn(),
  get_report_count: vi.fn(),
  is_banned: vi.fn(),
};

const mockTreasuryContract: Record<string, ReturnType<typeof vi.fn>> = {
  get_earnings: vi.fn(),
  get_payment: vi.fn(),
  get_config: vi.fn(),
  withdraw_earnings: vi.fn(),
  get_total_volume: vi.fn(),
  get_total_distributed_to_creators: vi.fn(),
};

// ---------------------------------------------------------------------------
// Mock starknet module
// ---------------------------------------------------------------------------

vi.mock('starknet', () => {
  /**
   * The Contract constructor receives (abi, address, providerOrAccount).
   * We route to the right mock object based on the address.
   */
  function MockContract(_abi: unknown, address: string) {
    if (address === '0xBLOGREGISTRY') return mockBlogRegistryContract;
    if (address === '0xSOCIAL') return mockSocialContract;
    if (address === '0xTREASURY') return mockTreasuryContract;
    // Fallback – should not happen in these tests
    return {};
  }
  MockContract.prototype = {};

  function MockRpcProvider() {
    return { getBlock: vi.fn() };
  }
  MockRpcProvider.prototype = {};

  return {
    Contract: MockContract,
    RpcProvider: MockRpcProvider,
    shortString: {
      encodeShortString: vi.fn((s: string) => s),
      decodeShortString: vi.fn((s: string) => s),
    },
  };
});

// ---------------------------------------------------------------------------
// Mock ABI imports (just empty arrays – we never inspect them in unit tests)
// ---------------------------------------------------------------------------

vi.mock('../abis/blog_registry.json', () => ({ default: [] }));
vi.mock('../abis/social.json', () => ({ default: [] }));
vi.mock('../abis/role_registry.json', () => ({ default: [] }));
vi.mock('../abis/reputation.json', () => ({ default: [] }));
vi.mock('../abis/treasury.json', () => ({ default: [] }));

// ---------------------------------------------------------------------------
// Import the functions under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  approvePost,
  rejectPost,
  getPostsByStatus,
  getPendingReviewCount,
  deleteComment,
  banUser,
  unbanUser,
  reportComment,
  getReportCount,
  isBanned,
  getEarnings,
  getPaymentRecord,
  getRevenueConfig,
  withdrawEarnings,
  getTotalRevenue,
  getCreatorEarnings,
} from '../starknet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccount() {
  return {
    waitForTransaction: vi.fn().mockResolvedValue({}),
    execute: vi.fn(),
    // Satisfy AccountInterface shape minimally
    address: '0xACCOUNT',
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const TX_HASH = '0xTX123';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Environment variables for contract addresses and RPC
  process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xBLOGREGISTRY';
  process.env.NEXT_PUBLIC_SOCIAL_ADDRESS = '0xSOCIAL';
  process.env.NEXT_PUBLIC_TREASURY_ADDRESS = '0xTREASURY';
  process.env.NEXT_PUBLIC_MADARA_RPC = 'http://localhost:9944';
});

// ===========================================================================
// ADMIN / REVIEW FUNCTIONS
// ===========================================================================

describe('Admin / Review Functions', () => {
  // -------------------------------------------------------------------------
  // approvePost
  // -------------------------------------------------------------------------
  describe('approvePost', () => {
    it('calls contract.approve_post and waits for transaction', async () => {
      const account = makeAccount();
      mockBlogRegistryContract.approve_post.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await approvePost(account, '42');

      expect(mockBlogRegistryContract.approve_post).toHaveBeenCalledWith('42');
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockBlogRegistryContract.approve_post.mockRejectedValue(new Error('Not authorized'));

      await expect(approvePost(account, '42')).rejects.toThrow('Failed to approve post: Not authorized');
    });
  });

  // -------------------------------------------------------------------------
  // rejectPost
  // -------------------------------------------------------------------------
  describe('rejectPost', () => {
    it('calls contract.reject_post and waits for transaction', async () => {
      const account = makeAccount();
      mockBlogRegistryContract.reject_post.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await rejectPost(account, '7');

      expect(mockBlogRegistryContract.reject_post).toHaveBeenCalledWith('7');
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockBlogRegistryContract.reject_post.mockRejectedValue(new Error('RPC timeout'));

      await expect(rejectPost(account, '7')).rejects.toThrow('Failed to reject post: RPC timeout');
    });
  });

  // -------------------------------------------------------------------------
  // getPostsByStatus
  // -------------------------------------------------------------------------
  describe('getPostsByStatus', () => {
    it('returns mapped PostMetadata[] from contract result', async () => {
      const rawPost = {
        id: 1n,
        author: 0xABCn,
        arweave_tx_id_1: 0, // zero → empty
        arweave_tx_id_2: 0,
        ipfs_cid_1: 0,
        ipfs_cid_2: 0,
        content_hash: '0xHASH',
        price: 0n,
        is_encrypted: false,
        created_at: 1000n,
        updated_at: 1000n,
        is_deleted: false,
        post_type: 2,
        parent_id: 0,
        thread_root_id: 0,
        is_pinned: false,
      };
      mockBlogRegistryContract.get_posts_by_status.mockResolvedValue([rawPost]);

      const posts = await getPostsByStatus(1, 10, 0);

      expect(mockBlogRegistryContract.get_posts_by_status).toHaveBeenCalledWith(1, 10, 0);
      expect(posts).toHaveLength(1);
      expect(posts[0].id).toBe('1');
      expect(posts[0].contentHash).toBe('0xHASH');
      expect(posts[0].isDeleted).toBe(false);
      expect(posts[0].postType).toBe(2);
    });

    it('propagates errors from the contract call', async () => {
      mockBlogRegistryContract.get_posts_by_status.mockRejectedValue(new Error('Invalid status'));

      await expect(getPostsByStatus(99)).rejects.toThrow('Failed to get posts by status: Invalid status');
    });
  });

  // -------------------------------------------------------------------------
  // getPendingReviewCount
  // -------------------------------------------------------------------------
  describe('getPendingReviewCount', () => {
    it('returns the pending review count as a number', async () => {
      mockBlogRegistryContract.get_pending_review_count.mockResolvedValue(5n);

      const count = await getPendingReviewCount();

      expect(mockBlogRegistryContract.get_pending_review_count).toHaveBeenCalled();
      expect(count).toBe(5);
    });

    it('propagates errors from the contract call', async () => {
      mockBlogRegistryContract.get_pending_review_count.mockRejectedValue(new Error('Network down'));

      await expect(getPendingReviewCount()).rejects.toThrow('Failed to get pending review count: Network down');
    });
  });
});

// ===========================================================================
// MODERATION FUNCTIONS
// ===========================================================================

describe('Moderation Functions', () => {
  // -------------------------------------------------------------------------
  // deleteComment
  // -------------------------------------------------------------------------
  describe('deleteComment', () => {
    it('calls contract.delete_comment and waits for transaction', async () => {
      const account = makeAccount();
      mockSocialContract.delete_comment.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await deleteComment(account, '10');

      expect(mockSocialContract.delete_comment).toHaveBeenCalledWith('10');
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockSocialContract.delete_comment.mockRejectedValue(new Error('Forbidden'));

      await expect(deleteComment(account, '10')).rejects.toThrow('Failed to delete comment: Forbidden');
    });
  });

  // -------------------------------------------------------------------------
  // banUser
  // -------------------------------------------------------------------------
  describe('banUser', () => {
    it('calls contract.ban_user and waits for transaction', async () => {
      const account = makeAccount();
      mockSocialContract.ban_user.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await banUser(account, '0xBADUSER');

      expect(mockSocialContract.ban_user).toHaveBeenCalledWith('0xBADUSER');
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockSocialContract.ban_user.mockRejectedValue(new Error('Only moderator'));

      await expect(banUser(account, '0xBADUSER')).rejects.toThrow('Failed to ban user: Only moderator');
    });
  });

  // -------------------------------------------------------------------------
  // unbanUser
  // -------------------------------------------------------------------------
  describe('unbanUser', () => {
    it('calls contract.unban_user and waits for transaction', async () => {
      const account = makeAccount();
      mockSocialContract.unban_user.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await unbanUser(account, '0xBADUSER');

      expect(mockSocialContract.unban_user).toHaveBeenCalledWith('0xBADUSER');
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockSocialContract.unban_user.mockRejectedValue(new Error('User not banned'));

      await expect(unbanUser(account, '0xBADUSER')).rejects.toThrow('Failed to unban user: User not banned');
    });
  });

  // -------------------------------------------------------------------------
  // reportComment
  // -------------------------------------------------------------------------
  describe('reportComment', () => {
    it('calls contract.report_comment and waits for transaction', async () => {
      const account = makeAccount();
      mockSocialContract.report_comment.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await reportComment(account, '55');

      expect(mockSocialContract.report_comment).toHaveBeenCalledWith('55');
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockSocialContract.report_comment.mockRejectedValue(new Error('Already reported'));

      await expect(reportComment(account, '55')).rejects.toThrow('Failed to report comment: Already reported');
    });
  });

  // -------------------------------------------------------------------------
  // getReportCount
  // -------------------------------------------------------------------------
  describe('getReportCount', () => {
    it('returns the report count as a number', async () => {
      mockSocialContract.get_report_count.mockResolvedValue(3n);

      const count = await getReportCount('55');

      expect(mockSocialContract.get_report_count).toHaveBeenCalledWith('55');
      expect(count).toBe(3);
    });

    it('propagates errors from the contract call', async () => {
      mockSocialContract.get_report_count.mockRejectedValue(new Error('Comment not found'));

      await expect(getReportCount('999')).rejects.toThrow('Failed to get report count: Comment not found');
    });
  });

  // -------------------------------------------------------------------------
  // isBanned
  // -------------------------------------------------------------------------
  describe('isBanned', () => {
    it('returns true when user is banned', async () => {
      mockSocialContract.is_banned.mockResolvedValue(true);

      const result = await isBanned('0xBADUSER');

      expect(mockSocialContract.is_banned).toHaveBeenCalledWith('0xBADUSER');
      expect(result).toBe(true);
    });

    it('returns false when user is not banned', async () => {
      mockSocialContract.is_banned.mockResolvedValue(false);

      const result = await isBanned('0xGOODUSER');

      expect(result).toBe(false);
    });

    it('propagates errors from the contract call', async () => {
      mockSocialContract.is_banned.mockRejectedValue(new Error('RPC error'));

      await expect(isBanned('0xUSER')).rejects.toThrow('Failed to check ban status: RPC error');
    });
  });
});

// ===========================================================================
// TREASURY FUNCTIONS
// ===========================================================================

describe('Treasury Functions', () => {
  // -------------------------------------------------------------------------
  // getEarnings
  // -------------------------------------------------------------------------
  describe('getEarnings', () => {
    it('returns Earnings with correct bigint values', async () => {
      mockTreasuryContract.get_earnings.mockResolvedValue({
        total_earned: 1000n,
        total_withdrawn: 200n,
        pending: 800n,
      });

      const earnings = await getEarnings('0xAUTHOR');

      expect(mockTreasuryContract.get_earnings).toHaveBeenCalledWith('0xAUTHOR');
      expect(earnings).toEqual({
        totalEarned: 1000n,
        totalWithdrawn: 200n,
        pending: 800n,
      });
    });

    it('propagates errors from the contract call', async () => {
      mockTreasuryContract.get_earnings.mockRejectedValue(new Error('User not found'));

      await expect(getEarnings('0xNOBODY')).rejects.toThrow('Failed to get earnings: User not found');
    });
  });

  // -------------------------------------------------------------------------
  // getPaymentRecord
  // -------------------------------------------------------------------------
  describe('getPaymentRecord', () => {
    it('returns a PaymentRecord with correct fields', async () => {
      mockTreasuryContract.get_payment.mockResolvedValue({
        id: 1n,
        post_id: 42n,
        payer: 0xABCn,
        amount: 500n,
        author_share: 425n,
        platform_share: 50n,
        referrer_share: 25n,
        referrer: 0xDEFn,
        timestamp: 1700000000n,
      });

      const record = await getPaymentRecord('1');

      expect(mockTreasuryContract.get_payment).toHaveBeenCalledWith('1');
      expect(record.id).toBe('1');
      expect(record.postId).toBe('42');
      expect(record.payer).toBe('0x' + BigInt(0xABC).toString(16));
      expect(record.amount).toBe(500n);
      expect(record.authorShare).toBe(425n);
      expect(record.platformShare).toBe(50n);
      expect(record.referrerShare).toBe(25n);
      expect(record.referrer).toBe('0x' + BigInt(0xDEF).toString(16));
      expect(record.timestamp).toBe(1700000000);
    });

    it('propagates errors from the contract call', async () => {
      mockTreasuryContract.get_payment.mockRejectedValue(new Error('Payment not found'));

      await expect(getPaymentRecord('999')).rejects.toThrow('Failed to get payment record: Payment not found');
    });
  });

  // -------------------------------------------------------------------------
  // getRevenueConfig
  // -------------------------------------------------------------------------
  describe('getRevenueConfig', () => {
    it('returns RevenueConfig with correct values', async () => {
      mockTreasuryContract.get_config.mockResolvedValue({
        platform_fee_bps: 500n,
        referral_fee_bps: 100n,
        min_withdrawal: 1000n,
      });

      const config = await getRevenueConfig();

      expect(mockTreasuryContract.get_config).toHaveBeenCalled();
      expect(config).toEqual({
        platformFeeBps: 500,
        referralFeeBps: 100,
        minWithdrawal: 1000n,
      });
    });

    it('propagates errors from the contract call', async () => {
      mockTreasuryContract.get_config.mockRejectedValue(new Error('Contract paused'));

      await expect(getRevenueConfig()).rejects.toThrow('Failed to get revenue config: Contract paused');
    });
  });

  // -------------------------------------------------------------------------
  // withdrawEarnings
  // -------------------------------------------------------------------------
  describe('withdrawEarnings', () => {
    it('calls contract.withdraw_earnings and waits for transaction', async () => {
      const account = makeAccount();
      mockTreasuryContract.withdraw_earnings.mockResolvedValue({ transaction_hash: TX_HASH });

      const result = await withdrawEarnings(account);

      expect(mockTreasuryContract.withdraw_earnings).toHaveBeenCalled();
      expect(account.waitForTransaction).toHaveBeenCalledWith(TX_HASH);
      expect(result).toBe(TX_HASH);
    });

    it('propagates errors from the contract call', async () => {
      const account = makeAccount();
      mockTreasuryContract.withdraw_earnings.mockRejectedValue(new Error('Below min withdrawal'));

      await expect(withdrawEarnings(account)).rejects.toThrow(
        'Failed to withdraw earnings: Below min withdrawal'
      );
    });
  });

  // -------------------------------------------------------------------------
  // getTotalRevenue
  // -------------------------------------------------------------------------
  describe('getTotalRevenue', () => {
    it('returns total volume as bigint', async () => {
      mockTreasuryContract.get_total_volume.mockResolvedValue(50000n);

      const total = await getTotalRevenue();

      expect(mockTreasuryContract.get_total_volume).toHaveBeenCalled();
      expect(total).toBe(50000n);
    });

    it('propagates errors from the contract call', async () => {
      mockTreasuryContract.get_total_volume.mockRejectedValue(new Error('Node unreachable'));

      await expect(getTotalRevenue()).rejects.toThrow('Failed to get total revenue: Node unreachable');
    });
  });

  // -------------------------------------------------------------------------
  // getCreatorEarnings
  // -------------------------------------------------------------------------
  describe('getCreatorEarnings', () => {
    it('returns total distributed to creators as bigint', async () => {
      mockTreasuryContract.get_total_distributed_to_creators.mockResolvedValue(30000n);

      const total = await getCreatorEarnings();

      expect(mockTreasuryContract.get_total_distributed_to_creators).toHaveBeenCalled();
      expect(total).toBe(30000n);
    });

    it('propagates errors from the contract call', async () => {
      mockTreasuryContract.get_total_distributed_to_creators.mockRejectedValue(
        new Error('Timeout exceeded')
      );

      await expect(getCreatorEarnings()).rejects.toThrow(
        'Failed to get creator earnings: Timeout exceeded'
      );
    });
  });
});
