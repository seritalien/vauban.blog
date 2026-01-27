/**
 * IPFS Client - Browser-safe wrapper using API proxy
 *
 * This module provides IPFS upload functionality that works in the browser
 * by routing requests through the Next.js API proxy (/api/ipfs/add) instead
 * of connecting directly to the IPFS daemon (which fails due to CORS).
 */

// =============================================================================
// TYPES
// =============================================================================

export interface IPFSUploadResult {
  cid: string;
  size?: number;
  name?: string;
}

export interface IPFSFetchResult<T> {
  data: T;
  cid: string;
}

// =============================================================================
// UPLOAD FUNCTIONS (via API proxy)
// =============================================================================

/**
 * Upload JSON data to IPFS via API proxy
 *
 * @param data - Any JSON-serializable data
 * @returns CID of the uploaded content
 *
 * @example
 * ```ts
 * const cid = await uploadJSONToIPFSViaAPI({ content: 'Hello!', author: '0x...' });
 * console.log('Uploaded:', cid);
 * ```
 */
export async function uploadJSONToIPFSViaAPI<T>(data: T): Promise<string> {
  const response = await fetch('/api/ipfs/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`IPFS upload failed: ${errorData.error || response.statusText}`);
  }

  const result: IPFSUploadResult = await response.json();

  if (!result.cid) {
    throw new Error('IPFS upload failed: No CID returned');
  }

  return result.cid;
}

/**
 * Upload a file to IPFS via API proxy
 *
 * @param file - File or Blob to upload
 * @returns CID of the uploaded content
 */
export async function uploadFileToIPFSViaAPI(file: File | Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/ipfs/add', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`IPFS file upload failed: ${errorData.error || response.statusText}`);
  }

  const result: IPFSUploadResult = await response.json();

  if (!result.cid) {
    throw new Error('IPFS upload failed: No CID returned');
  }

  return result.cid;
}

/**
 * Upload text content to IPFS via API proxy
 *
 * @param text - Plain text content
 * @returns CID of the uploaded content
 */
export async function uploadTextToIPFSViaAPI(text: string): Promise<string> {
  const response = await fetch('/api/ipfs/add', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: text,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`IPFS text upload failed: ${errorData.error || response.statusText}`);
  }

  const result: IPFSUploadResult = await response.json();

  if (!result.cid) {
    throw new Error('IPFS upload failed: No CID returned');
  }

  return result.cid;
}

// =============================================================================
// FETCH FUNCTIONS (via API proxy for consistent behavior)
// =============================================================================

/**
 * Fetch JSON content from IPFS via API proxy
 *
 * @param cid - IPFS content identifier
 * @returns Parsed JSON data
 */
export async function fetchJSONFromIPFSViaAPI<T>(cid: string): Promise<T> {
  const response = await fetch(`/api/ipfs/${cid}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch text content from IPFS via API proxy
 *
 * @param cid - IPFS content identifier
 * @returns Text content
 */
export async function fetchTextFromIPFSViaAPI(cid: string): Promise<string> {
  const response = await fetch(`/api/ipfs/${cid}`);

  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.statusText}`);
  }

  return response.text();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the gateway URL for an IPFS CID
 *
 * @param cid - IPFS content identifier
 * @returns Full gateway URL
 */
export function getIPFSGatewayUrl(cid: string): string {
  // Use the API proxy for consistent behavior
  return `/api/ipfs/${cid}`;
}

/**
 * Check if the IPFS API proxy is available
 *
 * @returns true if IPFS is reachable
 */
export async function checkIPFSAvailable(): Promise<boolean> {
  try {
    // Try to upload and immediately succeed - the API route handles errors
    const testData = { test: true, timestamp: Date.now() };
    const response = await fetch('/api/ipfs/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });
    return response.ok;
  } catch {
    return false;
  }
}
