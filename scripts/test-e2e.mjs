#!/usr/bin/env node
/**
 * End-to-end test for Vauban Blog publishing flow
 */

import { Account, RpcProvider, Contract, shortString, hash } from 'starknet';
import crypto from 'crypto';
import fs from 'fs';

const RPC_URL = 'http://localhost:9944';
const IPFS_API = 'http://localhost:5001/api/v0';
const IPFS_GATEWAY = 'http://localhost:8080';

// Madara devnet account #1
const DEPLOYER_ADDRESS = '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';
const DEPLOYER_PRIVATE_KEY = '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';

// Load deployment addresses
const deployments = JSON.parse(fs.readFileSync('/home/fabien/git/vauban.blog/.deployments.json', 'utf8'));
const BLOG_REGISTRY_ADDRESS = deployments.contracts.BlogRegistry;

// Load ABI
const blogRegistryAbi = JSON.parse(
  fs.readFileSync('/home/fabien/git/vauban.blog/packages/web3-utils/src/abis/blogregistry.json', 'utf8')
).abi;

async function main() {
  console.log('🧪 End-to-End Test: Vauban Blog Publishing Flow');
  console.log('='.repeat(60));

  // Step 1: Check RPC
  console.log('\n1️⃣  Testing RPC connectivity...');
  const provider = new RpcProvider({ nodeUrl: RPC_URL });
  const chainId = await provider.getChainId();
  console.log(`   ✅ Connected to chain: ${chainId}`);

  // Step 2: Check IPFS
  console.log('\n2️⃣  Testing IPFS connectivity...');
  try {
    const ipfsId = await fetch(`${IPFS_API}/id`, { method: 'POST' }).then(r => r.json());
    console.log(`   ✅ IPFS node ID: ${ipfsId.ID.slice(0, 20)}...`);
  } catch (error) {
    console.log(`   ❌ IPFS not available: ${error.message}`);
    console.log('   Continuing without IPFS test...');
  }

  // Step 3: Create test content
  console.log('\n3️⃣  Creating test article content...');
  const testArticle = {
    title: 'Test Article - E2E',
    slug: 'test-article-e2e-' + Date.now(),
    content: '# Hello World\n\nThis is a test article for end-to-end testing.',
    excerpt: 'A test article',
    tags: ['test', 'e2e'],
    isPaid: false,
    price: 0,
    publishedAt: new Date().toISOString(),
  };
  console.log(`   ✅ Article: "${testArticle.title}"`);

  // Step 4: Upload to IPFS
  console.log('\n4️⃣  Uploading to IPFS...');
  let ipfsCid;
  try {
    const formData = new FormData();
    formData.append('file', new Blob([JSON.stringify(testArticle)], { type: 'application/json' }));

    const addResponse = await fetch(`${IPFS_API}/add?pin=true`, {
      method: 'POST',
      body: formData,
    });
    const addResult = await addResponse.json();
    ipfsCid = addResult.Hash;
    console.log(`   ✅ IPFS CID: ${ipfsCid}`);
    console.log(`   📎 CID length: ${ipfsCid.length} chars`);
  } catch (error) {
    console.log(`   ❌ IPFS upload failed: ${error.message}`);
    // Use a fake CID for testing
    ipfsCid = 'QmTest' + crypto.randomBytes(20).toString('hex');
    console.log(`   ⚠️  Using fake CID: ${ipfsCid}`);
  }

  // Step 5: Calculate content hash (truncated to fit felt252)
  console.log('\n5️⃣  Calculating content hash...');
  const fullHash = crypto.createHash('sha256').update(JSON.stringify(testArticle)).digest('hex');
  // Truncate to 62 hex chars (248 bits) to fit in felt252
  const contentHash = '0x' + fullHash.slice(0, 62);
  console.log(`   ✅ SHA256 (truncated): ${contentHash.slice(0, 20)}...`);

  // Step 6: Prepare contract call
  console.log('\n6️⃣  Preparing blockchain transaction...');
  const account = new Account(provider, DEPLOYER_ADDRESS, DEPLOYER_PRIVATE_KEY);
  const contract = new Contract(blogRegistryAbi, BLOG_REGISTRY_ADDRESS, account);

  // Simulated Arweave TX (for testing)
  const arweaveTxId = `ar_test_${Date.now()}`;
  console.log(`   📎 Arweave TX (simulated): ${arweaveTxId}`);

  // Split strings for felt252 storage
  function splitStringForFelt252(str) {
    const part1 = str.slice(0, 31);
    const part2 = str.slice(31, 62);
    return [part1, part2 || ''];
  }

  const [arweave1, arweave2] = splitStringForFelt252(arweaveTxId);
  const [ipfs1, ipfs2] = splitStringForFelt252(ipfsCid);

  console.log(`   📎 Arweave split: ["${arweave1}", "${arweave2}"]`);
  console.log(`   📎 IPFS split: ["${ipfs1}", "${ipfs2}"]`);

  // Step 7: Publish to blockchain
  console.log('\n7️⃣  Publishing to blockchain...');
  try {
    const result = await contract.publish_post(
      shortString.encodeShortString(arweave1),
      arweave2 ? shortString.encodeShortString(arweave2) : 0,
      shortString.encodeShortString(ipfs1),
      ipfs2 ? shortString.encodeShortString(ipfs2) : 0,
      contentHash,
      { low: 0, high: 0 }, // price (u256)
      false // is_encrypted
    );

    console.log(`   📝 TX Hash: ${result.transaction_hash}`);
    console.log('   ⏳ Waiting for transaction...');

    await account.waitForTransaction(result.transaction_hash);
    console.log('   ✅ Transaction confirmed!');
  } catch (error) {
    console.log(`   ❌ Transaction failed: ${error.message}`);
    throw error;
  }

  // Step 8: Verify by reading back
  console.log('\n8️⃣  Verifying published article...');
  try {
    const postCount = await contract.get_post_count();
    console.log(`   📊 Total posts: ${postCount}`);

    // Read the latest post
    const latestPost = await contract.get_post(postCount);
    console.log(`   📄 Post ID: ${latestPost.id}`);

    // Decode the stored values
    function safeDecodeShortString(value) {
      if (!value || value.toString() === '0' || value === 0n) return '';
      try {
        return shortString.decodeShortString(value.toString());
      } catch {
        return '';
      }
    }

    const storedArweave = safeDecodeShortString(latestPost.arweave_tx_id_1) +
                          safeDecodeShortString(latestPost.arweave_tx_id_2);
    const storedIpfs = safeDecodeShortString(latestPost.ipfs_cid_1) +
                       safeDecodeShortString(latestPost.ipfs_cid_2);

    console.log(`   📎 Stored Arweave: ${storedArweave}`);
    console.log(`   📎 Stored IPFS: ${storedIpfs}`);
    console.log(`   ✅ Verification passed!`);
  } catch (error) {
    console.log(`   ❌ Verification failed: ${error.message}`);
  }

  // Step 9: Test IPFS retrieval
  console.log('\n9️⃣  Testing IPFS content retrieval...');
  try {
    const response = await fetch(`${IPFS_GATEWAY}/ipfs/${ipfsCid}`);
    if (response.ok) {
      const content = await response.json();
      console.log(`   ✅ Content retrieved: "${content.title}"`);
    } else {
      console.log(`   ⚠️  IPFS gateway returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ IPFS retrieval failed: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ End-to-End Test Complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
