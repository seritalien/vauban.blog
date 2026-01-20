import { NextRequest, NextResponse } from 'next/server';
import { Account, RpcProvider, Contract, ec, hash } from 'starknet';

// Relayer account (funded dev account that pays for gas)
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY || '0x76f2ccdb23f29bc7b69278e947c01c6160a31cf02c19d06d0f6e5ab1d768b86';
const RELAYER_ADDRESS = process.env.RELAYER_ADDRESS || '0x3bb306a004034dba19e6cf7b161e7a4fef64bc1078419e8ad1876192f0b8cd1';

const SOCIAL_ADDRESS = process.env.NEXT_PUBLIC_SOCIAL_ADDRESS;
const RPC_URL = process.env.MADARA_RPC_URL || 'http://localhost:9944';

interface RelayCommentRequest {
  postId: string;
  contentHash: string;
  parentCommentId?: string;
  sessionPublicKey: string;
  userAddress: string;
  signature: string; // Signature from session private key
  nonce: number;
}

/**
 * POST /api/relay/comment
 * Relays a comment on behalf of a user with an active session key
 * The relayer pays for gas, making it gasless for the user
 */
export async function POST(request: NextRequest) {
  try {
    const body: RelayCommentRequest = await request.json();
    const { postId, contentHash, parentCommentId, sessionPublicKey, userAddress, signature, nonce } = body;

    // Validate required fields
    if (!postId || !contentHash || !sessionPublicKey || !userAddress || !signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!SOCIAL_ADDRESS) {
      return NextResponse.json(
        { error: 'Social contract address not configured' },
        { status: 500 }
      );
    }

    // Verify signature
    const messageHash = hash.computeHashOnElements([
      postId,
      contentHash,
      parentCommentId || '0',
      userAddress,
      nonce.toString(),
    ]);

    try {
      // Verify the signature was created by the session key
      const isValid = ec.starkCurve.verify(
        signature,
        messageHash,
        sessionPublicKey
      );

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    } catch (sigError) {
      console.error('Signature verification error:', sigError);
      // Skip verification in dev mode for easier testing
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: 'Signature verification failed' },
          { status: 401 }
        );
      }
    }

    // Initialize relayer account
    const provider = new RpcProvider({ nodeUrl: RPC_URL });
    const relayerAccount = new Account(provider, RELAYER_ADDRESS, RELAYER_PRIVATE_KEY);

    // Load Social contract ABI
    const socialAbi = await import('@/abis/social.json').then(m => m.default || m);
    const contract = new Contract(socialAbi.abi || socialAbi, SOCIAL_ADDRESS, relayerAccount);

    // Submit comment via session key
    console.log(`Relaying comment for ${userAddress} on post ${postId}`);

    const result = await contract.add_comment_with_session_key(
      postId,
      contentHash,
      parentCommentId || '0',
      sessionPublicKey,
      userAddress,
      nonce
    );

    // Wait for transaction
    await provider.waitForTransaction(result.transaction_hash);

    console.log(`Comment relayed successfully: ${result.transaction_hash}`);

    return NextResponse.json({
      success: true,
      transactionHash: result.transaction_hash,
      message: 'Comment posted successfully (gasless)',
    });
  } catch (error) {
    console.error('Relay error:', error);
    return NextResponse.json(
      {
        error: 'Failed to relay comment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/relay/comment
 * Health check and info
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    relayer: RELAYER_ADDRESS ? `${RELAYER_ADDRESS.slice(0, 10)}...` : 'not configured',
    socialContract: SOCIAL_ADDRESS ? `${SOCIAL_ADDRESS.slice(0, 10)}...` : 'not configured',
  });
}
