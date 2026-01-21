import { NextRequest, NextResponse } from 'next/server';

const IPFS_GATEWAY = process.env.IPFS_GATEWAY_URL || 'http://localhost:8005';
const IPFS_API = process.env.IPFS_API_URL || 'http://localhost:5001';

// Content type detection based on magic bytes
function detectContentType(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'image/png';
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'image/jpeg';
  }
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  // SVG: starts with < (3C) or whitespace then <
  const text = new TextDecoder().decode(bytes.slice(0, 100));
  if (text.trim().startsWith('<svg') || text.trim().startsWith('<?xml')) {
    return 'image/svg+xml';
  }
  // JSON: starts with { or [
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    return 'application/json';
  }

  return 'application/octet-stream';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  const { cid } = await params;

  try {
    // Use IPFS API directly (avoids subdomain redirect issues with gateway)
    const response = await fetch(`${IPFS_API}/api/v0/cat?arg=${cid}`, {
      method: 'POST',
    });

    if (!response.ok) {
      // Fallback to gateway with manual redirect handling
      const gwResponse = await fetch(`${IPFS_GATEWAY}/ipfs/${cid}`, {
        redirect: 'manual',
      });

      if (gwResponse.status === 301 || gwResponse.status === 302) {
        // Handle subdomain redirect by extracting CID and using API
        const location = gwResponse.headers.get('location');
        if (location) {
          // Extract CID from redirect URL (e.g., http://bafybeih...ipfs.localhost:8005/)
          const match = location.match(/\/\/([a-z0-9]+)\.ipfs\./i);
          if (match) {
            const redirectCid = match[1];
            const apiResponse = await fetch(`${IPFS_API}/api/v0/cat?arg=${redirectCid}`, {
              method: 'POST',
            });
            if (apiResponse.ok) {
              const buffer = await apiResponse.arrayBuffer();
              const contentType = detectContentType(buffer);
              return new NextResponse(buffer, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=31536000, immutable',
                },
              });
            }
          }
        }
      }

      return NextResponse.json(
        { error: `IPFS fetch failed: ${response.status}` },
        { status: response.status }
      );
    }

    // Get the raw data
    const buffer = await response.arrayBuffer();
    const contentType = detectContentType(buffer);

    // Return with appropriate content type
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // IPFS content is immutable
      },
    });
  } catch (error) {
    console.error('IPFS Gateway Proxy error:', error);

    return NextResponse.json(
      { error: 'IPFS gateway request failed' },
      { status: 500 }
    );
  }
}
