import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Image, Loader2, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface WhatsAppImageDisplayProps {
  messageId: string;
  mediaId: string;
  accountId: string;
  isOutbound?: boolean;
}

export default function WhatsAppImageDisplay({
  messageId,
  mediaId,
  accountId,
  isOutbound = false,
}: WhatsAppImageDisplayProps) {
  const isAlreadyUrl = mediaId && (mediaId.startsWith("http") || mediaId.startsWith("/"));
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(isAlreadyUrl ? mediaId : null);
  const [showModal, setShowModal] = useState(false);

  const downloadMedia = async () => {
    if (imageUrl) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-download-media", {
        body: {
          media_id: mediaId,
          account_id: accountId,
          message_id: messageId,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || "Errore download immagine");
      }

      setImageUrl(data.media_url);
    } catch (err: any) {
      toast.error("Impossibile scaricare l'immagine: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!imageUrl && mediaId && !isLoading) {
      downloadMedia();
    }
  }, [mediaId]);

  if (!imageUrl) {
    return (
      <div className="mb-1">
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${isOutbound ? "border-green-400/50 text-white hover:bg-green-700" : ""}`}
          onClick={downloadMedia}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Image className="h-4 w-4" />
          )}
          {isLoading ? "Scaricamento..." : "📷 Scarica immagine"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-1 relative group">
      <img
        src={imageUrl}
        alt="Immagine WhatsApp"
        className="max-w-full rounded cursor-pointer hover:opacity-90"
        style={{ maxHeight: "300px" }}
        onClick={() => setShowModal(true)}
      />
      <Button
        variant="secondary"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => setShowModal(true)}
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
      <MediaPreviewModal
        open={showModal}
        onOpenChange={setShowModal}
        url={imageUrl}
        name="Immagine WhatsApp"
        isVideo={false}
      />
    </div>
  );
}
