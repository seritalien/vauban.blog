import { NextRequest, NextResponse } from 'next/server';

// Irys devnet endpoint for free uploads (no payment required)
const IRYS_DEVNET_URL = 'https://devnet.irys.xyz';

// For production, you'd use mainnet: https://node1.irys.xyz or https://node2.irys.xyz

/**
 * POST /api/arweave/add
 * Upload JSON data to Arweave via Irys devnet (free for testing)
 *
 * For production, this should be configured with proper Irys credentials
 * and funding mechanism (ETH, MATIC, AR, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Get JSON data from request
    const data = await request.json();
    const jsonString = JSON.stringify(data);
    const dataSize = Buffer.byteLength(jsonString, 'utf8');

    // For devnet, we can upload directly without payment
    // In production, you'd need to:
    // 1. Initialize Irys with a funded wallet
    // 2. Check balance and fund if needed
    // 3. Upload with proper signing

    // Devnet upload (free, data may be purged after some time)
    const uploadResponse = await fetch(`${IRYS_DEVNET_URL}/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-irys-tags': JSON.stringify([
          { name: 'Content-Type', value: 'application/json' },
          { name: 'App-Name', value: 'Vauban-Blog' },
          { name: 'App-Version', value: '0.1.0' },
        ]),
      },
      body: jsonString,
    });

    if (!uploadResponse.ok) {
      // Devnet might not accept unsigned uploads, fallback to simulation
      console.warn('Irys devnet upload failed, using simulation');

      // Generate simulated TX ID
      const simulatedTxId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      return NextResponse.json({
        success: true,
        txId: simulatedTxId,
        simulated: true,
        message: 'Arweave upload simulated (devnet unavailable)',
        size: dataSize,
      });
    }

    const result = await uploadResponse.json();

    return NextResponse.json({
      success: true,
      txId: result.id,
      simulated: false,
      message: 'Uploaded to Arweave via Irys devnet',
      size: dataSize,
    });
  } catch (error) {
    console.error('Arweave upload error:', error);

    // Fallback to simulation on any error
    const simulatedTxId = `ar_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return NextResponse.json({
      success: true,
      txId: simulatedTxId,
      simulated: true,
      message: 'Arweave upload simulated (service error)',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/arweave/add
 * Health check and info endpoint
 */
export async function GET() {
  try {
    // Check if devnet is reachable
    const healthResponse = await fetch(`${IRYS_DEVNET_URL}/info`, {
      signal: AbortSignal.timeout(5000),
    });

    const isHealthy = healthResponse.ok;

    return NextResponse.json({
      status: isHealthy ? 'connected' : 'unavailable',
      endpoint: IRYS_DEVNET_URL,
      mode: 'devnet',
      note: 'Using Irys devnet for free uploads. For production, configure with funded wallet.',
    });
  } catch {
    return NextResponse.json({
      status: 'unavailable',
      endpoint: IRYS_DEVNET_URL,
      mode: 'devnet',
      note: 'Irys devnet unreachable. Uploads will be simulated.',
    });
  }
}
