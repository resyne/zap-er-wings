import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ExternalLink, Copy, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GenerateConfiguratorLinkProps {
  leadId: string;
  leadName: string;
  pipeline: string;
  existingLink?: string | null;
}

export const GenerateConfiguratorLink = ({
  leadId,
  leadName,
  pipeline,
  existingLink,
}: GenerateConfiguratorLinkProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [link, setLink] = useState<string | null>(existingLink || null);
  const [showDialog, setShowDialog] = useState(false);

  // Only show for vesuviano pipeline
  if (pipeline !== "vesuviano") {
    return null;
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-configurator-link",
        {
          body: { leadId },
        }
      );

      if (error) throw error;

      if (data.success) {
        setLink(data.link);
        setShowDialog(true);
        
        if (data.isExisting) {
          toast.success("Link esistente recuperato");
        } else {
          toast.success("Link configuratore generato con successo!");
        }
      }
    } catch (error: any) {
      console.error("Error generating link:", error);
      toast.error(error.message || "Errore nella generazione del link");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (link) {
      navigator.clipboard.writeText(link);
      toast.success("Link copiato!");
    }
  };

  const openLink = () => {
    if (link) {
      window.open(link, "_blank");
    }
  };

  return (
    <>
      <Button
        variant={link ? "outline" : "default"}
        size="sm"
        onClick={link ? () => setShowDialog(true) : handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generazione...
          </>
        ) : link ? (
          <>
            <ExternalLink className="h-4 w-4 mr-2" />
            Vedi Link
          </>
        ) : (
          "Genera Link Configuratore"
        )}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Configuratore - {leadName}</DialogTitle>
            <DialogDescription>
              Link univoco per il configuratore prodotti
            </DialogDescription>
          </DialogHeader>
          
          {link && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg break-all text-sm">
                {link}
              </div>
              
              <div className="flex gap-2">
                <Button onClick={copyToClipboard} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copia
                </Button>
                <Button onClick={openLink} className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apri
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
