/**
 * Server-side proxy for image generation APIs
 *
 * Fallback chain (all free):
 * 1. Hugging Face (FLUX Schnell) - requires API key, free tier
 * 2. Pixazo (FLUX Schnell) - requires API key
 * 3. Pollinations (FLUX) - no API key, truly free
 * 4. DeepAI - free tier
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes for image generation

interface ImageRequestBody {
  prompt: string;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ImageRequestBody;
    const { prompt, width = 1024, height = 768, steps = 4 } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const errors: string[] = [];

    // Try Hugging Face first (if API key available) - best free option
    const huggingfaceKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;
    if (huggingfaceKey) {
      console.log(`[API/Image] Trying Hugging Face FLUX...`);
      const result = await generateWithHuggingFace(prompt, width, height, huggingfaceKey);
      if (result.ok) return result;
      const errorText = await result.clone().text().catch(() => 'failed');
      errors.push(`HuggingFace: ${errorText}`);
    }

    // Try Pixazo (if API key available)
    const pixazoKey = process.env.PIXAZO_API_KEY;
    if (pixazoKey) {
      console.log(`[API/Image] Trying Pixazo FLUX...`);
      const result = await generateWithPixazo(prompt, width, height, steps, pixazoKey);
      if (result.ok) return result;
      errors.push(`Pixazo: ${await result.text()}`);
    }

    // Try Pollinations (free, no API key)
    console.log(`[API/Image] Trying Pollinations...`);
    const pollinationsResult = await generateWithPollinations(prompt, width, height);
    if (pollinationsResult.ok) return pollinationsResult;
    errors.push(`Pollinations: ${await pollinationsResult.clone().text().catch(() => 'failed')}`);

    // Try DeepAI (free tier)
    const deepaiKey = process.env.DEEPAI_API_KEY;
    if (deepaiKey) {
      console.log(`[API/Image] Trying DeepAI...`);
      const result = await generateWithDeepAI(prompt, deepaiKey);
      if (result.ok) return result;
      errors.push(`DeepAI: ${await result.text()}`);
    }

    // All failed
    console.error('[API/Image] All providers failed:', errors);
    return NextResponse.json(
      { error: `All providers failed: ${errors.join('; ')}` },
      { status: 500 }
    );

  } catch (error) {
    console.error('[API/Image] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Hugging Face Inference API - Free, requires API key
 * https://huggingface.co/docs/api-inference
 * Uses FLUX.1-schnell model for fast, high-quality generation
 * Returns base64 to avoid CORS issues on client side
 */
async function generateWithHuggingFace(
  prompt: string,
  width: number,
  height: number,
  apiKey: string
): Promise<Response> {
  try {
    console.log(`[API/Image] HuggingFace: ${width}x${height}`);

    const enhancedPrompt = `${prompt}. Style: professional, modern, clean design suitable for a blog cover.`;

    // Use the router endpoint for better reliability
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: enhancedPrompt,
          parameters: {
            width,
            height,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/Image] HuggingFace error:', response.status, errorText);

      // Check for model loading error (common with free tier)
      if (response.status === 503) {
        console.log('[API/Image] HuggingFace model loading, will retry...');
        return NextResponse.json({ error: 'Model is loading, please try again' }, { status: 503 });
      }

      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    // HuggingFace returns raw image bytes
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`[API/Image] HuggingFace success, size: ${arrayBuffer.byteLength} bytes`);
    return NextResponse.json({ url: dataUrl });

  } catch (error) {
    console.error('[API/Image] HuggingFace exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'HuggingFace error' },
      { status: 500 }
    );
  }
}

/**
 * Pixazo FLUX Schnell API
 * https://www.pixazo.ai/models/text-to-image/flux-schnell-api
 * Returns base64 to avoid CORS issues on client side
 */
async function generateWithPixazo(
  prompt: string,
  width: number,
  height: number,
  steps: number,
  apiKey: string
): Promise<Response> {
  try {
    console.log(`[API/Image] Pixazo: ${width}x${height}, steps: ${steps}`);

    const response = await fetch('https://gateway.pixazo.ai/flux-1-schnell/v1/getData', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Ocp-Apim-Subscription-Key': apiKey,
      },
      body: JSON.stringify({
        prompt: `${prompt}. Style: professional, modern, clean design suitable for a blog cover.`,
        num_steps: Math.min(steps, 8),
        width,
        height,
        seed: Math.floor(Math.random() * 1000000),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/Image] Pixazo error:', response.status, errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    if (data?.output) {
      console.log('[API/Image] Pixazo returned URL, fetching for base64 conversion...');

      // Fetch the image and convert to base64 to avoid CORS on client
      const imageResponse = await fetch(data.output);
      if (!imageResponse.ok) {
        // Fallback: return URL if fetch fails (might work if CORS is allowed)
        console.log('[API/Image] Could not fetch Pixazo image, returning URL');
        return NextResponse.json({ url: data.output });
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const contentType = imageResponse.headers.get('content-type') || 'image/png';
      const dataUrl = `data:${contentType};base64,${base64}`;

      console.log(`[API/Image] Pixazo success, size: ${arrayBuffer.byteLength} bytes`);
      return NextResponse.json({ url: dataUrl });
    }

    return NextResponse.json({ error: 'No image in Pixazo response' }, { status: 500 });
  } catch (error) {
    console.error('[API/Image] Pixazo exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pixazo error' },
      { status: 500 }
    );
  }
}

/**
 * Pollinations API - Free, no API key required
 * https://pollinations.ai/
 * Uses random seed to ensure different images each time
 * Returns base64 to avoid CORS issues on client side
 */
async function generateWithPollinations(
  prompt: string,
  width: number,
  height: number
): Promise<Response> {
  try {
    // Generate truly random seed
    const seed = Date.now() + Math.floor(Math.random() * 10000000);
    const enhancedPrompt = `${prompt}. Style: professional, modern, clean design suitable for a blog cover.`;
    const encodedPrompt = encodeURIComponent(enhancedPrompt);

    // Pollinations URL with random seed and nologo
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

    console.log(`[API/Image] Pollinations: seed=${seed}, fetching image...`);

    // Fetch the actual image (not just verify)
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VaubanBlog/1.0',
      },
    });

    if (!response.ok) {
      console.error('[API/Image] Pollinations error:', response.status);
      return NextResponse.json({ error: `Pollinations error: ${response.status}` }, { status: response.status });
    }

    // Convert to base64 to avoid CORS issues on client
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const dataUrl = `data:${contentType};base64,${base64}`;

    console.log(`[API/Image] Pollinations success, size: ${arrayBuffer.byteLength} bytes`);
    return NextResponse.json({ url: dataUrl });

  } catch (error) {
    console.error('[API/Image] Pollinations exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Pollinations error' },
      { status: 500 }
    );
  }
}

/**
 * DeepAI Text2Img API - Free tier available
 * https://deepai.org/machine-learning-model/text2img
 */
async function generateWithDeepAI(
  prompt: string,
  apiKey: string
): Promise<Response> {
  try {
    console.log('[API/Image] DeepAI generating...');

    const formData = new FormData();
    formData.append('text', `${prompt}. Style: professional, modern, clean design suitable for a blog cover.`);

    const response = await fetch('https://api.deepai.org/api/text2img', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/Image] DeepAI error:', response.status, errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    if (data?.output_url) {
      console.log('[API/Image] DeepAI success');
      return NextResponse.json({ url: data.output_url });
    }

    return NextResponse.json({ error: 'No image in DeepAI response' }, { status: 500 });
  } catch (error) {
    console.error('[API/Image] DeepAI exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'DeepAI error' },
      { status: 500 }
    );
  }
}
