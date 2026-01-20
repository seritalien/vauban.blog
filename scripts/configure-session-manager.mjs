#!/usr/bin/env node
/**
 * Configure Social contract with SessionKeyManager address
 */

import { Account, RpcProvider, Contract } from 'starknet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const RPC_URL = process.env.RPC_URL || 'http://localhost:9944';

// Madara devnet account #1
const DEPLOYER_ADDRESS = '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';
const DEPLOYER_PRIVATE_KEY = '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';

async function main() {
  console.log('Configuring Session Key Manager...');

  // Load deployment addresses
  const deploymentPath = path.join(PROJECT_ROOT, '.deployments.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error('Deployment file not found. Run deploy-simple.mjs first.');
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const { Social, SessionKeyManager } = deployments.contracts;

  console.log(`Social: ${Social}`);
  console.log(`SessionKeyManager: ${SessionKeyManager}`);

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);

  // Load Social ABI
  const socialAbiPath = path.join(PROJECT_ROOT, 'contracts/target/dev/vauban_blog_Social.contract_class.json');
  const socialAbi = JSON.parse(fs.readFileSync(socialAbiPath, 'utf8')).abi;

  const socialContract = new Contract(socialAbi, Social, account);

  // Check current session key manager
  try {
    const currentManager = await socialContract.get_session_key_manager();
    console.log(`Current SessionKeyManager: ${currentManager}`);

    if (currentManager.toString() === SessionKeyManager ||
        BigInt(currentManager).toString(16) === SessionKeyManager.replace('0x', '')) {
      console.log('SessionKeyManager already configured correctly!');
      return;
    }
  } catch (e) {
    console.log('Could not read current manager:', e.message);
  }

  // Set session key manager
  console.log('Setting SessionKeyManager...');
  const result = await socialContract.set_session_key_manager(SessionKeyManager);
  console.log(`TX: ${result.transaction_hash}`);

  await provider.waitForTransaction(result.transaction_hash);
  console.log('SessionKeyManager configured successfully!');
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
