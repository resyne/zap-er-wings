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

interface AddMedicalCheckupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Array<{ id: string; full_name: string }>;
  onSuccess: () => void;
}

export const AddMedicalCheckupDialog = ({ open, onOpenChange, employees, onSuccess }: AddMedicalCheckupDialogProps) => {
  const [employeeId, setEmployeeId] = useState("");
  const [checkupDate, setCheckupDate] = useState<Date>();
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [doctorName, setDoctorName] = useState("");
  const [result, setResult] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!employeeId || !checkupDate || !expiryDate) {
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
        const fileName = `${employeeId}_medical_${Date.now()}.${fileExt}`;
        const filePath = `medical-certificates/${fileName}`;

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
        .from('medical_checkups')
        .insert({
          employee_id: employeeId,
          checkup_date: format(checkupDate, 'yyyy-MM-dd'),
          expiry_date: format(expiryDate, 'yyyy-MM-dd'),
          doctor_name: doctorName || null,
          result: result || null,
          certificate_url: certificateUrl,
        });

      if (error) throw error;

      toast.success("Visita medica registrata con successo");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error adding medical checkup:', error);
      toast.error("Errore durante la registrazione della visita medica");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmployeeId("");
    setCheckupDate(undefined);
    setExpiryDate(undefined);
    setDoctorName("");
    setResult("");
    setFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registra Visita Medica</DialogTitle>
          <DialogDescription>
            Aggiungi una nuova visita dal medico competente
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
            <Label>Data Visita *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !checkupDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {checkupDate ? format(checkupDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={checkupDate}
                  onSelect={setCheckupDate}
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
            <Label htmlFor="doctor-name">Nome Medico (opzionale)</Label>
            <Input
              id="doctor-name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Dr. Nome Cognome"
            />
          </div>

          <div>
            <Label htmlFor="result">Esito (opzionale)</Label>
            <Input
              id="result"
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="Es. Idoneo"
            />
          </div>

          <div>
            <Label>Carica Certificato (opzionale)</Label>
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
