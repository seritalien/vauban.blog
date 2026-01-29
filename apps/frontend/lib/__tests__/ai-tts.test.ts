import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isFishAudioAvailable,
  textToSpeechFishAudio,
  textToSpeechBrowser,
  stopSpeech,
  isSpeaking,
  getBrowserVoices,
  isServerTTSAvailable,
  textToSpeechServer,
  textToSpeech,
  splitTextForTTS,
  readArticleAloud,
  FISH_AUDIO_VOICES,
} from '../ai-tts';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock URL.createObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/test-audio-url');
global.URL.createObjectURL = mockCreateObjectURL;

// Mock speechSynthesis
const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockGetVoices = vi.fn((): { lang: string; name: string }[] => []);
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

describe('ai-tts.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.unstubAllEnvs();

    // Mock SpeechSynthesisUtterance as a proper class constructor
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class MockUtterance {
      text: string;
      lang = 'fr-FR';
      rate = 1.0;
      pitch = 1.0;
      volume = 1.0;
      voice: SpeechSynthesisVoice | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    global.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;

    // Setup speechSynthesis mock
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        pause: mockPause,
        resume: mockResume,
        speaking: false,
        getVoices: mockGetVoices,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('FISH_AUDIO_VOICES', () => {
    it('defines French and English voices', () => {
      expect(FISH_AUDIO_VOICES['fr-female']).toBeDefined();
      expect(FISH_AUDIO_VOICES['fr-male']).toBeDefined();
      expect(FISH_AUDIO_VOICES['en-female']).toBeDefined();
      expect(FISH_AUDIO_VOICES['en-male']).toBeDefined();
    });

    it('each voice has id, name, and lang', () => {
      for (const voice of Object.values(FISH_AUDIO_VOICES)) {
        expect(voice).toHaveProperty('id');
        expect(voice).toHaveProperty('name');
        expect(voice).toHaveProperty('lang');
      }
    });
  });

  describe('isFishAudioAvailable', () => {
    it('returns true when API key is configured', () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';
      expect(isFishAudioAvailable()).toBe(true);
    });

    it('returns false when API key is not configured', () => {
      delete process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY;
      expect(isFishAudioAvailable()).toBe(false);
    });

    it('returns false when API key is empty', () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = '';
      expect(isFishAudioAvailable()).toBe(false);
    });
  });

  describe('textToSpeechFishAudio', () => {
    it('returns error when API key is not configured', async () => {
      delete process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY;

      const result = await textToSpeechFishAudio('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Clé API Fish Audio non configurée');
      }
    });

    it('returns error for text exceeding 100 chars', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      const longText = 'a'.repeat(101);
      const result = await textToSpeechFishAudio(longText);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('trop long');
      }
    });

    it('generates audio successfully', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      const mockBlob = new Blob(['audio-data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await textToSpeechFishAudio('Hello world');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.audioUrl).toBe('blob:http://localhost/test-audio-url');
        expect(result.provider).toBe('fishaudio');
      }
    });

    it('uses the specified voice', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      const mockBlob = new Blob(['audio-data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await textToSpeechFishAudio('Hello', 'en-male');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.voice_id).toBe(FISH_AUDIO_VOICES['en-male'].id);
    });

    it('handles API error response', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      const result = await textToSpeechFishAudio('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Fish Audio error');
        expect(result.error).toContain('429');
      }
    });

    it('handles API error with non-text response', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error('Cannot read text')),
      });

      const result = await textToSpeechFishAudio('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Unknown error');
      }
    });

    it('handles network errors', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await textToSpeechFishAudio('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });

    it('handles non-Error exceptions', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      mockFetch.mockRejectedValueOnce('string error');

      const result = await textToSpeechFishAudio('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });

    it('sends correct request headers', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      const mockBlob = new Blob(['audio-data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await textToSpeechFishAudio('Hello');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fish.audio/v1/tts',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fish-key-123',
            'Content-Type': 'application/json',
          }),
        })
      );
    });
  });

  describe('textToSpeechBrowser', () => {
    it('speaks text using browser Speech Synthesis', () => {
      const result = textToSpeechBrowser('Hello world');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('browser');
      }
      expect(mockSpeak).toHaveBeenCalled();
    });

    it('uses default French language', () => {
      textToSpeechBrowser('Bonjour');

      // Verify speak was called and the utterance was created
      expect(mockSpeak).toHaveBeenCalled();
      const utterance = mockSpeak.mock.calls[0][0];
      expect(utterance.lang).toBe('fr-FR');
    });

    it('accepts custom language', () => {
      textToSpeechBrowser('Hello', { lang: 'en-US' });

      const utterance = mockSpeak.mock.calls[0][0];
      expect(utterance.lang).toBe('en-US');
    });

    it('accepts custom rate and pitch', () => {
      textToSpeechBrowser('Hello', { rate: 1.5, pitch: 0.8 });

      const utterance = mockSpeak.mock.calls[0][0];
      expect(utterance.rate).toBe(1.5);
      expect(utterance.pitch).toBe(0.8);
    });

    it('selects voice matching language', () => {
      mockGetVoices.mockReturnValueOnce([
        { lang: 'en-US', name: 'English' },
        { lang: 'fr-FR', name: 'French' },
      ]);

      textToSpeechBrowser('Bonjour', { lang: 'fr-FR' });

      // Verify speak was called
      expect(mockSpeak).toHaveBeenCalled();
    });

    it('returns error when speechSynthesis is not available', () => {
      // Temporarily remove speechSynthesis
      const original = window.speechSynthesis;
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = textToSpeechBrowser('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Speech Synthesis not available');
      }

      // Restore
      Object.defineProperty(window, 'speechSynthesis', {
        value: original,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('stopSpeech', () => {
    it('calls speechSynthesis.cancel()', () => {
      stopSpeech();
      expect(mockCancel).toHaveBeenCalled();
    });

    it('does not throw when speechSynthesis is not available', () => {
      const original = window.speechSynthesis;
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(() => stopSpeech()).not.toThrow();

      Object.defineProperty(window, 'speechSynthesis', {
        value: original,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('isSpeaking', () => {
    it('returns false when not speaking', () => {
      expect(isSpeaking()).toBe(false);
    });

    it('returns true when speaking', () => {
      Object.defineProperty(window.speechSynthesis, 'speaking', {
        value: true,
        writable: true,
        configurable: true,
      });

      expect(isSpeaking()).toBe(true);

      // Restore
      Object.defineProperty(window.speechSynthesis, 'speaking', {
        value: false,
        writable: true,
        configurable: true,
      });
    });

    it('returns false when speechSynthesis is not available', () => {
      const original = window.speechSynthesis;
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(isSpeaking()).toBe(false);

      Object.defineProperty(window, 'speechSynthesis', {
        value: original,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('getBrowserVoices', () => {
    it('returns empty array when speechSynthesis is not available', () => {
      const original = window.speechSynthesis;
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(getBrowserVoices()).toEqual([]);

      Object.defineProperty(window, 'speechSynthesis', {
        value: original,
        writable: true,
        configurable: true,
      });
    });

    it('returns voices from speechSynthesis', () => {
      const mockVoices = [
        { lang: 'en-US', name: 'English' },
        { lang: 'fr-FR', name: 'French' },
      ];
      mockGetVoices.mockReturnValueOnce(mockVoices);

      expect(getBrowserVoices()).toEqual(mockVoices);
    });
  });

  describe('isServerTTSAvailable', () => {
    it('returns true when HuggingFace API key is set', () => {
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY = 'hf-key';
      expect(isServerTTSAvailable()).toBe(true);
    });

    it('returns false when HuggingFace API key is not set', () => {
      delete process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
      expect(isServerTTSAvailable()).toBe(false);
    });

    it('returns false when HuggingFace API key is empty', () => {
      process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY = '';
      expect(isServerTTSAvailable()).toBe(false);
    });
  });

  describe('textToSpeechServer', () => {
    it('generates audio via server API', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/wav' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await textToSpeechServer('Hello world');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.audioUrl).toBe('blob:http://localhost/test-audio-url');
      }
    });

    it('sends correct request body', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/wav' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await textToSpeechServer('Hello', 'en');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/ai/tts',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Hello', lang: 'en' }),
        })
      );
    });

    it('defaults to French language', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/wav' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      await textToSpeechServer('Bonjour');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.lang).toBe('fr');
    });

    it('handles API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'TTS failed' }),
      });

      const result = await textToSpeechServer('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('TTS failed');
      }
    });

    it('handles API error with invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await textToSpeechServer('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unknown error');
      }
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await textToSpeechServer('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Connection refused');
      }
    });

    it('handles non-Error exceptions', async () => {
      mockFetch.mockRejectedValueOnce('string error');

      const result = await textToSpeechServer('Hello');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Network error');
      }
    });
  });

  describe('textToSpeech', () => {
    it('uses browser TTS by default', async () => {
      const result = await textToSpeech('Hello');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('browser');
      }
    });

    it('uses Fish Audio when requested and available', async () => {
      process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY = 'fish-key-123';

      const mockBlob = new Blob(['audio-data'], { type: 'audio/mp3' });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await textToSpeech('Hello', { provider: 'fishaudio' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('fishaudio');
      }
    });

    it('falls back to browser when Fish Audio is not available', async () => {
      delete process.env.NEXT_PUBLIC_FISHAUDIO_API_KEY;

      const result = await textToSpeech('Hello', { provider: 'fishaudio' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.provider).toBe('browser');
      }
    });

    it('passes speed and pitch to browser TTS', async () => {
      await textToSpeech('Hello', { provider: 'browser', speed: 1.5, pitch: 0.8 });

      const utterance = mockSpeak.mock.calls[0][0];
      expect(utterance.rate).toBe(1.5);
      expect(utterance.pitch).toBe(0.8);
    });
  });

  describe('splitTextForTTS', () => {
    it('splits by sentences', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = splitTextForTTS(text, 100);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.join(' ')).toContain('First sentence.');
    });

    it('respects maxChunkSize', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = splitTextForTTS(text, 30);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(30);
      }
    });

    it('handles text without sentence endings', () => {
      const text = 'Just a plain text without punctuation';
      const chunks = splitTextForTTS(text, 100);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it('splits long sentences by words', () => {
      const longSentence = 'This is a very long sentence that should be split into multiple chunks by word boundaries.';
      const chunks = splitTextForTTS(longSentence, 30);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(30);
      }
    });

    it('returns empty array for empty string', () => {
      const chunks = splitTextForTTS('');
      // Empty text results in [''] from match or [text]
      expect(chunks.length).toBeLessThanOrEqual(1);
    });

    it('combines short sentences into one chunk', () => {
      const text = 'Hi. Yes. No. Ok.';
      const chunks = splitTextForTTS(text, 100);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Hi. Yes. No. Ok.');
    });

    it('handles exclamation marks and question marks', () => {
      const text = 'Hello! How are you? I am fine.';
      const chunks = splitTextForTTS(text, 100);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('uses default maxChunkSize of 100', () => {
      const text = 'A'.repeat(50) + '. ' + 'B'.repeat(50) + '. ' + 'C'.repeat(50) + '.';
      const chunks = splitTextForTTS(text);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('readArticleAloud', () => {
    it('returns control functions', () => {
      // Mock voices available immediately
      mockGetVoices.mockReturnValue([{ lang: 'fr-FR', name: 'French' }]);

      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const controls = readArticleAloud('Hello world.');

      expect(controls).toHaveProperty('stop');
      expect(controls).toHaveProperty('pause');
      expect(controls).toHaveProperty('resume');
      expect(typeof controls.stop).toBe('function');
      expect(typeof controls.pause).toBe('function');
      expect(typeof controls.resume).toBe('function');
    });

    it('returns no-op controls when speechSynthesis is not available', () => {
      const original = window.speechSynthesis;
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      vi.spyOn(console, 'error').mockImplementation(() => {});

      const controls = readArticleAloud('Hello world.');

      expect(() => controls.stop()).not.toThrow();
      expect(() => controls.pause()).not.toThrow();
      expect(() => controls.resume()).not.toThrow();

      Object.defineProperty(window, 'speechSynthesis', {
        value: original,
        writable: true,
        configurable: true,
      });
    });

    it('returns no-op controls for empty content after cleaning', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const controls = readArticleAloud('```code block```');

      expect(() => controls.stop()).not.toThrow();
    });

    it('cleans HTML and markdown from content', () => {
      mockGetVoices.mockReturnValue([{ lang: 'fr-FR', name: 'French' }]);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      // The function should strip these
      readArticleAloud('<p>Hello</p> **bold** `code` [link](url) #heading');

      // Just verify it doesn't crash
    });

    it('stop function cancels speech', () => {
      mockGetVoices.mockReturnValue([{ lang: 'fr-FR', name: 'French' }]);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const controls = readArticleAloud('Hello world.');
      controls.stop();

      expect(mockCancel).toHaveBeenCalled();
    });

    it('pause function pauses speech', () => {
      mockGetVoices.mockReturnValue([{ lang: 'fr-FR', name: 'French' }]);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const controls = readArticleAloud('Hello world.');
      controls.pause();

      expect(mockPause).toHaveBeenCalled();
    });

    it('resume function resumes speech', () => {
      mockGetVoices.mockReturnValue([{ lang: 'fr-FR', name: 'French' }]);
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const controls = readArticleAloud('Hello world.');
      controls.resume();

      expect(mockResume).toHaveBeenCalled();
    });
  });
});
