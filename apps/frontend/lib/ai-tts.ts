/**
 * Text-to-Speech (TTS) API Client
 *
 * Provides text-to-speech functionality for accessibility:
 * - Fish Audio (free tier: 100 chars/request)
 * - Browser Speech Synthesis (fallback, always available)
 */

export type TTSProvider = 'fishaudio' | 'browser';

export interface TTSConfig {
  provider: TTSProvider;
  voice?: string;
  speed?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 2.0
}

export interface TTSResult {
  success: true;
  audioUrl?: string; // For Fish Audio
  provider: TTSProvider;
}

export interface TTSError {
  success: false;
  error: string;
}

export type TTSResponse = TTSResult | TTSError;

// Fish Audio voices (free tier)
export const FISH_AUDIO_VOICES = {
  'fr-female': { id: 'fr-female-1', name: 'Marie (French)', lang: 'fr' },
  'fr-male': { id: 'fr-male-1', name: 'Pierre (French)', lang: 'fr' },
  'en-female': { id: 'en-female-1', name: 'Sarah (English)', lang: 'en' },
  'en-male': { id: 'en-male-1', name: 'James (English)', lang: 'en' },
} as const;

export type FishAudioVoice = keyof typeof FISH_AUDIO_VOICES;

/**
 * Get the Fish Audio API key from environment
 */
function getFishAudioApiKey(): string | null {
  return process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY ?? null;
}

/**
 * Check if Fish Audio is available
 */
export function isFishAudioAvailable(): boolean {
  const apiKey = getFishAudioApiKey();
  return apiKey !== null && apiKey.length > 0;
}

/**
 * Generate speech from text using Fish Audio
 * Free tier: 100 characters per request
 */
export async function textToSpeechFishAudio(
  text: string,
  voice: FishAudioVoice = 'fr-female'
): Promise<TTSResponse> {
  const apiKey = getFishAudioApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: 'Clé API Fish Audio non configurée. Ajoutez NEXT_PUBLIC_FISHAUDIO_API_KEY',
    };
  }

  // Free tier limit
  if (text.length > 100) {
    return {
      success: false,
      error: 'Texte trop long pour le tier gratuit Fish Audio (max 100 caractères)',
    };
  }

  try {
    const voiceConfig = FISH_AUDIO_VOICES[voice];

    const response = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voiceConfig.id,
        format: 'mp3',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Fish Audio error: ${response.status} - ${errorText}`,
      };
    }

    // Create blob URL from audio response
    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);

    return {
      success: true,
      audioUrl,
      provider: 'fishaudio',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Generate speech from text using browser Speech Synthesis API
 * Always available, works offline
 */
export function textToSpeechBrowser(
  text: string,
  options: { lang?: string; rate?: number; pitch?: number } = {}
): TTSResponse {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return {
      success: false,
      error: 'Speech Synthesis not available in this browser',
    };
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options.lang ?? 'fr-FR';
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;

  // Find a voice for the language
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.startsWith(utterance.lang.split('-')[0]));
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);

  return {
    success: true,
    provider: 'browser',
  };
}

/**
 * Stop any ongoing speech synthesis
 */
export function stopSpeech(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if speech is currently playing
 */
export function isSpeaking(): boolean {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    return window.speechSynthesis.speaking;
  }
  return false;
}

/**
 * Get available browser voices
 */
export function getBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return [];
  }
  return window.speechSynthesis.getVoices();
}

/**
 * Generate speech using the best available provider
 * Falls back to browser if Fish Audio is not available
 */
export async function textToSpeech(
  text: string,
  options: TTSConfig = { provider: 'browser' }
): Promise<TTSResponse> {
  // If Fish Audio requested and available, use it
  if (options.provider === 'fishaudio' && isFishAudioAvailable()) {
    const voice = (options.voice as FishAudioVoice) ?? 'fr-female';
    return textToSpeechFishAudio(text, voice);
  }

  // Default to browser
  return textToSpeechBrowser(text, {
    rate: options.speed,
    pitch: options.pitch,
  });
}

/**
 * Split long text into chunks for TTS
 * Useful for reading articles (splits by sentences)
 */
export function splitTextForTTS(text: string, maxChunkSize = 100): string[] {
  // Split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (currentChunk.length + trimmed.length <= maxChunkSize) {
      currentChunk += (currentChunk ? ' ' : '') + trimmed;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If sentence itself is too long, split by words
      if (trimmed.length > maxChunkSize) {
        const words = trimmed.split(' ');
        currentChunk = '';
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxChunkSize) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
            }
            currentChunk = word;
          }
        }
      } else {
        currentChunk = trimmed;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Ensure voices are loaded (required for some browsers)
 */
function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Wait for voices to load
    const handleVoicesChanged = () => {
      const loadedVoices = window.speechSynthesis.getVoices();
      if (loadedVoices.length > 0) {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(loadedVoices);
      }
    };

    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);

    // Timeout fallback (some browsers don't fire the event)
    setTimeout(() => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    }, 1000);
  });
}

/**
 * Read an article aloud using browser speech synthesis
 * Handles long text by streaming sentences
 */
export function readArticleAloud(
  content: string,
  options: { lang?: string; rate?: number; onProgress?: (index: number, total: number) => void } = {}
): { stop: () => void; pause: () => void; resume: () => void } {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.error('[TTS] Speech Synthesis not available');
    return {
      stop: () => {},
      pause: () => {},
      resume: () => {},
    };
  }

  // Clean HTML/Markdown tags
  const cleanText = content
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/[#*_~]/g, '') // Remove markdown formatting
    .replace(/\n{2,}/g, '. ') // Convert double newlines to pauses
    .replace(/\n/g, ' ') // Convert single newlines to spaces
    .trim();

  if (!cleanText) {
    console.error('[TTS] No content to read');
    return {
      stop: () => {},
      pause: () => {},
      resume: () => {},
    };
  }

  const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
  let currentIndex = 0;
  let stopped = false;
  let selectedVoice: SpeechSynthesisVoice | null = null;

  console.log(`[TTS] Starting to read ${sentences.length} sentences`);

  const speakNext = () => {
    if (stopped || currentIndex >= sentences.length) {
      if (currentIndex >= sentences.length) {
        console.log('[TTS] Finished reading all sentences');
        options.onProgress?.(sentences.length, sentences.length);
      }
      return;
    }

    const sentence = sentences[currentIndex].trim();
    if (!sentence) {
      currentIndex++;
      speakNext();
      return;
    }

    // Chrome has a bug where long utterances fail - split if needed
    const maxLength = 200;
    const textToSpeak = sentence.length > maxLength
      ? sentence.substring(0, maxLength) + '...'
      : sentence;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = options.lang ?? 'fr-FR';
    utterance.rate = options.rate ?? 1.0;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;

    // Use pre-selected voice
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      console.log(`[TTS] Speaking sentence ${currentIndex + 1}/${sentences.length}: "${textToSpeak.substring(0, 50)}..."`);
    };

    utterance.onend = () => {
      currentIndex++;
      options.onProgress?.(currentIndex, sentences.length);
      // Small delay between sentences for natural pacing
      setTimeout(speakNext, 150);
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Speech error:', event.error, 'for sentence:', textToSpeak.substring(0, 50));
      // On error, try next sentence after delay
      currentIndex++;
      setTimeout(speakNext, 200);
    };

    // Speak without cancel() - cancel causes "synthesis-failed" in Chrome
    // Just speak - the onend handler will chain to next sentence
    window.speechSynthesis.speak(utterance);
  };

  // Initialize and start speaking
  waitForVoices().then((voices) => {
    console.log(`[TTS] ${voices.length} voices available`);

    if (voices.length === 0) {
      console.error('[TTS] No voices available in browser');
      return;
    }

    // Find best voice for language
    const targetLang = (options.lang ?? 'fr-FR').split('-')[0];
    selectedVoice = voices.find((v) => v.lang.startsWith(targetLang)) ||
                    voices.find((v) => v.lang.includes(targetLang)) ||
                    null;

    // If no voice found for target language, use any available voice
    if (!selectedVoice) {
      // Prefer English voices as fallback, then any voice
      selectedVoice = voices.find((v) => v.lang.startsWith('en')) ||
                      voices[0];
      console.warn(`[TTS] No ${targetLang} voice found, using fallback: ${selectedVoice?.name} (${selectedVoice?.lang})`);
    } else {
      console.log(`[TTS] Using voice: ${selectedVoice.name} (${selectedVoice.lang})`);
    }

    // Report initial progress
    options.onProgress?.(0, sentences.length);

    // Cancel any previous speech first
    window.speechSynthesis.cancel();

    // Chrome bug workaround: speak a silent utterance first to "wake up" the engine
    // This prevents synthesis-failed errors on first speak
    const silentUtterance = new SpeechSynthesisUtterance('');
    silentUtterance.volume = 0;
    if (selectedVoice) {
      silentUtterance.voice = selectedVoice;
    }
    window.speechSynthesis.speak(silentUtterance);

    // Then start real speech after delay
    setTimeout(() => {
      if (!stopped) {
        speakNext();
      }
    }, 200);
  });

  return {
    stop: () => {
      console.log('[TTS] Stopping');
      stopped = true;
      window.speechSynthesis.cancel();
    },
    pause: () => {
      console.log('[TTS] Pausing');
      window.speechSynthesis.pause();
    },
    resume: () => {
      console.log('[TTS] Resuming');
      window.speechSynthesis.resume();
    },
  };
}
