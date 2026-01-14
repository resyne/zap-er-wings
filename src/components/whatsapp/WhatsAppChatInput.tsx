import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, Mic, Paperclip, Image, FileText, 
  X, Loader2, Square, Play, Pause, Phone
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppChatInputProps {
  accountId: string;
  conversationPhone: string;
  onMessageSent: () => void;
  disabled?: boolean;
  userId?: string;
}

type MediaType = "image" | "document" | "audio" | "video";

export function WhatsAppChatInput({ 
  accountId, 
  conversationPhone, 
  onMessageSent, 
  disabled = false,
  userId
}: WhatsAppChatInputProps) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [audioUrl]);

  // File validation
  const MAX_SIZES: Record<MediaType, number> = {
    image: 5 * 1024 * 1024, // 5MB
    video: 16 * 1024 * 1024, // 16MB
    audio: 16 * 1024 * 1024, // 16MB
    document: 100 * 1024 * 1024, // 100MB
  };

  const getFileType = (file: File): MediaType => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  };

  const validateFile = (file: File): boolean => {
    const type = getFileType(file);
    const maxSize = MAX_SIZES[type];
    
    if (file.size > maxSize) {
      toast.error(`File troppo grande. Max ${Math.round(maxSize / 1024 / 1024)}MB per ${type}`);
      return false;
    }
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (!validateFile(file)) return;
    setSelectedFile(file);
    setMediaType(getFileType(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const clearFile = () => {
    setSelectedFile(null);
    setMediaType(null);
  };

  // Voice Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (err) {
      toast.error("Impossibile accedere al microfono");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const clearVoiceRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlayingPreview(false);
  };

  const togglePreviewPlayback = () => {
    if (!audioPreviewRef.current) return;
    
    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Upload file to Supabase storage
  const uploadFile = async (file: File | Blob, extension?: string): Promise<string> => {
    const ext = extension || (file instanceof File ? file.name.split(".").pop() : "ogg");
    const fileName = `whatsapp/${accountId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    
    const { error } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { contentType: file instanceof File ? file.type : "audio/ogg" });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  // Send message
  const sendMessage = async () => {
    if (isSending || disabled) return;
    
    try {
      setIsSending(true);
      
      // Handle voice note
      if (audioBlob) {
        setIsUploading(true);
        const mediaUrl = await uploadFile(audioBlob, "ogg");
        setIsUploading(false);
        
        const response = await supabase.functions.invoke("whatsapp-send", {
          body: {
            account_id: accountId,
            to: conversationPhone,
            type: "audio",
            media_url: mediaUrl,
            sent_by: userId
          }
        });
        
        if (response.error || !response.data?.success) {
          throw new Error(response.data?.error || "Errore invio audio");
        }
        
        clearVoiceRecording();
        onMessageSent();
        toast.success("Nota vocale inviata");
        return;
      }

      // Handle file attachment
      if (selectedFile && mediaType) {
        setIsUploading(true);
        const mediaUrl = await uploadFile(selectedFile);
        setIsUploading(false);
        
        const response = await supabase.functions.invoke("whatsapp-send", {
          body: {
            account_id: accountId,
            to: conversationPhone,
            type: mediaType,
            media_url: mediaUrl,
            media_caption: message.trim() || undefined,
            media_filename: mediaType === 'document' ? selectedFile.name : undefined,
            sent_by: userId
          }
        });
        
        if (response.error || !response.data?.success) {
          throw new Error(response.data?.error || "Errore invio file");
        }
        
        clearFile();
        setMessage("");
        onMessageSent();
        toast.success(`${mediaType === "image" ? "Immagine" : mediaType === "document" ? "Documento" : "Media"} inviato`);
        return;
      }

      // Handle text message
      if (message.trim()) {
        const response = await supabase.functions.invoke("whatsapp-send", {
          body: {
            account_id: accountId,
            to: conversationPhone,
            type: "text",
            content: message.trim(),
            sent_by: userId
          }
        });
        
        if (response.error || !response.data?.success) {
          throw new Error(response.data?.error || "Errore invio messaggio");
        }
        
        setMessage("");
        onMessageSent();
        toast.success("Messaggio inviato");
      }
    } catch (err: any) {
      toast.error(err.message || "Errore durante l'invio");
      console.error(err);
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && (message.trim() || selectedFile)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const openFilePicker = (type: "image" | "document") => {
    if (!fileInputRef.current) return;
    
    fileInputRef.current.accept = type === "image" 
      ? "image/*" 
      : ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
    fileInputRef.current.click();
  };

  return (
    <div 
      className={`relative space-y-2 ${isDragging ? "bg-primary/5 rounded-lg" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
          <p className="text-primary font-medium">Rilascia il file qui</p>
        </div>
      )}

      {/* File preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          {mediaType === "image" ? (
            <Image className="h-4 w-4 text-blue-600" />
          ) : (
            <FileText className="h-4 w-4 text-orange-600" />
          )}
          <span className="text-sm truncate flex-1">{selectedFile.name}</span>
          <span className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024).toFixed(0)} KB
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFile}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Voice recording preview */}
      {audioUrl && !isRecording && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={togglePreviewPlayback}
          >
            {isPlayingPreview ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-1 h-1 bg-primary/20 rounded-full">
            <div className="h-full bg-primary rounded-full w-full" />
          </div>
          <span className="text-xs text-muted-foreground">{formatTime(recordingTime)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearVoiceRecording}>
            <X className="h-3 w-3" />
          </Button>
          <audio 
            ref={audioPreviewRef} 
            src={audioUrl}
            onEnded={() => setIsPlayingPreview(false)}
          />
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
          <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm text-red-600 dark:text-red-400">Registrazione...</span>
          <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
          <Button 
            variant="destructive" 
            size="sm" 
            className="ml-auto"
            onClick={stopRecording}
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = "";
        }}
      />

      {/* Main input row */}
      <div className="flex items-center gap-2">
        {/* Call button - Coming soon with Twilio */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 shrink-0 opacity-50 cursor-not-allowed"
                disabled
              >
                <Phone className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Chiamate vocali - Coming soon (Twilio)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Attachment dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 shrink-0"
              disabled={disabled || isRecording || isSending}
            >
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => openFilePicker("image")}>
              <Image className="h-4 w-4 mr-2 text-blue-600" />
              Immagine
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openFilePicker("document")}>
              <FileText className="h-4 w-4 mr-2 text-orange-600" />
              Documento / PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Text input */}
        <Input
          placeholder={selectedFile ? "Aggiungi una didascalia..." : "Scrivi un messaggio..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isRecording || isSending}
          className="flex-1"
        />

        {/* Mic / Send button */}
        {!message.trim() && !selectedFile && !audioUrl ? (
          <Button
            variant={isRecording ? "destructive" : "ghost"}
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || isSending}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={sendMessage}
            disabled={disabled || isSending || isUploading}
          >
            {isSending || isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
