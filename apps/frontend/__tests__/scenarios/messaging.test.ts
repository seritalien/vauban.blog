import { vi } from 'vitest';

// =============================================================================
// FILE 6: Messaging Scenario Tests
// =============================================================================

// These tests exercise the crypto and IPFS modules directly
// (not the React hook, which requires full rendering context).

import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  encryptMessage,
  decryptMessage,
  getKeyFingerprint,
} from '@/lib/crypto';

// Mock IPFS client
vi.mock('@/lib/ipfs-client', () => ({
  uploadJSONToIPFSViaAPI: vi.fn().mockResolvedValue('QmMockMsgCid1'),
}));

import { uploadJSONToIPFSViaAPI } from '@/lib/ipfs-client';

// =============================================================================
// Tests
// =============================================================================

describe('Messaging Scenarios', () => {
  it('key initialization and export roundtrip', async () => {
    // Alice generates keys
    const aliceKeys = await generateKeyPair();
    expect(aliceKeys.publicKey).toBeDefined();
    expect(aliceKeys.privateKey).toBeDefined();

    // Export public key
    const exported = await exportPublicKey(aliceKeys.publicKey);
    expect(exported.x).toBeDefined();
    expect(exported.y).toBeDefined();

    // Import back
    const reimported = await importPublicKey(exported);
    expect(reimported.type).toBe('public');

    // Fingerprint should be consistent
    const fp1 = await getKeyFingerprint(aliceKeys.publicKey);
    const fp2 = await getKeyFingerprint(reimported);
    expect(fp1).toBe(fp2);
  });

  it('start new conversation (simulated state)', async () => {
    const aliceAddress = '0xAlice';
    const bobAddress = '0xBob';

    // Both users generate keys
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();

    const bobPublicExported = await exportPublicKey(bobKeys.publicKey);

    // Simulate conversation creation
    const conversation = {
      id: `${aliceAddress}-${bobAddress}`,
      participant: bobAddress,
      participantPublicKey: bobPublicExported,
      unreadCount: 0,
      updatedAt: Date.now(),
    };

    expect(conversation.id).toBe('0xAlice-0xBob');
    expect(conversation.participant).toBe(bobAddress);
    expect(conversation.participantPublicKey).toEqual(bobPublicExported);
  });

  it('send encrypted message via IPFS', async () => {
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();

    const plaintext = 'Hello Bob, this is a private message!';

    // Encrypt
    const encrypted = await encryptMessage(
      plaintext,
      aliceKeys.privateKey,
      aliceKeys.publicKey,
      bobKeys.publicKey
    );

    // Upload to IPFS
    const messageData = {
      encrypted,
      from: '0xAlice',
      to: '0xBob',
      timestamp: Date.now(),
    };

    const cid = await uploadJSONToIPFSViaAPI(messageData);
    expect(cid).toBe('QmMockMsgCid1');

    // Verify uploadJSONToIPFSViaAPI was called with encrypted message
    expect(uploadJSONToIPFSViaAPI).toHaveBeenCalledWith(
      expect.objectContaining({
        encrypted: expect.objectContaining({
          ciphertext: expect.any(String),
          iv: expect.any(String),
          senderPublicKey: expect.objectContaining({
            x: expect.any(String),
            y: expect.any(String),
          }),
        }),
        from: '0xAlice',
        to: '0xBob',
      })
    );

    // Bob decrypts
    const decrypted = await decryptMessage(encrypted, bobKeys.privateKey);
    expect(decrypted).toBe(plaintext);
  });

  it('wrong key cannot decrypt message', async () => {
    const aliceKeys = await generateKeyPair();
    const bobKeys = await generateKeyPair();
    const charlieKeys = await generateKeyPair();

    const plaintext = 'Secret message for Bob only';

    const encrypted = await encryptMessage(
      plaintext,
      aliceKeys.privateKey,
      aliceKeys.publicKey,
      bobKeys.publicKey
    );

    // Charlie attempts to decrypt -- should fail
    await expect(decryptMessage(encrypted, charlieKeys.privateKey)).rejects.toThrow();

    // Bob can decrypt
    const decrypted = await decryptMessage(encrypted, bobKeys.privateKey);
    expect(decrypted).toBe(plaintext);
  });
});
