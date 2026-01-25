/**
 * Server-side proxy for image generation APIs
 *
 * This avoids CORS issues when calling Hugging Face from the browser.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for image generation

interface ImageRequestBody {
  prompt: string;
  provider: 'huggingface' | 'together' | 'pollinations';
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ImageRequestBody;
    const { prompt, provider, model, width = 1024, height = 768, steps = 4 } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    switch (provider) {
      case 'huggingface':
        return await generateWithHuggingFace(prompt, model, width, height, steps);
      case 'together':
        return await generateWithTogether(prompt, model, width, height, steps);
      case 'pollinations':
        return await generateWithPollinations(prompt, model, width, height);
      default:
        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }
  } catch (error) {
    console.error('[API/Image] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateWithHuggingFace(
  prompt: string,
  model: string | undefined,
  width: number,
  height: number,
  steps: number
) {
  const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Hugging Face API key not configured' }, { status: 500 });
  }

  const modelId = model || 'black-forest-labs/FLUX.1-schnell';

  const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Wait-For-Model': 'true',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        width,
        height,
        num_inference_steps: steps,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[API/Image] Hugging Face error:', response.status, errorText);
    return NextResponse.json(
      { error: `Hugging Face error: ${response.status} - ${errorText}` },
      { status: response.status }
    );
  }

  // Return the image blob directly
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': blob.type || 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function generateWithTogether(
  prompt: string,
  model: string | undefined,
  width: number,
  height: number,
  steps: number
) {
  const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Together API key not configured' }, { status: 500 });
  }

  const modelId = model || 'black-forest-labs/FLUX.1-schnell';

  const response = await fetch('https://api.together.xyz/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      prompt,
      width,
      height,
      steps,
      n: 1,
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('[API/Image] Together error:', response.status, errorText);
    return NextResponse.json(
      { error: `Together error: ${response.status} - ${errorText}` },
      { status: response.status }
    );
  }

  const data = await response.json();
  const imageUrl = data?.data?.[0]?.url;

  if (!imageUrl) {
    return NextResponse.json({ error: 'No image URL in response' }, { status: 500 });
  }

  return NextResponse.json({ url: imageUrl });
}

async function generateWithPollinations(
  prompt: string,
  model: string | undefined,
  width: number,
  height: number
) {
  const apiKey = process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Pollinations API key not configured' }, { status: 500 });
  }

  const modelId = model || 'flux';
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt);

  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${modelId}&seed=${seed}&nologo=true&enhance=true`;

  const response = await fetch(imageUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    // Try URL-based approach with token
    const fallbackUrl = `${imageUrl}&token=${apiKey}`;
    return NextResponse.json({ url: fallbackUrl });
  }

  // Return the image blob directly
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();

  return new NextResponse(arrayBuffer, {
    headers: {
      'Content-Type': blob.type || 'image/png',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
