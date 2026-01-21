'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connect, disconnect, StarknetWindowObject } from 'starknetkit';
import { Account, RpcProvider } from 'starknet';

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

interface WalletContextType {
  address: string | null;
  account: Account | null;
  isConnected: boolean;
  isConnecting: boolean;
  isDevMode: boolean;
  connectWallet: () => Promise<void>;
  connectDevAccount: (index?: number) => void;
  disconnectWallet: () => void;
  wallet: StarknetWindowObject | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [wallet, setWallet] = useState<StarknetWindowObject | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);

  // Connect using devnet account (no wallet extension needed)
  const connectDevAccount = (index: number = 0) => {
    const devAccount = DEVNET_ACCOUNTS[index];
    if (!devAccount) {
      console.error('Invalid devnet account index');
      return;
    }

    // Use local proxy to avoid CORS issues
    const nodeUrl = '/api/rpc';
    const provider = new RpcProvider({ nodeUrl });

    const acc = new Account(
      provider,
      devAccount.address,
      devAccount.privateKey
    );

    setAddress(devAccount.address);
    setAccount(acc);
    setIsDevMode(true);
    setWallet(null);

    // Store in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('wallet_connected', 'dev');
      localStorage.setItem('wallet_address', devAccount.address);
      localStorage.setItem('dev_account_index', index.toString());
    }

    console.log(`Connected to ${devAccount.name}: ${devAccount.address}`);
  };

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      const { wallet: connectedWallet } = await connect({
        webWalletUrl: 'https://web.argent.xyz',
        argentMobileOptions: {
          dappName: 'Vauban Blog',
          url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3005',
        },
      });

      if (!connectedWallet) {
        throw new Error('No wallet connected');
      }

      // Note: starknetkit v2 API - wallet is already connected after connect() succeeds
      // Using 'as any' for type compatibility with starknetkit v2 API changes
      const wallet = connectedWallet as any;
      const walletAddress = wallet.selectedAddress || wallet.account?.address;

      if (walletAddress && wallet.account) {
        const nodeUrl = process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944';
        const provider = new RpcProvider({ nodeUrl });

        const acc = new Account(
          provider,
          walletAddress,
          wallet.account
        );

        setWallet(connectedWallet);
        setAddress(walletAddress);
        setAccount(acc);
        setIsDevMode(false);

        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('wallet_connected', 'true');
          localStorage.setItem('wallet_address', walletAddress);
        }
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    if (wallet) {
      disconnect();
    }
    setWallet(null);
    setAddress(null);
    setAccount(null);
    setIsDevMode(false);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_connected');
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('dev_account_index');
    }
  };

  // Auto-reconnect on page load
  useEffect(() => {
    const wasConnected = typeof window !== 'undefined' && localStorage.getItem('wallet_connected');
    if (wasConnected === 'dev') {
      // Reconnect to devnet account
      const indexStr = localStorage.getItem('dev_account_index');
      const index = indexStr ? parseInt(indexStr, 10) : 0;
      connectDevAccount(index);
    } else if (wasConnected === 'true') {
      connectWallet();
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        address,
        account,
        isConnected: !!address,
        isConnecting,
        isDevMode,
        connectWallet,
        connectDevAccount,
        disconnectWallet,
        wallet,
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
