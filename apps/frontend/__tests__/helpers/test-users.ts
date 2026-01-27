/**
 * Test Users: Alice & Bob
 *
 * Deterministic mock accounts for consistent test scenarios.
 */
import { vi } from 'vitest';

// =============================================================================
// USER DEFINITIONS
// =============================================================================

export interface TestUser {
  name: string;
  address: string;
  shortAddress: string;
}

export const ALICE: TestUser = {
  name: 'Alice',
  address: '0x0A11CE0000000000000000000000000000000000000000000000000000000001',
  shortAddress: '0x0A11...0001',
};

export const BOB: TestUser = {
  name: 'Bob',
  address: '0x00B0B0000000000000000000000000000000000000000000000000000000002',
  shortAddress: '0x00B0...0002',
};

// =============================================================================
// MOCK ACCOUNT FACTORY
// =============================================================================

export function createMockAccount(user: TestUser) {
  return {
    address: user.address,
    execute: vi.fn().mockResolvedValue({ transaction_hash: `0xTX_${user.name}` }),
    waitForTransaction: vi.fn().mockResolvedValue({ status: 'ACCEPTED_ON_L2' }),
    estimateFee: vi.fn().mockResolvedValue({ overall_fee: 100n }),
    signMessage: vi.fn().mockResolvedValue(['0xSIG1', '0xSIG2']),
    verifyMessage: vi.fn().mockResolvedValue(true),
  };
}

// =============================================================================
// MOCK WALLET CONTEXT FACTORY
// =============================================================================

export interface MockWalletContext {
  address: string | null;
  account: ReturnType<typeof createMockAccount> | null;
  isConnected: boolean;
  isConnecting: boolean;
  isDevMode: boolean;
  network: string;
  networkConfig: {
    chainId: string;
    name: string;
    rpcUrl: string;
    explorerUrl: string;
  };
  wallet: null;
  walletName: string | null;
  connectWallet: ReturnType<typeof vi.fn>;
  connectDevAccount: ReturnType<typeof vi.fn>;
  disconnectWallet: ReturnType<typeof vi.fn>;
  switchNetwork: ReturnType<typeof vi.fn>;
  getExplorerUrl: ReturnType<typeof vi.fn>;
  getAccountUrl: ReturnType<typeof vi.fn>;
}

export function createMockWalletContext(user: TestUser | null): MockWalletContext {
  const account = user ? createMockAccount(user) : null;

  return {
    address: user?.address ?? null,
    account,
    isConnected: user !== null,
    isConnecting: false,
    isDevMode: false,
    network: 'devnet',
    networkConfig: {
      chainId: '0x534e5f474f45524c49',
      name: 'Devnet',
      rpcUrl: '/api/rpc',
      explorerUrl: 'https://devnet.starkscan.co',
    },
    wallet: null,
    walletName: user ? 'MockWallet' : null,
    connectWallet: vi.fn(),
    connectDevAccount: vi.fn(),
    disconnectWallet: vi.fn(),
    switchNetwork: vi.fn(),
    getExplorerUrl: vi.fn((hash: string) => `https://devnet.starkscan.co/tx/${hash}`),
    getAccountUrl: vi.fn((addr: string) => `https://devnet.starkscan.co/contract/${addr}`),
  };
}
