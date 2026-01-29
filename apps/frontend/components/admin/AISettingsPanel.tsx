'use client';

import { useState, useEffect, useCallback, type FC } from 'react';
import { cn } from '@/lib/utils';
import {
  type TextProvider,
  type ImageProvider,
  type LocalAIModelInfo,
  TEXT_PROVIDERS,
  IMAGE_PROVIDERS,
  isTextProviderAvailable,
  isImageProviderAvailable,
  getLocalAIModelsWithStatus,
  clearLocalAIModelsCache,
} from '@/lib/ai-providers';
import {
  type AIConfig,
  getAIConfig,
  setAIConfig,
  resetAIConfig,
  subscribeToConfigChanges,
} from '@/lib/ai-config';
import { testProviderConnection } from '@/lib/ai';
import { testImageGeneration, type ImageGenerationResponse } from '@/lib/ai-images';

interface AISettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProviderTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  latencyMs?: number;
  error?: string;
}

interface LocalAIModelWithStatus extends LocalAIModelInfo {
  id: string;
}

export const AISettingsPanel: FC<AISettingsPanelProps> = ({ isOpen, onClose }) => {
  const [config, setConfigState] = useState<AIConfig>(getAIConfig);
  const [textTestResult, setTextTestResult] = useState<ProviderTestResult>({ status: 'idle' });
  const [imageTestResult, setImageTestResult] = useState<ProviderTestResult>({ status: 'idle' });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // LocalAI dynamic models
  const [localAIModels, setLocalAIModels] = useState<LocalAIModelWithStatus[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showInstallCommand, setShowInstallCommand] = useState<string | null>(null);

  // Subscribe to config changes
  useEffect(() => {
    const unsubscribe = subscribeToConfigChanges((newConfig) => {
      setConfigState(newConfig);
    });
    return unsubscribe;
  }, []);

  const fetchLocalAIModels = useCallback(async (forceRefresh = false) => {
    setIsLoadingModels(true);
    try {
      if (forceRefresh) {
        clearLocalAIModelsCache();
      }
      const models = await getLocalAIModelsWithStatus();
      setLocalAIModels(models);
    } catch (error) {
      console.error('Failed to fetch LocalAI models:', error);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  // Fetch LocalAI models when panel opens or provider is LocalAI
  useEffect(() => {
    if (isOpen && config.textProvider === 'localai') {
      void fetchLocalAIModels();
    }
  }, [isOpen, config.textProvider, fetchLocalAIModels]);

  // Handle text provider change
  const handleTextProviderChange = useCallback((provider: TextProvider) => {
    const providerConfig = TEXT_PROVIDERS[provider];
    const defaultModel = providerConfig.models[0] ?? 'mistral';
    setConfigState((prev) => ({
      ...prev,
      textProvider: provider,
      textModel: defaultModel,
    }));
    setHasChanges(true);
    setTextTestResult({ status: 'idle' });
  }, []);

  // Handle text model change
  const handleTextModelChange = useCallback((model: string) => {
    setConfigState((prev) => ({ ...prev, textModel: model }));
    setHasChanges(true);
  }, []);

  // Handle auto mode toggle
  const handleAutoModeToggle = useCallback((enabled: boolean) => {
    setConfigState((prev) => ({ ...prev, autoModelSelection: enabled }));
    setHasChanges(true);
  }, []);

  // Handle image provider change
  const handleImageProviderChange = useCallback((provider: ImageProvider) => {
    const providerConfig = IMAGE_PROVIDERS[provider];
    const defaultModel = providerConfig.models[0] ?? 'flux';
    setConfigState((prev) => ({
      ...prev,
      imageProvider: provider,
      imageModel: defaultModel,
    }));
    setHasChanges(true);
    setImageTestResult({ status: 'idle' });
    setImagePreview(null);
  }, []);

  // Handle image model change
  const handleImageModelChange = useCallback((model: string) => {
    setConfigState((prev) => ({ ...prev, imageModel: model }));
    setHasChanges(true);
  }, []);

  // Test text provider connection
  const handleTestTextProvider = useCallback(async () => {
    setTextTestResult({ status: 'testing' });

    const result = await testProviderConnection(config.textProvider);

    if (result.connected) {
      setTextTestResult({
        status: 'success',
        latencyMs: result.latencyMs,
      });
    } else {
      setTextTestResult({
        status: 'error',
        error: result.error ?? 'Connection failed',
      });
    }
  }, [config.textProvider]);

  // Test image generation
  const handleTestImageProvider = useCallback(async () => {
    setImageTestResult({ status: 'testing' });
    setImagePreview(null);

    const result: ImageGenerationResponse = await testImageGeneration(config.imageProvider);

    if (result.success) {
      setImageTestResult({ status: 'success' });
      setImagePreview(result.url);
    } else {
      setImageTestResult({
        status: 'error',
        error: result.error,
      });
    }
  }, [config.imageProvider]);

  // Save configuration
  const handleSave = useCallback(() => {
    setAIConfig(config);
    setHasChanges(false);
  }, [config]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    const defaultConfig = resetAIConfig();
    setConfigState(defaultConfig);
    setHasChanges(false);
    setTextTestResult({ status: 'idle' });
    setImageTestResult({ status: 'idle' });
    setImagePreview(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Configuration IA</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Text Provider Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Provider Texte
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(Object.keys(TEXT_PROVIDERS) as TextProvider[]).map((provider) => {
                const providerConfig = TEXT_PROVIDERS[provider];
                const isAvailable = isTextProviderAvailable(provider);
                const isSelected = config.textProvider === provider;

                return (
                  <button
                    key={provider}
                    onClick={() => handleTextProviderChange(provider)}
                    disabled={!isAvailable}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all text-left',
                      isSelected
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300',
                      !isAvailable && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="font-medium">{providerConfig.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Latence: {providerConfig.latency}
                    </div>
                    <div className="text-xs text-gray-500">
                      {providerConfig.free}
                    </div>
                    {!isAvailable && (
                      <div className="text-xs text-orange-600 mt-2">
                        Clé API requise
                      </div>
                    )}
                    {!providerConfig.commercial && isAvailable && (
                      <div className="text-xs text-yellow-600 mt-2">
                        Test uniquement
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Model selection - Dynamic for LocalAI and OpenRouter */}
            {config.textProvider === 'openrouter' ? (
              <div className="space-y-3">
                {/* Auto mode info for OpenRouter */}
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Mode automatique activé
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Le meilleur modèle gratuit est sélectionné selon la tâche:
                  </p>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                    <div><strong>Toutes tâches</strong> → gemini-2.0-flash-exp:free (rapide, gratuit)</div>
                    <div className="text-green-600 dark:text-green-400">✓ 100% gratuit - aucun coût</div>
                  </div>
                </div>

                {/* Comparison with LocalAI */}
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-xs">
                  <div className="font-medium text-purple-700 dark:text-purple-300 mb-1">
                    ⚡ 50-300x plus rapide que LocalAI
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    OpenRouter: ~100-500ms | LocalAI: ~5-30s
                  </div>
                </div>

                {/* Manual model override */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium">Modèle par défaut:</label>
                  <select
                    value={config.textModel}
                    onChange={(e) => handleTextModelChange(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800 text-sm"
                  >
                    {TEXT_PROVIDERS.openrouter.models.map((model) => (
                      <option key={model} value={model}>
                        {model.replace(':free', ' (gratuit)')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Test button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleTestTextProvider}
                    disabled={textTestResult.status === 'testing'}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium transition-colors',
                      textTestResult.status === 'testing'
                        ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    )}
                  >
                    {textTestResult.status === 'testing' ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Test...
                      </span>
                    ) : (
                      'Tester'
                    )}
                  </button>
                </div>
              </div>
            ) : config.textProvider === 'localai' ? (
              <div className="space-y-3">
                {/* Auto mode toggle */}
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Mode automatique</label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Sélectionne le meilleur modèle selon la tâche
                    </p>
                  </div>
                  <button
                    onClick={() => handleAutoModeToggle(!config.autoModelSelection)}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      config.autoModelSelection ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                        config.autoModelSelection ? 'translate-x-6' : 'translate-x-1'
                      )}
                    />
                  </button>
                </div>

                {config.autoModelSelection && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <strong>Toutes tâches</strong> → qwen2 (minimum viable)<br/>
                    <strong>Tâches lourdes</strong> (traduire, développer) → mistral si disponible
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {config.autoModelSelection ? 'Modèle par défaut:' : 'Modèle LocalAI:'}
                  </label>
                  <button
                    onClick={() => fetchLocalAIModels(true)}
                    disabled={isLoadingModels}
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    <svg className={cn("w-3 h-3", isLoadingModels && "animate-spin")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Actualiser
                  </button>
                </div>

                {/* Model cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {localAIModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => model.installed && handleTextModelChange(model.id)}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        config.textModel === model.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : model.installed
                          ? 'border-gray-200 dark:border-gray-700 hover:border-purple-300 cursor-pointer'
                          : 'border-dashed border-gray-300 dark:border-gray-600 opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{model.name}</span>
                        {model.installed ? (
                          <span className="text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">
                            Installé
                          </span>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowInstallCommand(showInstallCommand === model.id ? null : model.id);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 underline"
                          >
                            Installer
                          </button>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {model.size} • {model.speed} • {model.quality}
                      </div>
                      {showInstallCommand === model.id && !model.installed && (
                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono">
                          <code>./docker/ai/download-model.sh {model.id}</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {localAIModels.length === 0 && !isLoadingModels && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    LocalAI non disponible ou aucun modèle installé
                  </div>
                )}

                {/* Test button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleTestTextProvider}
                    disabled={textTestResult.status === 'testing'}
                    className={cn(
                      'px-4 py-2 rounded-lg font-medium transition-colors',
                      textTestResult.status === 'testing'
                        ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    )}
                  >
                    {textTestResult.status === 'testing' ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Test...
                      </span>
                    ) : (
                      'Tester'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Modèle:</label>
                <select
                  value={config.textModel}
                  onChange={(e) => handleTextModelChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800"
                >
                  {TEXT_PROVIDERS[config.textProvider].models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTestTextProvider}
                  disabled={textTestResult.status === 'testing'}
                  className={cn(
                    'px-4 py-2 rounded-lg font-medium transition-colors',
                    textTestResult.status === 'testing'
                      ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  )}
                >
                  {textTestResult.status === 'testing' ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Test...
                    </span>
                  ) : (
                    'Tester'
                  )}
                </button>
              </div>
            )}

            {/* Test result */}
            {textTestResult.status === 'success' && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Connecté ({textTestResult.latencyMs}ms)
              </div>
            )}
            {textTestResult.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Erreur: {textTestResult.error}
              </div>
            )}
          </section>

          {/* Image Provider Section */}
          <section className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Provider Images
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(Object.keys(IMAGE_PROVIDERS) as ImageProvider[]).map((provider) => {
                const providerConfig = IMAGE_PROVIDERS[provider];
                const isAvailable = isImageProviderAvailable(provider);
                const isSelected = config.imageProvider === provider;

                return (
                  <button
                    key={provider}
                    onClick={() => handleImageProviderChange(provider)}
                    disabled={!isAvailable}
                    className={cn(
                      'p-4 rounded-lg border-2 transition-all text-left',
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300',
                      !isAvailable && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="font-medium">{providerConfig.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Latence: {providerConfig.latency}
                    </div>
                    <div className="text-xs text-gray-500">
                      {providerConfig.free}
                    </div>
                    {!isAvailable && (
                      <div className="text-xs text-orange-600 mt-2">
                        Clé API requise
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Model selection */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Modèle:</label>
              <select
                value={config.imageModel}
                onChange={(e) => handleImageModelChange(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg dark:bg-gray-800"
              >
                {IMAGE_PROVIDERS[config.imageProvider].models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <button
                onClick={handleTestImageProvider}
                disabled={imageTestResult.status === 'testing'}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium transition-colors',
                  imageTestResult.status === 'testing'
                    ? 'bg-gray-200 dark:bg-gray-700 cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                )}
              >
                {imageTestResult.status === 'testing' ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Génération...
                  </span>
                ) : (
                  'Générer test'
                )}
              </button>
            </div>

            {/* Test result */}
            {imageTestResult.status === 'success' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Image générée
                </div>
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Test image"
                    className="w-full max-w-sm rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
            )}
            {imageTestResult.status === 'error' && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Erreur: {imageTestResult.error}
              </div>
            )}
          </section>

          {/* API Keys Info */}
          <section className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <h4 className="font-medium mb-2">Clés API</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Les clés API sont configurées via les variables d&apos;environnement:
            </p>
            <div className="space-y-1 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-purple-600">NEXT_PUBLIC_GEMINI_API_KEY</span>
                <span className="text-gray-400">-</span>
                <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  aistudio.google.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600">NEXT_PUBLIC_OPENROUTER_API_KEY</span>
                <span className="text-gray-400">-</span>
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  openrouter.ai (18+ modèles gratuits)
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-purple-600">NEXT_PUBLIC_GROQ_API_KEY</span>
                <span className="text-gray-400">-</span>
                <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  console.groq.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600">NEXT_PUBLIC_HUGGINGFACE_API_KEY</span>
                <span className="text-gray-400">-</span>
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  huggingface.co (gratuit, images FLUX)
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600">NEXT_PUBLIC_TOGETHER_API_KEY</span>
                <span className="text-gray-400">-</span>
                <a href="https://api.together.xyz" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  api.together.xyz
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-600">NEXT_PUBLIC_POLLINATIONS_API_KEY</span>
                <span className="text-gray-400">-</span>
                <a href="https://enter.pollinations.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  enter.pollinations.ai
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors text-sm"
          >
            Réinitialiser par défaut
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={cn(
                'px-4 py-2 rounded-lg font-medium transition-colors',
                hasChanges
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              )}
            >
              Sauvegarder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISettingsPanel;
