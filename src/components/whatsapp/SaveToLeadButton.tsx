import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaveToLeadButtonProps {
  leadId: string;
  mediaUrl: string;
  messageId: string;
  accountId: string;
  messageType: string;
  isOutbound?: boolean;
}

export default function SaveToLeadButton({
  leadId,
  mediaUrl,
  messageId,
  accountId,
  messageType,
  isOutbound = false,
}: SaveToLeadButtonProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const getFileExtension = (type: string, url: string) => {
    const urlPath = url.split("?")[0];
    const urlExt = urlPath.split(".").pop()?.toLowerCase();
    if (urlExt && urlExt.length <= 5 && urlExt !== urlPath) return urlExt;
    switch (type) {
      case "image": return "jpg";
      case "video": return "mp4";
      case "audio": return "ogg";
      case "document": return "pdf";
      default: return "bin";
    }
  };

  const getMimeType = (type: string) => {
    switch (type) {
      case "image": return "image/jpeg";
      case "video": return "video/mp4";
      case "audio": return "audio/ogg";
      case "document": return "application/pdf";
      default: return "application/octet-stream";
    }
  };

  const resolveMediaUrl = async (): Promise<string> => {
    // If already a URL, return it
    if (mediaUrl.startsWith("http") || mediaUrl.startsWith("/")) {
      return mediaUrl;
    }
    // Otherwise it's a Meta media ID - download it first
    const { data, error } = await supabase.functions.invoke("whatsapp-download-media", {
      body: {
        media_id: mediaUrl,
        account_id: accountId,
        message_id: messageId,
      },
    });
    if (error || !data?.success) {
      throw new Error(data?.error || "Impossibile scaricare il media");
    }
    return data.media_url;
  };

  const handleSave = async () => {
    if (isSaving || isSaved) return;
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      // Resolve actual URL (download from Meta if needed)
      const actualUrl = await resolveMediaUrl();

      // Download the media file
      const response = await fetch(actualUrl);
      if (!response.ok) throw new Error("Impossibile scaricare il file");
      const blob = await response.blob();

      const ext = getFileExtension(messageType, actualUrl);
      const fileName = `whatsapp_${messageType}_${Date.now()}.${ext}`;
      const filePath = `${leadId}/${fileName}`;

      // Upload to lead-files bucket
      const { error: uploadError } = await supabase.storage
        .from("lead-files")
        .upload(filePath, blob, { contentType: blob.type || getMimeType(messageType) });

      if (uploadError) throw uploadError;

      // Save metadata to lead_files table
      const { error: dbError } = await supabase
        .from("lead_files")
        .insert([{
          lead_id: leadId,
          file_name: fileName,
          file_path: filePath,
          file_type: blob.type || getMimeType(messageType),
          file_size: blob.size,
          uploaded_by: user.id,
        }]);

      if (dbError) throw dbError;

      setIsSaved(true);
      toast.success("File salvato nel lead");
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isSaved) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        className={`gap-1 text-xs h-6 px-2 ${isOutbound ? "text-green-200" : "text-muted-foreground"}`}
      >
        <Check className="h-3 w-3" />
        Salvato
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleSave}
      disabled={isSaving}
      className={`gap-1 text-xs h-6 px-2 ${isOutbound ? "text-green-200 hover:bg-green-700" : "text-muted-foreground hover:bg-accent"}`}
      title="Salva nel Lead"
    >
      {isSaving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <FolderOpen className="h-3 w-3" />
      )}
      {isSaving ? "Salvataggio..." : "Salva nel Lead"}
    </Button>
  );
}
