#!/usr/bin/env node
/**
 * Deploy Vauban Blog Smart Contracts to Madara L3
 * Using starknet.js for direct interaction with devnet
 */

import { Account, RpcProvider, Contract, json, hash, CallData, constants } from 'starknet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(PROJECT_ROOT, 'contracts');

// Configuration
const RPC_URL = process.env.RPC_URL || 'http://localhost:9944';

// Madara devnet account #1
const DEPLOYER_ADDRESS = '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';
const DEPLOYER_PRIVATE_KEY = '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';

async function main() {
  console.log('🚀 Deploying Vauban Blog Smart Contracts');
  console.log('==========================================');
  console.log(`📍 Network: ${RPC_URL}`);
  console.log(`👤 Deployer: ${DEPLOYER_ADDRESS}`);
  console.log('');

  // Initialize provider and account
  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  console.log('🔗 Checking RPC connectivity...');
  try {
    const chainId = await provider.getChainId();
    console.log(`✅ Connected to chain: ${chainId}`);
  } catch (error) {
    console.error('❌ Failed to connect to RPC:', error.message);
    process.exit(1);
  }

  // Create account instance
  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);

  console.log('');
  console.log('📦 Loading contract artifacts...');

  // Load contract class files
  const contracts = ['BlogRegistry', 'Social', 'Paymaster', 'SessionKeyManager'];
  const artifacts = {};

  for (const name of contracts) {
    const classPath = path.join(CONTRACTS_DIR, 'target', 'dev', `vauban_blog_${name}.contract_class.json`);
    const casmPath = path.join(CONTRACTS_DIR, 'target', 'dev', `vauban_blog_${name}.compiled_contract_class.json`);

    if (!fs.existsSync(classPath) || !fs.existsSync(casmPath)) {
      console.error(`❌ Contract artifact not found for ${name}`);
      process.exit(1);
    }

    artifacts[name] = {
      sierra: JSON.parse(fs.readFileSync(classPath, 'utf8')),
      casm: JSON.parse(fs.readFileSync(casmPath, 'utf8')),
    };
    console.log(`   ✓ Loaded ${name}`);
  }

  console.log('');
  const deployedAddresses = {};

  // Deploy BlogRegistry
  // Constructor: (owner: ContractAddress, treasury: ContractAddress, platform_fee_percentage: u256)
  // Note: u256 needs to be passed as {low, high} or as uint256.bnToUint256
  console.log('1️⃣  Deploying BlogRegistry...');
  try {
    const blogRegistryAddress = await declareAndDeploy(
      account,
      artifacts.BlogRegistry,
      [
        DEPLOYER_ADDRESS,  // owner
        DEPLOYER_ADDRESS,  // treasury
        { low: 250, high: 0 },  // platform_fee_percentage (u256: 2.5%)
      ]
    );
    deployedAddresses.BlogRegistry = blogRegistryAddress;
    console.log(`   ✅ BlogRegistry: ${blogRegistryAddress}`);
  } catch (error) {
    console.error(`   ❌ Failed to deploy BlogRegistry:`, error.message);
    throw error;
  }

  // Deploy Social
  // Constructor: (owner: ContractAddress)
  console.log('');
  console.log('2️⃣  Deploying Social...');
  try {
    const socialAddress = await declareAndDeploy(
      account,
      artifacts.Social,
      [DEPLOYER_ADDRESS]  // owner
    );
    deployedAddresses.Social = socialAddress;
    console.log(`   ✅ Social: ${socialAddress}`);
  } catch (error) {
    console.error(`   ❌ Failed to deploy Social:`, error.message);
    throw error;
  }

  // Deploy Paymaster
  // Constructor: (owner: ContractAddress, emergency_admin: ContractAddress, daily_budget: u256, user_limit: u256)
  console.log('');
  console.log('3️⃣  Deploying Paymaster...');
  try {
    const paymasterAddress = await declareAndDeploy(
      account,
      artifacts.Paymaster,
      [
        DEPLOYER_ADDRESS,                             // owner
        DEPLOYER_ADDRESS,                             // emergency_admin
        { low: '100000000000000000000', high: 0 },    // daily_budget (u256: 100 ETH)
        { low: '1000000000000000000', high: 0 },      // user_limit (u256: 1 ETH)
      ]
    );
    deployedAddresses.Paymaster = paymasterAddress;
    console.log(`   ✅ Paymaster: ${paymasterAddress}`);
  } catch (error) {
    console.error(`   ❌ Failed to deploy Paymaster:`, error.message);
    throw error;
  }

  // Deploy SessionKeyManager
  // Constructor: (owner: ContractAddress)
  console.log('');
  console.log('4️⃣  Deploying SessionKeyManager...');
  try {
    const sessionKeyManagerAddress = await declareAndDeploy(
      account,
      artifacts.SessionKeyManager,
      [DEPLOYER_ADDRESS]  // owner
    );
    deployedAddresses.SessionKeyManager = sessionKeyManagerAddress;
    console.log(`   ✅ SessionKeyManager: ${sessionKeyManagerAddress}`);
  } catch (error) {
    console.error(`   ❌ Failed to deploy SessionKeyManager:`, error.message);
    throw error;
  }

  // Save deployment info
  console.log('');
  console.log('💾 Saving deployment info...');

  const deploymentInfo = {
    network: RPC_URL,
    deployed_at: new Date().toISOString(),
    deployer: DEPLOYER_ADDRESS,
    contracts: deployedAddresses,
  };

  const deploymentPath = path.join(PROJECT_ROOT, '.deployments.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`   ✓ Saved to ${deploymentPath}`);

  // Create frontend .env.local
  const frontendEnvPath = path.join(PROJECT_ROOT, 'apps', 'frontend', '.env.local');
  const frontendEnv = `# Auto-generated by scripts/deploy-contracts.mjs
# Deployed at: ${new Date().toISOString()}

NEXT_PUBLIC_MADARA_RPC=${RPC_URL}
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=${deployedAddresses.BlogRegistry}
NEXT_PUBLIC_SOCIAL_ADDRESS=${deployedAddresses.Social}
NEXT_PUBLIC_PAYMASTER_ADDRESS=${deployedAddresses.Paymaster}
NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS=${deployedAddresses.SessionKeyManager}
NEXT_PUBLIC_CHAIN_ID=MADARA_DEVNET
`;
  fs.writeFileSync(frontendEnvPath, frontendEnv);
  console.log(`   ✓ Created ${frontendEnvPath}`);

  console.log('');
  console.log('==========================================');
  console.log('✅ Deployment Complete!');
  console.log('==========================================');
  console.log('');
  console.log('📋 Deployed Contracts:');
  for (const [name, address] of Object.entries(deployedAddresses)) {
    console.log(`   • ${name}: ${address}`);
  }
  console.log('');
}

async function declareAndDeploy(account, artifact, constructorArgs) {
  const { sierra, casm } = artifact;

  // Compute class hash
  const classHash = hash.computeContractClassHash(sierra);
  const compiledClassHash = hash.computeCompiledClassHash(casm);

  console.log(`   Class hash: ${classHash}`);

  // Check if class is already declared
  let needsDeclare = true;
  try {
    await account.getClass(classHash);
    console.log(`   Class already declared, skipping declaration`);
    needsDeclare = false;
  } catch {
    // Class not declared yet
  }

  if (needsDeclare) {
    // Declare the class - skip fee estimation for devnet
    console.log(`   Declaring class...`);
    const declareResponse = await account.declare({
      contract: sierra,
      casm: casm,
    }, {
      skipValidate: true,
      maxFee: '0x100000000000000', // High max fee for devnet
    });
    console.log(`   Declaration tx: ${declareResponse.transaction_hash}`);
    await account.waitForTransaction(declareResponse.transaction_hash);
  }

  // Deploy using declareAndDeploy which handles the contract address calculation
  console.log(`   Deploying instance...`);

  // Compute contract address deterministically
  const constructorCalldata = CallData.compile(constructorArgs);

  // Use a unique salt based on timestamp
  const salt = hash.computePedersenHash('0x' + Date.now().toString(16), account.address);

  // Compute the contract address
  const contractAddress = hash.calculateContractAddressFromHash(
    salt,
    classHash,
    constructorCalldata,
    0 // deployer address (0 for direct deploy)
  );

  console.log(`   Computed address: ${contractAddress}`);

  // Deploy by invoking the DEPLOY_CONTRACT syscall via account
  // Use starknet.js's built-in deploy - skip fee estimation for devnet
  try {
    const deployResponse = await account.deployContract({
      classHash: classHash,
      constructorCalldata: constructorCalldata,
      salt: salt,
    }, {
      skipValidate: true,
      maxFee: '0x100000000000000', // High max fee for devnet
    });
    console.log(`   Deploy tx: ${deployResponse.transaction_hash}`);
    await account.waitForTransaction(deployResponse.transaction_hash);

    // Return the address from the response or computed
    return deployResponse.contract_address || contractAddress;
  } catch (udcError) {
    // UDC not available, try deploy_account pattern or direct syscall
    console.log(`   UDC not available, trying direct deployment...`);
    console.log(`   Error: ${udcError.message}`);

    // For devnets without UDC, we can use declare + call constructor approach
    // This is a workaround - deploy via invoke
    const { transaction_hash } = await account.execute({
      contractAddress: classHash,
      entrypoint: 'constructor',
      calldata: constructorCalldata,
    }, undefined, {
      skipValidate: true,
      maxFee: '0x100000000000000',
    });

    console.log(`   Direct deploy tx: ${transaction_hash}`);
    await account.waitForTransaction(transaction_hash);

    return contractAddress;
  }
}

main().catch((error) => {
  console.error('❌ Deployment failed:', error);
  process.exit(1);
});
