/**
 * AI Configuration Management
 *
 * Handles persistence and retrieval of AI provider settings in localStorage.
 */

import { z } from 'zod';
import {
  TEXT_PROVIDERS,
  IMAGE_PROVIDERS,
  getBestAvailableTextProvider,
  getBestAvailableImageProvider,
} from './ai-providers';

// Storage key for localStorage
const CONFIG_KEY = 'vauban_ai_config';

// Zod schema for AI configuration
const AIConfigSchema = z.object({
  textProvider: z.enum(['gemini', 'groq', 'openrouter', 'localai']),
  textModel: z.string().min(1),
  imageProvider: z.enum(['huggingface', 'together', 'pollinations']),
  imageModel: z.string().min(1),
  // Auto mode: automatically select the best model based on task type
  autoModelSelection: z.boolean().default(true),
});

// TypeScript type inferred from schema
export type AIConfig = z.infer<typeof AIConfigSchema>;

/**
 * Get default configuration based on available providers
 */
export function getDefaultConfig(): AIConfig {
  const textProvider = getBestAvailableTextProvider();
  const imageProvider = getBestAvailableImageProvider();

  // Use the best free model for OpenRouter
  const textModel = textProvider === 'openrouter'
    ? 'google/gemini-2.5-flash:free'
    : TEXT_PROVIDERS[textProvider].models[0] ?? 'mistral';

  // Use FLUX for Hugging Face (best free image model)
  const imageModel = imageProvider === 'huggingface'
    ? 'black-forest-labs/FLUX.1-schnell'
    : IMAGE_PROVIDERS[imageProvider].models[0] ?? 'flux';

  return {
    textProvider,
    textModel,
    imageProvider,
    imageModel,
    autoModelSelection: true, // Enable auto mode by default
  };
}

/**
 * Get the current AI configuration from localStorage
 * Falls back to defaults if not set or invalid
 * Auto-resets if stored model no longer exists
 */
export function getAIConfig(): AIConfig {
  // Server-side or no localStorage available
  if (typeof window === 'undefined') {
    return getDefaultConfig();
  }

  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) {
      return getDefaultConfig();
    }

    const parsed = JSON.parse(stored) as unknown;
    const validated = AIConfigSchema.safeParse(parsed);

    if (validated.success) {
      const config = validated.data;

      // Validate that the stored model still exists
      const providerModels = TEXT_PROVIDERS[config.textProvider]?.models ?? [];
      const modelExists = providerModels.includes(config.textModel);

      if (!modelExists) {
        console.warn(`[AI Config] Stored model "${config.textModel}" no longer exists, resetting to defaults`);
        const defaults = getDefaultConfig();
        localStorage.setItem(CONFIG_KEY, JSON.stringify(defaults));
        return defaults;
      }

      return config;
    }

    // Invalid stored config, return defaults
    return getDefaultConfig();
  } catch {
    // JSON parse error or other issues
    return getDefaultConfig();
  }
}

/**
 * Save AI configuration to localStorage
 */
export function setAIConfig(config: AIConfig): void {
  // Server-side or no localStorage available
  if (typeof window === 'undefined') {
    return;
  }

  // Validate before saving
  const validated = AIConfigSchema.safeParse(config);
  if (!validated.success) {
    throw new Error(`Invalid AI config: ${validated.error.message}`);
  }

  localStorage.setItem(CONFIG_KEY, JSON.stringify(validated.data));

  // Dispatch custom event for components to react to config changes
  window.dispatchEvent(
    new CustomEvent('ai-config-changed', {
      detail: validated.data,
    })
  );
}

/**
 * Update partial AI configuration
 */
export function updateAIConfig(partial: Partial<AIConfig>): AIConfig {
  const current = getAIConfig();
  const updated = { ...current, ...partial };
  setAIConfig(updated);
  return updated;
}

/**
 * Reset AI configuration to defaults
 */
export function resetAIConfig(): AIConfig {
  const defaults = getDefaultConfig();
  setAIConfig(defaults);
  return defaults;
}

/**
 * Check if configuration is using defaults
 */
export function isUsingDefaultConfig(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  const stored = localStorage.getItem(CONFIG_KEY);
  return stored === null;
}

/**
 * React hook helper: subscribe to config changes
 * Returns cleanup function
 */
export function subscribeToConfigChanges(
  callback: (config: AIConfig) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<AIConfig>;
    callback(customEvent.detail);
  };

  window.addEventListener('ai-config-changed', handler);
  return () => window.removeEventListener('ai-config-changed', handler);
}
