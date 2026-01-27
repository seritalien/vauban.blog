#!/usr/bin/env node
/**
 * Redeploy BlogRegistry with updated code (publish_post_extended etc.)
 */
import { Account, RpcProvider, json } from 'starknet';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');

const RPC_URL = process.env.RPC_URL || 'http://localhost:9944';
const DEPLOYER_ADDR = '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';
const DEPLOYER_KEY = '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';

async function deployContract(account, provider, name, constructorCalldata) {
  const contractPath = join(__dirname, '..', 'target', 'dev', `vauban_blog_${name}.contract_class.json`);
  const compiledPath = join(__dirname, '..', 'target', 'dev', `vauban_blog_${name}.compiled_contract_class.json`);
  const contractClass = json.parse(readFileSync(contractPath, 'utf8'));
  const compiledClass = json.parse(readFileSync(compiledPath, 'utf8'));

  console.log(`\n📄 Declaring ${name}...`);
  let classHash;
  try {
    const declareResponse = await account.declare({
      contract: contractClass,
      casm: compiledClass,
    });
    classHash = declareResponse.class_hash;
    console.log(`   Declared: ${classHash}`);
    if (declareResponse.transaction_hash) {
      await provider.waitForTransaction(declareResponse.transaction_hash);
    }
  } catch (err) {
    if (err.message?.includes('already declared') || err.message?.includes('CLASS_ALREADY_DECLARED')) {
      // Compute from Sierra
      const { hash } = await import('starknet');
      classHash = hash.computeSierraContractClassHash(contractClass);
      console.log(`   Already declared: ${classHash}`);
    } else {
      throw err;
    }
  }

  console.log(`🏗️  Deploying ${name}...`);
  const deployResponse = await account.deployContract({
    classHash,
    constructorCalldata,
  });
  await provider.waitForTransaction(deployResponse.transaction_hash);
  console.log(`✅ ${name}: ${deployResponse.contract_address}`);

  return { classHash, address: deployResponse.contract_address };
}

async function main() {
  console.log('🚀 Redeploying updated BlogRegistry + Social...');

  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const account = new Account(provider, DEPLOYER_ADDR, DEPLOYER_KEY);

  // BlogRegistry constructor: owner, treasury_address, max_title_length, publish_cooldown_seconds
  const blogRegistry = await deployContract(account, provider, 'BlogRegistry', [
    DEPLOYER_ADDR, DEPLOYER_ADDR, 250, 0, // 0 cooldown for dev
  ]);

  // Social constructor: owner
  const social = await deployContract(account, provider, 'Social', [DEPLOYER_ADDR]);

  // Update .deployments.json
  const deploymentsPath = join(PROJECT_ROOT, '.deployments.json');
  const deployments = JSON.parse(readFileSync(deploymentsPath, 'utf8'));
  deployments.contracts.BlogRegistry = blogRegistry;
  deployments.contracts.Social = social;
  writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\n💾 Updated .deployments.json`);

  // Update .env.local
  const envPath = join(PROJECT_ROOT, 'apps', 'frontend', '.env.local');
  let envContent = readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=.*/,
    `NEXT_PUBLIC_BLOG_REGISTRY_ADDRESS=${blogRegistry.address}`
  );
  envContent = envContent.replace(
    /NEXT_PUBLIC_SOCIAL_ADDRESS=.*/,
    `NEXT_PUBLIC_SOCIAL_ADDRESS=${social.address}`
  );
  writeFileSync(envPath, envContent);
  console.log(`📝 Updated .env.local`);

  console.log('\n=========================================');
  console.log(`✅ BlogRegistry: ${blogRegistry.address}`);
  console.log(`✅ Social: ${social.address}`);
  console.log('=========================================');
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
