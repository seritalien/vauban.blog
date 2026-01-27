'use client';

import { useState, useCallback, useEffect, useRef, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { readArticleAloud, stopSpeech, getBrowserVoices, textToSpeechServer } from '@/lib/ai-tts';

interface ReadAloudButtonProps {
  content: string;
  className?: string;
  /** Callback when the currently read sentence changes */
  onSentenceChange?: (index: number, total: number) => void;
}

type TTSMode = 'browser' | 'server' | 'none';

/**
 * Accessibility button to read article content aloud.
 * Uses browser TTS if available, falls back to server-side Hugging Face TTS.
 */
export const ReadAloudButton: FC<ReadAloudButtonProps> = ({ content, className = '', onSentenceChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [controls, setControls] = useState<ReturnType<typeof readArticleAloud> | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [ttsMode, setTtsMode] = useState<TTSMode>('none');

  // Audio element ref for server-side TTS
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentSentenceRef = useRef(0);
  const sentencesRef = useRef<string[]>([]);
  const stoppedRef = useRef(false);

  // Check for TTS availability on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check browser voices multiple times
      let attempts = 0;
      const maxAttempts = 5;

      const checkVoices = () => {
        const voices = getBrowserVoices();
        if (voices.length > 0) {
          setTtsMode('browser');
          console.log(`[TTS] Using browser TTS (${voices.length} voices)`);
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkVoices, 500);
          } else {
            // No browser voices, use server TTS
            setTtsMode('server');
            console.log('[TTS] No browser voices, using server TTS');
          }
        }
      };

      // Listen for voiceschanged event
      const handleVoicesChanged = () => {
        const voices = getBrowserVoices();
        if (voices.length > 0) {
          setTtsMode('browser');
          console.log(`[TTS] Browser voices loaded: ${voices.length}`);
        }
      };

      if (window.speechSynthesis) {
        window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
        setTimeout(checkVoices, 100);

        return () => {
          window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        };
      } else {
        // No speechSynthesis API, use server
        setTtsMode('server');
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Clean content for TTS
  const cleanContent = useCallback((text: string) => {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/[#*_~]/g, '') // Remove markdown formatting
      .replace(/\n{2,}/g, '. ') // Convert double newlines to pauses
      .replace(/\n/g, ' ') // Convert single newlines to spaces
      .trim();
  }, []);

  // Play next sentence using server TTS
  const playNextServerSentence = useCallback(async () => {
    if (stoppedRef.current || currentSentenceRef.current >= sentencesRef.current.length) {
      setIsPlaying(false);
      setProgress(0);
      currentSentenceRef.current = 0;
      return;
    }

    const sentence = sentencesRef.current[currentSentenceRef.current];
    if (!sentence.trim()) {
      currentSentenceRef.current++;
      setProgress(currentSentenceRef.current);
      playNextServerSentence();
      return;
    }

    setIsLoading(true);
    const result = await textToSpeechServer(sentence, 'fr');
    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      setIsPlaying(false);
      return;
    }

    if (stoppedRef.current) {
      URL.revokeObjectURL(result.audioUrl);
      return;
    }

    // Create audio element and play
    const audio = new Audio(result.audioUrl);
    audio.playbackRate = speed;
    audioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(result.audioUrl);
      currentSentenceRef.current++;
      setProgress(currentSentenceRef.current);
      onSentenceChange?.(currentSentenceRef.current, sentencesRef.current.length);
      playNextServerSentence();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(result.audioUrl);
      currentSentenceRef.current++;
      playNextServerSentence();
    };

    // Notify current sentence before playing
    onSentenceChange?.(currentSentenceRef.current, sentencesRef.current.length);

    audio.play().catch((err) => {
      console.error('[TTS] Audio play error:', err);
      setError('Erreur de lecture audio');
      setIsPlaying(false);
    });
  }, [speed, onSentenceChange]);

  const handlePlay = useCallback(() => {
    setError(null);

    if (isPlaying) {
      // Stop
      stoppedRef.current = true;
      controls?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setControls(null);
      currentSentenceRef.current = 0;
      onSentenceChange?.(-1, totalSentences); // Signal stop with -1
    } else {
      // Start
      stoppedRef.current = false;
      const cleanText = cleanContent(content);
      const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
      sentencesRef.current = sentences;
      setTotalSentences(sentences.length);

      if (ttsMode === 'browser') {
        // Use browser TTS
        const ctrl = readArticleAloud(content, {
          lang: 'fr-FR',
          rate: speed,
          onProgress: (index, total) => {
            setProgress(index);
            setTotalSentences(total);
            onSentenceChange?.(index, total);
            if (index >= total) {
              setIsPlaying(false);
              setIsPaused(false);
              setProgress(0);
              setControls(null);
              onSentenceChange?.(-1, total); // Signal end with -1
            }
          },
        });
        setControls(ctrl);
        setIsPlaying(true);
        setIsPaused(false);
      } else if (ttsMode === 'server') {
        // Use server-side TTS (for browsers without native TTS like Brave)
        setIsPlaying(true);
        setIsPaused(false);
        playNextServerSentence();
      } else {
        // No TTS available - show helpful error
        setError('TTS indisponible. Utilisez Chrome ou Firefox.');
      }
    }
  }, [content, controls, isPlaying, speed, ttsMode, totalSentences, cleanContent, playNextServerSentence, onSentenceChange]);

  const handlePauseResume = useCallback(() => {
    if (ttsMode === 'browser') {
      if (isPaused) {
        controls?.resume();
        setIsPaused(false);
      } else {
        controls?.pause();
        setIsPaused(true);
      }
    } else if (ttsMode === 'server' && audioRef.current) {
      if (isPaused) {
        audioRef.current.play();
        setIsPaused(false);
      } else {
        audioRef.current.pause();
        setIsPaused(true);
      }
    }
  }, [controls, isPaused, ttsMode]);

  const progressPercent = totalSentences > 0 ? (progress / totalSentences) * 100 : 0;

  return (
    <div className={`inline-flex items-center gap-2 flex-wrap ${className}`}>
      {/* Main play/stop button */}
      <motion.button
        onClick={handlePlay}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        disabled={isLoading}
        className={`
          relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
          transition-colors overflow-hidden
          ${isPlaying
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          }
          ${isLoading ? 'opacity-70 cursor-wait' : ''}
        `}
        title={isPlaying ? 'Stop reading' : `Read article aloud (${ttsMode === 'server' ? 'AI' : 'Browser'})`}
      >
        {/* Progress bar background */}
        {isPlaying && (
          <motion.div
            className="absolute inset-0 bg-purple-200 dark:bg-purple-800/50"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Icon */}
        <span className="relative z-10">
          {isLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isPlaying ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </span>

        {/* Label */}
        <span className="relative z-10">
          {isPlaying ? 'Stop' : 'Écouter'}
        </span>
      </motion.button>

      {/* Pause/Resume button (only when playing) */}
      <AnimatePresence>
        {isPlaying && !isLoading && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: -10 }}
            onClick={handlePauseResume}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Progress indicator (only when playing) */}
      <AnimatePresence>
        {isPlaying && totalSentences > 0 && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-gray-500 dark:text-gray-400"
          >
            {progress}/{totalSentences}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Speed control */}
      <div className="flex items-center gap-2">
        <label htmlFor="speed-control" className="text-xs text-gray-500 dark:text-gray-400">
          Vitesse:
        </label>
        <input
          id="speed-control"
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-20 h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
          title={`Playback speed: ${speed}x`}
          disabled={isPlaying}
        />
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[2.5rem]">
          {speed.toFixed(1)}x
        </span>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReadAloudButton;
