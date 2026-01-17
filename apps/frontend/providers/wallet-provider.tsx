'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { connect, disconnect, IStarknetWindowObject } from 'starknetkit';
import { Account, RpcProvider } from 'starknet';

interface WalletContextType {
  address: string | null;
  account: Account | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  wallet: IStarknetWindowObject | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [wallet, setWallet] = useState<IStarknetWindowObject | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = async () => {
    try {
      setIsConnecting(true);
      const { wallet: connectedWallet } = await connect({
        webWalletUrl: 'https://web.argent.xyz',
        argentMobileOptions: {
          dappName: 'Vauban Blog',
        },
      });

      if (!connectedWallet) {
        throw new Error('No wallet connected');
      }

      await connectedWallet.enable();

      if (connectedWallet.isConnected && connectedWallet.selectedAddress) {
        const nodeUrl = process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944';
        const provider = new RpcProvider({ nodeUrl });

        const acc = new Account(
          provider,
          connectedWallet.selectedAddress,
          connectedWallet.account
        );

        setWallet(connectedWallet);
        setAddress(connectedWallet.selectedAddress);
        setAccount(acc);

        // Store in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('wallet_connected', 'true');
          localStorage.setItem('wallet_address', connectedWallet.selectedAddress);
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

    if (typeof window !== 'undefined') {
      localStorage.removeItem('wallet_connected');
      localStorage.removeItem('wallet_address');
    }
  };

  // Auto-reconnect on page load
  useEffect(() => {
    const wasConnected = typeof window !== 'undefined' && localStorage.getItem('wallet_connected');
    if (wasConnected) {
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
        connectWallet,
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
