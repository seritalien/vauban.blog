import { vi } from 'vitest';

// =============================================================================
// FILE 2: Crypto Tests (Web Crypto API - ECDH + AES-GCM)
// =============================================================================

// Mock IndexedDB for storeKeyPair / getStoredKeyPair / hasStoredKeys
// Since fake-indexeddb is not available, we mock indexedDB globally.

function createMockIDB() {
  const store = new Map<string, unknown>();

  const mockObjectStore = {
    put: vi.fn((data: { id: string }) => {
      store.set(data.id, data);
      const request = { result: undefined, error: null } as any;
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
    get: vi.fn((key: string) => {
      const result = store.get(key);
      const request = { result, error: null } as any;
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
      const request = { result: undefined, error: null } as any;
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    }),
  };

  const mockTransaction = {
    objectStore: vi.fn(() => mockObjectStore),
  };

  const mockDB = {
    transaction: vi.fn(() => mockTransaction),
    objectStoreNames: { contains: vi.fn(() => true) },
    createObjectStore: vi.fn(),
  };

  const mockOpen = vi.fn(() => {
    const request = { result: mockDB, error: null } as any;
    setTimeout(() => {
      request.onupgradeneeded?.({ target: request });
      request.onsuccess?.();
    }, 0);
    return request;
  });

  return {
    open: mockOpen,
    store,
    clear: () => store.clear(),
  };
}

const mockIDB = createMockIDB();
vi.stubGlobal('indexedDB', { open: mockIDB.open });

import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  exportPrivateKey,
  importPrivateKey,
  encryptMessage,
  decryptMessage,
  getKeyFingerprint,
  storeKeyPair,
  getStoredKeyPair,
  hasStoredKeys,
} from '../crypto';

beforeEach(() => {
  mockIDB.clear();
});

// =============================================================================
// Key Generation
// =============================================================================

describe('generateKeyPair', () => {
  it('returns an object with publicKey and privateKey CryptoKey instances', async () => {
    const keyPair = await generateKeyPair();

    expect(keyPair).toBeDefined();
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    // CryptoKey objects have a type property
    expect(keyPair.publicKey.type).toBe('public');
    expect(keyPair.privateKey.type).toBe('private');
  });
});

// =============================================================================
// Public Key Export/Import Roundtrip
// =============================================================================

describe('exportPublicKey + importPublicKey', () => {
  it('roundtrip produces a valid key (export then import)', async () => {
    const keyPair = await generateKeyPair();
    const exported = await exportPublicKey(keyPair.publicKey);

    expect(exported.x).toBeDefined();
    expect(exported.y).toBeDefined();
    expect(typeof exported.x).toBe('string');
    expect(typeof exported.y).toBe('string');

    const reimported = await importPublicKey(exported);
    expect(reimported.type).toBe('public');
    expect(reimported.algorithm).toMatchObject({ name: 'ECDH' });
  });
});

// =============================================================================
// Encrypt + Decrypt
// =============================================================================

describe('encryptMessage + decryptMessage', () => {
  it('encrypt with Alice keys to Bob, Bob decrypts successfully', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();

    const plaintext = 'Hello Bob, this is a secret message!';

    const encrypted = await encryptMessage(
      plaintext,
      alice.privateKey,
      alice.publicKey,
      bob.publicKey
    );

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.senderPublicKey).toBeDefined();
    // Ciphertext should not be the plaintext
    expect(encrypted.ciphertext).not.toBe(plaintext);

    const decrypted = await decryptMessage(encrypted, bob.privateKey);
    expect(decrypted).toBe(plaintext);
  });
});

// =============================================================================
// Wrong Key Rejection
// =============================================================================

describe('Wrong key rejection', () => {
  it('message encrypted for Bob cannot be decrypted with a different key pair', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const charlie = await generateKeyPair();

    const plaintext = 'Secret for Bob only';

    const encrypted = await encryptMessage(
      plaintext,
      alice.privateKey,
      alice.publicKey,
      bob.publicKey
    );

    // Charlie should NOT be able to decrypt
    await expect(decryptMessage(encrypted, charlie.privateKey)).rejects.toThrow();
  });
});

// =============================================================================
// Key Fingerprint
// =============================================================================

describe('getKeyFingerprint', () => {
  it('returns consistent hex string format (XX:XX:XX:XX:XX:XX:XX:XX)', async () => {
    const keyPair = await generateKeyPair();
    const fingerprint = await getKeyFingerprint(keyPair.publicKey);

    // Format: 8 pairs of hex digits separated by colons, uppercase
    const parts = fingerprint.split(':');
    expect(parts).toHaveLength(8);
    for (const part of parts) {
      expect(part).toMatch(/^[0-9A-F]{2}$/);
    }
  });

  it('returns the same fingerprint for the same key', async () => {
    const keyPair = await generateKeyPair();
    const fp1 = await getKeyFingerprint(keyPair.publicKey);
    const fp2 = await getKeyFingerprint(keyPair.publicKey);

    expect(fp1).toBe(fp2);
  });
});

// =============================================================================
// Private Key Export/Import Roundtrip
// =============================================================================

describe('exportPrivateKey + importPrivateKey', () => {
  it('roundtrip works - export and reimport produces usable key', async () => {
    const original = await generateKeyPair();
    const jwk = await exportPrivateKey(original.privateKey);

    expect(jwk.kty).toBe('EC');
    expect(jwk.crv).toBe('P-256');
    expect(jwk.d).toBeDefined(); // private component

    const reimported = await importPrivateKey(jwk);
    expect(reimported.type).toBe('private');

    // Verify reimported key can be used for encryption/decryption
    const bob = await generateKeyPair();
    const encrypted = await encryptMessage(
      'Test message',
      reimported,
      original.publicKey,
      bob.publicKey
    );
    const decrypted = await decryptMessage(encrypted, bob.privateKey);
    expect(decrypted).toBe('Test message');
  });
});

// =============================================================================
// IndexedDB Storage (storeKeyPair / getStoredKeyPair / hasStoredKeys)
// =============================================================================

describe('storeKeyPair + getStoredKeyPair', () => {
  it('roundtrip: store then retrieve key pair', async () => {
    const keyPair = await generateKeyPair();
    const userAddress = '0xAlice123';

    await storeKeyPair(userAddress, keyPair);
    const retrieved = await getStoredKeyPair(userAddress);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.publicKey.type).toBe('public');
    expect(retrieved!.privateKey.type).toBe('private');
  });
});

describe('hasStoredKeys', () => {
  it('returns true after storing keys', async () => {
    const keyPair = await generateKeyPair();
    await storeKeyPair('0xUser1', keyPair);

    const result = await hasStoredKeys('0xUser1');
    expect(result).toBe(true);
  });

  it('returns false when no keys stored for address', async () => {
    const result = await hasStoredKeys('0xNonExistent');
    expect(result).toBe(false);
  });
});
