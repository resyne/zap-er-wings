import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { toast } from "sonner";

interface PDFPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileUrl: string;
  onDownload: () => void;
}

export function PDFPreview({ 
  open, 
  onOpenChange, 
  fileName, 
  fileUrl, 
  onDownload 
}: PDFPreviewProps) {
  const [loading, setLoading] = useState(true);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    toast.error("Errore nel caricamento del PDF");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate">{fileName}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onDownload}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Scarica
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 relative bg-muted rounded-lg overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          
          <iframe
            src={fileUrl}
            title={fileName}
            className="w-full h-full border-0"
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}