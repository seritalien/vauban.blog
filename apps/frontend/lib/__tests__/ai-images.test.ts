import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../ai-providers', () => ({
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
  getImageProviderApiKey: vi.fn(),
  isImageProviderAvailable: vi.fn(),
}));

vi.mock('../ai-config', () => ({
  getAIConfig: vi.fn(() => ({
    textProvider: 'localai',
    textModel: 'mistral',
    imageProvider: 'huggingface',
    imageModel: 'black-forest-labs/FLUX.1-schnell',
  })),
}));

import { generateImage, generateCoverImage, testImageGeneration } from '../ai-images';
import { getImageProviderApiKey, isImageProviderAvailable } from '../ai-providers';
import { getAIConfig } from '../ai-config';

const mockGetImageProviderApiKey = vi.mocked(getImageProviderApiKey);
const mockIsImageProviderAvailable = vi.mocked(isImageProviderAvailable);
const mockGetAIConfig = vi.mocked(getAIConfig);

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/test-blob-url');
global.URL.createObjectURL = mockCreateObjectURL;

describe('ai-images.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockIsImageProviderAvailable.mockReturnValue(true);
    mockGetImageProviderApiKey.mockReturnValue('test-api-key');

    // Suppress console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateImage', () => {
    it('generates image via proxy and returns JSON URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/image.png' }),
      });

      const result = await generateImage('a beautiful sunset');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.url).toBe('https://example.com/image.png');
        expect(result.provider).toBe('huggingface');
      }
    });

    it('generates image via proxy and returns blob URL', async () => {
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await generateImage('a beautiful sunset');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.url).toBe('blob:http://localhost/test-blob-url');
      }
    });

    it('uses specified provider', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/image.png' }),
      });

      const result = await generateImage('a sunset', { provider: 'together' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('together');
      }
    });

    it('uses config provider when none specified', async () => {
      mockGetAIConfig.mockReturnValueOnce({
        textProvider: 'localai',
        textModel: 'mistral',
        imageProvider: 'huggingface',
        imageModel: 'custom-model',
        autoModelSelection: true,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/image.png' }),
      });

      await generateImage('a sunset');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.provider).toBe('huggingface');
    });

    it('returns API error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const result = await generateImage('a sunset');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('API_ERROR');
        expect(result.error).toContain('Server error');
      }
    });

    it('returns API error with fallback message on invalid JSON error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await generateImage('a sunset');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('API_ERROR');
      }
    });

    it('returns TIMEOUT error on abort', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await generateImage('a sunset');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('TIMEOUT');
        expect(result.error).toBe('Request timed out');
      }
    });

    it('returns NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await generateImage('a sunset');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NETWORK_ERROR');
        expect(result.error).toBe('Network error');
      }
    });

    it('returns NO_PROVIDER when huggingface API key is missing', async () => {
      mockGetImageProviderApiKey.mockReturnValue(null);
      mockIsImageProviderAvailable.mockReturnValue(false);

      const result = await generateImage('a sunset');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NO_PROVIDER');
      }
    });

    it('falls back to available provider when primary is not available', async () => {
      mockIsImageProviderAvailable.mockImplementation((provider) => {
        return provider === 'together';
      });
      mockGetImageProviderApiKey.mockImplementation((provider) => {
        if (provider === 'together') return 'key-123';
        return null;
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/image.png' }),
      });

      const result = await generateImage('a sunset');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('together');
      }
    });

    it('returns NO_PROVIDER when no fallback is available', async () => {
      mockIsImageProviderAvailable.mockReturnValue(false);

      const result = await generateImage('a sunset');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NO_PROVIDER');
      }
    });

    it('sends correct request body with defaults', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/image.png' }),
      });

      await generateImage('test prompt');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.prompt).toBe('test prompt');
      expect(callBody.width).toBe(1024);
      expect(callBody.height).toBe(768);
      expect(callBody.steps).toBe(4);
    });

    it('sends custom dimensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/image.png' }),
      });

      await generateImage('test prompt', { width: 512, height: 512 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.width).toBe(512);
      expect(callBody.height).toBe(512);
    });

    it('handles unknown provider gracefully', async () => {
      mockIsImageProviderAvailable.mockReturnValue(true);
      mockGetImageProviderApiKey.mockReturnValue(null);

      // Force unknown provider by mocking config
      mockGetAIConfig.mockReturnValueOnce({
        textProvider: 'localai',
        textModel: 'mistral',
        imageProvider: 'unknown' as 'huggingface',
        imageModel: 'model',
        autoModelSelection: true,
      });

      const result = await generateImage('test');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('NO_PROVIDER');
      }
    });
  });

  describe('generateCoverImage', () => {
    it('generates cover image with article metadata', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/cover.png' }),
      });

      const result = await generateCoverImage('My Article Title', 'Article content here');

      expect(result.success).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.prompt).toContain('My Article Title');
      expect(callBody.prompt).toContain('Article content');
      expect(callBody.width).toBe(1200);
      expect(callBody.height).toBe(630);
    });

    it('truncates long content in prompt', async () => {
      const longContent = 'x'.repeat(1000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/cover.png' }),
      });

      await generateCoverImage('Title', longContent);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      // Prompt should contain truncated content (first 500 chars)
      expect(callBody.prompt.length).toBeLessThan(longContent.length + 200);
    });

    it('strips markdown from content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/cover.png' }),
      });

      await generateCoverImage('Title', '# Header **bold** `code` [link](url)');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.prompt).not.toContain('#');
      expect(callBody.prompt).not.toContain('**');
      expect(callBody.prompt).not.toContain('`');
    });

    it('allows custom dimensions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/cover.png' }),
      });

      await generateCoverImage('Title', 'Content', { width: 800, height: 400 });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.width).toBe(800);
      expect(callBody.height).toBe(400);
    });
  });

  describe('testImageGeneration', () => {
    it('generates test image with default settings', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/test.png' }),
      });

      const result = await testImageGeneration();

      expect(result.success).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.width).toBe(512);
      expect(callBody.height).toBe(512);
      expect(callBody.prompt).toContain('abstract geometric');
    });

    it('uses specified provider for testing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ url: 'https://example.com/test.png' }),
      });

      const result = await testImageGeneration('together');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('together');
      }
    });
  });
});
