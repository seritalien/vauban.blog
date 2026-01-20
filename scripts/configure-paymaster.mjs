#!/usr/bin/env node
/**
 * Configure Paymaster contract - whitelist Social contract and fund it
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
  console.log('Configuring Paymaster...');

  // Load deployment addresses
  const deploymentPath = path.join(PROJECT_ROOT, '.deployments.json');
  if (!fs.existsSync(deploymentPath)) {
    console.error('Deployment file not found. Run deploy-simple.mjs first.');
    process.exit(1);
  }

  const deployments = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const { Paymaster, Social, BlogRegistry } = deployments.contracts;

  console.log(`Paymaster: ${Paymaster}`);
  console.log(`Social: ${Social}`);
  console.log(`BlogRegistry: ${BlogRegistry}`);

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);

  // Load Paymaster ABI
  const paymasterAbiPath = path.join(PROJECT_ROOT, 'contracts/target/dev/vauban_blog_Paymaster.contract_class.json');
  const paymasterAbi = JSON.parse(fs.readFileSync(paymasterAbiPath, 'utf8')).abi;

  const paymasterContract = new Contract(paymasterAbi, Paymaster, account);

  // 1. Check and whitelist Social contract
  console.log('\n1. Checking Social contract whitelist...');
  try {
    const isWhitelisted = await paymasterContract.is_whitelisted(Social);
    console.log(`   Social whitelisted: ${isWhitelisted}`);

    if (!isWhitelisted) {
      console.log('   Whitelisting Social contract...');
      const result = await paymasterContract.whitelist_contract(Social);
      console.log(`   TX: ${result.transaction_hash}`);
      await provider.waitForTransaction(result.transaction_hash);
      console.log('   Social contract whitelisted!');
    }
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // 2. Check and whitelist BlogRegistry contract
  console.log('\n2. Checking BlogRegistry contract whitelist...');
  try {
    const isWhitelisted = await paymasterContract.is_whitelisted(BlogRegistry);
    console.log(`   BlogRegistry whitelisted: ${isWhitelisted}`);

    if (!isWhitelisted) {
      console.log('   Whitelisting BlogRegistry contract...');
      const result = await paymasterContract.whitelist_contract(BlogRegistry);
      console.log(`   TX: ${result.transaction_hash}`);
      await provider.waitForTransaction(result.transaction_hash);
      console.log('   BlogRegistry contract whitelisted!');
    }
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // 3. Fund the paymaster (simulated - in real deployment would transfer STRK)
  console.log('\n3. Funding Paymaster...');
  try {
    const currentBalance = await paymasterContract.get_balance();
    console.log(`   Current balance: ${currentBalance}`);

    // Fund with 10 STRK (10 * 10^18 wei)
    const fundAmount = BigInt('10000000000000000000');
    console.log(`   Funding with ${fundAmount} wei...`);
    const result = await paymasterContract.fund(fundAmount);
    console.log(`   TX: ${result.transaction_hash}`);
    await provider.waitForTransaction(result.transaction_hash);

    const newBalance = await paymasterContract.get_balance();
    console.log(`   New balance: ${newBalance}`);
  } catch (e) {
    console.log('   Error:', e.message);
  }

  // 4. Display stats
  console.log('\n4. Paymaster Stats:');
  try {
    const balance = await paymasterContract.get_balance();
    const dailyBudget = await paymasterContract.get_daily_budget();
    const userLimit = await paymasterContract.get_user_daily_limit();
    const totalSponsored = await paymasterContract.get_total_sponsored();
    const txCount = await paymasterContract.get_total_tx_count();
    const isPaused = await paymasterContract.is_paused();

    console.log(`   Balance: ${balance}`);
    console.log(`   Daily Budget: ${dailyBudget}`);
    console.log(`   User Daily Limit: ${userLimit}`);
    console.log(`   Total Sponsored: ${totalSponsored}`);
    console.log(`   TX Count: ${txCount}`);
    console.log(`   Paused: ${isPaused}`);
  } catch (e) {
    console.log('   Error getting stats:', e.message);
  }

  console.log('\nPaymaster configured successfully!');
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
