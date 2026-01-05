import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Building2, UserPlus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { SubjectMatch } from "@/lib/fuzzyMatch";

export type SimilarSubjectAction = "use_existing" | "update_existing" | "create_new";

interface SimilarSubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  newName: string;
  matches: SubjectMatch[];
  subjectType: "cliente" | "fornitore";
  onAction: (action: SimilarSubjectAction, selectedMatch?: SubjectMatch) => void;
  isLoading?: boolean;
}

export function SimilarSubjectDialog({
  open,
  onOpenChange,
  newName,
  matches,
  subjectType,
  onAction,
  isLoading = false,
}: SimilarSubjectDialogProps) {
  const [selectedAction, setSelectedAction] = useState<SimilarSubjectAction>("use_existing");
  const [selectedMatchId, setSelectedMatchId] = useState<string>(matches[0]?.id || "");

  const handleConfirm = () => {
    const selectedMatch = matches.find(m => m.id === selectedMatchId);
    onAction(selectedAction, selectedMatch);
  };

  const formatSimilarity = (similarity: number) => {
    return `${Math.round(similarity * 100)}%`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {subjectType === "cliente" ? "Cliente" : "Fornitore"} simile trovato
          </DialogTitle>
          <DialogDescription>
            Stai inserendo "<strong>{newName}</strong>" ma abbiamo trovato voci simili in anagrafica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Similar matches found */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Voci simili trovate:</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
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
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{match.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {formatSimilarity(match.similarity)} simile
                    </Badge>
                  </div>
                  {(match.code || match.tax_id) && (
                    <div className="text-xs text-muted-foreground mt-1 ml-6">
                      {match.code && <span>Codice: {match.code}</span>}
                      {match.code && match.tax_id && <span> • </span>}
                      {match.tax_id && <span>P.IVA: {match.tax_id}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cosa vuoi fare?</Label>
            <RadioGroup value={selectedAction} onValueChange={(v) => setSelectedAction(v as SimilarSubjectAction)}>
              <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="use_existing" id="use_existing" className="mt-1" />
                <Label htmlFor="use_existing" className="cursor-pointer flex-1">
                  <div className="font-medium">Usa esistente</div>
                  <div className="text-xs text-muted-foreground">
                    Collega a "{matches.find(m => m.id === selectedMatchId)?.name || matches[0]?.name}"
                  </div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="update_existing" id="update_existing" className="mt-1" />
                <Label htmlFor="update_existing" className="cursor-pointer flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <RefreshCw className="h-3 w-3" />
                    Aggiorna esistente
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Aggiorna il nome a "{newName}"
                  </div>
                </Label>
              </div>
              
              <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50">
                <RadioGroupItem value="create_new" id="create_new" className="mt-1" />
                <Label htmlFor="create_new" className="cursor-pointer flex-1">
                  <div className="font-medium flex items-center gap-2">
                    <UserPlus className="h-3 w-3" />
                    Crea nuovo
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Crea una nuova voce "{newName}"
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
