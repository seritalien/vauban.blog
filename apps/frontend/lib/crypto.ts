/**
 * End-to-End Encryption Utilities
 *
 * Uses Web Crypto API for secure messaging:
 * - ECDH for key exchange (P-256 curve)
 * - AES-GCM for message encryption
 * - Keys stored in IndexedDB locally
 */

// =============================================================================
// TYPES
// =============================================================================

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface ExportedPublicKey {
  x: string; // Base64
  y: string; // Base64
}

export interface EncryptedMessage {
  ciphertext: string; // Base64
  iv: string; // Base64
  senderPublicKey: ExportedPublicKey;
}

// =============================================================================
// KEY GENERATION & MANAGEMENT
// =============================================================================

/**
 * Generate a new ECDH key pair for the user
 */
export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true, // extractable
    ['deriveBits', 'deriveKey']
  );

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
  };
}

/**
 * Export public key to shareable format
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<ExportedPublicKey> {
  const exported = await crypto.subtle.exportKey('jwk', publicKey);

  if (!exported.x || !exported.y) {
    throw new Error('Invalid public key format');
  }

  return {
    x: exported.x,
    y: exported.y,
  };
}

/**
 * Import public key from exported format
 */
export async function importPublicKey(exported: ExportedPublicKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: exported.x,
      y: exported.y,
    },
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
}

/**
 * Export private key for storage (encrypted with user password)
 */
export async function exportPrivateKey(privateKey: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', privateKey);
}

/**
 * Import private key from storage
 */
export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveBits', 'deriveKey']
  );
}

// =============================================================================
// KEY DERIVATION
// =============================================================================

/**
 * Derive a shared AES key from ECDH key exchange
 */
async function deriveSharedKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: publicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// =============================================================================
// ENCRYPTION & DECRYPTION
// =============================================================================

/**
 * Encrypt a message for a recipient
 */
export async function encryptMessage(
  plaintext: string,
  senderPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<EncryptedMessage> {
  // Derive shared key
  const sharedKey = await deriveSharedKey(senderPrivateKey, recipientPublicKey);

  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt the message
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    sharedKey,
    data
  );

  // Export sender's public key
  const exportedPublicKey = await exportPublicKey(senderPublicKey);

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer),
    senderPublicKey: exportedPublicKey,
  };
}

/**
 * Decrypt a message from a sender
 */
export async function decryptMessage(
  encrypted: EncryptedMessage,
  recipientPrivateKey: CryptoKey
): Promise<string> {
  // Import sender's public key
  const senderPublicKey = await importPublicKey(encrypted.senderPublicKey);

  // Derive shared key
  const sharedKey = await deriveSharedKey(recipientPrivateKey, senderPublicKey);

  // Decrypt the message
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = base64ToArrayBuffer(encrypted.iv);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv),
    },
    sharedKey,
    new Uint8Array(ciphertext)
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Return a clean ArrayBuffer slice — bytes.buffer may be a shared backing
  // buffer larger than the view, which some SubtleCrypto implementations reject.
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

/**
 * Generate a fingerprint for a public key (for verification)
 */
export async function getKeyFingerprint(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', publicKey);
  const hash = await crypto.subtle.digest('SHA-256', exported);
  const bytes = new Uint8Array(hash);

  // Return first 8 bytes as hex, grouped in pairs
  return Array.from(bytes.slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

// =============================================================================
// LOCAL KEY STORAGE (IndexedDB)
// =============================================================================

const DB_NAME = 'vauban-crypto';
const DB_VERSION = 1;
const KEYS_STORE = 'keys';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Store user's key pair locally
 */
export async function storeKeyPair(
  userAddress: string,
  keyPair: KeyPair
): Promise<void> {
  const db = await openDB();
  const privateKeyJwk = await exportPrivateKey(keyPair.privateKey);
  const publicKeyExported = await exportPublicKey(keyPair.publicKey);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([KEYS_STORE], 'readwrite');
    const store = transaction.objectStore(KEYS_STORE);

    const request = store.put({
      id: userAddress,
      privateKey: privateKeyJwk,
      publicKey: publicKeyExported,
      createdAt: Date.now(),
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Retrieve user's key pair from local storage
 */
export async function getStoredKeyPair(userAddress: string): Promise<KeyPair | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([KEYS_STORE], 'readonly');
    const store = transaction.objectStore(KEYS_STORE);
    const request = store.get(userAddress);

    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      const result = request.result;
      if (!result) {
        resolve(null);
        return;
      }

      try {
        const privateKey = await importPrivateKey(result.privateKey);
        const publicKey = await importPublicKey(result.publicKey);
        resolve({ privateKey, publicKey });
      } catch (error) {
        console.error('Error importing stored keys:', error);
        resolve(null);
      }
    };
  });
}

/**
 * Check if user has stored keys
 */
export async function hasStoredKeys(userAddress: string): Promise<boolean> {
  const keyPair = await getStoredKeyPair(userAddress);
  return keyPair !== null;
}

/**
 * Delete stored keys (for key rotation or logout)
 */
export async function deleteStoredKeys(userAddress: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([KEYS_STORE], 'readwrite');
    const store = transaction.objectStore(KEYS_STORE);
    const request = store.delete(userAddress);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
