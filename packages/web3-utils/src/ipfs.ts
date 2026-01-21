// Dynamic import to avoid SSR issues with Next.js
let create: any;

// Check if we're in browser environment
// @ts-ignore - window check for browser environment
const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  // Only import IPFS in browser
  import('ipfs-http-client').then((module) => {
    create = module.create;
  });
}

// ============================================================================
// IPFS CLIENT CONFIGURATION
// ============================================================================

let ipfsClient: any = null;

export interface IPFSConfig {
  url?: string;
  host?: string;
  port?: number;
  protocol?: 'http' | 'https';
  apiPath?: string;
}

/**
 * Initialize IPFS client
 */
export async function initIPFS(config: IPFSConfig = {}): Promise<any> {
  // Ensure IPFS is loaded
  if (!create) {
    if (isBrowser) {
      const module = await import('ipfs-http-client');
      create = module.create;
    } else {
      throw new Error('IPFS can only be used in browser environment');
    }
  }
  const {
    url = process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001',
    host,
    port,
    protocol,
    apiPath = '/api/v0',
  } = config;

  if (url) {
    ipfsClient = create({ url });
  } else {
    ipfsClient = create({
      host: host || 'localhost',
      port: port || 5001,
      protocol: protocol || 'http',
      apiPath,
    });
  }

  return ipfsClient;
}

/**
 * Get IPFS client (initialize if not already done)
 */
export async function getIPFSClient(): Promise<any> {
  if (!ipfsClient) {
    return await initIPFS();
  }
  return ipfsClient;
}

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Upload JSON data to IPFS
 */
export async function uploadJSONToIPFS(data: any): Promise<string> {
  const client = await getIPFSClient();

  try {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });

    const { cid } = await client.add(blob);
    const cidString = cid.toString();

    console.log(`Uploaded to IPFS: ${cidString}`);
    return cidString;
  } catch (error) {
    console.error('Error uploading to IPFS:', error);
    throw new Error(`Failed to upload to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload file to IPFS
 */
export async function uploadFileToIPFS(file: File | Blob): Promise<string> {
  const client = await getIPFSClient();

  try {
    const { cid } = await client.add(file);
    const cidString = cid.toString();

    console.log(`Uploaded file to IPFS: ${cidString}`);
    return cidString;
  } catch (error) {
    console.error('Error uploading file to IPFS:', error);
    throw new Error(`Failed to upload file to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload buffer to IPFS
 */
export async function uploadBufferToIPFS(buffer: Buffer | Uint8Array): Promise<string> {
  const client = await getIPFSClient();

  try {
    const { cid } = await client.add(buffer);
    const cidString = cid.toString();

    console.log(`Uploaded buffer to IPFS: ${cidString}`);
    return cidString;
  } catch (error) {
    console.error('Error uploading buffer to IPFS:', error);
    throw new Error(`Failed to upload buffer to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch content from IPFS as JSON
 */
export async function fetchJSONFromIPFS<T = any>(cid: string): Promise<T> {
  const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'http://localhost:8005';
  const url = `${gatewayUrl}/ipfs/${cid}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 seconds
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    console.error(`Error fetching from IPFS (${cid}):`, error);
    throw new Error(`Failed to fetch from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch content from IPFS as text
 */
export async function fetchTextFromIPFS(cid: string): Promise<string> {
  const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'http://localhost:8005';
  const url = `${gatewayUrl}/ipfs/${cid}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    return text;
  } catch (error) {
    console.error(`Error fetching text from IPFS (${cid}):`, error);
    throw new Error(`Failed to fetch text from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch content from IPFS as blob
 */
export async function fetchBlobFromIPFS(cid: string): Promise<Blob> {
  const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'http://localhost:8005';
  const url = `${gatewayUrl}/ipfs/${cid}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    return blob;
  } catch (error) {
    console.error(`Error fetching blob from IPFS (${cid}):`, error);
    throw new Error(`Failed to fetch blob from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// PIN MANAGEMENT
// ============================================================================

/**
 * Pin content to IPFS (keep it cached)
 */
export async function pinToIPFS(cid: string): Promise<void> {
  const client = await getIPFSClient();

  try {
    await client.pin.add(cid);
    console.log(`Pinned to IPFS: ${cid}`);
  } catch (error) {
    console.error(`Error pinning to IPFS (${cid}):`, error);
    throw new Error(`Failed to pin to IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Unpin content from IPFS
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  const client = await getIPFSClient();

  try {
    await client.pin.rm(cid);
    console.log(`Unpinned from IPFS: ${cid}`);
  } catch (error) {
    console.error(`Error unpinning from IPFS (${cid}):`, error);
    throw new Error(`Failed to unpin from IPFS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * List all pinned content
 */
export async function listPinnedContent(): Promise<string[]> {
  const client = await getIPFSClient();

  try {
    const pins: string[] = [];
    for await (const { cid } of client.pin.ls()) {
      pins.push(cid.toString());
    }
    return pins;
  } catch (error) {
    console.error('Error listing pinned content:', error);
    throw new Error(`Failed to list pins: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get IPFS gateway URL for a CID
 */
export function getIPFSGatewayUrl(cid: string): string {
  const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'http://localhost:8005';
  return `${gatewayUrl}/ipfs/${cid}`;
}

/**
 * Check if IPFS node is reachable
 */
export async function checkIPFSConnection(): Promise<boolean> {
  try {
    const client = await getIPFSClient();
    await client.id();
    return true;
  } catch (error) {
    console.error('IPFS connection failed:', error);
    return false;
  }
}

/**
 * Get IPFS node info
 */
export async function getIPFSNodeInfo(): Promise<any> {
  const client = await getIPFSClient();
  try {
    return await client.id();
  } catch (error) {
    console.error('Error getting IPFS node info:', error);
    throw new Error(`Failed to get node info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
