import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies using vi.hoisted
const mockAccount = vi.hoisted(() => {
  // Must be a real class so `new Account(...)` works
  return class MockAccount {
    address: string;
    constructor(_provider: unknown, address: string, _pk: string) {
      void _pk; // Suppress unused parameter warning
      this.address = address;
    }
  };
});

const mockRpcProvider = vi.hoisted(() => {
  return class MockRpcProvider {};
});
const mockInitStarknetProvider = vi.hoisted(() => vi.fn(() => ({ nodeUrl: 'http://localhost:9944' })));
const mockSetContractAddresses = vi.hoisted(() => vi.fn());
const mockPublishPost = vi.hoisted(() => vi.fn());

vi.mock('starknet', () => ({
  Account: mockAccount,
  RpcProvider: mockRpcProvider,
}));

vi.mock('@vauban/web3-utils', () => ({
  initStarknetProvider: mockInitStarknetProvider,
  setContractAddresses: mockSetContractAddresses,
  publishPost: mockPublishPost,
}));

describe('relayer.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    // Reset module state by re-importing (the module has internal state)
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('initRelayer', () => {
    it('initializes with env variables', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      process.env.MADARA_RPC_URL = 'http://localhost:9944';
      process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xblogregistry';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { initRelayer } = await import('../relayer');
      const result = initRelayer();

      expect(result.account).toBeDefined();
      expect(result.provider).toBeDefined();
      expect(mockInitStarknetProvider).toHaveBeenCalledWith({ nodeUrl: 'http://localhost:9944' });
      expect(mockSetContractAddresses).toHaveBeenCalled();
    });

    it('throws when RELAYER_PRIVATE_KEY is missing', async () => {
      delete process.env.RELAYER_PRIVATE_KEY;
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { initRelayer } = await import('../relayer');
      expect(() => initRelayer()).toThrow('RELAYER_PRIVATE_KEY and RELAYER_ADDRESS must be set');
    });

    it('throws when RELAYER_ADDRESS is missing', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      delete process.env.RELAYER_ADDRESS;

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { initRelayer } = await import('../relayer');
      expect(() => initRelayer()).toThrow('RELAYER_PRIVATE_KEY and RELAYER_ADDRESS must be set');
    });

    it('defaults MADARA_RPC_URL to localhost:9944', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      delete process.env.MADARA_RPC_URL;

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { initRelayer } = await import('../relayer');
      initRelayer();

      expect(mockInitStarknetProvider).toHaveBeenCalledWith({ nodeUrl: 'http://localhost:9944' });
    });
  });

  describe('getRelayer', () => {
    it('initializes on first call', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { getRelayer } = await import('../relayer');
      const result = getRelayer();

      expect(result.account).toBeDefined();
      expect(result.provider).toBeDefined();
    });

    it('returns cached instance on subsequent calls', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { getRelayer } = await import('../relayer');
      const result1 = getRelayer();
      const callCount = mockInitStarknetProvider.mock.calls.length;

      const result2 = getRelayer();

      expect(result1.account).toBe(result2.account);
      expect(mockInitStarknetProvider).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('relayPublishPost', () => {
    it('publishes a post using the relayer account', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xblogregistry';

      mockPublishPost.mockResolvedValueOnce('0xtxhash');

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { relayPublishPost } = await import('../relayer');
      const result = await relayPublishPost('arweave-tx', 'ipfs-cid', 'content-hash');

      expect(result.txHash).toBe('0xtxhash');
      expect(mockPublishPost).toHaveBeenCalledWith(
        expect.anything(), // account
        'arweave-tx',
        'ipfs-cid',
        'content-hash',
        '0',     // default price
        false    // default isEncrypted
      );
    });

    it('passes custom price and isEncrypted', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xblogregistry';

      mockPublishPost.mockResolvedValueOnce('0xtxhash');

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { relayPublishPost } = await import('../relayer');
      await relayPublishPost('arweave-tx', 'ipfs-cid', 'content-hash', '100', true);

      expect(mockPublishPost).toHaveBeenCalledWith(
        expect.anything(),
        'arweave-tx',
        'ipfs-cid',
        'content-hash',
        '100',
        true
      );
    });

    it('throws when NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS is not configured', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      delete process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS;

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { relayPublishPost } = await import('../relayer');
      await expect(
        relayPublishPost('arweave-tx', 'ipfs-cid', 'content-hash')
      ).rejects.toThrow('NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS not configured');
    });
  });

  describe('getRelayerBalance', () => {
    it('returns account address on success', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';

      const mockProvider = {
        nodeUrl: 'http://localhost:9944',
        getBlock: vi.fn().mockResolvedValue({ block_number: 42 }),
      };
      mockInitStarknetProvider.mockReturnValue(mockProvider);

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { getRelayerBalance } = await import('../relayer');
      const result = await getRelayerBalance();

      expect(result).toBe('0xrelayeraddress');
    });

    it('returns 0 on error', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';

      const mockProvider = {
        nodeUrl: 'http://localhost:9944',
        getBlock: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };
      mockInitStarknetProvider.mockReturnValue(mockProvider);

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { getRelayerBalance } = await import('../relayer');
      const result = await getRelayerBalance();

      expect(result).toBe('0');
      consoleSpy.mockRestore();
    });
  });

  describe('isRelayerConfigured', () => {
    it('returns true when all required env vars are set', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xblogregistry';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { isRelayerConfigured } = await import('../relayer');
      expect(isRelayerConfigured()).toBe(true);
    });

    it('returns false when RELAYER_PRIVATE_KEY is missing', async () => {
      delete process.env.RELAYER_PRIVATE_KEY;
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xblogregistry';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { isRelayerConfigured } = await import('../relayer');
      expect(isRelayerConfigured()).toBe(false);
    });

    it('returns false when RELAYER_ADDRESS is missing', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      delete process.env.RELAYER_ADDRESS;
      process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS = '0xblogregistry';

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { isRelayerConfigured } = await import('../relayer');
      expect(isRelayerConfigured()).toBe(false);
    });

    it('returns false when NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS is missing', async () => {
      process.env.RELAYER_PRIVATE_KEY = '0xprivatekey';
      process.env.RELAYER_ADDRESS = '0xrelayeraddress';
      delete process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS;

      vi.resetModules();
      vi.doMock('starknet', () => ({
        Account: mockAccount,
        RpcProvider: mockRpcProvider,
      }));
      vi.doMock('@vauban/web3-utils', () => ({
        initStarknetProvider: mockInitStarknetProvider,
        setContractAddresses: mockSetContractAddresses,
        publishPost: mockPublishPost,
      }));

      const { isRelayerConfigured } = await import('../relayer');
      expect(isRelayerConfigured()).toBe(false);
    });
  });
});
