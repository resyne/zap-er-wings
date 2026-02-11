import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Video, Loader2, Play, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface WhatsAppVideoPlayerProps {
  messageId: string;
  mediaId: string;
  accountId: string;
  isDownloaded?: boolean;
  isOutbound?: boolean;
}

export default function WhatsAppVideoPlayer({
  messageId,
  mediaId,
  accountId,
  isDownloaded = false,
  isOutbound = false,
}: WhatsAppVideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(
    isDownloaded || (mediaId && mediaId.startsWith("http")) ? mediaId : null
  );
  const [showModal, setShowModal] = useState(false);

  const downloadMedia = async () => {
    if (videoUrl) return;
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
        throw new Error(data?.error || "Errore download video");
      }

      setVideoUrl(data.media_url);
    } catch (err: any) {
      toast.error("Impossibile scaricare il video: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!videoUrl) {
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
            <Video className="h-4 w-4" />
          )}
          {isLoading ? "Scaricamento..." : "🎬 Scarica video"}
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-1 relative group">
      <video
        src={videoUrl}
        controls
        className="max-w-full rounded cursor-pointer"
        style={{ maxHeight: "300px" }}
        preload="metadata"
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
        url={videoUrl}
        name="Video WhatsApp"
        isVideo={true}
      />
    </div>
  );
}
