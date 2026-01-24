/**
 * AI API Client - Multi-Provider Support
 *
 * Provides integration with multiple AI providers for text generation:
 * - Google Gemini (fast, 1000 req/day free)
 * - OpenRouter (18+ free models, commercial use allowed)
 * - Groq (fastest, 500K tokens/day free, test only)
 * - LocalAI (slow, unlimited, self-hosted)
 */

import { z } from 'zod';
import {
  type TextProvider,
  type AITaskType,
  TEXT_PROVIDERS,
  getTextProviderApiKey,
  getBestModelForTask,
  getTaskTypeForAction,
} from './ai-providers';
import { getAIConfig } from './ai-config';

// Schema for chat completion response (OpenAI-compatible)
const ChatCompletionMessageSchema = z.object({
  role: z.enum(['assistant', 'user', 'system']),
  content: z.string(),
});

const ChatCompletionChoiceSchema = z.object({
  index: z.number(),
  message: ChatCompletionMessageSchema,
  finish_reason: z.string().nullable(),
});

const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChatCompletionChoiceSchema),
});

// Gemini response schema
const GeminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string(),
          })
        ),
        role: z.string(),
      }),
      finishReason: z.string().optional(),
    })
  ),
});

// Types
export type ChatMessage = z.infer<typeof ChatCompletionMessageSchema>;
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

export interface AIRequestOptions {
  provider?: TextProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  // For automatic model selection
  taskType?: AITaskType;
  action?: string;
}

export interface AIResult<T> {
  success: true;
  data: T;
  provider: TextProvider;
  model: string;
  latencyMs?: number;
}

export interface AIError {
  success: false;
  error: string;
  code: 'NETWORK_ERROR' | 'API_ERROR' | 'VALIDATION_ERROR' | 'TIMEOUT' | 'NO_PROVIDER';
}

export type AIResponse<T> = AIResult<T> | AIError;

// Predefined system prompts for different AI actions
const SYSTEM_PROMPTS = {
  improve: `Tu es un assistant éditorial expert. Améliore le texte fourni en:
- Corrigeant les fautes d'orthographe et de grammaire
- Améliorant la clarté et la fluidité
- Conservant le ton et le style original
- Ne modifiant pas le sens

Réponds UNIQUEMENT avec le texte amélioré, sans explication.`,

  simplify: `Tu es un assistant éditorial expert. Simplifie le texte fourni en:
- Utilisant des mots plus simples
- Raccourcissant les phrases complexes
- Rendant le texte accessible à tous
- Conservant le message principal

Réponds UNIQUEMENT avec le texte simplifié, sans explication.`,

  expand: `Tu es un assistant éditorial expert. Développe le texte fourni en:
- Ajoutant des détails pertinents
- Développant les idées
- Ajoutant des exemples si approprié
- Gardant un style cohérent

Réponds UNIQUEMENT avec le texte développé, sans explication.`,

  translate_en: `Tu es un traducteur expert. Traduis le texte suivant en anglais:
- Utilise un anglais naturel et idiomatique
- Conserve le ton et le style
- Adapte les expressions culturelles

Réponds UNIQUEMENT avec la traduction, sans explication.`,

  translate_fr: `Tu es un traducteur expert. Traduis le texte suivant en français:
- Utilise un français naturel et idiomatique
- Conserve le ton et le style
- Adapte les expressions culturelles

Réponds UNIQUEMENT avec la traduction, sans explication.`,

  suggest_title: `Suggère 3 titres courts pour cet article de blog.
Format:
1. [titre clair]
2. [titre avec question]
3. [titre accrocheur]

Réponds UNIQUEMENT avec les 3 titres numérotés.`,

  suggest_tags: `Liste 5-8 tags pour cet article.
Règles: mots courts, minuscules, séparés par virgules.
Exemple: javascript, react, tutorial, web

Réponds UNIQUEMENT avec les tags séparés par virgules.`,

  suggest_excerpt: `Écris UN SEUL paragraphe de 2 phrases maximum pour résumer cet article.
C'est pour la meta description SEO (150 caractères max).

IMPORTANT: Ne pas réécrire l'article, juste un court résumé accrocheur.

Réponds UNIQUEMENT avec le résumé court.`,

  continue: `Tu es un assistant d'écriture expert. Continue le texte fourni de manière naturelle:
- Maintiens le style et le ton
- Développe les idées de manière logique
- Reste cohérent avec le contexte

Réponds UNIQUEMENT avec la continuation, sans inclure le texte original.`,

  fix_grammar: `Tu es un correcteur orthographique et grammatical expert.
Corrige uniquement les fautes d'orthographe et de grammaire sans modifier le style ni le sens.

Réponds UNIQUEMENT avec le texte corrigé, sans explication.`,
};

export type AIAction = keyof typeof SYSTEM_PROMPTS;

/**
 * Get the current provider and model from config
 * Returns null for apiKey if provider requires one but it's not configured
 * Supports automatic model selection for LocalAI based on task type
 */
async function getProviderConfig(options: AIRequestOptions): Promise<{
  provider: TextProvider;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  missingApiKey: boolean;
  autoSelected: boolean;
}> {
  let provider = options.provider;
  let model = options.model;
  let autoSelected = false;

  // If not specified, use config (respect admin's choice)
  if (!provider) {
    const config = getAIConfig();
    provider = config.textProvider;

    // Automatic model selection for LocalAI
    if (provider === 'localai' && config.autoModelSelection && !model) {
      // Determine task type from action or explicit taskType
      const taskType = options.taskType ?? (options.action ? getTaskTypeForAction(options.action) : 'medium');
      const bestModel = await getBestModelForTask(taskType);
      model = bestModel.model;
      autoSelected = true;
    } else {
      model = model ?? config.textModel;
    }
  }

  const providerConfig = TEXT_PROVIDERS[provider];
  const apiKey = getTextProviderApiKey(provider);
  const missingApiKey = providerConfig.requiresApiKey && !apiKey;

  model = model ?? providerConfig.models[0] ?? 'qwen2-1.5b';

  return {
    provider,
    model,
    apiKey,
    baseUrl: providerConfig.baseUrl,
    missingApiKey,
    autoSelected,
  };
}

/**
 * Check if the AI service is available
 */
export async function checkAIConnection(provider?: TextProvider): Promise<boolean> {
  const config = await getProviderConfig({ provider });

  try {
    switch (config.provider) {
      case 'gemini': {
        // Gemini: check by listing models
        const response = await fetch(
          `${config.baseUrl}/models?key=${config.apiKey}`,
          {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          }
        );
        return response.ok;
      }
      case 'groq': {
        // Groq: OpenAI-compatible /models endpoint
        const response = await fetch(`${config.baseUrl}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      }
      case 'openrouter': {
        // OpenRouter: OpenAI-compatible /models endpoint
        const response = await fetch(`${config.baseUrl}/models`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://vauban.blog',
            'X-Title': 'Vauban Blog',
          },
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      }
      case 'localai':
      default: {
        // LocalAI: use /v1/models endpoint
        const response = await fetch(`${config.baseUrl}/models`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        return response.ok;
      }
    }
  } catch {
    return false;
  }
}

/**
 * Send chat completion to Gemini
 */
async function chatCompletionGemini(
  messages: ChatMessage[],
  options: AIRequestOptions & { apiKey: string; model: string }
): Promise<AIResponse<string>> {
  const startTime = Date.now();

  try {
    // Convert messages to Gemini format
    const systemInstruction = messages.find((m) => m.role === 'system')?.content;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${options.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          generationConfig: {
            temperature: options.temperature ?? 0.7,
            maxOutputTokens: options.maxTokens ?? 2048,
          },
        }),
        signal: options.signal ?? AbortSignal.timeout(30000),
      }
    );

    if (!response.ok) {
      // Handle rate limit specifically
      if (response.status === 429) {
        return {
          success: false,
          error: 'Quota Gemini épuisée. Changez de provider (LocalAI) dans les paramètres ou réessayez dans 1 minute.',
          code: 'API_ERROR',
        };
      }

      return {
        success: false,
        error: `Erreur Gemini (${response.status}). Essayez LocalAI dans les paramètres.`,
        code: 'API_ERROR',
      };
    }

    const data = await response.json();
    const parsed = GeminiResponseSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid Gemini response: ${parsed.error.message}`,
        code: 'VALIDATION_ERROR',
      };
    }

    const content = parsed.data.candidates[0]?.content.parts[0]?.text;
    if (content === undefined) {
      return {
        success: false,
        error: 'No content in Gemini response',
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: true,
      data: content,
      provider: 'gemini',
      model: options.model,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out', code: 'TIMEOUT' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Send chat completion to OpenAI-compatible API (Groq, OpenRouter, LocalAI)
 */
async function chatCompletionOpenAI(
  messages: ChatMessage[],
  options: AIRequestOptions & {
    provider: TextProvider;
    apiKey: string | null;
    baseUrl: string;
    model: string;
  }
): Promise<AIResponse<string>> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.apiKey) {
      headers['Authorization'] = `Bearer ${options.apiKey}`;
    }

    // OpenRouter requires additional headers
    if (options.provider === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://vauban.blog';
      headers['X-Title'] = 'Vauban Blog';
    }

    const response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
      }),
      signal: options.signal ?? AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText}`,
        code: 'API_ERROR',
      };
    }

    const data = await response.json();
    const parsed = ChatCompletionResponseSchema.safeParse(data);

    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid response format: ${parsed.error.message}`,
        code: 'VALIDATION_ERROR',
      };
    }

    const content = parsed.data.choices[0]?.message.content;
    if (content === undefined) {
      return {
        success: false,
        error: 'No content in response',
        code: 'VALIDATION_ERROR',
      };
    }

    return {
      success: true,
      data: content,
      provider: options.provider,
      model: options.model,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request timed out', code: 'TIMEOUT' };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Send a chat completion request to the configured AI provider
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: AIRequestOptions = {}
): Promise<AIResponse<string>> {
  const config = await getProviderConfig(options);

  switch (config.provider) {
    case 'gemini':
      if (!config.apiKey) {
        return {
          success: false,
          error: 'Clé API Gemini non configurée. Ajoutez NEXT_PUBLIC_GEMINI_API_KEY ou changez de provider.',
          code: 'NO_PROVIDER',
        };
      }
      return chatCompletionGemini(messages, {
        ...options,
        apiKey: config.apiKey,
        model: config.model,
      });

    case 'groq':
      if (!config.apiKey) {
        return {
          success: false,
          error: 'Clé API Groq non configurée. Ajoutez NEXT_PUBLIC_GROQ_API_KEY ou changez de provider.',
          code: 'NO_PROVIDER',
        };
      }
      return chatCompletionOpenAI(messages, {
        ...options,
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

    case 'openrouter':
      if (!config.apiKey) {
        return {
          success: false,
          error: 'Clé API OpenRouter non configurée. Ajoutez NEXT_PUBLIC_OPENROUTER_API_KEY (inscription gratuite sur openrouter.ai)',
          code: 'NO_PROVIDER',
        };
      }
      return chatCompletionOpenAI(messages, {
        ...options,
        provider: config.provider,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });

    case 'localai':
    default:
      return chatCompletionOpenAI(messages, {
        ...options,
        provider: 'localai',
        apiKey: null,
        baseUrl: config.baseUrl,
        model: config.model,
      });
  }
}

/**
 * Perform an AI action on the given text
 * Automatically selects the best model based on action type if autoModelSelection is enabled
 */
export async function performAIAction(
  action: AIAction,
  text: string,
  options: AIRequestOptions = {}
): Promise<AIResponse<string>> {
  const systemPrompt = SYSTEM_PROMPTS[action];

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text },
  ];

  // Pass action for automatic model selection
  return chatCompletion(messages, { ...options, action });
}

/**
 * Custom prompt - for free-form AI requests
 */
export async function customPrompt(
  userPrompt: string,
  context: string,
  options: AIRequestOptions = {}
): Promise<AIResponse<string>> {
  const systemPrompt = `Tu es un assistant éditorial expert pour un blog tech.
Tu aides à la rédaction, correction et amélioration d'articles.
Réponds de manière concise et directe.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: context
        ? `Contexte (texte sélectionné ou article):\n---\n${context}\n---\n\nDemande: ${userPrompt}`
        : userPrompt,
    },
  ];

  return chatCompletion(messages, options);
}

/**
 * Parse title suggestions from AI response
 */
export function parseTitleSuggestions(response: string): string[] {
  const lines = response.split('\n').filter((line) => line.trim());
  const titles: string[] = [];

  for (const line of lines) {
    // Match patterns like "1. Title" or "- Title" or just plain text
    const match = line.match(/^(?:\d+[\.\)]\s*|\-\s*)?(.+)/);
    if (match?.[1]) {
      const title = match[1].trim();
      // Exclude meta-text
      if (
        title.length > 0 &&
        !title.toLowerCase().includes('voici') &&
        !title.toLowerCase().includes('titre')
      ) {
        titles.push(title);
      }
    }
  }

  return titles.slice(0, 5); // Max 5 suggestions
}

/**
 * Parse tag suggestions from AI response
 */
export function parseTagSuggestions(response: string): string[] {
  // Split by commas, clean up, and filter
  return response
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length < 30)
    .slice(0, 10);
}

/**
 * Test connection to a specific provider
 */
export async function testProviderConnection(
  provider: TextProvider
): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
  const startTime = Date.now();

  try {
    const connected = await checkAIConnection(provider);
    return {
      connected,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
