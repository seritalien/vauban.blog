/**
 * AI Image Generation
 *
 * Provides image generation via server-side proxy to avoid CORS issues.
 * Supports Hugging Face, Together AI, and Pollinations.
 */

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

/**
 * Generate an image using the server-side proxy
 * This avoids CORS issues with external APIs
 */
async function generateViaProxy(
  provider: ImageProvider,
  prompt: string,
  options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
  const model = options.model ?? IMAGE_PROVIDERS[provider].models[0];

  try {
    const response = await fetch('/api/ai/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        provider,
        model,
        width: options.width ?? 1024,
        height: options.height ?? 768,
        steps: options.steps ?? 4,
      }),
      signal: options.signal ?? AbortSignal.timeout(120000), // 2 min timeout
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        error: errorData.error || `Error ${response.status}`,
        code: 'API_ERROR',
      };
    }

    const contentType = response.headers.get('content-type') || '';

    // If the response is JSON, it contains a URL
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return {
        success: true,
        url: data.url,
        provider,
        model: model ?? 'unknown',
      };
    }

    // Otherwise, it's an image blob
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return {
      success: true,
      url,
      provider,
      model: model ?? 'unknown',
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
 * Generate an image using Hugging Face (via server proxy)
 */
async function generateWithHuggingFace(
  prompt: string,
  options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
  const apiKey = getImageProviderApiKey('huggingface');
  if (!apiKey) {
    return {
      success: false,
      error: 'Hugging Face API key not configured',
      code: 'NO_PROVIDER',
    };
  }

  return generateViaProxy('huggingface', prompt, options);
}

/**
 * Generate an image using Together AI (via server proxy)
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

  return generateViaProxy('together', prompt, options);
}

/**
 * Generate an image using Pollinations API (via server proxy)
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

  return generateViaProxy('pollinations', prompt, options);
}

// Image provider fallback chain
const IMAGE_PROVIDER_FALLBACK: Record<ImageProvider, ImageProvider[]> = {
  huggingface: ['together', 'pollinations'],
  together: ['huggingface', 'pollinations'],
  pollinations: ['huggingface', 'together'],
};

/**
 * Generate an image with a specific provider
 */
async function generateWithProvider(
  provider: ImageProvider,
  prompt: string,
  options: ImageGenerationOptions
): Promise<ImageGenerationResponse> {
  switch (provider) {
    case 'huggingface':
      return generateWithHuggingFace(prompt, options);
    case 'together':
      return generateWithTogether(prompt, options);
    case 'pollinations':
      return generateWithPollinations(prompt, options);
    default:
      return {
        success: false,
        error: `Unknown image provider: ${provider}`,
        code: 'NO_PROVIDER',
      };
  }
}

/**
 * Generate an image using the configured provider
 * No automatic fallback to avoid confusion - returns error directly
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

  console.log(`[AI Images] Generating with ${provider}, model: ${model || 'default'}`);

  // Check if provider is available
  if (!isImageProviderAvailable(provider)) {
    // Try to find an available fallback
    const fallbacks = IMAGE_PROVIDER_FALLBACK[provider] ?? [];
    const availableFallback = fallbacks.find(isImageProviderAvailable);

    if (availableFallback) {
      console.log(`[AI Images] Primary provider ${provider} not available, using: ${availableFallback}`);
      provider = availableFallback;
      model = undefined; // Let fallback use its default model
    } else {
      return {
        success: false,
        error: `Aucun provider d'images configuré. Ajoutez NEXT_PUBLIC_HUGGINGFACE_API_KEY dans .env.local`,
        code: 'NO_PROVIDER',
      };
    }
  }

  // Try provider (no automatic fallback to avoid loops)
  const result = await generateWithProvider(provider, prompt, { ...options, model });
  return result;
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
