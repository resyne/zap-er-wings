import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, Play, Pause, Loader2, Languages, Volume2, ChevronDown, ChevronUp 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getLanguageFlag, getLanguageName } from "@/hooks/useChatTranslation";

interface WhatsAppAudioPlayerProps {
  messageId: string;
  mediaId: string; // The WhatsApp media ID or already-downloaded URL
  accountId: string;
  isDownloaded?: boolean;
  existingTranscription?: string | null;
  existingTranslation?: string | null;
  existingLanguage?: string | null;
  onTranscriptionComplete?: () => void;
}

export default function WhatsAppAudioPlayer({
  messageId,
  mediaId,
  accountId,
  isDownloaded = false,
  existingTranscription,
  existingTranslation,
  existingLanguage,
  onTranscriptionComplete
}: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(isDownloaded ? mediaId : null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Transcription state
  const [transcription, setTranscription] = useState<string | null>(existingTranscription || null);
  const [translation, setTranslation] = useState<string | null>(existingTranslation || null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(existingLanguage || null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscription, setShowTranscription] = useState(true);

  // Update state when props change
  useEffect(() => {
    if (existingTranscription) setTranscription(existingTranscription);
    if (existingTranslation) setTranslation(existingTranslation);
    if (existingLanguage) setDetectedLanguage(existingLanguage);
  }, [existingTranscription, existingTranslation, existingLanguage]);

  // If mediaId looks like a URL (already downloaded), use it directly
  useEffect(() => {
    if (mediaId && (mediaId.startsWith('http://') || mediaId.startsWith('https://'))) {
      setAudioUrl(mediaId);
    }
  }, [mediaId]);

  const downloadMedia = async () => {
    if (audioUrl) return audioUrl;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-download-media', {
        body: {
          media_id: mediaId,
          account_id: accountId,
          message_id: messageId
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Errore download audio');
      }

      setAudioUrl(data.media_url);
      return data.media_url;
    } catch (err: any) {
      toast.error('Impossibile scaricare l\'audio: ' + err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!audioRef.current) {
      // Need to download first
      const url = await downloadMedia();
      if (!url) return;
      
      // Wait for audio to be ready
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      }, 100);
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTranscribe = async () => {
    // Download first if needed
    let url = audioUrl;
    if (!url) {
      url = await downloadMedia();
      if (!url) return;
    }

    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-whatsapp-audio', {
        body: {
          audio_url: url,
          message_id: messageId
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Errore trascrizione');
      }

      setTranscription(data.transcription);
      setDetectedLanguage(data.detected_language);
      if (data.translated_text) {
        setTranslation(data.translated_text);
      }
      
      onTranscriptionComplete?.();
      toast.success('Audio trascritto');
    } catch (err: any) {
      toast.error('Trascrizione fallita: ' + err.message);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isNonItalian = detectedLanguage && !['it', 'italian'].includes(detectedLanguage.toLowerCase());

  return (
    <div className="space-y-2">
      {/* Audio Player */}
      <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        
        <div className="flex-1 min-w-0">
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Transcribe button */}
        {!transcription && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={handleTranscribe}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Languages className="h-3 w-3 mr-1" />
            )}
            Trascrivi
          </Button>
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Transcription display */}
      {transcription && (
        <div className="space-y-1.5 border-t border-current/10 pt-1.5">
          {/* Original transcription with language */}
          {isNonItalian && (
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-xs">{getLanguageFlag(detectedLanguage || '')}</span>
                <span className="text-[10px] opacity-60">
                  {getLanguageName(detectedLanguage || '')}
                </span>
              </div>
              <p className="text-xs opacity-70 italic whitespace-pre-wrap">{transcription}</p>
            </div>
          )}

          {/* Italian translation or original if already Italian */}
          {showTranscription && (
            <div className={isNonItalian ? "border-t border-current/10 pt-1" : ""}>
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-xs">🇮🇹</span>
                <span className="text-[10px] opacity-60">
                  {isNonItalian ? "Traduzione" : "Trascrizione"}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {translation || transcription}
              </p>
            </div>
          )}

          {/* Toggle transcription visibility */}
          {isNonItalian && (
            <button
              className="text-[10px] opacity-50 hover:opacity-80 underline"
              onClick={() => setShowTranscription(!showTranscription)}
            >
              {showTranscription ? "Nascondi traduzione" : "Mostra traduzione"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
