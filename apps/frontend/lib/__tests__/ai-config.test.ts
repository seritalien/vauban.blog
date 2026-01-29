import { describe, it, expect, vi } from 'vitest';

// Mock ai-providers before importing ai-config
vi.mock('../ai-providers', () => ({
  TEXT_PROVIDERS: {
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
      name: 'Groq',
      models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
      baseUrl: 'https://api.groq.com/openai/v1',
      latency: '<50ms',
      free: '500K tokens/jour',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_GROQ_API_KEY',
      commercial: false,
    },
    openrouter: {
      name: 'OpenRouter',
      models: [
        'google/gemini-2.5-flash:free',
        'meta-llama/llama-3.3-70b-instruct:free',
      ],
      baseUrl: 'https://openrouter.ai/api/v1',
      latency: '~100-500ms',
      free: '100% gratuit',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_OPENROUTER_API_KEY',
      commercial: true,
    },
    localai: {
      name: 'LocalAI',
      models: ['qwen2-1.5b', 'mistral'],
      baseUrl: 'http://localhost:8081/v1',
      latency: '~3-30s',
      free: 'Illimite',
      requiresApiKey: false,
      apiKeyEnvVar: '',
      commercial: true,
    },
  },
  IMAGE_PROVIDERS: {
    huggingface: {
      name: 'Hugging Face',
      models: ['black-forest-labs/FLUX.1-schnell'],
      baseUrl: 'https://router.huggingface.co/hf-inference/models',
      latency: '~3-15s',
      free: '100% gratuit',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_HUGGINGFACE_API_KEY',
      commercial: true,
    },
    together: {
      name: 'Together AI',
      models: ['black-forest-labs/FLUX.1-schnell'],
      baseUrl: 'https://api.together.xyz/v1',
      latency: '1.5-2s',
      free: '$1 credit',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_TOGETHER_API_KEY',
      commercial: true,
    },
    pollinations: {
      name: 'Pollinations',
      models: ['flux'],
      baseUrl: 'https://image.pollinations.ai',
      latency: '3-8s',
      free: 'Inscription requise',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_POLLINATIONS_API_KEY',
      commercial: true,
    },
  },
  getBestAvailableTextProvider: vi.fn(() => 'localai'),
  getBestAvailableImageProvider: vi.fn(() => 'huggingface'),
}));

import {
  getDefaultConfig,
  getAIConfig,
  setAIConfig,
  updateAIConfig,
  resetAIConfig,
  isUsingDefaultConfig,
  subscribeToConfigChanges,
  type AIConfig,
} from '../ai-config';

const STORAGE_KEY = 'vauban_ai_config';

// =============================================================================
// getDefaultConfig
// =============================================================================

describe('getDefaultConfig', () => {
  it('returns a valid config with expected shape', () => {
    const config = getDefaultConfig();

    expect(config).toHaveProperty('textProvider');
    expect(config).toHaveProperty('textModel');
    expect(config).toHaveProperty('imageProvider');
    expect(config).toHaveProperty('imageModel');
    expect(config).toHaveProperty('autoModelSelection');
  });

  it('returns localai as text provider (from mock getBestAvailableTextProvider)', () => {
    const config = getDefaultConfig();

    expect(config.textProvider).toBe('localai');
  });

  it('returns huggingface as image provider (from mock getBestAvailableImageProvider)', () => {
    const config = getDefaultConfig();

    expect(config.imageProvider).toBe('huggingface');
    expect(config.imageModel).toBe('black-forest-labs/FLUX.1-schnell');
  });

  it('enables autoModelSelection by default', () => {
    const config = getDefaultConfig();

    expect(config.autoModelSelection).toBe(true);
  });
});

// =============================================================================
// getAIConfig
// =============================================================================

describe('getAIConfig', () => {
  it('returns defaults when localStorage is empty', () => {
    const config = getAIConfig();
    const defaults = getDefaultConfig();

    expect(config).toEqual(defaults);
  });

  it('returns stored config when valid', () => {
    const storedConfig: AIConfig = {
      textProvider: 'localai',
      textModel: 'qwen2-1.5b',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedConfig));

    const config = getAIConfig();

    expect(config.textProvider).toBe('localai');
    expect(config.textModel).toBe('qwen2-1.5b');
    expect(config.autoModelSelection).toBe(false);
  });

  it('falls back to defaults for invalid stored config', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ invalid: true }));

    const config = getAIConfig();
    const defaults = getDefaultConfig();

    expect(config).toEqual(defaults);
  });

  it('falls back to defaults for malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not valid json{{{');

    const config = getAIConfig();
    const defaults = getDefaultConfig();

    expect(config).toEqual(defaults);
  });

  it('resets to defaults when stored model no longer exists in provider', () => {
    const storedConfig: AIConfig = {
      textProvider: 'localai',
      textModel: 'non-existent-model',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedConfig));

    const config = getAIConfig();
    const defaults = getDefaultConfig();

    // Should fall back to defaults because model doesn't exist
    expect(config).toEqual(defaults);
  });
});

// =============================================================================
// setAIConfig
// =============================================================================

describe('setAIConfig', () => {
  it('stores valid config in localStorage', () => {
    const config: AIConfig = {
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    };

    setAIConfig(config);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.textProvider).toBe('localai');
    expect(stored.textModel).toBe('mistral');
  });

  it('throws for invalid config', () => {
    const invalidConfig = {
      textProvider: 'invalid_provider',
      textModel: '',
      imageProvider: 'huggingface',
      imageModel: 'model',
      autoModelSelection: true,
    } as unknown as AIConfig;

    expect(() => setAIConfig(invalidConfig)).toThrow();
  });

  it('dispatches ai-config-changed custom event', () => {
    const config: AIConfig = {
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    };

    setAIConfig(config);

    expect(window.dispatchEvent).toHaveBeenCalled();
  });
});

// =============================================================================
// updateAIConfig
// =============================================================================

describe('updateAIConfig', () => {
  it('merges partial config with current config', () => {
    // Set initial config
    const initial: AIConfig = {
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    };
    setAIConfig(initial);

    // Update only autoModelSelection
    const updated = updateAIConfig({ autoModelSelection: false });

    expect(updated.textProvider).toBe('localai');
    expect(updated.textModel).toBe('mistral');
    expect(updated.autoModelSelection).toBe(false);
  });

  it('returns the updated config', () => {
    const result = updateAIConfig({ autoModelSelection: false });

    expect(result).toHaveProperty('textProvider');
    expect(result).toHaveProperty('textModel');
    expect(result).toHaveProperty('imageProvider');
    expect(result).toHaveProperty('imageModel');
    expect(result.autoModelSelection).toBe(false);
  });
});

// =============================================================================
// resetAIConfig
// =============================================================================

describe('resetAIConfig', () => {
  it('clears to defaults', () => {
    // Set a custom config first
    setAIConfig({
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: false,
    });

    const result = resetAIConfig();
    const defaults = getDefaultConfig();

    expect(result).toEqual(defaults);
  });

  it('stored config matches defaults after reset', () => {
    setAIConfig({
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: false,
    });

    resetAIConfig();

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    const defaults = getDefaultConfig();
    expect(stored.textProvider).toBe(defaults.textProvider);
    expect(stored.autoModelSelection).toBe(defaults.autoModelSelection);
  });
});

// =============================================================================
// isUsingDefaultConfig
// =============================================================================

describe('isUsingDefaultConfig', () => {
  it('returns true when no stored config exists', () => {
    expect(isUsingDefaultConfig()).toBe(true);
  });

  it('returns false after setAIConfig', () => {
    setAIConfig({
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    });

    expect(isUsingDefaultConfig()).toBe(false);
  });
});

// =============================================================================
// subscribeToConfigChanges
// =============================================================================

describe('subscribeToConfigChanges', () => {
  it('fires callback on config change via setAIConfig', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToConfigChanges(callback);

    const config: AIConfig = {
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    };
    setAIConfig(config);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ textProvider: 'localai' })
    );

    unsubscribe();
  });

  it('does not fire callback after unsubscribe', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToConfigChanges(callback);

    unsubscribe();

    setAIConfig({
      textProvider: 'localai',
      textModel: 'mistral',
      imageProvider: 'huggingface',
      imageModel: 'black-forest-labs/FLUX.1-schnell',
      autoModelSelection: true,
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('returns a cleanup function', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeToConfigChanges(callback);

    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
  });
});
