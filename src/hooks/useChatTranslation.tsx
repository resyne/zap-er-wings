import { useState, useCallback } from 'react';
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

export function useChatTranslation() {
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const [isTranslating, setIsTranslating] = useState<Set<string>>(new Set());
  const [outboundTranslation, setOutboundTranslation] = useState<{
    original: string;
    translated: string;
    targetLang: string;
  } | null>(null);
  const [isTranslatingOutbound, setIsTranslatingOutbound] = useState(false);

  // Translate incoming message to Italian (auto-detect source)
  const translateIncoming = useCallback(async (messageId: string, text: string): Promise<TranslationResult | null> => {
    // Check cache first
    const cacheKey = `incoming_${messageId}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    // Check if already translating
    if (isTranslating.has(cacheKey)) {
      return null;
    }

    setIsTranslating(prev => new Set(prev).add(cacheKey));

    try {
      const { data, error } = await supabase.functions.invoke('translate-chat-message', {
        body: {
          text,
          target_language: 'it' // Always translate to Italian for incoming
        }
      });

      if (error) {
        console.error('Translation error:', error);
        return null;
      }

      const result = data as TranslationResult;
      
      // Cache the result
      setTranslationCache(prev => ({
        ...prev,
        [cacheKey]: result
      }));

      return result;
    } catch (err) {
      console.error('Translation failed:', err);
      return null;
    } finally {
      setIsTranslating(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [translationCache, isTranslating]);

  // Translate outbound message from Italian to target language
  const translateOutbound = useCallback(async (text: string, targetLanguage: string): Promise<string | null> => {
    if (!text.trim()) return null;

    setIsTranslatingOutbound(true);

    try {
      const { data, error } = await supabase.functions.invoke('translate-chat-message', {
        body: {
          text,
          target_language: targetLanguage,
          source_language: 'it' // We're writing in Italian
        }
      });

      if (error) {
        toast.error('Errore traduzione: ' + error.message);
        return null;
      }

      const result = data as TranslationResult;
      
      if (result.success) {
        setOutboundTranslation({
          original: text,
          translated: result.translation,
          targetLang: targetLanguage
        });
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

  // Clear outbound translation
  const clearOutboundTranslation = useCallback(() => {
    setOutboundTranslation(null);
  }, []);

  // Check if a message is being translated
  const isMessageTranslating = useCallback((messageId: string) => {
    return isTranslating.has(`incoming_${messageId}`);
  }, [isTranslating]);

  // Get cached translation for a message
  const getCachedTranslation = useCallback((messageId: string): TranslationResult | null => {
    return translationCache[`incoming_${messageId}`] || null;
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

// Detect language from country
export const getLanguageFromCountry = (country: string | null | undefined): string => {
  if (!country) return 'en';
  
  const countryLower = country.toLowerCase();
  
  if (countryLower.includes('spagna') || countryLower.includes('spain') || countryLower.includes('messico') || countryLower.includes('argentina')) {
    return 'es';
  }
  if (countryLower.includes('francia') || countryLower.includes('france') || countryLower.includes('belgi')) {
    return 'fr';
  }
  if (countryLower.includes('germania') || countryLower.includes('germany') || countryLower.includes('austria') || countryLower.includes('svizzer')) {
    return 'de';
  }
  if (countryLower.includes('portogallo') || countryLower.includes('portugal') || countryLower.includes('brasil')) {
    return 'pt';
  }
  if (countryLower.includes('italia') || countryLower.includes('italy')) {
    return 'it';
  }
  if (countryLower.includes('uk') || countryLower.includes('regno unito') || countryLower.includes('inghilterra') || countryLower.includes('usa') || countryLower.includes('stati uniti') || countryLower.includes('australia') || countryLower.includes('canada')) {
    return 'en';
  }
  
  return 'en'; // Default to English
};
