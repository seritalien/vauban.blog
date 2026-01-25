'use client';

import { useState, useCallback, type FC, type ReactNode } from 'react';
import { performAIAction, parseTitleSuggestions, type AIAction } from '@/lib/ai';
import { getAIConfig } from '@/lib/ai-config';
import { cn } from '@/lib/utils';

export interface FieldWithAIProps {
  /** Field label */
  label: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** AI action to perform */
  aiAction: AIAction;
  /** Context for AI (e.g., full content for excerpt generation) */
  aiContext?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether to use textarea instead of input */
  multiline?: boolean;
  /** Number of rows for textarea */
  rows?: number;
  /** Additional class names */
  className?: string;
  /** Helper text below the field */
  helperText?: string;
  /** Prefix to show inside input (e.g., "/articles/") */
  prefix?: string;
  /** Custom render for the input */
  children?: ReactNode;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Input field with integrated AI suggestion button.
 * Shows suggestions inline and allows one-click application.
 */
export const FieldWithAI: FC<FieldWithAIProps> = ({
  label,
  value,
  onChange,
  aiAction,
  aiContext,
  placeholder,
  required = false,
  multiline = false,
  rows = 3,
  className = '',
  helperText,
  prefix,
  children,
  disabled = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]); // For multiple choices (titles)
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<{ provider: string; model: string; latencyMs?: number } | null>(null);

  const handleGenerateSuggestion = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuggestion(null);
    setSuggestions([]);

    try {
      const config = getAIConfig();
      const response = await performAIAction(
        aiAction,
        aiContext || value,
        {
          provider: config.textProvider,
          model: config.textModel,
        }
      );

      if (response.success && response.data) {
        // Clean the result
        let result = response.data.trim();

        // Store model info for display
        setModelUsed({
          provider: response.provider,
          model: response.model,
          latencyMs: response.latencyMs,
        });

        // For titles, parse as multiple choices
        if (aiAction === 'suggest_title') {
          const titles = parseTitleSuggestions(result);
          if (titles.length > 1) {
            setSuggestions(titles);
            return;
          } else if (titles.length === 1) {
            result = titles[0];
          }
        }

        // For tags, parse as array
        if (aiAction === 'suggest_tags') {
          // Tags come as comma-separated or JSON array
          try {
            const parsed = JSON.parse(result);
            if (Array.isArray(parsed)) {
              result = parsed.join(', ');
            }
          } catch {
            // Already a string, keep as is
          }
        }

        setSuggestion(result);
      } else if (!response.success) {
        setError(response.error || 'Failed to generate suggestion');
        setModelUsed(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [aiAction, aiContext, value]);

  const handleApplySuggestion = useCallback((value?: string) => {
    const toApply = value || suggestion;
    if (toApply) {
      onChange(toApply);
      setSuggestion(null);
      setSuggestions([]);
    }
  }, [suggestion, onChange]);

  const handleDismissSuggestion = useCallback(() => {
    setSuggestion(null);
    setSuggestions([]);
    setError(null);
  }, []);

  const inputClasses = `w-full border rounded px-4 py-2 dark:bg-gray-900 dark:border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
    prefix ? 'pl-20' : ''
  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`;

  return (
    <div className={className}>
      {/* Label with AI button */}
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-semibold">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <button
          type="button"
          onClick={handleGenerateSuggestion}
          disabled={isLoading || disabled}
          className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-lg transition-colors ${
            isLoading
              ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
              : 'text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20'
          }`}
          title={`Generate ${label.toLowerCase()} with AI`}
        >
          {isLoading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>AI</span>
            </>
          )}
        </button>
      </div>

      {/* Input field */}
      {children ? (
        children
      ) : multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClasses}
          placeholder={placeholder}
          required={required}
          rows={rows}
          disabled={disabled}
        />
      ) : (
        <div className="relative">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm">
              {prefix}
            </span>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClasses}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
          />
        </div>
      )}

      {/* Helper text */}
      {helperText && !suggestion && !error && suggestions.length === 0 && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      )}

      {/* Multiple AI Suggestions (for titles) */}
      {suggestions.length > 0 && (
        <div className="mt-2 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                Choisissez un titre
              </span>
            </div>
            {modelUsed && (
              <span className="text-[10px] text-purple-400 dark:text-purple-500" title={`${modelUsed.provider}/${modelUsed.model}`}>
                {modelUsed.model.split('/').pop()?.replace(':free', '')} • {modelUsed.latencyMs}ms
              </span>
            )}
          </div>
          <div className="space-y-2">
            {suggestions.map((title, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleApplySuggestion(title)}
                className={cn(
                  "w-full text-left p-3 rounded-lg transition-all duration-200",
                  "bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700",
                  "hover:bg-purple-100 dark:hover:bg-purple-900/40 hover:border-purple-400",
                  "hover:scale-[1.01] active:scale-[0.99]",
                  "text-sm text-gray-800 dark:text-gray-200"
                )}
              >
                <span className="text-purple-600 dark:text-purple-400 font-medium mr-2">
                  {index + 1}.
                </span>
                {title}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleDismissSuggestion}
              className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleGenerateSuggestion}
              className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
            >
              Régénérer
            </button>
          </div>
        </div>
      )}

      {/* Single AI Suggestion */}
      {suggestion && suggestions.length === 0 && (
        <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-purple-800 dark:text-purple-200 break-words">
                {suggestion}
              </p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplySuggestion()}
                    className="px-3 py-1 text-xs font-medium bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    Appliquer
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissSuggestion}
                    className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateSuggestion}
                    className="px-3 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded transition-colors"
                  >
                    Régénérer
                  </button>
                </div>
                {/* Model info - subtle display */}
                {modelUsed && (
                  <span className="text-[10px] text-purple-400 dark:text-purple-500" title={`${modelUsed.provider}/${modelUsed.model}`}>
                    {modelUsed.model.split('/').pop()?.replace(':free', '')} • {modelUsed.latencyMs}ms
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              <button
                type="button"
                onClick={handleDismissSuggestion}
                className="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldWithAI;
