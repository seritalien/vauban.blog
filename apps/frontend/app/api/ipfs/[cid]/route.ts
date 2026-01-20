import { NextRequest, NextResponse } from 'next/server';

const IPFS_GATEWAY = process.env.IPFS_GATEWAY_URL || 'http://localhost:8080';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;

  try {
    // Follow redirects automatically
    const response = await fetch(`${IPFS_GATEWAY}/ipfs/${cid}`, {
      headers: {
        'Accept': 'application/json',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      // Try without subdomain redirect by using the API directly
      const apiResponse = await fetch(`http://localhost:5001/api/v0/cat?arg=${cid}`, {
        method: 'POST',
      });

      if (apiResponse.ok) {
        const text = await apiResponse.text();
        try {
          return NextResponse.json(JSON.parse(text));
        } catch {
          return NextResponse.json({ content: text });
        }
      }

      return NextResponse.json(
        { error: `IPFS fetch failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('IPFS Gateway Proxy error:', error);

    // Fallback: try API directly
    try {
      const apiResponse = await fetch(`http://localhost:5001/api/v0/cat?arg=${cid}`, {
        method: 'POST',
      });

      if (apiResponse.ok) {
        const text = await apiResponse.text();
        try {
          return NextResponse.json(JSON.parse(text));
        } catch {
          return NextResponse.json({ content: text });
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      { error: 'IPFS gateway request failed' },
      { status: 500 }
    );
  }
}
