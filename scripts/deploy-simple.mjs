#!/usr/bin/env node
/**
 * Simple deploy script - skips fee estimation completely
 */

import { Account, RpcProvider, hash, CallData, stark, ec } from 'starknet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(PROJECT_ROOT, 'contracts');

const RPC_URL = process.env.RPC_URL || 'http://localhost:9944';

// Madara devnet account #1
const DEPLOYER_ADDRESS = '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';
const DEPLOYER_PRIVATE_KEY = '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';

async function main() {
  console.log('🚀 Simple Deploy Script');
  console.log('=======================');
  console.log(`Network: ${RPC_URL}`);

  const provider = new RpcProvider({ nodeUrl: RPC_URL });

  // Test connection
  try {
    const chainId = await provider.getChainId();
    console.log(`Chain ID: ${chainId}`);
  } catch (e) {
    console.error('Failed to connect:', e.message);
    process.exit(1);
  }

  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);

  // Load BlogRegistry
  const contracts = ['BlogRegistry', 'Social', 'Paymaster', 'SessionKeyManager'];
  const deployedAddresses = {};

  for (const name of contracts) {
    console.log(`\n📦 Deploying ${name}...`);

    const sierraPath = path.join(CONTRACTS_DIR, 'target', 'dev', `vauban_blog_${name}.contract_class.json`);
    const casmPath = path.join(CONTRACTS_DIR, 'target', 'dev', `vauban_blog_${name}.compiled_contract_class.json`);

    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = JSON.parse(fs.readFileSync(casmPath, 'utf8'));

    const classHash = hash.computeContractClassHash(sierra);
    const compiledClassHash = hash.computeCompiledClassHash(casm);

    console.log(`   Class hash: ${classHash}`);

    // Try to declare
    try {
      console.log('   Declaring...');
      const declareResult = await account.declare(
        { contract: sierra, casm: casm },
        {
          skipValidate: true,
          maxFee: 0n,  // Free on devnet
        }
      );
      console.log(`   Declare TX: ${declareResult.transaction_hash}`);
      await provider.waitForTransaction(declareResult.transaction_hash);
      console.log('   ✅ Declared');
    } catch (e) {
      if (e.message?.includes('already declared') || e.message?.includes('StarknetErrorCode.CLASS_ALREADY_DECLARED')) {
        console.log('   Already declared, continuing...');
      } else {
        console.log(`   Declare error: ${e.message}`);
        // Try to continue anyway
      }
    }

    // Deploy
    try {
      console.log('   Deploying...');

      let constructorArgs;
      if (name === 'BlogRegistry') {
        constructorArgs = [DEPLOYER_ADDRESS, DEPLOYER_ADDRESS, { low: 250, high: 0 }];
      } else if (name === 'Paymaster') {
        constructorArgs = [DEPLOYER_ADDRESS, DEPLOYER_ADDRESS, { low: '100000000000000000000', high: 0 }, { low: '1000000000000000000', high: 0 }];
      } else {
        constructorArgs = [DEPLOYER_ADDRESS];
      }

      const constructorCalldata = CallData.compile(constructorArgs);
      const salt = stark.randomAddress();

      const deployResult = await account.deployContract(
        { classHash, constructorCalldata, salt },
        { skipValidate: true, maxFee: 0n }
      );

      console.log(`   Deploy TX: ${deployResult.transaction_hash}`);
      await provider.waitForTransaction(deployResult.transaction_hash);

      deployedAddresses[name] = deployResult.contract_address;
      console.log(`   ✅ ${name}: ${deployResult.contract_address}`);
    } catch (e) {
      console.log(`   Deploy error: ${e.message}`);
      throw e;
    }
  }

  // Save deployment info
  const deploymentInfo = {
    network: RPC_URL,
    deployed_at: new Date().toISOString(),
    deployer: DEPLOYER_ADDRESS,
    contracts: deployedAddresses,
  };

  fs.writeFileSync(
    path.join(PROJECT_ROOT, '.deployments.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Update frontend .env.local
  const frontendEnv = `# Auto-generated
NEXT_PUBLIC_MADARA_RPC=${RPC_URL}
NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=${deployedAddresses.BlogRegistry}
NEXT_PUBLIC_SOCIAL_ADDRESS=${deployedAddresses.Social}
NEXT_PUBLIC_PAYMASTER_ADDRESS=${deployedAddresses.Paymaster}
NEXT_PUBLIC_SESSION_KEY_MANAGER_ADDRESS=${deployedAddresses.SessionKeyManager}
NEXT_PUBLIC_CHAIN_ID=MADARA_DEVNET
`;
  fs.writeFileSync(path.join(PROJECT_ROOT, 'apps', 'frontend', '.env.local'), frontendEnv);

  console.log('\n✅ Deployment complete!');
  console.log(JSON.stringify(deployedAddresses, null, 2));
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});
