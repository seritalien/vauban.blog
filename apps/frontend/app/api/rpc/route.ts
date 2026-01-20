import { NextRequest, NextResponse } from 'next/server';

const MADARA_RPC = process.env.NEXT_PUBLIC_MADARA_RPC || 'http://localhost:9944';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(MADARA_RPC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('RPC Proxy error:', error);
    return NextResponse.json(
      { error: 'RPC request failed' },
      { status: 500 }
    );
  }
}
