import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { Smartphone } from "lucide-react";

const zAppPages = [
  { title: "Rapporto Intervento", url: "/hr/z-app/rapporti" },
  { title: "Registro Incasso/Spese", url: "/hr/z-app/registro" },
  { title: "Magazzino", url: "/hr/z-app/magazzino" },
  { title: "Commesse", url: "/hr/z-app/commesse" },
  { title: "Calendario Lavori", url: "/hr/z-app/calendario" },
  { title: "Comunicazioni", url: "/hr/z-app/comunicazioni" },
  { title: "Ordini", url: "/hr/z-app/ordini" },
  { title: "Ordini Fornitori", url: "/hr/z-app/ordini-fornitori" },
];

interface ZAppVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function ZAppVisibilityDialog({ open, onOpenChange, userId, userName }: ZAppVisibilityDialogProps) {
  const { toast } = useToast();
  const { pageVisibility, updatePageVisibility, refreshPageVisibility } = usePageVisibility(userId);
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) refreshPageVisibility();
  }, [open]);

  useEffect(() => {
    setLocalVisibility(pageVisibility);
  }, [pageVisibility]);

  const handleToggle = async (pageUrl: string, newValue: boolean) => {
    try {
      setLocalVisibility(prev => ({ ...prev, [pageUrl]: newValue }));
      await updatePageVisibility(pageUrl, newValue);
      toast({ title: "Successo", description: "Visibilità aggiornata" });
    } catch {
      setLocalVisibility(prev => ({ ...prev, [pageUrl]: !newValue }));
      toast({ title: "Errore", description: "Impossibile aggiornare", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Pagine Z-APP
          </DialogTitle>
          <DialogDescription>
            Scegli quali pagine Z-APP può vedere <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {zAppPages.map(page => (
            <div key={page.url} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
              <Label htmlFor={`zapp-${page.url}`} className="text-sm font-normal cursor-pointer flex-1">
                {page.title}
              </Label>
              <Switch
                id={`zapp-${page.url}`}
                checked={localVisibility[page.url] !== false}
                onCheckedChange={checked => handleToggle(page.url, checked)}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
