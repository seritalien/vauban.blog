import { NextRequest, NextResponse } from 'next/server';

const IPFS_API = process.env.IPFS_API_URL || process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let fileContent: Blob;

    if (contentType.includes('application/json')) {
      // Handle JSON content (from M2M API)
      const jsonData = await request.text();
      fileContent = new Blob([jsonData], { type: 'application/json' });
    } else if (contentType.includes('multipart/form-data')) {
      // Handle form data (file upload)
      const formData = await request.formData();
      const file = formData.get('file');
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      fileContent = file;
    } else {
      // Handle raw text/binary
      const rawData = await request.text();
      fileContent = new Blob([rawData], { type: 'text/plain' });
    }

    // Create FormData for IPFS API
    const ipfsFormData = new FormData();
    ipfsFormData.append('file', fileContent);

    const response = await fetch(`${IPFS_API}/api/v0/add?pin=true`, {
      method: 'POST',
      body: ipfsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('IPFS API error:', errorText);
      return NextResponse.json(
        { error: 'IPFS upload failed', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Return normalized response
    return NextResponse.json({
      cid: data.Hash,
      size: data.Size,
      name: data.Name,
    });
  } catch (error) {
    console.error('IPFS Proxy error:', error);
    return NextResponse.json(
      { error: 'IPFS request failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
