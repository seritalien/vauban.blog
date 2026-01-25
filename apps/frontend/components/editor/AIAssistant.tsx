'use client';

import { useState, useCallback, useEffect, useRef, type FC } from 'react';
import {
  performAIAction,
  customPrompt,
  checkAIConnection,
  parseTitleSuggestions,
  parseTagSuggestions,
  type AIAction,
  type AIResponse,
} from '@/lib/ai';
import {
  generateImage,
  generateCoverImage,
  type ImageGenerationResponse,
} from '@/lib/ai-images';
import { getAIConfig, subscribeToConfigChanges } from '@/lib/ai-config';
import { TEXT_PROVIDERS, IMAGE_PROVIDERS } from '@/lib/ai-providers';
import { cn } from '@/lib/utils';

interface AIAssistantProps {
  /** Currently selected text in the editor */
  selectedText: string;
  /** Full content of the editor */
  fullContent: string;
  /** Current title */
  title: string;
  /** Current tags */
  tags: string[];
  /** Current excerpt */
  excerpt: string;
  /** Callback when AI suggests replacement text */
  onReplaceText: (text: string) => void;
  /** Callback when AI suggests inserting text */
  onInsertText: (text: string) => void;
  /** Callback when AI suggests a title */
  onSuggestTitle: (title: string) => void;
  /** Callback when AI suggests tags */
  onSuggestTags: (tags: string[]) => void;
  /** Callback when AI suggests an excerpt */
  onSuggestExcerpt: (excerpt: string) => void;
  /** Callback when AI generates a cover image */
  onSetCoverImage?: (url: string) => void;
  /** Whether the sidebar is expanded */
  isExpanded: boolean;
  /** Toggle sidebar expansion */
  onToggleExpanded: () => void;
}

interface AIActionButton {
  id: AIAction;
  label: string;
  icon: React.ReactNode;
  description: string;
  requiresSelection: boolean;
}

const AI_ACTIONS: AIActionButton[] = [
  {
    id: 'improve',
    label: 'Améliorer',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    description: 'Améliore le style et la clarté',
    requiresSelection: true,
  },
  {
    id: 'fix_grammar',
    label: 'Corriger',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Corrige orthographe et grammaire',
    requiresSelection: true,
  },
  {
    id: 'simplify',
    label: 'Simplifier',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
      </svg>
    ),
    description: 'Rend le texte plus accessible',
    requiresSelection: true,
  },
  {
    id: 'expand',
    label: 'Développer',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
      </svg>
    ),
    description: 'Développe et enrichit le texte',
    requiresSelection: true,
  },
  {
    id: 'continue',
    label: 'Continuer',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    ),
    description: 'Continue le texte naturellement',
    requiresSelection: false,
  },
  {
    id: 'translate_en',
    label: 'EN',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    description: 'Traduit en anglais',
    requiresSelection: true,
  },
  {
    id: 'translate_fr',
    label: 'FR',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
      </svg>
    ),
    description: 'Traduit en français',
    requiresSelection: true,
  },
];

const METADATA_ACTIONS = [
  { id: 'suggest_title' as const, label: 'Titres', icon: '📝' },
  { id: 'suggest_tags' as const, label: 'Tags', icon: '🏷️' },
  { id: 'suggest_excerpt' as const, label: 'Extrait', icon: '📄' },
];

export const AIAssistant: FC<AIAssistantProps> = (props) => {
  const {
    selectedText,
    fullContent,
    title,
    tags,
    // excerpt - reserved for future use (e.g., showing current excerpt in UI)
    onReplaceText,
    onInsertText,
    onSuggestTitle,
    onSuggestTags,
    onSuggestExcerpt,
    onSetCoverImage,
    isExpanded,
    onToggleExpanded,
  } = props;
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [lastCompletedAction, setLastCompletedAction] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const [titleSuggestions, setTitleSuggestions] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Provider info state
  const [currentTextProvider, setCurrentTextProvider] = useState<string>('');
  const [currentTextModel, setCurrentTextModel] = useState<string>('');
  const [currentImageProvider, setCurrentImageProvider] = useState<string>('');
  const [currentImageModel, setCurrentImageModel] = useState<string>('');

  // Last used model info (from response)
  const [lastUsedModel, setLastUsedModel] = useState<{ provider: string; model: string; latencyMs?: number } | null>(null);

  // Check AI connection on mount and track config changes
  useEffect(() => {
    const updateProviderInfo = () => {
      const config = getAIConfig();
      setCurrentTextProvider(TEXT_PROVIDERS[config.textProvider].name);
      setCurrentTextModel(config.textModel);
      setCurrentImageProvider(IMAGE_PROVIDERS[config.imageProvider].name);
      setCurrentImageModel(config.imageModel);
    };

    updateProviderInfo();
    checkAIConnection().then(setIsConnected);

    const unsubscribe = subscribeToConfigChanges(() => {
      updateProviderInfo();
      checkAIConnection().then(setIsConnected);
    });

    return unsubscribe;
  }, []);

  // Clear results when selection changes
  useEffect(() => {
    setResult(null);
    setError(null);
    setTitleSuggestions([]);
    setTagSuggestions([]);
    setLastCompletedAction(null);
  }, [selectedText]);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setLoadingAction(null);
  }, []);

  const handleAction = useCallback(
    async (action: AIAction) => {
      const textToProcess =
        action === 'continue' ? fullContent.slice(-500) : selectedText;

      if (!textToProcess && action !== 'suggest_title' && action !== 'suggest_tags' && action !== 'suggest_excerpt') {
        setError('Sélectionnez du texte pour utiliser cette action');
        return;
      }

      setIsLoading(true);
      setLoadingAction(action);
      setResult(null);
      setError(null);
      setTitleSuggestions([]);
      setTagSuggestions([]);

      abortControllerRef.current = new AbortController();

      let response: AIResponse<string>;

      if (action === 'suggest_title') {
        response = await performAIAction(action, fullContent || title, {
          signal: abortControllerRef.current.signal,
        });
      } else if (action === 'suggest_tags') {
        response = await performAIAction(action, fullContent || title, {
          signal: abortControllerRef.current.signal,
        });
      } else if (action === 'suggest_excerpt') {
        response = await performAIAction(action, fullContent || title, {
          signal: abortControllerRef.current.signal,
        });
      } else {
        response = await performAIAction(action, textToProcess, {
          signal: abortControllerRef.current.signal,
        });
      }

      setIsLoading(false);
      setLoadingAction(null);

      if (!response.success) {
        if (response.code === 'TIMEOUT') {
          setError('La requête a expiré. Réessayez.');
        } else {
          setError(response.error);
        }
        return;
      }

      // Track which action produced this result (for button rendering)
      setLastCompletedAction(action);

      // Store model info from response
      setLastUsedModel({
        provider: response.provider,
        model: response.model,
        latencyMs: response.latencyMs,
      });

      if (action === 'suggest_title') {
        const titles = parseTitleSuggestions(response.data);
        setTitleSuggestions(titles);
      } else if (action === 'suggest_tags') {
        const parsedTags = parseTagSuggestions(response.data);
        setTagSuggestions(parsedTags);
      } else if (action === 'suggest_excerpt') {
        setResult(response.data);
      } else {
        setResult(response.data);
      }
    },
    [selectedText, fullContent, title]
  );

  const handleCustomPrompt = useCallback(async () => {
    if (!customQuery.trim()) return;

    setIsLoading(true);
    setLoadingAction('custom');
    setResult(null);
    setError(null);

    abortControllerRef.current = new AbortController();

    const context = selectedText || fullContent.slice(0, 1000);
    const response = await customPrompt(customQuery, context, {
      signal: abortControllerRef.current.signal,
    });

    setIsLoading(false);
    setLoadingAction(null);

    if (!response.success) {
      setError(response.error);
      setLastUsedModel(null);
      return;
    }

    setResult(response.data);
    setLastUsedModel({
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    });
  }, [customQuery, selectedText, fullContent]);

  const handleApplyResult = useCallback(() => {
    if (!result) return;
    if (selectedText) {
      onReplaceText(result);
    } else {
      onInsertText(result);
    }
    setResult(null);
  }, [result, selectedText, onReplaceText, onInsertText]);

  const handleApplyExcerpt = useCallback(() => {
    if (!result) return;
    onSuggestExcerpt(result);
    setResult(null);
  }, [result, onSuggestExcerpt]);

  // Image generation handlers
  const handleGenerateCover = useCallback(async () => {
    if (!title && !fullContent) {
      setImageError('Ajoutez un titre ou du contenu pour générer une image de couverture');
      return;
    }

    setIsGeneratingImage(true);
    setImageError(null);
    setGeneratedImage(null);

    const response: ImageGenerationResponse = await generateCoverImage(title, fullContent);

    setIsGeneratingImage(false);

    if (response.success) {
      setGeneratedImage(response.url);
    } else {
      setImageError(response.error);
    }
  }, [title, fullContent]);

  const handleGenerateCustomImage = useCallback(async () => {
    if (!imagePrompt.trim()) {
      setImageError('Entrez une description pour générer une image');
      return;
    }

    setIsGeneratingImage(true);
    setImageError(null);
    setGeneratedImage(null);

    const response: ImageGenerationResponse = await generateImage(imagePrompt);

    setIsGeneratingImage(false);

    if (response.success) {
      setGeneratedImage(response.url);
    } else {
      setImageError(response.error);
    }
  }, [imagePrompt]);

  const handleUseAsCover = useCallback(() => {
    if (!generatedImage || !onSetCoverImage) return;
    onSetCoverImage(generatedImage);
    setGeneratedImage(null);
    setImagePrompt('');
  }, [generatedImage, onSetCoverImage]);

  const handleInsertImage = useCallback(() => {
    if (!generatedImage) return;
    // Insert markdown image at the end of content
    onInsertText(`![Image générée](${generatedImage})`);
    setGeneratedImage(null);
    setImagePrompt('');
  }, [generatedImage, onInsertText]);

  // Collapsed state - just show toggle button
  if (!isExpanded) {
    return (
      <button
        onClick={onToggleExpanded}
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-40',
          'px-2 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-l-lg shadow-lg',
          'transition-all duration-200 hover:px-3',
          'flex flex-col items-center gap-1'
        )}
        title="Ouvrir l'assistant IA"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs [writing-mode:vertical-rl] rotate-180">AI</span>
      </button>
    );
  }

  return (
    <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="font-semibold text-white">Assistant IA</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Provider info + Connection status */}
          {currentTextModel && (
            <span
              className="text-[10px] text-white/50 hidden sm:inline truncate max-w-[80px]"
              title={`${currentTextProvider} - ${currentTextModel}`}
            >
              {currentTextModel}
            </span>
          )}
          <span
            className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              isConnected === true && 'bg-green-400',
              isConnected === false && 'bg-red-400',
              isConnected === null && 'bg-yellow-400 animate-pulse'
            )}
            title={
              isConnected === true
                ? `${currentTextProvider} connecté`
                : isConnected === false
                  ? `${currentTextProvider} non disponible`
                  : 'Vérification...'
            }
          />
          <button
            onClick={onToggleExpanded}
            className="p-1 hover:bg-white/20 rounded text-white"
            title="Fermer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Selected text indicator */}
        {selectedText ? (
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">
              Texte sélectionné ({selectedText.length} caractères)
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
              {selectedText}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Sélectionnez du texte dans l&apos;éditeur pour utiliser les actions IA,
              ou utilisez les suggestions de métadonnées ci-dessous.
            </div>
          </div>
        )}

        {/* Text Actions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Actions sur le texte
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {AI_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                disabled={isLoading || (action.requiresSelection && !selectedText) || !isConnected}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
                  'border border-gray-200 dark:border-gray-700',
                  action.requiresSelection && !selectedText
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300',
                  loadingAction === action.id && 'bg-purple-100 dark:bg-purple-900/30 border-purple-400'
                )}
                title={action.description}
              >
                {loadingAction === action.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  action.icon
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Metadata Suggestions */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Suggestions de métadonnées
          </h3>
          <div className="flex gap-2">
            {METADATA_ACTIONS.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                disabled={isLoading || !fullContent || !isConnected}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors',
                  'border border-gray-200 dark:border-gray-700',
                  !fullContent
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300',
                  loadingAction === action.id && 'bg-blue-100 dark:bg-blue-900/30 border-blue-400'
                )}
              >
                {loadingAction === action.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span>{action.icon}</span>
                )}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Query */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Question libre
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomPrompt()}
              placeholder="Demandez à l'IA..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800"
              disabled={isLoading || !isConnected}
            />
            <button
              onClick={handleCustomPrompt}
              disabled={isLoading || !customQuery.trim() || !isConnected}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Image Generation */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Génération d&apos;images
            {currentImageModel && (
              <span
                className="text-[10px] font-normal text-blue-500/70 dark:text-blue-400/70 truncate max-w-[60px]"
                title={`${currentImageProvider} - ${currentImageModel}`}
              >
                {currentImageModel}
              </span>
            )}
          </h3>

          {/* Quick generate cover button */}
          <button
            onClick={handleGenerateCover}
            disabled={isGeneratingImage || (!title && !fullContent)}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors mb-2',
              'border border-blue-200 dark:border-blue-700',
              (!title && !fullContent)
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300',
              isGeneratingImage && 'bg-blue-100 dark:bg-blue-900/30'
            )}
          >
            {isGeneratingImage ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Génération...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>Générer cover automatique</span>
              </>
            )}
          </button>

          {/* Custom image prompt */}
          <div className="flex gap-2">
            <input
              type="text"
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateCustomImage()}
              placeholder="Décrivez l'image..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800"
              disabled={isGeneratingImage}
            />
            <button
              onClick={handleGenerateCustomImage}
              disabled={isGeneratingImage || !imagePrompt.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Image error */}
          {imageError && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-xs text-red-800 dark:text-red-200">{imageError}</div>
            </div>
          )}

          {/* Generated image preview */}
          {generatedImage && (
            <div className="mt-3 space-y-2">
              <img
                src={generatedImage}
                alt="Image générée"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700"
              />
              <div className="flex gap-2">
                {onSetCoverImage && (
                  <button
                    onClick={handleUseAsCover}
                    className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                  >
                    Utiliser comme cover
                  </button>
                )}
                <button
                  onClick={handleInsertImage}
                  className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Insérer dans le contenu
                </button>
                <button
                  onClick={() => setGeneratedImage(null)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  title="Fermer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Génération en cours...</span>
            <button onClick={cancelRequest} className="text-red-500 hover:text-red-600">
              Annuler
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
          </div>
        )}

        {/* Title Suggestions */}
        {titleSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Suggestions de titres
              </h3>
              {lastUsedModel && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500" title={`${lastUsedModel.provider}/${lastUsedModel.model}`}>
                  {lastUsedModel.model.split('/').pop()?.replace(':free', '')} • {lastUsedModel.latencyMs}ms
                </span>
              )}
            </div>
            {titleSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  onSuggestTitle(suggestion);
                  setTitleSuggestions([]);
                }}
                className="w-full text-left p-3 text-sm bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Tag Suggestions */}
        {tagSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tags suggérés
              </h3>
              {lastUsedModel && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500" title={`${lastUsedModel.provider}/${lastUsedModel.model}`}>
                  {lastUsedModel.model.split('/').pop()?.replace(':free', '')} • {lastUsedModel.latencyMs}ms
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {tagSuggestions.map((tag, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (!tags.includes(tag)) {
                      onSuggestTags([...tags, tag]);
                    }
                  }}
                  disabled={tags.includes(tag)}
                  className={cn(
                    'px-2 py-1 text-xs rounded-full transition-colors',
                    tags.includes(tag)
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                  )}
                >
                  + {tag}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const newTags = tagSuggestions.filter((t) => !tags.includes(t));
                onSuggestTags([...tags, ...newTags]);
                setTagSuggestions([]);
              }}
              className="w-full py-2 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              Ajouter tous les tags manquants
            </button>
          </div>
        )}

        {/* Result */}
        {result && !titleSuggestions.length && !tagSuggestions.length && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Résultat
              </h3>
              {/* Model info - subtle display */}
              {lastUsedModel && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500" title={`${lastUsedModel.provider}/${lastUsedModel.model}`}>
                  {lastUsedModel.model.split('/').pop()?.replace(':free', '')} • {lastUsedModel.latencyMs}ms
                </span>
              )}
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {result}
              </div>
            </div>
            <div className="flex gap-2">
              {lastCompletedAction === 'suggest_excerpt' ? (
                <button
                  onClick={handleApplyExcerpt}
                  className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  Utiliser comme extrait
                </button>
              ) : (
                <button
                  onClick={handleApplyResult}
                  className="flex-1 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  {selectedText ? 'Remplacer le texte' : 'Insérer à la fin'}
                </button>
              )}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                title="Copier"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => setResult(null)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                title="Fermer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Connection error */}
        {isConnected === false && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>{currentTextProvider} non disponible.</strong>
              <br />
              {currentTextProvider === 'LocalAI' ? (
                <>
                  Lancez le service LocalAI :<br />
                  <code className="text-xs bg-yellow-100 dark:bg-yellow-900/50 px-1 rounded">
                    cd docker && docker compose -f docker-compose.ai.yml up -d
                  </code>
                </>
              ) : (
                <>Vérifiez votre configuration IA ou essayez un autre provider via le bouton de configuration.</>
              )}
            </div>
            <button
              onClick={() => checkAIConnection().then(setIsConnected)}
              className="mt-2 text-xs text-yellow-700 hover:underline"
            >
              Réessayer la connexion
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;
