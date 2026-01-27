#!/usr/bin/env node
/**
 * Deploy Follows contract to Madara devnet using starknet.js
 *
 * Usage: node contracts/scripts/deploy-follows.mjs
 */
import { Account, RpcProvider, json, Contract } from 'starknet';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

// Config
const RPC_URL = process.env.RPC_URL || 'http://localhost:9944';
const DEPLOYER_ADDR = '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';
const DEPLOYER_KEY = '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';

async function main() {
  console.log('🚀 Deploying Follows contract...');
  console.log(`📍 RPC: ${RPC_URL}`);
  console.log(`👤 Deployer: ${DEPLOYER_ADDR}`);
  console.log('');

  // Provider
  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  // Account
  const account = new Account(provider, DEPLOYER_ADDR, DEPLOYER_KEY);

  // Read compiled contract
  const contractPath = join(__dirname, '..', 'target', 'dev', 'vauban_blog_Follows.contract_class.json');
  const compiledPath = join(__dirname, '..', 'target', 'dev', 'vauban_blog_Follows.compiled_contract_class.json');
  const contractClass = json.parse(readFileSync(contractPath, 'utf8'));
  const compiledClass = json.parse(readFileSync(compiledPath, 'utf8'));

  // Declare
  console.log('📄 Declaring contract class...');
  let classHash;
  try {
    const declareResponse = await account.declare({
      contract: contractClass,
      casm: compiledClass,
    });
    classHash = declareResponse.class_hash;
    console.log(`✅ Declared: ${classHash}`);

    // Wait for declaration
    if (declareResponse.transaction_hash) {
      console.log(`   Waiting for tx: ${declareResponse.transaction_hash}`);
      await provider.waitForTransaction(declareResponse.transaction_hash);
    }
  } catch (err) {
    // If already declared, extract class hash
    if (err.message?.includes('already declared') || err.message?.includes('CLASS_ALREADY_DECLARED')) {
      console.log('⚠️  Class already declared, computing hash...');
      // Compute class hash from the contract
      const { hash } = await import('starknet');
      classHash = hash.computeContractClassHash(contractClass);
      console.log(`   Class hash: ${classHash}`);
    } else {
      throw err;
    }
  }

  // Deploy with owner as constructor arg
  console.log('');
  console.log('🏗️  Deploying contract...');
  const deployResponse = await account.deployContract({
    classHash,
    constructorCalldata: [DEPLOYER_ADDR],
  });

  console.log(`   Waiting for tx: ${deployResponse.transaction_hash}`);
  await provider.waitForTransaction(deployResponse.transaction_hash);

  const contractAddress = deployResponse.contract_address;
  console.log(`✅ Follows deployed at: ${contractAddress}`);

  // Update .deployments.json
  const deploymentsPath = join(PROJECT_ROOT, '.deployments.json');
  let deployments;
  try {
    deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
  } catch {
    deployments = { contracts: {} };
  }

  deployments.contracts.Follows = {
    classHash,
    address: contractAddress,
  };

  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`💾 Updated .deployments.json`);

  // Update .env.local
  const envPath = join(PROJECT_ROOT, 'apps', 'frontend', '.env.local');
  try {
    let envContent = readFileSync(envPath, 'utf8');
    if (envContent.includes('NEXT_PUBLIC_FOLLOWS_ADDRESS')) {
      envContent = envContent.replace(
        /NEXT_PUBLIC_FOLLOWS_ADDRESS=.*/,
        `NEXT_PUBLIC_FOLLOWS_ADDRESS=${contractAddress}`
      );
    } else {
      envContent += `\nNEXT_PUBLIC_FOLLOWS_ADDRESS=${contractAddress}\n`;
    }
    writeFileSync(envPath, envContent);
    console.log(`📝 Updated .env.local`);
  } catch {
    console.log(`⚠️  Could not update .env.local`);
  }

  // Also redeclare + redeploy BlogRegistry if the current one is stale
  console.log('');
  console.log('=========================================');
  console.log(`✅ Follows contract: ${contractAddress}`);
  console.log('=========================================');
}

main().catch((err) => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});
