import { NextRequest, NextResponse } from 'next/server';

const IPFS_API = process.env.IPFS_API_URL || 'http://localhost:5001';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const response = await fetch(`${IPFS_API}/api/v0/add?pin=true`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('IPFS Proxy error:', error);
    return NextResponse.json(
      { error: 'IPFS request failed' },
      { status: 500 }
    );
  }
}
