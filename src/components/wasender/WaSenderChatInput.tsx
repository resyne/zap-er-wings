import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, Paperclip, Image, FileText, Video, X, Loader2, Mic, Square, Play, Pause
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WaSenderChatInputProps {
  conversationId: string;
  customerPhone: string;
  accountId: string;
  onMessageSent: () => void;
  isSending: boolean;
  setIsSending: (val: boolean) => void;
}

type MediaType = "image" | "video" | "document" | "audio" | null;

export default function WaSenderChatInput({
  conversationId,
  customerPhone,
  accountId,
  onMessageSent,
  isSending,
  setIsSending,
}: WaSenderChatInputProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const getFileType = (file: File): MediaType => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const validateFile = (file: File): boolean => {
    const maxSizes: Record<string, number> = {
      image: 5 * 1024 * 1024,    // 5MB
      video: 50 * 1024 * 1024,   // 50MB
      audio: 16 * 1024 * 1024,   // 16MB for voice messages
      document: 100 * 1024 * 1024, // 100MB
    };

    const type = getFileType(file);
    const maxSize = maxSizes[type || "document"];

    if (file.size > maxSize) {
      toast.error(`File troppo grande. Max: ${maxSize / (1024 * 1024)}MB`);
      return false;
    }

    return true;
  };

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return;
    // Clear any voice recording when selecting a file
    clearVoiceRecording();
    setSelectedFile(file);
    setMediaType(getFileType(file));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const openFilePicker = (type: MediaType) => {
    setMediaType(type);
    const accept = type === "image" ? "image/*" : 
                   type === "video" ? "video/*" : 
                   type === "audio" ? "audio/*" :
                   ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
    
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setMediaType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearVoiceRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlayingPreview(false);
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
  };

  const startRecording = async () => {
    try {
      // Clear any existing file selection
      clearFile();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        setMediaType("audio");
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Impossibile accedere al microfono. Verifica i permessi.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const togglePreviewPlayback = () => {
    if (!audioPreviewRef.current) return;

    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const uploadFile = async (file: File | Blob, extension: string = ''): Promise<string | null> => {
    const fileExt = file instanceof File ? file.name.split(".").pop() : extension;
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${conversationId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("wasender-media")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      toast.error("Errore durante il caricamento del file");
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("wasender-media")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const sendMessage = async () => {
    if (!message.trim() && !selectedFile && !audioBlob) return;
    
    setIsSending(true);
    setIsUploading(!!selectedFile || !!audioBlob);

    try {
      let mediaUrl: string | null = null;
      let currentMediaType = mediaType;

      // Upload file or voice recording
      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile);
        if (!mediaUrl) {
          setIsSending(false);
          setIsUploading(false);
          return;
        }
      } else if (audioBlob) {
        mediaUrl = await uploadFile(audioBlob, 'webm');
        currentMediaType = "audio";
        if (!mediaUrl) {
          setIsSending(false);
          setIsUploading(false);
          return;
        }
      }

      // Build request body
      const requestBody: Record<string, string> = {
        to: customerPhone,
        accountId,
        conversationId,
      };

      // Add sender user ID
      if (user?.id) {
        requestBody.sentBy = user.id;
      }

      if (message.trim()) {
        requestBody.text = message.trim();
      }

      if (mediaUrl && currentMediaType) {
        if (currentMediaType === "image") {
          requestBody.imageUrl = mediaUrl;
        } else if (currentMediaType === "video") {
          requestBody.videoUrl = mediaUrl;
        } else if (currentMediaType === "document") {
          requestBody.documentUrl = mediaUrl;
          requestBody.fileName = selectedFile?.name || "document";
        } else if (currentMediaType === "audio") {
          requestBody.audioUrl = mediaUrl;
        }
        requestBody.messageType = currentMediaType;
      }

      const { data, error } = await supabase.functions.invoke("wasender-send", {
        body: requestBody,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reset form
      setMessage("");
      clearFile();
      clearVoiceRecording();
      onMessageSent();
    } catch (error: any) {
      console.error("Send error:", error);
      toast.error(`Errore invio: ${error.message}`);
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div 
      className={`p-4 border-t transition-colors ${isDragOver ? "bg-emerald-50 border-emerald-400" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Hidden audio element for preview */}
      {audioUrl && (
        <audio 
          ref={audioPreviewRef} 
          src={audioUrl} 
          onEnded={() => setIsPlayingPreview(false)}
          className="hidden"
        />
      )}

      {/* Drop zone overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/90 z-10 pointer-events-none">
          <div className="text-center">
            <Paperclip className="h-12 w-12 mx-auto text-emerald-600 mb-2" />
            <p className="text-emerald-700 font-medium">Rilascia il file qui</p>
          </div>
        </div>
      )}

      {/* Selected file preview */}
      {selectedFile && (
        <div className="mb-3 p-2 bg-muted rounded-lg flex items-center gap-2">
          {mediaType === "image" && <Image className="h-5 w-5 text-blue-500" />}
          {mediaType === "video" && <Video className="h-5 w-5 text-purple-500" />}
          {mediaType === "document" && <FileText className="h-5 w-5 text-orange-500" />}
          {mediaType === "audio" && <Mic className="h-5 w-5 text-pink-500" />}
          <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
          <span className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <Button variant="ghost" size="sm" onClick={clearFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Voice recording preview */}
      {audioBlob && !isRecording && (
        <div className="mb-3 p-2 bg-pink-50 rounded-lg flex items-center gap-2">
          <Mic className="h-5 w-5 text-pink-500" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={togglePreviewPlayback}
            className="p-1"
          >
            {isPlayingPreview ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <span className="text-sm flex-1">Messaggio vocale</span>
          <span className="text-xs text-muted-foreground">
            {formatTime(recordingTime)}
          </span>
          <Button variant="ghost" size="sm" onClick={clearVoiceRecording}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="mb-3 p-3 bg-red-50 rounded-lg flex items-center gap-3 animate-pulse">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-red-700">Registrazione in corso...</span>
          <span className="text-sm text-red-600 font-mono">{formatTime(recordingTime)}</span>
          <div className="flex-1" />
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={stopRecording}
            className="gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileInputChange}
        />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" disabled={isSending || isRecording}>
              <Paperclip className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="bg-popover">
            <DropdownMenuItem onClick={() => openFilePicker("image")}>
              <Image className="h-4 w-4 mr-2 text-blue-500" />
              Immagine
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker("video")}>
              <Video className="h-4 w-4 mr-2 text-purple-500" />
              Video
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker("document")}>
              <FileText className="h-4 w-4 mr-2 text-orange-500" />
              Documento (PDF, DOC, ecc.)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker("audio")}>
              <Mic className="h-4 w-4 mr-2 text-pink-500" />
              File Audio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Voice recording button */}
        <Button 
          variant={isRecording ? "destructive" : "outline"} 
          size="icon" 
          disabled={isSending || !!selectedFile}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Ferma registrazione" : "Registra messaggio vocale"}
        >
          {isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        <Input
          placeholder={
            isRecording ? "Registrazione in corso..." :
            selectedFile ? "Aggiungi una didascalia..." : 
            audioBlob ? "Aggiungi una didascalia..." :
            "Scrivi un messaggio..."
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending || isRecording}
        />
        
        <Button 
          onClick={sendMessage}
          disabled={((!message.trim() && !selectedFile && !audioBlob) || isSending || isRecording)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground mt-2">
        Trascina un file, usa 📎 per allegare media, o 🎤 per registrare un messaggio vocale
      </p>
    </div>
  );
}
