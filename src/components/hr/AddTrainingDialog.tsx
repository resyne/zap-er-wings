import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileUpload } from "@/components/ui/file-upload";

interface AddTrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: string; full_name: string }>;
  onSuccess: () => void;
}

export const AddTrainingDialog = ({ open, onOpenChange, employees, onSuccess }: AddTrainingDialogProps) => {
  const [employeeId, setEmployeeId] = useState("");
  const [trainingType, setTrainingType] = useState("");
  const [customTrainingType, setCustomTrainingType] = useState("");
  const [trainingDate, setTrainingDate] = useState<Date>();
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const finalTrainingType = trainingType === "altro" ? customTrainingType : trainingType;

  const handleSubmit = async () => {
    if (!employeeId || !finalTrainingType || !trainingDate || !expiryDate) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    setLoading(true);
    try {
      let certificateUrl = null;

      // Upload certificate if present
      if (files.length > 0) {
        const file = files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${employeeId}_${trainingType}_${Date.now()}.${fileExt}`;
        const filePath = `safety-certificates/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);

        certificateUrl = publicUrl;
      }

      const { error } = await supabase
        .from('safety_training_records')
        .insert({
          employee_id: employeeId,
          training_type: finalTrainingType,
          training_date: format(trainingDate, 'yyyy-MM-dd'),
          expiry_date: format(expiryDate, 'yyyy-MM-dd'),
          certificate_url: certificateUrl,
        });

      if (error) throw error;

      toast.success("Formazione aggiunta con successo");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error adding training:', error);
      toast.error("Errore durante l'aggiunta della formazione");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmployeeId("");
    setTrainingType("");
    setCustomTrainingType("");
    setTrainingDate(undefined);
    setExpiryDate(undefined);
    setFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Formazione</DialogTitle>
          <DialogDescription>
            Registra un nuovo attestato di formazione
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="employee">Dipendente *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona dipendente" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="training-type">Tipo Formazione *</Label>
            <Select value={trainingType} onValueChange={setTrainingType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generale">Formazione Generale</SelectItem>
                <SelectItem value="alto_rischio">Formazione Alto Rischio</SelectItem>
                <SelectItem value="pav_base">Formazione PAV (Base)</SelectItem>
                <SelectItem value="pes_esperto">Formazione PES (Esperto)</SelectItem>
                <SelectItem value="rspp">Formazione RSPP</SelectItem>
                <SelectItem value="antincendio">Antincendio</SelectItem>
                <SelectItem value="primo_soccorso">Primo Soccorso</SelectItem>
                <SelectItem value="preposto">Preposto</SelectItem>
                <SelectItem value="altro">Altro...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trainingType === "altro" && (
            <div>
              <Label htmlFor="custom-training-type">Specifica Tipo Formazione *</Label>
              <Input
                id="custom-training-type"
                value={customTrainingType}
                onChange={(e) => setCustomTrainingType(e.target.value)}
                placeholder="Es. Formazione Carrellisti"
              />
            </div>
          )}

          <div>
            <Label>Data Formazione *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !trainingDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {trainingDate ? format(trainingDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={trainingDate}
                  onSelect={setTrainingDate}
                  locale={it}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Data Scadenza *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  locale={it}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Carica Attestato (opzionale)</Label>
            <FileUpload
              value={files}
              onChange={setFiles}
              maxFiles={1}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
