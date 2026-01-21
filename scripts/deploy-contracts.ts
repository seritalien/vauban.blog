#!/usr/bin/env npx ts-node

/**
 * Deploy Vauban Blog contracts to Madara devnet
 * Uses starknet.js v6 for compatibility with Madara RPC
 */

import { Account, RpcProvider, json, hash } from 'starknet';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Devnet accounts (from Madara logs)
const DEVNET_ACCOUNTS = [
  {
    address: '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1',
    privateKey: '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86',
    name: 'dev1',
  },
  {
    address: '0x5e9e93c6235f8ae6c2f4f0069bd30753ec21b26fbad80cfbf5da2c1bc573d69',
    privateKey: '0x11830d3641a682d4a690dcc25d1f4b0dac948325ac18f6dd32564371735f320',
    name: 'dev2',
  },
];

const RPC_URL = process.env.MADARA_RPC_URL || 'http://localhost:9944';
const CONTRACTS_DIR = path.join(__dirname, '..', 'contracts', 'target', 'dev');

interface DeployedContract {
  name: string;
  classHash: string;
  address: string;
  txHash: string;
}

async function loadContractArtifact(name: string) {
  const sierraPath = path.join(CONTRACTS_DIR, `vauban_blog_${name}.contract_class.json`);
  const casmPath = path.join(CONTRACTS_DIR, `vauban_blog_${name}.compiled_contract_class.json`);

  if (!fs.existsSync(sierraPath)) {
    throw new Error(`Sierra file not found: ${sierraPath}`);
  }
  if (!fs.existsSync(casmPath)) {
    throw new Error(`CASM file not found: ${casmPath}`);
  }

  const sierra = json.parse(fs.readFileSync(sierraPath, 'utf-8'));
  const casm = json.parse(fs.readFileSync(casmPath, 'utf-8'));

  return { sierra, casm };
}

async function declareAndDeployContract(
  account: Account,
  name: string,
  constructorArgs: any[]
): Promise<{ classHash: string; address: string }> {
  console.log(`\n📋 Declaring and deploying ${name}...`);

  const { sierra, casm } = await loadContractArtifact(name);

  // Calculate class hash
  const classHash = hash.computeContractClassHash(sierra);
  console.log(`   Class hash: ${classHash}`);

  // Check if already declared
  let needsDeclare = true;
  try {
    await account.getClassByHash(classHash);
    console.log(`   ✅ Already declared`);
    needsDeclare = false;
  } catch {
    // Not declared yet
  }

  // Declare if needed
  if (needsDeclare) {
    const declareResponse = await account.declare({
      contract: sierra,
      casm: casm,
    });
    console.log(`   Declare TX: ${declareResponse.transaction_hash}`);
    await account.waitForTransaction(declareResponse.transaction_hash);
    console.log(`   ✅ Declared`);
  }

  // Deploy using declareAndDeploy (skip declare step since already done)
  console.log(`   Constructor args:`, constructorArgs);

  // Calculate contract address deterministically
  const salt = hash.computePedersenHash(Date.now().toString(), account.address);

  const deployResponse = await account.declareAndDeploy({
    contract: sierra,
    casm: casm,
    constructorCalldata: constructorArgs,
    salt,
  });

  console.log(`   Deploy TX: ${deployResponse.deploy.transaction_hash}`);
  await account.waitForTransaction(deployResponse.deploy.transaction_hash);
  console.log(`   ✅ Deployed at: ${deployResponse.deploy.contract_address}`);

  return {
    classHash: String(deployResponse.declare?.class_hash || classHash),
    address: String(deployResponse.deploy.contract_address),
  };
}

async function main() {
  console.log('🔧 Vauban Blog Contract Deployment');
  console.log('===================================');
  console.log(`RPC: ${RPC_URL}`);

  // Setup provider and account
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const devAccount = DEVNET_ACCOUNTS[0];
  const account = new Account(provider, devAccount.address, devAccount.privateKey);

  console.log(`\n👤 Deployer: ${devAccount.address}`);

  // Check chain
  const chainId = await provider.getChainId();
  console.log(`⛓️  Chain ID: ${chainId}`);

  const deployments: DeployedContract[] = [];

  try {
    // 1. Deploy Treasury first (simple constructor: owner only)
    const treasury = await declareAndDeployContract(
      account,
      'Treasury',
      [devAccount.address] // owner
    );
    deployments.push({
      name: 'Treasury',
      classHash: treasury.classHash,
      address: treasury.address,
      txHash: '',
    });

    // 2. Deploy BlogRegistry (needs treasury address)
    // Constructor: owner, treasury, platform_fee_percentage (u256 = low, high)
    const blogRegistry = await declareAndDeployContract(
      account,
      'BlogRegistry',
      [
        devAccount.address, // owner
        treasury.address,   // treasury
        '100',              // platform_fee_percentage low (1% = 100 basis points)
        '0',                // platform_fee_percentage high (u256 needs two felts)
      ]
    );
    deployments.push({
      name: 'BlogRegistry',
      classHash: blogRegistry.classHash,
      address: blogRegistry.address,
      txHash: '',
    });

    // 3. Deploy Social
    const social = await declareAndDeployContract(
      account,
      'Social',
      [devAccount.address] // owner
    );
    deployments.push({
      name: 'Social',
      classHash: social.classHash,
      address: social.address,
      txHash: '',
    });

    // 4. Deploy RoleRegistry
    const roleRegistry = await declareAndDeployContract(
      account,
      'RoleRegistry',
      [devAccount.address] // owner
    );
    deployments.push({
      name: 'RoleRegistry',
      classHash: roleRegistry.classHash,
      address: roleRegistry.address,
      txHash: '',
    });

    // 5. Deploy Reputation
    const reputation = await declareAndDeployContract(
      account,
      'Reputation',
      [devAccount.address] // owner
    );
    deployments.push({
      name: 'Reputation',
      classHash: reputation.classHash,
      address: reputation.address,
      txHash: '',
    });

    // Save deployments
    const deploymentsPath = path.join(__dirname, '..', '.deployments.json');
    const deploymentsData = {
      network: 'madara-devnet',
      chainId,
      deployedAt: new Date().toISOString(),
      deployer: devAccount.address,
      contracts: Object.fromEntries(
        deployments.map(d => [d.name, { classHash: d.classHash, address: d.address }])
      ),
    };
    fs.writeFileSync(deploymentsPath, JSON.stringify(deploymentsData, null, 2));
    console.log(`\n📁 Saved deployments to ${deploymentsPath}`);

    // Update frontend .env.local
    const envPath = path.join(__dirname, '..', 'apps', 'frontend', '.env.local');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Update or add contract addresses
    const envUpdates: Record<string, string> = {
      'NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS': deployments.find(d => d.name === 'BlogRegistry')!.address,
      'NEXT_PUBLIC_SOCIAL_ADDRESS': deployments.find(d => d.name === 'Social')!.address,
      'NEXT_PUBLIC_ROLE_REGISTRY_ADDRESS': deployments.find(d => d.name === 'RoleRegistry')!.address,
      'NEXT_PUBLIC_REPUTATION_ADDRESS': deployments.find(d => d.name === 'Reputation')!.address,
      'NEXT_PUBLIC_TREASURY_ADDRESS': deployments.find(d => d.name === 'Treasury')!.address,
    };

    for (const [key, value] of Object.entries(envUpdates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${key}=${value}`);
      } else {
        envContent += `\n${key}=${value}`;
      }
    }

    fs.writeFileSync(envPath, envContent.trim() + '\n');
    console.log(`📁 Updated ${envPath}`);

    console.log('\n✅ Deployment complete!');
    console.log('\nContract Addresses:');
    console.log('-------------------');
    for (const d of deployments) {
      console.log(`${d.name}: ${d.address}`);
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  }
}

main();
