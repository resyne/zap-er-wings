import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface MediaPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  name: string;
  isVideo: boolean;
}

export function MediaPreviewModal({ open, onOpenChange, url, name, isVideo }: MediaPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        
        {/* Large close button for mobile */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 z-50 h-10 w-10 rounded-full bg-black/70 hover:bg-black/90 text-white"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-6 w-6" />
        </Button>
        
        <div 
          className="flex items-center justify-center w-full h-full min-h-[50vh] bg-black"
          onClick={() => onOpenChange(false)}
        >
          {isVideo ? (
            <video
              src={url}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={url}
              alt={name}
              className="max-w-full max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
