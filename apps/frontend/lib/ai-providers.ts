/**
 * AI Provider Configuration
 *
 * Defines available text and image generation providers with their configurations.
 * LocalAI models are detected dynamically from the running instance.
 */

// Text provider types
export type TextProvider = 'gemini' | 'groq' | 'openrouter' | 'localai';

// LocalAI model metadata (for display purposes)
export interface LocalAIModelInfo {
  name: string;
  size: string;
  speed: string;
  quality: string;
  installed?: boolean;
}

// Static metadata for known LocalAI models
export const LOCALAI_MODELS_METADATA: Record<string, LocalAIModelInfo> = {
  // Ultra-légers (< 1GB)
  'smollm2-360m': { name: 'SmolLM2 360M', size: '230MB', speed: '~1s', quality: 'Expérimental' },
  'tinyllama': { name: 'TinyLlama 1.1B', size: '670MB', speed: '~3s', quality: 'Basique' },

  // Légers (1-2GB) - bon compromis
  'qwen2-1.5b': { name: 'Qwen2 1.5B', size: '941MB', speed: '~5s', quality: 'Bon' },
  'gemma-2b': { name: 'Gemma 2B', size: '1.5GB', speed: '~6s', quality: 'Bon' },

  // Moyens (2-4GB) - meilleure qualité
  'phi-3-mini': { name: 'Phi-3 Mini', size: '2.4GB', speed: '~8s', quality: 'Très bon' },

  // Gros (4GB+) - qualité maximale
  'mistral': { name: 'Mistral 7B', size: '4.1GB', speed: '~30s', quality: 'Excellent' },
  'llama3-8b': { name: 'Llama 3 8B', size: '4.7GB', speed: '~40s', quality: 'Excellent' },
};

// Task types for automatic model selection
export type AITaskType = 'light' | 'medium' | 'heavy';

// Model priority by task type (first available will be used)
// Note: Models < 1.5B don't follow instructions reliably
export const MODEL_PRIORITY_BY_TASK: Record<AITaskType, string[]> = {
  // Light tasks: tags, titles, excerpts - qwen2 is fast enough and reliable
  light: ['qwen2-1.5b', 'gemma-2b', 'phi-3-mini', 'tinyllama', 'mistral', 'smollm2-360m'],
  // Medium tasks: improvements, simplify, grammar - balanced
  medium: ['qwen2-1.5b', 'gemma-2b', 'phi-3-mini', 'mistral', 'tinyllama', 'smollm2-360m'],
  // Heavy tasks: expand, translate, continue - prefer quality
  heavy: ['mistral', 'llama3-8b', 'phi-3-mini', 'qwen2-1.5b', 'gemma-2b', 'tinyllama'],
};

// Map AI actions to task types
export const ACTION_TASK_TYPE: Record<string, AITaskType> = {
  // Light tasks
  suggest_title: 'light',
  suggest_tags: 'light',
  suggest_excerpt: 'light',
  fix_grammar: 'light',
  // Medium tasks
  improve: 'medium',
  simplify: 'medium',
  // Heavy tasks
  expand: 'heavy',
  translate_en: 'heavy',
  translate_fr: 'heavy',
  continue: 'heavy',
};

// Cache for installed models
let installedModelsCache: string[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds

// Image provider types
export type ImageProvider = 'huggingface' | 'together' | 'pollinations';

// Provider configuration interface
export interface TextProviderConfig {
  name: string;
  models: string[];
  baseUrl: string;
  latency: string;
  free: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  commercial: boolean;
}

export interface ImageProviderConfig {
  name: string;
  models: string[];
  baseUrl: string;
  latency: string;
  free: string;
  requiresApiKey: boolean;
  apiKeyEnvVar: string;
  commercial: boolean;
}

// Text providers configuration
export const TEXT_PROVIDERS: Record<TextProvider, TextProviderConfig> = {
  gemini: {
    name: 'Google Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-flash'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    latency: '~150ms',
    free: '1000 req/jour',
    requiresApiKey: true,
    apiKeyEnvVar: 'NEXT_PUBLIC_GEMINI_API_KEY',
    commercial: true,
  },
  groq: {
    name: 'Groq (Test only)',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    baseUrl: 'https://api.groq.com/openai/v1',
    latency: '<50ms',
    free: '500K tokens/jour',
    requiresApiKey: true,
    apiKeyEnvVar: 'NEXT_PUBLIC_GROQ_API_KEY',
    commercial: false,
  },
  openrouter: {
    name: 'OpenRouter (modèles 100% gratuits)',
    // ONLY FREE models - all must end with :free
    // See: https://openrouter.ai/models?q=:free
    models: [
      // Google Gemini (best performance/speed, 100% free)
      'google/gemini-2.0-flash-exp:free',      // Fastest, best quality (Jan 2026)
      'google/gemini-2.5-flash-preview-05-20:free', // Alternative
      // Meta Llama (high quality, slower)
      'meta-llama/llama-3.3-70b-instruct:free', // Excellent quality, good French
      // Mistral (good French support)
      'mistralai/mistral-small-3.1-24b-instruct:free',
      // Qwen (large context)
      'qwen/qwen3-235b-a22b:free',
    ],
    baseUrl: 'https://openrouter.ai/api/v1',
    latency: '~100-500ms',
    free: '100% gratuit (rate limits)',
    requiresApiKey: true,
    apiKeyEnvVar: 'NEXT_PUBLIC_OPENROUTER_API_KEY',
    commercial: true,
  },
  localai: {
    name: 'LocalAI',
    // Note: This list is populated dynamically via fetchInstalledLocalAIModels()
    // These are fallback defaults if API is not reachable
    models: ['qwen2-1.5b', 'mistral'],
    baseUrl: process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:8081/v1',
    latency: '~3-30s',
    free: 'Illimité',
    requiresApiKey: false,
    apiKeyEnvVar: '',
    commercial: true,
  },
};

// OpenRouter model selection by task type (for optimal speed/quality tradeoff)
// ALL models MUST end with :free to ensure zero cost
export const OPENROUTER_MODEL_BY_TASK: Record<AITaskType, string> = {
  // Light tasks (tags, titles, excerpts): fastest model
  light: 'google/gemini-2.0-flash-exp:free',
  // Medium tasks (improve, simplify, fix): balanced model
  medium: 'google/gemini-2.0-flash-exp:free',
  // Heavy tasks (expand, translate, continue): quality model with good French
  heavy: 'google/gemini-2.0-flash-exp:free',
};

// Fallback free models if primary fails (in order of preference)
export const OPENROUTER_FREE_FALLBACKS: string[] = [
  'google/gemini-2.0-flash-exp:free',      // Best free model currently
  'google/gemini-2.5-flash-preview-05-20:free', // Alternative Gemini
  'meta-llama/llama-3.3-70b-instruct:free', // High quality, slower
  'mistralai/mistral-small-3.1-24b-instruct:free', // Good French
  'qwen/qwen3-235b-a22b:free',              // Large, good reasoning
];

// Fallback chain when a provider fails
export const PROVIDER_FALLBACK_CHAIN: Record<TextProvider, TextProvider[]> = {
  gemini: ['openrouter', 'groq', 'localai'],
  openrouter: ['gemini', 'groq', 'localai'],
  groq: ['openrouter', 'gemini', 'localai'],
  localai: ['openrouter', 'gemini', 'groq'],
};

// Image providers configuration
export const IMAGE_PROVIDERS: Record<ImageProvider, ImageProviderConfig> = {
  huggingface: {
    name: 'Hugging Face (Gratuit)',
    // Free image generation models
    models: [
      'black-forest-labs/FLUX.1-schnell',     // Fast, high quality
      'stabilityai/stable-diffusion-xl-base-1.0', // SDXL
      'stabilityai/stable-diffusion-3.5-large',   // SD 3.5
    ],
    baseUrl: 'https://api-inference.huggingface.co/models',
    latency: '~3-15s',
    free: '100% gratuit (rate limits)',
    requiresApiKey: true,
    apiKeyEnvVar: 'NEXT_PUBLIC_HUGGINGFACE_API_KEY',
    commercial: true,
  },
  together: {
    name: 'Together AI',
    models: ['black-forest-labs/FLUX.1-schnell', 'black-forest-labs/FLUX.1.1-pro'],
    baseUrl: 'https://api.together.xyz/v1',
    latency: '1.5-2s',
    free: '$1 crédit gratuit',
    requiresApiKey: true,
    apiKeyEnvVar: 'NEXT_PUBLIC_TOGETHER_API_KEY',
    commercial: true,
  },
  pollinations: {
    name: 'Pollinations (Inscription requise)',
    models: ['flux'],
    baseUrl: 'https://image.pollinations.ai',
    latency: '3-8s',
    free: 'Inscription requise',
    requiresApiKey: true, // Now requires signup
    apiKeyEnvVar: 'NEXT_PUBLIC_POLLINATIONS_API_KEY',
    commercial: true,
  },
};

/**
 * Get the API key for a text provider
 */
export function getTextProviderApiKey(provider: TextProvider): string | null {
  const config = TEXT_PROVIDERS[provider];
  if (!config.requiresApiKey) {
    return null;
  }

  // Access env vars at runtime
  switch (provider) {
    case 'gemini':
      return process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? null;
    case 'groq':
      return process.env.NEXT_PUBLIC_GROQ_API_KEY ?? null;
    case 'openrouter':
      return process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ?? null;
    default:
      return null;
  }
}

/**
 * Get the API key for an image provider
 */
export function getImageProviderApiKey(provider: ImageProvider): string | null {
  const config = IMAGE_PROVIDERS[provider];
  if (!config.requiresApiKey) {
    return null;
  }

  // Access env vars at runtime
  switch (provider) {
    case 'huggingface':
      return process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY ?? null;
    case 'together':
      return process.env.NEXT_PUBLIC_TOGETHER_API_KEY ?? null;
    case 'pollinations':
      return process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY ?? null;
    default:
      return null;
  }
}

/**
 * Check if a text provider is available (has required API key)
 */
export function isTextProviderAvailable(provider: TextProvider): boolean {
  const config = TEXT_PROVIDERS[provider];
  if (!config.requiresApiKey) {
    return true;
  }
  const apiKey = getTextProviderApiKey(provider);
  return apiKey !== null && apiKey.length > 0;
}

/**
 * Check if an image provider is available (has required API key)
 */
export function isImageProviderAvailable(provider: ImageProvider): boolean {
  const config = IMAGE_PROVIDERS[provider];
  if (!config.requiresApiKey) {
    return true;
  }
  const apiKey = getImageProviderApiKey(provider);
  return apiKey !== null && apiKey.length > 0;
}

/**
 * Get all available text providers
 */
export function getAvailableTextProviders(): TextProvider[] {
  return (Object.keys(TEXT_PROVIDERS) as TextProvider[]).filter(isTextProviderAvailable);
}

/**
 * Get all available image providers
 */
export function getAvailableImageProviders(): ImageProvider[] {
  return (Object.keys(IMAGE_PROVIDERS) as ImageProvider[]).filter(isImageProviderAvailable);
}

/**
 * Get the best available text provider (fastest with API key)
 */
export function getBestAvailableTextProvider(): TextProvider {
  // Priority order: gemini (fast + commercial), openrouter (18+ free models), groq (fastest but test only), localai (slow but always available)
  const priority: TextProvider[] = ['gemini', 'openrouter', 'groq', 'localai'];

  for (const provider of priority) {
    if (isTextProviderAvailable(provider)) {
      return provider;
    }
  }

  // Fallback to localai (always available)
  return 'localai';
}

/**
 * Get the best available image provider
 */
export function getBestAvailableImageProvider(): ImageProvider {
  // Priority order: huggingface (free), together ($1 credit), pollinations (requires signup)
  const priority: ImageProvider[] = ['huggingface', 'together', 'pollinations'];

  for (const provider of priority) {
    if (isImageProviderAvailable(provider)) {
      return provider;
    }
  }

  // Fallback to huggingface
  return 'huggingface';
}

/**
 * Fetch installed models from LocalAI API
 * Returns list of model IDs that are currently loaded
 */
export async function fetchInstalledLocalAIModels(forceRefresh = false): Promise<string[]> {
  const now = Date.now();

  // Return cached result if still valid
  if (!forceRefresh && installedModelsCache && (now - lastFetchTime) < CACHE_TTL) {
    return installedModelsCache;
  }

  const baseUrl = TEXT_PROVIDERS.localai.baseUrl;

  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.warn('LocalAI models endpoint returned error:', response.status);
      return installedModelsCache ?? [];
    }

    const data = await response.json();

    // Filter out non-LLM models (like embeddings)
    const models = (data.data || [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id !== 'text-embedding' && !id.includes('embed'));

    installedModelsCache = models;
    lastFetchTime = now;

    return models;
  } catch (error) {
    console.warn('Failed to fetch LocalAI models:', error);
    return installedModelsCache ?? [];
  }
}

/**
 * Get all LocalAI models with their installation status
 * Combines installed models with known models metadata
 */
export async function getLocalAIModelsWithStatus(): Promise<(LocalAIModelInfo & { id: string })[]> {
  const installedModels = await fetchInstalledLocalAIModels();
  const installedSet = new Set(installedModels);

  // Start with all known models
  const allModels = Object.entries(LOCALAI_MODELS_METADATA).map(([id, info]) => ({
    id,
    ...info,
    installed: installedSet.has(id),
  }));

  // Add any installed models not in our metadata (unknown models)
  for (const modelId of installedModels) {
    if (!LOCALAI_MODELS_METADATA[modelId]) {
      allModels.push({
        id: modelId,
        name: modelId,
        size: 'Inconnu',
        speed: 'Inconnu',
        quality: 'Inconnu',
        installed: true,
      });
    }
  }

  // Sort: installed first, then by name
  return allModels.sort((a, b) => {
    if (a.installed && !b.installed) return -1;
    if (!a.installed && b.installed) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Clear the installed models cache (call after installing a new model)
 */
export function clearLocalAIModelsCache(): void {
  installedModelsCache = null;
  lastFetchTime = 0;
}

/**
 * Get the best available LocalAI model for a task type
 * Returns the first installed model from the priority list, or fallback
 */
export async function getBestModelForTask(
  taskType: AITaskType,
  installedModels?: string[]
): Promise<{ model: string; isOptimal: boolean }> {
  // Get installed models if not provided
  const installed = installedModels ?? await fetchInstalledLocalAIModels();
  const installedSet = new Set(installed);

  // Get priority list for this task type
  const priorityList = MODEL_PRIORITY_BY_TASK[taskType];

  // Find first available model from priority list
  for (const model of priorityList) {
    if (installedSet.has(model)) {
      // Check if this is the optimal (first choice) model
      const isOptimal = model === priorityList[0];
      return { model, isOptimal };
    }
  }

  // Fallback: use any installed model
  if (installed.length > 0) {
    return { model: installed[0], isOptimal: false };
  }

  // Ultimate fallback
  return { model: 'qwen2-1.5b', isOptimal: false };
}

/**
 * Get task type for an AI action
 */
export function getTaskTypeForAction(action: string): AITaskType {
  return ACTION_TASK_TYPE[action] ?? 'medium';
}

/**
 * Get the best OpenRouter model for a task type
 */
export function getOpenRouterModelForTask(taskType: AITaskType): string {
  return OPENROUTER_MODEL_BY_TASK[taskType];
}

/**
 * Get fallback providers for a given provider
 * Returns only providers that are available (have API keys configured)
 */
export function getAvailableFallbackProviders(provider: TextProvider): TextProvider[] {
  const fallbacks = PROVIDER_FALLBACK_CHAIN[provider] ?? [];
  return fallbacks.filter(isTextProviderAvailable);
}
