/**
 * AI Image Generation
 *
 * Provides image generation capabilities using Together AI or Pollinations.
 */

import { z } from 'zod';
import {
  type ImageProvider,
  IMAGE_PROVIDERS,
  getImageProviderApiKey,
  isImageProviderAvailable,
} from './ai-providers';
import { getAIConfig } from './ai-config';

// Image generation options
export interface ImageGenerationOptions {
  provider?: ImageProvider;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  signal?: AbortSignal;
}

// Image generation result
export interface ImageGenerationResult {
  success: true;
  url: string;
  provider: ImageProvider;
  model: string;
}

export interface ImageGenerationError {
  success: false;
  error: string;
  code: 'NETWORK_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT' | 'NO_PROVIDER';
}

export type ImageGenerationResponse = ImageGenerationResult | ImageGenerationError;

// Together AI response schema
const TogetherImageResponseSchema = z.object({
  data: z.array(
    z.object({
      url: z.string().url().optional(),
      b64_json: z.string().optional(),
    })
  ),
});

/**
 * Generate an image using Together AI
 */
async function generateWithTogether(
  prompt: string,
  options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
  const apiKey = getImageProviderApiKey('together');
  if (!apiKey) {
    return {
      success: false,
      error: 'Together AI API key not configured',
      code: 'NO_PROVIDER',
    };
  }

  const model = options.model ?? IMAGE_PROVIDERS.together.models[0] ?? 'black-forest-labs/FLUX.1-schnell';

  try {
    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        width: options.width ?? 1024,
        height: options.height ?? 768,
        steps: options.steps ?? 4,
        n: 1,
        response_format: 'url',
      }),
      signal: options.signal ?? AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Together AI error: ${response.status} - ${errorText}`,
        code: 'API_ERROR',
      };
    }

    const data = await response.json();
    const parsed = TogetherImageResponseSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid response format: ${parsed.error.message}`,
        code: 'VALIDATION_ERROR',
      };
    }

    const imageData = parsed.data.data[0];
    if (!imageData?.url) {
      return {
        success: false,
        error: 'No image URL in response',
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: true,
      url: imageData.url,
      provider: 'together',
      model,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timed out',
        code: 'TIMEOUT',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Generate an image using Pollinations API
 * Requires API key from enter.pollinations.ai
 */
async function generateWithPollinations(
  prompt: string,
  options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
  const apiKey = getImageProviderApiKey('pollinations');
  if (!apiKey) {
    return {
      success: false,
      error: 'Pollinations nécessite une clé API. Inscris-toi sur enter.pollinations.ai',
      code: 'NO_PROVIDER',
    };
  }

  const width = options.width ?? 1024;
  const height = options.height ?? 768;
  const model = options.model ?? 'flux';

  // Generate unique seed using timestamp + random to avoid cache issues
  const seed = Date.now() + Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt);

  // Build URL with all parameters including seed for cache busting
  const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&seed=${seed}&nologo=true&enhance=true`;

  try {
    // Use Pollinations API with authentication header and full parameters
    const response = await fetch(imageUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: options.signal ?? AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      // If auth fails, try URL-based approach with token param
      const fallbackUrl = `${imageUrl}&token=${apiKey}`;

      return {
        success: true,
        url: fallbackUrl,
        provider: 'pollinations',
        model,
      };
    }

    // If successful, create a blob URL from the response
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return {
      success: true,
      url,
      provider: 'pollinations',
      model,
    };
  } catch (error) {
    // Fallback to URL-based approach with token
    const fallbackUrl = `${imageUrl}&token=${apiKey}`;

    return {
      success: true,
      url: fallbackUrl,
      provider: 'pollinations',
      model,
    };
  }
}

/**
 * Generate an image using the configured provider
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> {
  // Get provider from options or config
  let provider = options.provider;
  let model = options.model;

  if (!provider) {
    const config = getAIConfig();
    provider = config.imageProvider;
    model = model ?? config.imageModel;
  }

  // Check if provider is available
  if (!isImageProviderAvailable(provider)) {
    return {
      success: false,
      error: `Aucun provider d'images configuré. Ajoutez NEXT_PUBLIC_TOGETHER_API_KEY dans .env.local (inscription gratuite sur together.ai)`,
      code: 'NO_PROVIDER',
    };
  }

  // Route to appropriate provider
  switch (provider) {
    case 'together':
      return generateWithTogether(prompt, { ...options, model });
    case 'pollinations':
      return await generateWithPollinations(prompt, { ...options, model });
    default:
      return {
        success: false,
        error: `Unknown image provider: ${provider}`,
        code: 'NO_PROVIDER',
      };
  }
}

/**
 * Generate a cover image based on article content
 */
export async function generateCoverImage(
  title: string,
  content: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResponse> {
  // Create a prompt based on article content
  const excerpt = content.slice(0, 500).replace(/[#*`\[\]]/g, '').trim();
  const prompt = `Create a professional blog cover image for an article titled "${title}". The article is about: ${excerpt}. Style: modern, clean, tech-focused, subtle gradients, abstract shapes.`;

  return generateImage(prompt, {
    ...options,
    width: options.width ?? 1200,
    height: options.height ?? 630, // OG image standard size
  });
}

/**
 * Test image generation with a simple prompt
 */
export async function testImageGeneration(
  provider?: ImageProvider
): Promise<ImageGenerationResponse> {
  const testPrompt = 'A simple abstract geometric pattern in blue and purple tones, minimalist style';

  return generateImage(testPrompt, {
    provider,
    width: 512,
    height: 512,
  });
}
