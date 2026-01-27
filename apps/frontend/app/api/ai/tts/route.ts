/**
 * Server-side TTS API using Hugging Face
 *
 * Provides text-to-speech for browsers without native TTS support (e.g., Brave).
 * Uses free Hugging Face inference API with high-quality French/English models.
 *
 * Models:
 * - French: facebook/mms-tts-fra (high quality)
 * - English: facebook/mms-tts-eng (high quality)
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30; // TTS should be fast

interface TTSRequestBody {
  text: string;
  lang?: string; // 'fr' or 'en'
}

// Model mapping by language
const TTS_MODELS: Record<string, string> = {
  fr: 'facebook/mms-tts-fra',
  en: 'facebook/mms-tts-eng',
  default: 'facebook/mms-tts-fra',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as TTSRequestBody;
    const { text, lang = 'fr' } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Limit text length to prevent abuse
    const maxLength = 500;
    const truncatedText = text.slice(0, maxLength);

    // Get Hugging Face API key
    const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY || process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'TTS serveur non configuré. Utilisez Chrome ou Firefox pour la lecture audio native.',
          code: 'NO_API_KEY'
        },
        { status: 503 }
      );
    }

    // Select model based on language
    const model = TTS_MODELS[lang] || TTS_MODELS.default;

    console.log(`[API/TTS] Generating speech: ${truncatedText.substring(0, 50)}... (lang: ${lang}, model: ${model})`);

    // Call Hugging Face inference API
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: truncatedText,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API/TTS] Hugging Face error:', response.status, errorText);

      // Handle model loading (503)
      if (response.status === 503) {
        // Parse estimated time if available
        try {
          const errorData = JSON.parse(errorText);
          const estimatedTime = errorData.estimated_time || 20;
          return NextResponse.json(
            {
              error: `Modèle en chargement (~${Math.ceil(estimatedTime)}s). Réessayez dans quelques secondes.`,
              code: 'MODEL_LOADING',
              retryAfter: Math.ceil(estimatedTime)
            },
            { status: 503 }
          );
        } catch {
          return NextResponse.json(
            {
              error: 'Modèle en chargement. Réessayez dans quelques secondes.',
              code: 'MODEL_LOADING',
              retryAfter: 20
            },
            { status: 503 }
          );
        }
      }

      // Handle rate limit (429)
      if (response.status === 429) {
        return NextResponse.json(
          {
            error: 'Limite de requêtes atteinte. Réessayez dans quelques secondes.',
            code: 'RATE_LIMIT'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `TTS error: ${response.status}`, code: 'API_ERROR' },
        { status: response.status }
      );
    }

    // Return audio as response
    const audioBuffer = await response.arrayBuffer();

    console.log(`[API/TTS] Success, audio size: ${audioBuffer.byteLength} bytes`);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/flac',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=86400', // Cache for 24h
      },
    });

  } catch (error) {
    console.error('[API/TTS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
