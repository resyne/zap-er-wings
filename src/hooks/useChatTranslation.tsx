import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TranslationResult {
  success: boolean;
  translation: string;
  source_language: string;
  source_language_name?: string;
  target_language: string;
  original_text: string;
  same_language?: boolean;
  error?: string;
}

interface TranslationCache {
  [key: string]: TranslationResult;
}

// Global queue to throttle translation requests across all hook instances
const translationQueue: Array<{
  cacheKey: string;
  text: string;
  resolve: (result: TranslationResult | null) => void;
}> = [];
let isProcessingQueue = false;
const globalCache: TranslationCache = {};
const activeKeys = new Set<string>();

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (translationQueue.length > 0) {
    const item = translationQueue.shift()!;
    
    // Check global cache
    if (globalCache[item.cacheKey]) {
      item.resolve(globalCache[item.cacheKey]);
      continue;
    }

    try {
      const { data, error } = await supabase.functions.invoke('translate-chat-message', {
        body: { text: item.text, target_language: 'it' }
      });

      if (error) {
        console.error('Translation error:', error);
        // On rate limit, re-queue remaining with delay
        if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
          console.warn('Rate limited, pausing translation queue for 10s');
          translationQueue.unshift(item); // put it back
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        item.resolve(null);
      } else {
        const result = data as TranslationResult;
        globalCache[item.cacheKey] = result;
        item.resolve(result);
      }
    } catch (err) {
      console.error('Translation failed:', err);
      item.resolve(null);
    }

    activeKeys.delete(item.cacheKey);

    // Small delay between requests to avoid rate limiting
    if (translationQueue.length > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  isProcessingQueue = false;
}

export function useChatTranslation() {
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const [isTranslating, setIsTranslating] = useState<Set<string>>(new Set());
  const [outboundTranslation, setOutboundTranslation] = useState<{
    original: string;
    translated: string;
    targetLang: string;
  } | null>(null);
  const [isTranslatingOutbound, setIsTranslatingOutbound] = useState(false);

  // Translate incoming message to Italian (auto-detect source) - queued
  const translateIncoming = useCallback(async (messageId: string, text: string): Promise<TranslationResult | null> => {
    const cacheKey = `incoming_${messageId}`;
    
    // Check local cache
    if (translationCache[cacheKey]) return translationCache[cacheKey];
    // Check global cache
    if (globalCache[cacheKey]) {
      setTranslationCache(prev => ({ ...prev, [cacheKey]: globalCache[cacheKey] }));
      return globalCache[cacheKey];
    }
    // Already queued
    if (activeKeys.has(cacheKey)) return null;

    activeKeys.add(cacheKey);
    setIsTranslating(prev => new Set(prev).add(cacheKey));

    return new Promise<TranslationResult | null>((resolve) => {
      translationQueue.push({
        cacheKey,
        text,
        resolve: (result) => {
          if (result) {
            setTranslationCache(prev => ({ ...prev, [cacheKey]: result }));
          }
          setIsTranslating(prev => {
            const next = new Set(prev);
            next.delete(cacheKey);
            return next;
          });
          resolve(result);
        }
      });
      processQueue();
    });
  }, [translationCache]);

  // Translate outbound message from Italian to target language
  const translateOutbound = useCallback(async (text: string, targetLanguage: string): Promise<string | null> => {
    if (!text.trim()) return null;
    setIsTranslatingOutbound(true);

    try {
      const { data, error } = await supabase.functions.invoke('translate-chat-message', {
        body: { text, target_language: targetLanguage, source_language: 'it' }
      });

      if (error) {
        toast.error('Errore traduzione: ' + error.message);
        return null;
      }

      const result = data as TranslationResult;
      if (result.success) {
        setOutboundTranslation({ original: text, translated: result.translation, targetLang: targetLanguage });
        return result.translation;
      }
      return null;
    } catch (err: any) {
      toast.error('Traduzione fallita: ' + (err.message || 'Errore sconosciuto'));
      return null;
    } finally {
      setIsTranslatingOutbound(false);
    }
  }, []);

  const clearOutboundTranslation = useCallback(() => { setOutboundTranslation(null); }, []);

  const isMessageTranslating = useCallback((messageId: string) => {
    return isTranslating.has(`incoming_${messageId}`);
  }, [isTranslating]);

  const getCachedTranslation = useCallback((messageId: string): TranslationResult | null => {
    return translationCache[`incoming_${messageId}`] || globalCache[`incoming_${messageId}`] || null;
  }, [translationCache]);

  return {
    translateIncoming,
    translateOutbound,
    outboundTranslation,
    clearOutboundTranslation,
    isTranslatingOutbound,
    isMessageTranslating,
    getCachedTranslation
  };
}

// Language utilities
export const SUPPORTED_LANGUAGES = [
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'en', name: 'Inglese', flag: '🇬🇧' },
  { code: 'es', name: 'Spagnolo', flag: '🇪🇸' },
  { code: 'fr', name: 'Francese', flag: '🇫🇷' },
  { code: 'de', name: 'Tedesco', flag: '🇩🇪' },
  { code: 'pt', name: 'Portoghese', flag: '🇵🇹' }
];

export const getLanguageFlag = (langCode: string): string => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode.toLowerCase());
  return lang?.flag || '🌐';
};

export const getLanguageName = (langCode: string): string => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === langCode.toLowerCase());
  return lang?.name || langCode;
};

export const getLanguageFromCountry = (country: string | null | undefined): string => {
  if (!country) return 'en';
  const countryLower = country.toLowerCase();
  if (countryLower.includes('spagna') || countryLower.includes('spain') || countryLower.includes('messico') || countryLower.includes('argentina')) return 'es';
  if (countryLower.includes('francia') || countryLower.includes('france') || countryLower.includes('belgi')) return 'fr';
  if (countryLower.includes('germania') || countryLower.includes('germany') || countryLower.includes('austria') || countryLower.includes('svizzer')) return 'de';
  if (countryLower.includes('portogallo') || countryLower.includes('portugal') || countryLower.includes('brasil')) return 'pt';
  if (countryLower.includes('italia') || countryLower.includes('italy')) return 'it';
  if (countryLower.includes('uk') || countryLower.includes('regno unito') || countryLower.includes('inghilterra') || countryLower.includes('usa') || countryLower.includes('stati uniti') || countryLower.includes('australia') || countryLower.includes('canada')) return 'en';
  return 'en';
};
