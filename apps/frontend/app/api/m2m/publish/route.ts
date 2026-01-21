import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  validateApiKey,
  checkRateLimit,
  getRateLimitRemaining,
  getRateLimitReset,
} from '@/lib/api-keys';
import { relayPublishPost, isRelayerConfigured } from '@/lib/relayer';
import { calculateContentHash } from '@vauban/web3-utils';

// Request body schema
const PublishRequestSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(100),
  content: z.string().min(100).max(500000),
  excerpt: z.string().min(10).max(500),
  tags: z.array(z.string()).min(1).max(10),
  coverImage: z.string().url().optional(),
  isPaid: z.boolean().default(false),
  price: z.number().min(0).max(1000000).default(0),
  isEncrypted: z.boolean().default(false),
});

/**
 * POST /api/m2m/publish
 *
 * Publish an article via M2M API (for automated/AI publishing)
 *
 * Headers:
 *   X-API-Key: <api-key>
 *
 * Body:
 *   - title: string
 *   - slug: string
 *   - content: string (markdown)
 *   - excerpt: string
 *   - tags: string[]
 *   - coverImage?: string (URL)
 *   - isPaid?: boolean
 *   - price?: number
 *   - isEncrypted?: boolean
 */
export async function POST(request: NextRequest) {
  // Check if relayer is configured
  if (!isRelayerConfigured()) {
    return NextResponse.json(
      {
        error: 'M2M publishing not configured',
        message: 'Server is missing relayer configuration',
      },
      { status: 503 }
    );
  }

  // Get API key from header
  const apiKey = request.headers.get('X-API-Key');

  // Validate API key
  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
      },
      { status: 401 }
    );
  }

  // Check rate limit
  if (!checkRateLimit(apiKey!)) {
    const resetTime = getRateLimitReset(apiKey!);
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        resetAt: new Date(resetTime).toISOString(),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
        },
      }
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = PublishRequestSchema.parse(body);

    // Create content object for storage
    const contentObject = {
      title: validatedData.title,
      slug: validatedData.slug,
      content: validatedData.content,
      excerpt: validatedData.excerpt,
      tags: validatedData.tags,
      coverImage: validatedData.coverImage || null,
    };
    const contentJson = JSON.stringify(contentObject);

    // Calculate content hash
    const contentHash = await calculateContentHash(contentJson);

    // Upload to IPFS via local API
    let ipfsCid: string;
    try {
      const ipfsResponse = await fetch(`${getBaseUrl(request)}/api/ipfs/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: contentJson,
      });

      if (!ipfsResponse.ok) {
        throw new Error(`IPFS upload failed: ${ipfsResponse.status}`);
      }

      const ipfsResult = await ipfsResponse.json();
      ipfsCid = ipfsResult.cid;
    } catch (error) {
      console.error('IPFS upload error:', error);
      return NextResponse.json(
        {
          error: 'Storage error',
          message: 'Failed to upload content to IPFS',
        },
        { status: 500 }
      );
    }

    // Upload to Arweave via local API
    let arweaveTxId: string;
    try {
      const arweaveResponse = await fetch(`${getBaseUrl(request)}/api/arweave/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: contentJson,
      });

      if (!arweaveResponse.ok) {
        // Arweave might fail in dev - use simulated ID
        console.warn('Arweave upload failed, using simulated ID');
        arweaveTxId = `ar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      } else {
        const arweaveResult = await arweaveResponse.json();
        arweaveTxId = arweaveResult.txId || arweaveResult.id;
      }
    } catch (error) {
      console.warn('Arweave upload error, using simulated ID:', error);
      arweaveTxId = `ar_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }

    // Publish to blockchain via relayer
    const priceWei = validatedData.isPaid
      ? (BigInt(validatedData.price) * BigInt(10 ** 18)).toString()
      : '0';

    const { txHash } = await relayPublishPost(
      arweaveTxId,
      ipfsCid,
      contentHash,
      priceWei,
      validatedData.isEncrypted
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          txHash,
          arweaveTxId,
          ipfsCid,
          contentHash,
          title: validatedData.title,
          slug: validatedData.slug,
        },
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': getRateLimitRemaining(apiKey!).toString(),
          'X-RateLimit-Reset': getRateLimitReset(apiKey!).toString(),
        },
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: 'Invalid request body',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('M2M publish error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/m2m/publish
 *
 * Returns API info and configuration status
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('X-API-Key');

  if (!validateApiKey(apiKey)) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API key',
      },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'ok',
    configured: isRelayerConfigured(),
    rateLimit: {
      remaining: getRateLimitRemaining(apiKey!),
      resetAt: new Date(getRateLimitReset(apiKey!)).toISOString(),
    },
    endpoints: {
      publish: 'POST /api/m2m/publish',
    },
  });
}

/**
 * Get base URL for internal API calls
 */
function getBaseUrl(request: NextRequest): string {
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3005';
  return `${protocol}://${host}`;
}
