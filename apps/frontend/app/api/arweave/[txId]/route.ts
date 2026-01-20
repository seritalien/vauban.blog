import { NextRequest, NextResponse } from 'next/server';

const ARWEAVE_GATEWAY = 'https://arweave.net';
const IRYS_GATEWAY = 'https://gateway.irys.xyz';

/**
 * GET /api/arweave/[txId]
 * Proxy endpoint to fetch content from Arweave with CORS support
 * Falls back between multiple gateways for reliability
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ txId: string }> }
) {
  const { txId } = await params;

  if (!txId) {
    return NextResponse.json({ error: 'Missing txId' }, { status: 400 });
  }

  // Handle simulated TX IDs (return placeholder)
  if (txId.startsWith('ar_')) {
    return NextResponse.json(
      {
        error: 'Simulated Arweave TX',
        message: 'This is a simulated transaction ID (no wallet was provided during upload)',
        txId,
      },
      { status: 404 }
    );
  }

  // Try multiple gateways for reliability
  const gateways = [ARWEAVE_GATEWAY, IRYS_GATEWAY];

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${txId}`, {
        signal: AbortSignal.timeout(30000), // 30s timeout
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // For JSON responses
        if (contentType.includes('application/json')) {
          const data = await response.json();
          return NextResponse.json(data, {
            headers: {
              'X-Arweave-Gateway': gateway,
              'X-Arweave-TxId': txId,
            },
          });
        }

        // For text responses
        if (contentType.includes('text/')) {
          const text = await response.text();
          return new NextResponse(text, {
            headers: {
              'Content-Type': contentType,
              'X-Arweave-Gateway': gateway,
              'X-Arweave-TxId': txId,
            },
          });
        }

        // For binary responses
        const blob = await response.blob();
        return new NextResponse(blob, {
          headers: {
            'Content-Type': contentType,
            'X-Arweave-Gateway': gateway,
            'X-Arweave-TxId': txId,
          },
        });
      }
    } catch (error) {
      console.warn(`Gateway ${gateway} failed for ${txId}:`, error);
      continue; // Try next gateway
    }
  }

  // All gateways failed
  return NextResponse.json(
    {
      error: 'Failed to fetch from Arweave',
      message: 'Content not found on any gateway. It may still be pending confirmation.',
      txId,
      triedGateways: gateways,
    },
    { status: 404 }
  );
}
