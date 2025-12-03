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
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden border-0 bg-transparent [&>button]:hidden">
        <DialogTitle className="sr-only">{name}</DialogTitle>
        
        <div className="relative w-full h-full">
          {/* Large close X button - always visible */}
          <Button
            variant="secondary"
            size="icon"
            className="fixed top-4 right-4 z-[100] h-12 w-12 rounded-full bg-white shadow-lg border-2 border-gray-200 hover:bg-gray-100"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-7 w-7 text-black" />
          </Button>
          
          <div 
            className="flex items-center justify-center w-full h-full min-h-[50vh] bg-black/95 rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            {isVideo ? (
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-[85vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
