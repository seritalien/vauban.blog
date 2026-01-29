import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TEXT_PROVIDERS,
  IMAGE_PROVIDERS,
  LOCALAI_MODELS_METADATA,
  MODEL_PRIORITY_BY_TASK,
  ACTION_TASK_TYPE,
  OPENROUTER_MODEL_BY_TASK,
  OPENROUTER_FREE_FALLBACKS,
  PROVIDER_FALLBACK_CHAIN,
  getTextProviderApiKey,
  getImageProviderApiKey,
  isTextProviderAvailable,
  isImageProviderAvailable,
  getAvailableTextProviders,
  getAvailableImageProviders,
  getBestAvailableTextProvider,
  getBestAvailableImageProvider,
  fetchInstalledLocalAIModels,
  getLocalAIModelsWithStatus,
  clearLocalAIModelsCache,
  getBestModelForTask,
  getTaskTypeForAction,
  getOpenRouterModelForTask,
  getAvailableFallbackProviders,
  type TextProvider,
  type AITaskType,
} from '../ai-providers';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ai-providers.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    clearLocalAIModelsCache();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('constants and configurations', () => {
    it('defines all text providers', () => {
      expect(TEXT_PROVIDERS).toHaveProperty('gemini');
      expect(TEXT_PROVIDERS).toHaveProperty('groq');
      expect(TEXT_PROVIDERS).toHaveProperty('openrouter');
      expect(TEXT_PROVIDERS).toHaveProperty('localai');
    });

    it('defines all image providers', () => {
      expect(IMAGE_PROVIDERS).toHaveProperty('huggingface');
      expect(IMAGE_PROVIDERS).toHaveProperty('together');
      expect(IMAGE_PROVIDERS).toHaveProperty('pollinations');
    });

    it('defines LocalAI models metadata', () => {
      expect(LOCALAI_MODELS_METADATA).toHaveProperty('mistral');
      expect(LOCALAI_MODELS_METADATA['mistral']).toHaveProperty('name');
      expect(LOCALAI_MODELS_METADATA['mistral']).toHaveProperty('size');
      expect(LOCALAI_MODELS_METADATA['mistral']).toHaveProperty('speed');
      expect(LOCALAI_MODELS_METADATA['mistral']).toHaveProperty('quality');
    });

    it('defines model priority for all task types', () => {
      expect(MODEL_PRIORITY_BY_TASK).toHaveProperty('light');
      expect(MODEL_PRIORITY_BY_TASK).toHaveProperty('medium');
      expect(MODEL_PRIORITY_BY_TASK).toHaveProperty('heavy');
      expect(MODEL_PRIORITY_BY_TASK.light.length).toBeGreaterThan(0);
    });

    it('defines action-to-task-type mapping', () => {
      expect(ACTION_TASK_TYPE['suggest_title']).toBe('light');
      expect(ACTION_TASK_TYPE['improve']).toBe('medium');
      expect(ACTION_TASK_TYPE['expand']).toBe('heavy');
    });

    it('all OpenRouter models end with :free', () => {
      for (const model of OPENROUTER_FREE_FALLBACKS) {
        expect(model).toMatch(/:free$/);
      }
    });

    it('defines fallback chains for all providers', () => {
      const providers: TextProvider[] = ['gemini', 'groq', 'openrouter', 'localai'];
      for (const p of providers) {
        expect(PROVIDER_FALLBACK_CHAIN[p]).toBeDefined();
        expect(PROVIDER_FALLBACK_CHAIN[p].length).toBeGreaterThan(0);
      }
    });

    it('text providers have required config fields', () => {
      for (const provider of Object.values(TEXT_PROVIDERS)) {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('models');
        expect(provider).toHaveProperty('baseUrl');
        expect(provider).toHaveProperty('requiresApiKey');
        expect(provider.models.length).toBeGreaterThan(0);
      }
    });

    it('image providers have required config fields', () => {
      for (const provider of Object.values(IMAGE_PROVIDERS)) {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('models');
        expect(provider).toHaveProperty('baseUrl');
        expect(provider).toHaveProperty('requiresApiKey');
        expect(provider.models.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTextProviderApiKey', () => {
    it('returns null for localai (no key required)', () => {
      expect(getTextProviderApiKey('localai')).toBeNull();
    });

    it('returns gemini API key when set', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'gemini-key-123';
      expect(getTextProviderApiKey('gemini')).toBe('gemini-key-123');
    });

    it('returns groq API key when set', () => {
      process.env.NEXT_PUBLIC_GROQ_API_KEY = 'groq-key-123';
      expect(getTextProviderApiKey('groq')).toBe('groq-key-123');
    });

    it('returns openrouter API key when set', () => {
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = 'or-key-123';
      expect(getTextProviderApiKey('openrouter')).toBe('or-key-123');
    });

    it('returns null when API key is not set', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      expect(getTextProviderApiKey('gemini')).toBeNull();
    });
  });

  describe('getImageProviderApiKey', () => {
    it('returns huggingface API key when set', () => {
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY = 'hf-key-123';
      expect(getImageProviderApiKey('huggingface')).toBe('hf-key-123');
    });

    it('returns together API key when set', () => {
      process.env.NEXT_PUBLIC_TOGETHER_API_KEY = 'together-key-123';
      expect(getImageProviderApiKey('together')).toBe('together-key-123');
    });

    it('returns pollinations API key when set', () => {
      process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY = 'poll-key-123';
      expect(getImageProviderApiKey('pollinations')).toBe('poll-key-123');
    });

    it('returns null when API key is not set', () => {
      delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
      expect(getImageProviderApiKey('huggingface')).toBeNull();
    });
  });

  describe('isTextProviderAvailable', () => {
    it('returns true for localai (no key required)', () => {
      expect(isTextProviderAvailable('localai')).toBe(true);
    });

    it('returns true when API key is configured', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'key-123';
      expect(isTextProviderAvailable('gemini')).toBe(true);
    });

    it('returns false when API key is missing', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      expect(isTextProviderAvailable('gemini')).toBe(false);
    });

    it('returns false when API key is empty string', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = '';
      expect(isTextProviderAvailable('gemini')).toBe(false);
    });
  });

  describe('isImageProviderAvailable', () => {
    it('returns true when API key is configured', () => {
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY = 'key-123';
      expect(isImageProviderAvailable('huggingface')).toBe(true);
    });

    it('returns false when API key is missing', () => {
      delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
      expect(isImageProviderAvailable('huggingface')).toBe(false);
    });
  });

  describe('getAvailableTextProviders', () => {
    it('includes localai (always available)', () => {
      const available = getAvailableTextProviders();
      expect(available).toContain('localai');
    });

    it('includes providers with configured API keys', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'key-123';
      const available = getAvailableTextProviders();
      expect(available).toContain('gemini');
      expect(available).toContain('localai');
    });

    it('excludes providers without API keys', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      delete process.env.NEXT_PUBLIC_GROQ_API_KEY;
      delete process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
      const available = getAvailableTextProviders();
      expect(available).not.toContain('gemini');
      expect(available).not.toContain('groq');
      expect(available).not.toContain('openrouter');
    });
  });

  describe('getAvailableImageProviders', () => {
    it('includes providers with configured API keys', () => {
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY = 'key-123';
      const available = getAvailableImageProviders();
      expect(available).toContain('huggingface');
    });

    it('returns empty when no providers are configured', () => {
      delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
      delete process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
      delete process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY;
      const available = getAvailableImageProviders();
      expect(available).toHaveLength(0);
    });
  });

  describe('getBestAvailableTextProvider', () => {
    it('returns gemini as first priority when available', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'key-123';
      expect(getBestAvailableTextProvider()).toBe('gemini');
    });

    it('returns openrouter when gemini is not available', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = 'key-123';
      expect(getBestAvailableTextProvider()).toBe('openrouter');
    });

    it('returns groq when gemini and openrouter are not available', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      delete process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
      process.env.NEXT_PUBLIC_GROQ_API_KEY = 'key-123';
      expect(getBestAvailableTextProvider()).toBe('groq');
    });

    it('falls back to localai when no API keys are configured', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      delete process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
      delete process.env.NEXT_PUBLIC_GROQ_API_KEY;
      expect(getBestAvailableTextProvider()).toBe('localai');
    });
  });

  describe('getBestAvailableImageProvider', () => {
    it('returns huggingface as first priority when available', () => {
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY = 'key-123';
      expect(getBestAvailableImageProvider()).toBe('huggingface');
    });

    it('returns together when huggingface is not available', () => {
      delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
      process.env.NEXT_PUBLIC_TOGETHER_API_KEY = 'key-123';
      expect(getBestAvailableImageProvider()).toBe('together');
    });

    it('falls back to huggingface when no providers are available', () => {
      delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
      delete process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
      delete process.env.NEXT_PUBLIC_POLLINATIONS_API_KEY;
      expect(getBestAvailableImageProvider()).toBe('huggingface');
    });
  });

  describe('fetchInstalledLocalAIModels', () => {
    it('fetches models from LocalAI API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'mistral' },
            { id: 'qwen2-1.5b' },
          ],
        }),
      });

      const models = await fetchInstalledLocalAIModels();

      expect(models).toEqual(['mistral', 'qwen2-1.5b']);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/models'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('filters out embedding models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [
            { id: 'mistral' },
            { id: 'text-embedding' },
            { id: 'some-embed-model' },
          ],
        }),
      });

      const models = await fetchInstalledLocalAIModels();

      expect(models).toEqual(['mistral']);
    });

    it('returns cached result within TTL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });

      await fetchInstalledLocalAIModels();
      const models2 = await fetchInstalledLocalAIModels();

      expect(models2).toEqual(['mistral']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refreshes when forceRefresh is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });
      await fetchInstalledLocalAIModels();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }, { id: 'qwen2-1.5b' }],
        }),
      });
      const models = await fetchInstalledLocalAIModels(true);

      expect(models).toEqual(['mistral', 'qwen2-1.5b']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('returns empty array on API error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const models = await fetchInstalledLocalAIModels();

      expect(models).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('returns empty array on network error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const models = await fetchInstalledLocalAIModels();

      expect(models).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('returns cached result on subsequent API error', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });
      await fetchInstalledLocalAIModels();

      clearLocalAIModelsCache();

      // First force refresh to populate cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });
      await fetchInstalledLocalAIModels(true);

      // API fails but cache exists
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const models = await fetchInstalledLocalAIModels(true);

      expect(models).toEqual(['mistral']);
      consoleSpy.mockRestore();
    });

    it('handles empty data array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const models = await fetchInstalledLocalAIModels();
      expect(models).toEqual([]);
    });

    it('handles missing data field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const models = await fetchInstalledLocalAIModels();
      expect(models).toEqual([]);
    });
  });

  describe('getLocalAIModelsWithStatus', () => {
    it('returns all known models with install status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });

      const models = await getLocalAIModelsWithStatus();

      const mistral = models.find(m => m.id === 'mistral');
      expect(mistral?.installed).toBe(true);

      const tinyllama = models.find(m => m.id === 'tinyllama');
      expect(tinyllama?.installed).toBe(false);
    });

    it('includes unknown installed models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'custom-model' }],
        }),
      });

      const models = await getLocalAIModelsWithStatus();

      const custom = models.find(m => m.id === 'custom-model');
      expect(custom).toBeDefined();
      expect(custom?.installed).toBe(true);
      expect(custom?.name).toBe('custom-model');
    });

    it('sorts installed models first', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });

      const models = await getLocalAIModelsWithStatus();

      const firstInstalled = models.findIndex(m => m.installed);
      const lastInstalled = models.length - 1 - [...models].reverse().findIndex(m => m.installed);
      const firstNotInstalled = models.findIndex(m => !m.installed);

      if (firstInstalled !== -1 && firstNotInstalled !== -1) {
        expect(lastInstalled).toBeLessThan(firstNotInstalled);
      }
    });
  });

  describe('clearLocalAIModelsCache', () => {
    it('forces fresh fetch on next call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });
      await fetchInstalledLocalAIModels();

      clearLocalAIModelsCache();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'qwen2-1.5b' }],
        }),
      });
      const models = await fetchInstalledLocalAIModels();

      expect(models).toEqual(['qwen2-1.5b']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBestModelForTask', () => {
    it('returns optimal model for light task when available', async () => {
      const installed = ['qwen2-1.5b', 'mistral'];
      const result = await getBestModelForTask('light', installed);

      expect(result.model).toBe('qwen2-1.5b');
      expect(result.isOptimal).toBe(true);
    });

    it('returns non-optimal model when optimal is not installed', async () => {
      const installed = ['mistral'];
      const result = await getBestModelForTask('light', installed);

      expect(result.model).toBe('mistral');
      expect(result.isOptimal).toBe(false);
    });

    it('returns optimal model for heavy task', async () => {
      const installed = ['mistral', 'qwen2-1.5b'];
      const result = await getBestModelForTask('heavy', installed);

      expect(result.model).toBe('mistral');
      expect(result.isOptimal).toBe(true);
    });

    it('falls back to any installed model when none in priority list', async () => {
      const installed = ['custom-model'];
      const result = await getBestModelForTask('light', installed);

      expect(result.model).toBe('custom-model');
      expect(result.isOptimal).toBe(false);
    });

    it('returns ultimate fallback when no models installed', async () => {
      const installed: string[] = [];
      const result = await getBestModelForTask('light', installed);

      expect(result.model).toBe('qwen2-1.5b');
      expect(result.isOptimal).toBe(false);
    });

    it('fetches installed models if not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [{ id: 'mistral' }],
        }),
      });

      const result = await getBestModelForTask('medium');

      expect(result.model).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('getTaskTypeForAction', () => {
    it('returns light for suggest_title', () => {
      expect(getTaskTypeForAction('suggest_title')).toBe('light');
    });

    it('returns light for suggest_tags', () => {
      expect(getTaskTypeForAction('suggest_tags')).toBe('light');
    });

    it('returns medium for improve', () => {
      expect(getTaskTypeForAction('improve')).toBe('medium');
    });

    it('returns heavy for expand', () => {
      expect(getTaskTypeForAction('expand')).toBe('heavy');
    });

    it('returns heavy for translate_en', () => {
      expect(getTaskTypeForAction('translate_en')).toBe('heavy');
    });

    it('defaults to medium for unknown actions', () => {
      expect(getTaskTypeForAction('unknown_action')).toBe('medium');
    });
  });

  describe('getOpenRouterModelForTask', () => {
    it('returns model for light task', () => {
      const model = getOpenRouterModelForTask('light');
      expect(model).toBeDefined();
      expect(typeof model).toBe('string');
    });

    it('returns model for each task type', () => {
      const taskTypes: AITaskType[] = ['light', 'medium', 'heavy'];
      for (const taskType of taskTypes) {
        const model = getOpenRouterModelForTask(taskType);
        expect(model).toBeDefined();
        expect(model).toBe(OPENROUTER_MODEL_BY_TASK[taskType]);
      }
    });
  });

  describe('getAvailableFallbackProviders', () => {
    it('returns empty array when no fallback providers are available', () => {
      delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      delete process.env.NEXT_PUBLIC_GROQ_API_KEY;
      delete process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

      // localai is always available, so gemini fallback chain should include it
      const fallbacks = getAvailableFallbackProviders('gemini');
      expect(fallbacks).toContain('localai');
    });

    it('returns available fallback providers', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'key-123';
      process.env.NEXT_PUBLIC_GROQ_API_KEY = 'key-456';

      const fallbacks = getAvailableFallbackProviders('openrouter');
      expect(fallbacks).toContain('gemini');
      expect(fallbacks).toContain('groq');
    });

    it('does not include the original provider in fallbacks', () => {
      process.env.NEXT_PUBLIC_GEMINI_API_KEY = 'key-123';

      const fallbacks = getAvailableFallbackProviders('gemini');
      expect(fallbacks).not.toContain('gemini');
    });
  });
});
