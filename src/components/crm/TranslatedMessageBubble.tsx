import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Languages, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useChatTranslation, getLanguageFlag, getLanguageName } from "@/hooks/useChatTranslation";

interface TranslatedMessageBubbleProps {
  messageId: string;
  originalText: string;
  isInbound: boolean; // Only translate inbound (customer) messages
}

export function TranslatedMessageBubble({ 
  messageId, 
  originalText,
  isInbound
}: TranslatedMessageBubbleProps) {
  const [showTranslation, setShowTranslation] = useState(true);
  const [translation, setTranslation] = useState<{
    translatedText: string;
    sourceLanguage: string;
    sourceLanguageName?: string;
    sameLanguage?: boolean;
  } | null>(null);
  const { translateIncoming, isMessageTranslating, getCachedTranslation } = useChatTranslation();

  // Trigger translation on mount for inbound non-Italian messages
  useEffect(() => {
    if (!isInbound || !originalText) return;

    const cached = getCachedTranslation(messageId);
    if (cached) {
      setTranslation({
        translatedText: cached.translation,
        sourceLanguage: cached.source_language,
        sourceLanguageName: cached.source_language_name,
        sameLanguage: cached.same_language
      });
      return;
    }

    // Only translate if it looks like non-Italian text
    // Simple heuristic: check for common Italian words
    const italianWords = ['ciao', 'buongiorno', 'grazie', 'salve', 'vorrei', 'avrei', 'posso', 'come', 'quando', 'dove', 'perché', 'sono', 'siamo', 'hai', 'abbiamo'];
    const lowerText = originalText.toLowerCase();
    const hasItalianWords = italianWords.some(word => lowerText.includes(word));
    
    // If it seems Italian, skip translation
    if (hasItalianWords && lowerText.length < 100) {
      return;
    }

    translateIncoming(messageId, originalText).then(result => {
      if (result && !result.same_language) {
        setTranslation({
          translatedText: result.translation,
          sourceLanguage: result.source_language,
          sourceLanguageName: result.source_language_name,
          sameLanguage: result.same_language
        });
      } else if (result?.same_language) {
        setTranslation({
          translatedText: originalText,
          sourceLanguage: result.source_language,
          sameLanguage: true
        });
      }
    });
  }, [messageId, originalText, isInbound, translateIncoming, getCachedTranslation]);

  const isTranslating = isMessageTranslating(messageId);

  // If not inbound, no translation needed, or same language
  if (!isInbound || !translation || translation.sameLanguage) {
    return <p className="text-sm whitespace-pre-wrap">{originalText}</p>;
  }

  return (
    <div className="space-y-1.5">
      {/* Original text with language indicator */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs">{getLanguageFlag(translation.sourceLanguage)}</span>
          <span className="text-xs opacity-70">
            {getLanguageName(translation.sourceLanguage)}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap opacity-70 italic">{originalText}</p>
      </div>
      
      {/* Translation */}
      {showTranslation && (
        <div className="border-t border-current/20 pt-1.5 mt-1.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">🇮🇹</span>
            <span className="text-xs opacity-70">Traduzione</span>
          </div>
          {isTranslating ? (
            <div className="flex items-center gap-2 text-xs opacity-70">
              <Loader2 className="h-3 w-3 animate-spin" />
              Traduzione in corso...
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{translation.translatedText}</p>
          )}
        </div>
      )}

      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-5 text-xs px-1 opacity-70 hover:opacity-100"
        onClick={() => setShowTranslation(!showTranslation)}
      >
        {showTranslation ? (
          <>
            <ChevronUp className="h-3 w-3 mr-0.5" />
            Nascondi traduzione
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-0.5" />
            Mostra traduzione
          </>
        )}
      </Button>
    </div>
  );
}
