import ArweaveModule from 'arweave';

// Handle both default and named exports (CommonJS vs ESM)
const Arweave = (ArweaveModule as any).default || ArweaveModule;

// ============================================================================
// ARWEAVE CLIENT CONFIGURATION
// ============================================================================

let arweaveClient: InstanceType<typeof Arweave> | null = null;

export interface ArweaveConfig {
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
  timeout?: number;
  logging?: boolean;
}

/**
 * Initialize Arweave client
 */
export function initArweave(config: ArweaveConfig = {}): InstanceType<typeof Arweave> {
  const {
    host = 'arweave.net',
    port = 443,
    protocol = 'https',
    timeout = 60000,
    logging = false,
  } = config;

  arweaveClient = Arweave.init({
    host,
    port,
    protocol,
    timeout,
    logging,
  });

  return arweaveClient;
}

/**
 * Get Arweave client (initialize if not already done)
 */
export function getArweaveClient(): InstanceType<typeof Arweave> {
  if (!arweaveClient) {
    return initArweave();
  }
  return arweaveClient;
}

// ============================================================================
// WALLET MANAGEMENT
// ============================================================================

/**
 * Load Arweave wallet from JSON
 */
export async function loadArweaveWallet(walletJson: string | object): Promise<any> {
  const wallet = typeof walletJson === 'string' ? JSON.parse(walletJson) : walletJson;
  return wallet;
}

/**
 * Get wallet address
 */
export async function getWalletAddress(wallet: any): Promise<string> {
  const arweave = getArweaveClient();
  return await arweave.wallets.jwkToAddress(wallet);
}

/**
 * Get wallet balance (in AR)
 */
export async function getWalletBalance(address: string): Promise<string> {
  const arweave = getArweaveClient();
  const winston = await arweave.wallets.getBalance(address);
  const ar = arweave.ar.winstonToAr(winston);
  return ar;
}

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload JSON data to Arweave
 */
export async function uploadJSONToArweave(data: any, wallet: any, tags: Record<string, string> = {}): Promise<string> {
  const arweave = getArweaveClient();

  try {
    const json = JSON.stringify(data);
    const transaction = await arweave.createTransaction({ data: json }, wallet);

    // Add standard tags
    transaction.addTag('Content-Type', 'application/json');
    transaction.addTag('App-Name', 'Vauban-Blog');
    transaction.addTag('App-Version', '0.1.0');

    // Add custom tags
    for (const [key, value] of Object.entries(tags)) {
      transaction.addTag(key, value);
    }

    // Sign and post transaction
    await arweave.transactions.sign(transaction, wallet);
    const response = await arweave.transactions.post(transaction);

    if (response.status !== 200) {
      throw new Error(`Arweave upload failed: ${response.status} ${response.statusText}`);
    }

    const txId = transaction.id;
    console.log(`Uploaded to Arweave: ${txId}`);

    return txId;
  } catch (error) {
    console.error('Error uploading to Arweave:', error);
    throw new Error(`Failed to upload to Arweave: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload file to Arweave
 */
export async function uploadFileToArweave(
  file: File | Blob,
  wallet: any,
  contentType?: string,
  tags: Record<string, string> = {}
): Promise<string> {
  const arweave = getArweaveClient();

  try {
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    const transaction = await arweave.createTransaction({ data }, wallet);

    // Add content type tag
    const type = contentType || (file instanceof File ? file.type : 'application/octet-stream');
    transaction.addTag('Content-Type', type);
    transaction.addTag('App-Name', 'Vauban-Blog');

    // Add custom tags
    for (const [key, value] of Object.entries(tags)) {
      transaction.addTag(key, value);
    }

    // Sign and post
    await arweave.transactions.sign(transaction, wallet);
    const response = await arweave.transactions.post(transaction);

    if (response.status !== 200) {
      throw new Error(`Arweave upload failed: ${response.status}`);
    }

    const txId = transaction.id;
    console.log(`Uploaded file to Arweave: ${txId}`);

    return txId;
  } catch (error) {
    console.error('Error uploading file to Arweave:', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload buffer to Arweave
 */
export async function uploadBufferToArweave(
  buffer: Buffer | Uint8Array,
  wallet: any,
  contentType: string = 'application/octet-stream',
  tags: Record<string, string> = {}
): Promise<string> {
  const arweave = getArweaveClient();

  try {
    const transaction = await arweave.createTransaction({ data: buffer }, wallet);

    transaction.addTag('Content-Type', contentType);
    transaction.addTag('App-Name', 'Vauban-Blog');

    for (const [key, value] of Object.entries(tags)) {
      transaction.addTag(key, value);
    }

    await arweave.transactions.sign(transaction, wallet);
    const response = await arweave.transactions.post(transaction);

    if (response.status !== 200) {
      throw new Error(`Arweave upload failed: ${response.status}`);
    }

    return transaction.id;
  } catch (error) {
    console.error('Error uploading buffer to Arweave:', error);
    throw new Error(`Failed to upload buffer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch content from Arweave as JSON
 */
export async function fetchJSONFromArweave<T = any>(txId: string): Promise<T> {
  const url = `https://arweave.net/${txId}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(60000), // 60 seconds for Arweave
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`Error fetching from Arweave (${txId}):`, error);
    throw new Error(`Failed to fetch from Arweave: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch content from Arweave as text
 */
export async function fetchTextFromArweave(txId: string): Promise<string> {
  const url = `https://arweave.net/${txId}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Error fetching text from Arweave (${txId}):`, error);
    throw new Error(`Failed to fetch text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch content from Arweave as blob
 */
export async function fetchBlobFromArweave(txId: string): Promise<Blob> {
  const url = `https://arweave.net/${txId}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error(`Error fetching blob from Arweave (${txId}):`, error);
    throw new Error(`Failed to fetch blob: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// TRANSACTION INFO
// ============================================================================

/**
 * Get transaction status
 */
export async function getTransactionStatus(txId: string): Promise<any> {
  const arweave = getArweaveClient();

  try {
    const status = await arweave.transactions.getStatus(txId);
    return status;
  } catch (error) {
    console.error(`Error getting transaction status (${txId}):`, error);
    throw new Error(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Wait for transaction confirmation
 */
export async function waitForConfirmation(txId: string, maxAttempts: number = 20): Promise<boolean> {
  const arweave = getArweaveClient();

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await arweave.transactions.getStatus(txId);

      if (status.confirmed && status.confirmed.number_of_confirmations > 0) {
        console.log(`Transaction ${txId} confirmed with ${status.confirmed.number_of_confirmations} confirmations`);
        return true;
      }

      console.log(`Waiting for confirmation... (attempt ${i + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait 15s between checks
    } catch (error) {
      console.warn(`Error checking confirmation (attempt ${i + 1}):`, error);
    }
  }

  console.warn(`Transaction ${txId} not confirmed after ${maxAttempts} attempts`);
  return false;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get Arweave gateway URL for a transaction
 */
export function getArweaveGatewayUrl(txId: string): string {
  return `https://arweave.net/${txId}`;
}

/**
 * Calculate upload cost in AR
 */
export async function calculateUploadCost(dataSize: number): Promise<string> {
  const arweave = getArweaveClient();

  try {
    const winston = await arweave.transactions.getPrice(dataSize);
    const ar = arweave.ar.winstonToAr(winston);
    return ar;
  } catch (error) {
    console.error('Error calculating upload cost:', error);
    throw new Error(`Failed to calculate cost: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if Arweave node is reachable
 */
export async function checkArweaveConnection(): Promise<boolean> {
  try {
    const arweave = getArweaveClient();
    const info = await arweave.network.getInfo();
    return info.height > 0;
  } catch (error) {
    console.error('Arweave connection failed:', error);
    return false;
  }
}

/**
 * Get network info
 */
export async function getNetworkInfo(): Promise<any> {
  const arweave = getArweaveClient();
  try {
    return await arweave.network.getInfo();
  } catch (error) {
    console.error('Error getting network info:', error);
    throw new Error(`Failed to get network info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
