'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { connect, disconnect, StarknetWindowObject } from 'starknetkit';
import { Account, RpcProvider, constants, AccountInterface } from 'starknet';
import { getPublicEnv } from '@/lib/public-env';

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================
type NetworkId = 'mainnet' | 'sepolia' | 'devnet';

interface NetworkConfig {
  chainId: string;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
}

function getNetworks(): Record<NetworkId, NetworkConfig> {
  return {
    mainnet: {
      chainId: constants.StarknetChainId.SN_MAIN,
      name: 'Starknet Mainnet',
      rpcUrl: getPublicEnv('NEXT_PUBLIC_MAINNET_RPC') || 'https://starknet-mainnet.public.blastapi.io',
      explorerUrl: 'https://starkscan.co',
    },
    sepolia: {
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      name: 'Starknet Sepolia',
      rpcUrl: getPublicEnv('NEXT_PUBLIC_SEPOLIA_RPC') || 'https://starknet-sepolia.public.blastapi.io',
      explorerUrl: 'https://sepolia.starkscan.co',
    },
    devnet: {
      chainId: 'SN_DEVNET',
      name: 'Local Devnet',
      rpcUrl: '/api/rpc', // Proxy to avoid CORS
      explorerUrl: '',
    },
  };
}

// Determine network from env
function getNetworkFromEnv(): NetworkId {
  const networkEnv = getPublicEnv('NEXT_PUBLIC_STARKNET_NETWORK')?.toLowerCase();
  if (networkEnv === 'mainnet') return 'mainnet';
  if (networkEnv === 'sepolia') return 'sepolia';
  return 'devnet';
}

// ============================================================================
// DEVNET ACCOUNTS (pre-funded on Madara devnet)
// ============================================================================
const DEVNET_ACCOUNTS = [
  {
    address: '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1',
    privateKey: '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86',
    name: 'Devnet Account #1',
  },
  {
    address: '0x5e9e93c6235f8ae6c2f4f0069bd30753ec21b26fbad80cfbf5da2c1bc573d69',
    privateKey: '0x11830d3641a682d4a690dcc25d1f4b0dac948325ac18f6dd32564371735f320',
    name: 'Devnet Account #2',
  },
];

// ============================================================================
// CONTEXT TYPES
// ============================================================================
interface WalletContextType {
  // Connection state
  address: string | null;
  account: Account | AccountInterface | null;
  isConnected: boolean;
  isConnecting: boolean;
  isDevMode: boolean;

  // Network info
  network: NetworkId;
  networkConfig: NetworkConfig;

  // Wallet info
  wallet: StarknetWindowObject | null;
  walletName: string | null;

  // Actions
  connectWallet: () => Promise<void>;
  connectDevAccount: (index?: number) => void;
  disconnectWallet: () => void;
  switchNetwork: (network: NetworkId) => void;

  // Helpers
  getExplorerUrl: (txHash: string) => string;
  getAccountUrl: (address: string) => string;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | AccountInterface | null>(null);
  const [wallet, setWallet] = useState<StarknetWindowObject | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [network, setNetwork] = useState<NetworkId>(getNetworkFromEnv());

  const networkConfig = getNetworks()[network];

  // Get explorer URLs
  const getExplorerUrl = useCallback((txHash: string) => {
    if (!networkConfig.explorerUrl) return '';
    return `${networkConfig.explorerUrl}/tx/${txHash}`;
  }, [networkConfig.explorerUrl]);

  const getAccountUrl = useCallback((addr: string) => {
    if (!networkConfig.explorerUrl) return '';
    return `${networkConfig.explorerUrl}/contract/${addr}`;
  }, [networkConfig.explorerUrl]);

  // Connect using devnet account (no wallet extension needed)
  const connectDevAccount = useCallback((index: number = 0) => {
    const devAccount = DEVNET_ACCOUNTS[index];
    if (!devAccount) {
      console.error('Invalid devnet account index');
      return;
    }

    const provider = new RpcProvider({ nodeUrl: getNetworks().devnet.rpcUrl });
    const acc = new Account(
      provider,
      devAccount.address,
      devAccount.privateKey
    );

    setAddress(devAccount.address);
    setAccount(acc);
    setIsDevMode(true);
    setWallet(null);
    setWalletName('Devnet');
    setNetwork('devnet');

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_connected', 'dev');
      localStorage.setItem('wallet_address', devAccount.address);
      localStorage.setItem('dev_account_index', index.toString());
    }

    console.log(`Connected to ${devAccount.name}: ${devAccount.address}`);
  }, []);

  // Connect wallet via starknetkit
  const connectWallet = useCallback(async () => {
    try {
      setIsConnecting(true);

      const { wallet: connectedWallet } = await connect({
        webWalletUrl: 'https://web.argent.xyz',
        argentMobileOptions: {
          dappName: 'Vauban Blog',
          url: typeof window !== 'undefined' ? window.location.origin : 'https://blog.vauban.tech',
        },
      });

      if (!connectedWallet) {
        throw new Error('No wallet connected');
      }

      // Starknetkit v2 API
      const walletAny = connectedWallet as any;
      const walletAddress = walletAny.selectedAddress || walletAny.account?.address;

      if (!walletAddress) {
        throw new Error('Could not get wallet address');
      }

      // Detect wallet's network from chainId
      let detectedNetwork: NetworkId = network;
      if (walletAny.chainId) {
        if (walletAny.chainId === constants.StarknetChainId.SN_MAIN) {
          detectedNetwork = 'mainnet';
        } else if (walletAny.chainId === constants.StarknetChainId.SN_SEPOLIA) {
          detectedNetwork = 'sepolia';
        }
      }

      // Use the wallet's account directly - it already has the correct provider
      // This ensures transactions are signed and sent on the correct network
      const walletAccount = walletAny.account as AccountInterface;

      setWallet(connectedWallet);
      setAddress(walletAddress);
      setAccount(walletAccount);
      setIsDevMode(false);
      setWalletName(walletAny.name || walletAny.id || 'Wallet');
      setNetwork(detectedNetwork);

      // Store in localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_connected', 'true');
        localStorage.setItem('wallet_address', walletAddress);
        localStorage.setItem('wallet_network', detectedNetwork);
      }

      console.log(`Connected to ${walletAny.name || 'wallet'} on ${getNetworks()[detectedNetwork].name}: ${walletAddress}`);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [network]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    if (wallet) {
      disconnect();
    }
    setWallet(null);
    setAddress(null);
    setAccount(null);
    setIsDevMode(false);
    setWalletName(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_connected');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('dev_account_index');
      localStorage.removeItem('wallet_network');
    }
  }, [wallet]);

  // Switch network (only for devnet, wallet networks are determined by wallet)
  const switchNetwork = useCallback((newNetwork: NetworkId) => {
    if (isDevMode && newNetwork === 'devnet') {
      // Already in devnet, nothing to do
      return;
    }

    if (newNetwork === 'devnet') {
      // Switching to devnet requires disconnecting wallet
      disconnectWallet();
      connectDevAccount(0);
    } else {
      // For mainnet/sepolia, user needs to reconnect with correct network in wallet
      console.log(`To switch to ${getNetworks()[newNetwork].name}, please change network in your wallet and reconnect.`);
    }
  }, [isDevMode, disconnectWallet, connectDevAccount]);

  // Auto-reconnect on page load
  useEffect(() => {
    const wasConnected = typeof window !== 'undefined' && localStorage.getItem('wallet_connected');

    if (wasConnected === 'dev') {
      // Reconnect to devnet account
      const indexStr = localStorage.getItem('dev_account_index');
      const index = indexStr ? parseInt(indexStr, 10) : 0;
      connectDevAccount(index);
    } else if (wasConnected === 'true') {
      // Try to reconnect wallet
      connectWallet().catch((err) => {
        console.warn('Auto-reconnect failed:', err);
        // Clear stored state if reconnect fails
        if (typeof window !== 'undefined') {
          localStorage.removeItem('wallet_connected');
          localStorage.removeItem('wallet_address');
          localStorage.removeItem('wallet_network');
        }
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <WalletContext.Provider
      value={{
        address,
        account,
        isConnected: !!address,
        isConnecting,
        isDevMode,
        network,
        networkConfig,
        wallet,
        walletName,
        connectWallet,
        connectDevAccount,
        disconnectWallet,
        switchNetwork,
        getExplorerUrl,
        getAccountUrl,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

// Export network config for use elsewhere
export { getNetworks, type NetworkId, type NetworkConfig };
