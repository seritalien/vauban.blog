/**
 * Test accounts for E2E testing on Madara devnet
 *
 * These are pre-funded accounts from the Madara genesis configuration.
 * DO NOT use these in production!
 */

export interface TestAccount {
  name: string;
  address: string;
  privateKey: string;
  publicKey: string;
}

/**
 * Madara devnet pre-funded accounts
 *
 * The deployer account uses the well-known devnet private key.
 * This is the standard Starknet devnet account setup.
 *
 * SECURITY: These keys are PUBLIC and should NEVER be used outside of local devnet!
 */
export const TEST_ACCOUNTS: TestAccount[] = [
  {
    name: 'deployer',
    address: '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1',
    // Madara devnet key (from deploy_sncast.sh - DO NOT use in production!)
    privateKey: '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86',
    publicKey: '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86',
  },
];

export const USER_A: TestAccount = {
  name: 'user_a',
  address: '0x5e9e93c6235f8ae6c2f4f0069bd30753ec21b26fbad80cfbf5da2c1bc573d69',
  privateKey: '0x11830d3641a682d4a690dcc25d1f4b0dac948325ac18f6dd32564371735f320',
  publicKey: '0x11830d3641a682d4a690dcc25d1f4b0dac948325ac18f6dd32564371735f320',
};

export const USER_B: TestAccount = {
  name: 'user_b',
  address: '0x1f7cccfc0ae200cf667fe8c842ca24dfc8790409a04e217f0ffc2ad7def6bda',
  privateKey: '0x7bec814b18b1d193eaa7cec41007e04bf0a98453b06ec7582aa29882c52eb7b',
  publicKey: '0x7bec814b18b1d193eaa7cec41007e04bf0a98453b06ec7582aa29882c52eb7b',
};

export const DEPLOYER = TEST_ACCOUNTS[0];

// Contract addresses from deployment
export const CONTRACTS = {
  BlogRegistry: '0x33633026db7a22b50849ebe112f39d710d967856cc5f9b7088069af48eee98b',
  Social: '0x67dc927e948662cd150a0d977ed1166a3287f30e9c737be0b5be484cc3aa8d',
  RoleRegistry: '0x3a864c75941e678c2a685a2efcd89bc68c7951546ccfdb44504b5f0a6f48ced',
  Reputation: '0xef558283180a5c0f3b8daf79edd5592136404d0a8af7a058615428d8da887e',
  Follows: '0x1c38dfe6f2a479abbfbe10c710249e7cbfaea0c68d260d0f69572f97a6b6d3e',
  Treasury: '0x1944f5af48af7b9c64344da7bdcd28c6cc5ac7bef6be6c9a7b20de84a2e3ec5',
};

// RPC endpoint
export const RPC_URL = process.env.MADARA_RPC_URL || 'http://localhost:9944';
