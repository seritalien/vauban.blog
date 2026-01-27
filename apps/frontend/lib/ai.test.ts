import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkAIConnection,
  chatCompletion,
  performAIAction,
  customPrompt,
  parseTitleSuggestions,
  parseTagSuggestions,
  testProviderConnection,
  type ChatMessage,
} from './ai';

// Mock the dependencies
vi.mock('./ai-config', () => ({
  getAIConfig: vi.fn(() => ({
    textProvider: 'localai',
    textModel: 'mistral',
    imageProvider: 'pollinations',
    imageModel: 'flux',
  })),
}));

vi.mock('./ai-providers', () => ({
  TEXT_PROVIDERS: {
    gemini: {
      name: 'Google Gemini',
      models: ['gemini-2.0-flash'],
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      latency: '~150ms',
      free: '1000 req/jour',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_GEMINI_API_KEY',
      commercial: true,
    },
    groq: {
      name: 'Groq',
      models: ['llama-3.3-70b-versatile'],
      baseUrl: 'https://api.groq.com/openai/v1',
      latency: '<50ms',
      free: '500K tokens/jour',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_GROQ_API_KEY',
      commercial: false,
    },
    openrouter: {
      name: 'OpenRouter',
      models: ['google/gemini-2.5-flash-lite:free'],
      baseUrl: 'https://openrouter.ai/api/v1',
      latency: '~100-500ms',
      free: 'Illimité',
      requiresApiKey: true,
      apiKeyEnvVar: 'NEXT_PUBLIC_OPENROUTER_API_KEY',
      commercial: true,
    },
    localai: {
      name: 'LocalAI',
      models: ['phi-3-mini', 'gemma-2b', 'qwen2-1.5b', 'tinyllama', 'mistral', 'llama3-8b'],
      baseUrl: 'http://localhost:8081/v1',
      latency: '~2-30s',
      free: 'Illimité',
      requiresApiKey: false,
      apiKeyEnvVar: '',
      commercial: true,
    },
  },
  getTextProviderApiKey: vi.fn(() => null),
  isTextProviderAvailable: vi.fn(() => true),
  getBestModelForTask: vi.fn(() => Promise.resolve({ model: 'mistral', isOptimal: true })),
  getTaskTypeForAction: vi.fn(() => 'medium'),
  getOpenRouterModelForTask: vi.fn(() => 'google/gemini-2.5-flash-lite:free'),
  getAvailableFallbackProviders: vi.fn(() => []), // Return empty array to disable fallback in tests
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ai.ts', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkAIConnection', () => {
    it('returns true when AI service is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await checkAIConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/models'),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('returns false when AI service is unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await checkAIConnection();

      expect(result).toBe(false);
    });

    it('returns false when fetch throws an error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await checkAIConnection();

      expect(result).toBe(false);
    });
  });

  describe('chatCompletion', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' },
    ];

    const mockSuccessResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'mistral',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Hello! How can I help you?',
          },
          finish_reason: 'stop',
        },
      ],
    };

    it('returns success response with content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await chatCompletion(mockMessages);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Hello! How can I help you?');
        expect(result.provider).toBe('localai');
        expect(result.model).toBe('mistral');
      }
    });

    it('sends correct request body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await chatCompletion(mockMessages, {
        temperature: 0.5,
        maxTokens: 1024,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"model":"mistral"'),
        })
      );

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.temperature).toBe(0.5);
      expect(body.max_tokens).toBe(1024);
    });

    it('returns API error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const result = await chatCompletion(mockMessages);

      expect(result).toEqual({
        success: false,
        error: 'Erreur serveur IA (500): Internal Server Error. Réessayez.',
        code: 'API_ERROR',
      });
    });

    it('returns validation error for invalid response format', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ invalid: 'response' }),
      });

      const result = await chatCompletion(mockMessages);

      expect(result).toEqual({
        success: false,
        error: 'No content in API response. Check console for details.',
        code: 'VALIDATION_ERROR',
      });
    });

    it('returns validation error when no content in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockSuccessResponse,
            choices: [],
          }),
      });

      const result = await chatCompletion(mockMessages);

      expect(result).toEqual({
        success: false,
        error: 'No content in API response. Check console for details.',
        code: 'VALIDATION_ERROR',
      });
    });

    it('returns network error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await chatCompletion(mockMessages);

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
        code: 'NETWORK_ERROR',
      });
    });

    it('handles abort signal', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await chatCompletion(mockMessages);

      expect(result).toEqual({
        success: false,
        error: 'Request timed out',
        code: 'TIMEOUT',
      });
    });
  });

  describe('performAIAction', () => {
    const mockSuccessResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'mistral',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Improved text here.',
          },
          finish_reason: 'stop',
        },
      ],
    };

    it('performs improve action with correct system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await performAIAction('improve', 'Some text to improve');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('Improved text here.');
      }

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('Améliore');
      expect(body.messages[1].content).toBe('Some text to improve');
    });

    it('performs translate_en action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockSuccessResponse,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'Hello world' },
                finish_reason: 'stop',
              },
            ],
          }),
      });

      const result = await performAIAction('translate_en', 'Bonjour le monde');

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].content).toContain('anglais');
    });

    it('performs suggest_title action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockSuccessResponse,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '1. Title One\n2. Title Two\n3. Title Three',
                },
                finish_reason: 'stop',
              },
            ],
          }),
      });

      const result = await performAIAction(
        'suggest_title',
        'Article content about AI'
      );

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].content).toContain('titres');
    });
  });

  describe('customPrompt', () => {
    const mockSuccessResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'mistral',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: 'Custom response here.',
          },
          finish_reason: 'stop',
        },
      ],
    };

    it('sends custom prompt with context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const result = await customPrompt('Make this funnier', 'Serious text');

      expect(result.success).toBe(true);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[1].content).toContain('Serious text');
      expect(body.messages[1].content).toContain('Make this funnier');
    });

    it('sends custom prompt without context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      await customPrompt('What is AI?', '');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[1].content).toBe('What is AI?');
    });
  });

  describe('testProviderConnection', () => {
    it('returns connected with latency on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await testProviderConnection('localai');

      expect(result.connected).toBe(true);
      expect(result.latencyMs).toBeDefined();
      expect(typeof result.latencyMs).toBe('number');
    });

    it('returns not connected with error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const result = await testProviderConnection('localai');

      expect(result.connected).toBe(false);
    });
  });

  describe('parseTitleSuggestions', () => {
    it('parses numbered list of titles', () => {
      const response = `1. First Title Here
2. Second Title Here
3. Third Title Here`;

      const titles = parseTitleSuggestions(response);

      expect(titles).toEqual([
        'First Title Here',
        'Second Title Here',
        'Third Title Here',
      ]);
    });

    it('parses titles with different formats', () => {
      const response = `1) Title One
- Title Two
Title Three`;

      const titles = parseTitleSuggestions(response);

      expect(titles).toEqual(['Title One', 'Title Two', 'Title Three']);
    });

    it('filters out meta-text', () => {
      const response = `Voici trois suggestions de titres:
1. Real Title One
2. Un autre titre
3. Final Title`;

      const titles = parseTitleSuggestions(response);

      // Should filter out lines containing "voici" or "titre" meta-text
      expect(titles).toContain('Real Title One');
      expect(titles).toContain('Final Title');
    });

    it('limits to 5 suggestions', () => {
      const response = `1. Title 1
2. Title 2
3. Title 3
4. Title 4
5. Title 5
6. Title 6
7. Title 7`;

      const titles = parseTitleSuggestions(response);

      expect(titles).toHaveLength(5);
    });

    it('handles empty response', () => {
      const titles = parseTitleSuggestions('');
      expect(titles).toEqual([]);
    });
  });

  describe('parseTagSuggestions', () => {
    it('parses comma-separated tags', () => {
      const response = 'javascript, react, typescript, web3, blockchain';

      const tags = parseTagSuggestions(response);

      expect(tags).toEqual([
        'javascript',
        'react',
        'typescript',
        'web3',
        'blockchain',
      ]);
    });

    it('cleans up whitespace and converts to lowercase', () => {
      const response = '  JavaScript ,  React , TypeScript  ';

      const tags = parseTagSuggestions(response);

      expect(tags).toEqual(['javascript', 'react', 'typescript']);
    });

    it('filters out empty tags', () => {
      const response = 'tag1, , tag2,  , tag3';

      const tags = parseTagSuggestions(response);

      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('filters out tags that are too long', () => {
      const longTag = 'a'.repeat(35);
      const response = `short, ${longTag}, medium`;

      const tags = parseTagSuggestions(response);

      expect(tags).toEqual(['short', 'medium']);
    });

    it('limits to 10 tags', () => {
      const response = Array(15)
        .fill(null)
        .map((_, i) => `tag${i}`)
        .join(', ');

      const tags = parseTagSuggestions(response);

      expect(tags).toHaveLength(10);
    });

    it('handles empty response', () => {
      const tags = parseTagSuggestions('');
      expect(tags).toEqual([]);
    });
  });
});
