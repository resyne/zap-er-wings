import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowUp, ArrowDown, FileText, CheckCircle, ExternalLink } from "lucide-react";

interface AccountingEntry {
  id: string;
  direction: string;
  document_type: string;
  amount: number;
  document_date: string;
  attachment_url: string;
  payment_method: string | null;
  subject_type: string | null;
  note: string | null;
  status: string;
  created_at: string;
}

const documentTypes = [
  { value: "fattura", label: "Fattura" },
  { value: "scontrino", label: "Scontrino / Ricevuta" },
  { value: "estratto_conto", label: "Estratto conto" },
  { value: "documento_interno", label: "Documento interno" },
  { value: "rapporto_intervento", label: "Rapporto di intervento" },
  { value: "altro", label: "Altro" },
];

const paymentMethods = [
  { value: "contanti", label: "Contanti" },
  { value: "carta", label: "Carta" },
  { value: "bonifico", label: "Bonifico" },
  { value: "anticipo_personale", label: "Anticipo personale" },
  { value: "non_so", label: "Non so" },
];

const subjectTypes = [
  { value: "cliente", label: "Cliente" },
  { value: "fornitore", label: "Fornitore" },
  { value: "interno", label: "Interno" },
];

export default function EventClassificationPage() {
  const queryClient = useQueryClient();
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null);
  const [editForm, setEditForm] = useState({
    direction: "",
    document_type: "",
    amount: "",
    document_date: "",
    payment_method: "",
    subject_type: "",
    note: "",
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["accounting-entries-to-classify"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select("*")
        .eq("status", "da_classificare")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AccountingEntry[];
    },
  });

  const classifyMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<AccountingEntry> }) => {
      const { error } = await supabase
        .from("accounting_entries")
        .update({ ...data.updates, status: "classificato" })
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      toast.success("Evento classificato con successo");
      setSelectedEntry(null);
    },
    onError: () => {
      toast.error("Errore durante la classificazione");
    },
  });

  const handleOpenEntry = (entry: AccountingEntry) => {
    setSelectedEntry(entry);
    setEditForm({
      direction: entry.direction,
      document_type: entry.document_type,
      amount: entry.amount.toString(),
      document_date: entry.document_date,
      payment_method: entry.payment_method || "",
      subject_type: entry.subject_type || "",
      note: entry.note || "",
    });
  };

  const handleClassify = () => {
    if (!selectedEntry) return;

    if (!editForm.direction || !editForm.document_type || !editForm.amount || !editForm.document_date) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    classifyMutation.mutate({
      id: selectedEntry.id,
      updates: {
        direction: editForm.direction,
        document_type: editForm.document_type,
        amount: parseFloat(editForm.amount),
        document_date: editForm.document_date,
        payment_method: editForm.payment_method || null,
        subject_type: editForm.subject_type || null,
        note: editForm.note || null,
      },
    });
  };

  const getDocumentTypeLabel = (value: string) => {
    return documentTypes.find((t) => t.value === value)?.label || value;
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Classificazione Eventi</h1>
        <p className="text-muted-foreground">
          {entries.length} eventi da classificare
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">Nessun evento da classificare</p>
            <p className="text-muted-foreground">Tutti gli eventi sono stati classificati</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleOpenEntry(entry)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        entry.direction === "entrata"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {entry.direction === "entrata" ? (
                        <ArrowUp className="h-5 w-5" />
                      ) : (
                        <ArrowDown className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        € {entry.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(entry.document_type)} •{" "}
                        {format(new Date(entry.document_date), "dd MMM yyyy", { locale: it })}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    Da classificare
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Classifica Evento</DialogTitle>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              {/* Allegato */}
              <div>
                <Label>Allegato</Label>
                <a
                  href={selectedEntry.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 border rounded-md hover:bg-accent transition-colors"
                >
                  <FileText className="h-5 w-5" />
                  <span className="flex-1 truncate">Visualizza documento</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              {/* Direzione */}
              <div className="space-y-2">
                <Label>Direzione *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={editForm.direction === "entrata" ? "default" : "outline"}
                    className={editForm.direction === "entrata" ? "bg-green-600 hover:bg-green-700" : ""}
                    onClick={() => setEditForm({ ...editForm, direction: "entrata" })}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Entrata
                  </Button>
                  <Button
                    type="button"
                    variant={editForm.direction === "uscita" ? "default" : "outline"}
                    className={editForm.direction === "uscita" ? "bg-red-600 hover:bg-red-700" : ""}
                    onClick={() => setEditForm({ ...editForm, direction: "uscita" })}
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Uscita
                  </Button>
                </div>
              </div>

              {/* Tipo Documento */}
              <div className="space-y-2">
                <Label>Tipo Documento *</Label>
                <Select
                  value={editForm.document_type}
                  onValueChange={(value) => setEditForm({ ...editForm, document_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Importo */}
              <div className="space-y-2">
                <Label>Importo Totale *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              {/* Data Documento */}
              <div className="space-y-2">
                <Label>Data Documento *</Label>
                <Input
                  type="date"
                  value={editForm.document_date}
                  onChange={(e) => setEditForm({ ...editForm, document_date: e.target.value })}
                />
              </div>

              {/* Metodo di pagamento */}
              <div className="space-y-2">
                <Label>Metodo di Pagamento</Label>
                <Select
                  value={editForm.payment_method}
                  onValueChange={(value) => setEditForm({ ...editForm, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Soggetto */}
              <div className="space-y-2">
                <Label>Soggetto</Label>
                <Select
                  value={editForm.subject_type}
                  onValueChange={(value) => setEditForm({ ...editForm, subject_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nota */}
              <div className="space-y-2">
                <Label>Nota</Label>
                <Textarea
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value.slice(0, 140) })}
                  placeholder="Max 140 caratteri"
                  maxLength={140}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {editForm.note.length}/140
                </p>
              </div>

              <Button
                onClick={handleClassify}
                disabled={classifyMutation.isPending}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {classifyMutation.isPending ? "Classificazione..." : "Classifica Evento"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
