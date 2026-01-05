import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, RefreshCw, Plus } from "lucide-react";
import { useState, useEffect } from "react";

export type SimilarMaterialAction = "use_existing" | "update_existing" | "create_new";

export interface MaterialMatch {
  id: string;
  name: string;
  code: string;
  similarity: number;
  unit?: string;
  supplier_id?: string | null;
}

interface SimilarMaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newName: string;
  matches: MaterialMatch[];
  onAction: (action: SimilarMaterialAction, selectedMatch?: MaterialMatch) => void;
  isLoading?: boolean;
}

export function SimilarMaterialDialog({
  open,
  onOpenChange,
  newName,
  matches,
  onAction,
  isLoading = false,
}: SimilarMaterialDialogProps) {
  const [selectedAction, setSelectedAction] = useState<SimilarMaterialAction>("use_existing");
  const [selectedMatchId, setSelectedMatchId] = useState<string>(matches[0]?.id || "");

  // Reset selection when matches change
  useEffect(() => {
    if (matches.length > 0) {
      setSelectedMatchId(matches[0].id);
      setSelectedAction("use_existing");
    }
  }, [matches]);

  const handleConfirm = () => {
    const selectedMatch = matches.find(m => m.id === selectedMatchId);
    onAction(selectedAction, selectedMatch);
  };

  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}%`;
  };

  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Articolo simile trovato
          </DialogTitle>
          <DialogDescription>
            Stai inserendo "<strong className="text-foreground">{newName}</strong>" ma abbiamo trovato articoli simili in anagrafica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Similar matches found */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Articoli simili trovati:</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {matches.slice(0, 5).map((match) => (
                <div
                  key={match.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedMatchId === match.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{match.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {formatSimilarity(match.similarity)} simile
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 ml-6">
                    Codice: {match.code}
                    {match.unit && <span> • Unità: {match.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cosa vuoi fare?</Label>
            <RadioGroup value={selectedAction} onValueChange={(v) => setSelectedAction(v as SimilarMaterialAction)}>
              <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="use_existing" id="mat_use_existing" className="mt-1" />
                <Label htmlFor="mat_use_existing" className="cursor-pointer flex-1">
                  <div className="font-medium">Usa esistente</div>
                  <div className="text-xs text-muted-foreground">
                    Collega a "{selectedMatch?.name || matches[0]?.name}" ({selectedMatch?.code || matches[0]?.code})
                  </div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="update_existing" id="mat_update_existing" className="mt-1" />
                <Label htmlFor="mat_update_existing" className="cursor-pointer flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Aggiorna esistente
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Aggiorna il nome dell'articolo a "{newName}"
                  </div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="create_new" id="mat_create_new" className="mt-1" />
                <Label htmlFor="mat_create_new" className="cursor-pointer flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <Plus className="h-3 w-3" />
                    Crea nuovo articolo
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Crea un nuovo articolo "{newName}"
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Annulla
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Elaborazione..." : "Conferma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
