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

interface AddDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddDocumentDialog = ({ open, onOpenChange, onSuccess }: AddDocumentDialogProps) => {
  const [documentType, setDocumentType] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date>();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!documentType || !documentName || files.length === 0) {
      toast.error("Compila tutti i campi obbligatori e carica un file");
      return;
    }

    setLoading(true);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentType}_${Date.now()}.${fileExt}`;
      const filePath = `safety-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      const { error } = await supabase
        .from('safety_documents')
        .insert({
          document_type: documentType,
          document_name: documentName,
          document_url: publicUrl,
          upload_date: format(new Date(), 'yyyy-MM-dd'),
          expiry_date: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : null,
        });

      if (error) throw error;

      toast.success("Documento caricato con successo");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error adding document:', error);
      toast.error("Errore durante il caricamento del documento");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDocumentType("");
    setDocumentName("");
    setExpiryDate(undefined);
    setFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Carica Documento</DialogTitle>
          <DialogDescription>
            Aggiungi un documento di sicurezza
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="document-type">Tipo Documento *</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DUVRI">DUVRI</SelectItem>
                <SelectItem value="DVR">DVR - Documento Valutazione Rischi</SelectItem>
                <SelectItem value="Procedura">Procedura di Sicurezza</SelectItem>
                <SelectItem value="Piano Emergenza">Piano di Emergenza</SelectItem>
                <SelectItem value="Registro">Registro Antincendio</SelectItem>
                <SelectItem value="Altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="document-name">Nome Documento *</Label>
            <Input
              id="document-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Es. DUVRI 2024"
            />
          </div>

          <div>
            <Label>Data Scadenza (opzionale)</Label>
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
            <Label>Carica File *</Label>
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
            {loading ? "Caricamento..." : "Carica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
