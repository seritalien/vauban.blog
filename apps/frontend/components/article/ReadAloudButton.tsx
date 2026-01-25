'use client';

import { useState, useCallback, useEffect, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { readArticleAloud, stopSpeech, getBrowserVoices } from '@/lib/ai-tts';

interface ReadAloudButtonProps {
  content: string;
  className?: string;
}

/**
 * Accessibility button to read article content aloud using browser TTS.
 * Shows progress and controls for pause/resume/stop.
 */
export const ReadAloudButton: FC<ReadAloudButtonProps> = ({ content, className = '' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [controls, setControls] = useState<ReturnType<typeof readArticleAloud> | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [hasVoices, setHasVoices] = useState<boolean | null>(null);

  // Check for voice availability on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Check voices multiple times - some browsers load them asynchronously
      let attempts = 0;
      const maxAttempts = 5;

      const checkVoices = () => {
        const voices = getBrowserVoices();
        if (voices.length > 0) {
          setHasVoices(true);
          console.log(`[TTS] Found ${voices.length} voices`);
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            // Try again after delay
            setTimeout(checkVoices, 500);
          } else {
            // Final check - Brave/some browsers may need voiceschanged event
            setHasVoices(false);
            console.log('[TTS] No voices found after multiple attempts');
          }
        }
      };

      // Also listen for voiceschanged event
      const handleVoicesChanged = () => {
        const voices = getBrowserVoices();
        if (voices.length > 0) {
          setHasVoices(true);
          console.log(`[TTS] Voices loaded via event: ${voices.length}`);
        }
      };

      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      setTimeout(checkVoices, 100);

      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    } else {
      setHasVoices(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
    };
  }, []);

  const handlePlay = useCallback(() => {
    // Clear any previous error
    setError(null);

    if (isPlaying) {
      // Stop
      controls?.stop();
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(0);
      setControls(null);
    } else {
      // Check for voice availability
      if (hasVoices === false) {
        setError('Pas de voix TTS disponibles. Installez des voix dans votre système.');
        return;
      }

      // Start
      const ctrl = readArticleAloud(content, {
        lang: 'fr-FR',
        rate: speed,
        onProgress: (index, total) => {
          setProgress(index);
          setTotalSentences(total);
          if (index >= total) {
            setIsPlaying(false);
            setIsPaused(false);
            setProgress(0);
            setControls(null);
          }
        },
      });
      setControls(ctrl);
      setIsPlaying(true);
      setIsPaused(false);

      // Estimate total sentences for progress
      const cleanText = content.replace(/<[^>]*>/g, '').replace(/```[\s\S]*?```/g, '');
      const sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText];
      setTotalSentences(sentences.length);
    }
  }, [content, controls, hasVoices, isPlaying, speed]);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      controls?.resume();
      setIsPaused(false);
    } else {
      controls?.pause();
      setIsPaused(true);
    }
  }, [controls, isPaused]);

  const progressPercent = totalSentences > 0 ? (progress / totalSentences) * 100 : 0;

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Main play/stop button */}
      <motion.button
        onClick={handlePlay}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium
          transition-colors overflow-hidden
          ${isPlaying
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
            : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50'
          }
        `}
        title={isPlaying ? 'Stop reading' : 'Read article aloud'}
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
          {isPlaying ? (
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
          {isPlaying ? 'Stop' : 'Listen'}
        </span>
      </motion.button>

      {/* Pause/Resume button (only when playing) */}
      <AnimatePresence>
        {isPlaying && (
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

      {/* Speed control (always visible) */}
      <div className="flex items-center gap-2">
        <label htmlFor="speed-control" className="text-xs text-gray-500 dark:text-gray-400">
          Speed:
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

      {/* No voices warning */}
      {hasVoices === false && !error && (
        <span
          className="text-xs text-orange-600 dark:text-orange-400 cursor-help"
          title="TTS non disponible. Sur Linux: installez speech-dispatcher et espeak-ng. Brave browser a un support TTS limité - essayez Chrome/Firefox."
        >
          ⚠️ TTS indisponible
        </span>
      )}
    </div>
  );
};

export default ReadAloudButton;
