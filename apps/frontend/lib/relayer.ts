/**
 * Relayer Service for M2M Publishing
 *
 * This service uses a server-side Starknet account to sign and submit
 * transactions on behalf of the M2M API. The relayer pays for gas.
 */

import { Account, RpcProvider } from 'starknet';
import {
  initStarknetProvider,
  setContractAddresses,
  publishPost,
} from '@vauban/web3-utils';

let relayerAccount: Account | null = null;
let provider: RpcProvider | null = null;
let initialized = false;

/**
 * Initialize the relayer with environment variables
 */
export function initRelayer(): { account: Account; provider: RpcProvider } {
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  const address = process.env.RELAYER_ADDRESS;
  const rpcUrl = process.env.MADARA_RPC_URL || 'http://localhost:9944';

  if (!privateKey || !address) {
    throw new Error('RELAYER_PRIVATE_KEY and RELAYER_ADDRESS must be set');
  }

  // Initialize the Starknet provider from web3-utils
  provider = initStarknetProvider({ nodeUrl: rpcUrl });

  // Set contract addresses
  setContractAddresses({
    blogRegistry: process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS,
    social: process.env.NEXT_PUBLIC_SOCIAL_ADDRESS,
    paymaster: process.env.NEXT_PUBLIC_PAYMASTER_ADDRESS,
    sessionKeyManager: process.env.NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS,
  });

  relayerAccount = new Account(provider, address, privateKey);
  initialized = true;

  return { account: relayerAccount, provider };
}

/**
 * Get the relayer account (initializes if needed)
 */
export function getRelayer(): { account: Account; provider: RpcProvider } {
  if (!relayerAccount || !provider || !initialized) {
    return initRelayer();
  }
  return { account: relayerAccount, provider };
}

/**
 * Publish a post using the relayer account
 */
export async function relayPublishPost(
  arweaveTxId: string,
  ipfsCid: string,
  contentHash: string,
  price: string = '0',
  isEncrypted: boolean = false
): Promise<{ txHash: string; postId?: string }> {
  const { account } = getRelayer();

  if (!process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS) {
    throw new Error('NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS not configured');
  }

  // Use the publishPost function from web3-utils
  const txHash = await publishPost(
    account,
    arweaveTxId,
    ipfsCid,
    contentHash,
    price,
    isEncrypted
  );

  return { txHash };
}

/**
 * Check relayer account balance
 */
export async function getRelayerBalance(): Promise<string> {
  try {
    const { provider, account } = getRelayer();

    // Get block to verify connection
    const block = await provider.getBlock('latest');
    console.log(`Relayer connected, latest block: ${block.block_number}`);

    // For now, return a placeholder - actual balance checking depends on token contract
    return account.address;
  } catch (error) {
    console.error('Error checking relayer:', error);
    return '0';
  }
}

/**
 * Check if relayer is properly configured
 */
export function isRelayerConfigured(): boolean {
  return !!(
    process.env.RELAYER_PRIVATE_KEY &&
    process.env.RELAYER_ADDRESS &&
    process.env.NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS
  );
}
