import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, Paperclip, Image, FileText, Video, X, Loader2 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

type MediaType = "image" | "video" | "document" | null;

export default function WaSenderChatInput({
  conversationId,
  customerPhone,
  accountId,
  onMessageSent,
  isSending,
  setIsSending,
}: WaSenderChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (file: File): MediaType => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return "document";
  };

  const validateFile = (file: File): boolean => {
    const maxSizes: Record<string, number> = {
      image: 5 * 1024 * 1024,    // 5MB
      video: 50 * 1024 * 1024,   // 50MB
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

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split(".").pop();
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
    if (!message.trim() && !selectedFile) return;
    
    setIsSending(true);
    setIsUploading(!!selectedFile);

    try {
      let mediaUrl: string | null = null;

      // Upload file if present
      if (selectedFile) {
        mediaUrl = await uploadFile(selectedFile);
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

      if (message.trim()) {
        requestBody.text = message.trim();
      }

      if (mediaUrl && mediaType) {
        if (mediaType === "image") {
          requestBody.imageUrl = mediaUrl;
        } else if (mediaType === "video") {
          requestBody.videoUrl = mediaUrl;
        } else if (mediaType === "document") {
          requestBody.documentUrl = mediaUrl;
          requestBody.fileName = selectedFile?.name || "document";
        }
        requestBody.messageType = mediaType;
      }

      const { data, error } = await supabase.functions.invoke("wasender-send", {
        body: requestBody,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Reset form
      setMessage("");
      clearFile();
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
          <span className="text-sm flex-1 truncate">{selectedFile.name}</span>
          <span className="text-xs text-muted-foreground">
            {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
          </span>
          <Button variant="ghost" size="sm" onClick={clearFile}>
            <X className="h-4 w-4" />
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
            <Button variant="outline" size="icon" disabled={isSending}>
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
          </DropdownMenuContent>
        </DropdownMenu>

        <Input
          placeholder={selectedFile ? "Aggiungi una didascalia..." : "Scrivi un messaggio..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        
        <Button 
          onClick={sendMessage}
          disabled={((!message.trim() && !selectedFile) || isSending)}
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
        Trascina un file qui oppure usa 📎 per allegare immagini, video o documenti
      </p>
    </div>
  );
}
