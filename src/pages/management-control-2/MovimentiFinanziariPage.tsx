import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Filter, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Pencil,
  Eye,
  Link2
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface MovimentoFinanziario {
  id: string;
  data_movimento: string;
  importo: number;
  direzione: "entrata" | "uscita";
  metodo_pagamento: "banca" | "cassa" | "carta";
  soggetto_tipo: string | null;
  soggetto_id: string | null;
  soggetto_nome: string | null;
  allegato_url: string | null;
  allegato_nome: string | null;
  riferimento: string | null;
  descrizione: string | null;
  tipo_allocazione: string | null;
  scadenza_id: string | null;
  fattura_id: string | null;
  centro_costo_id: string | null;
  centro_ricavo_id: string | null;
  conto_id: string | null;
  prima_nota_id: string | null;
  stato: "grezzo" | "da_verificare" | "da_classificare" | "allocato" | "contabilizzato";
  created_by: string | null;
  created_at: string;
  note_cfo: string | null;
}

const statoConfig = {
  grezzo: { label: "Grezzo", color: "bg-gray-500", icon: Clock },
  da_verificare: { label: "Da Verificare", color: "bg-yellow-500", icon: AlertCircle },
  da_classificare: { label: "Da Classificare", color: "bg-orange-500", icon: AlertCircle },
  allocato: { label: "Allocato", color: "bg-blue-500", icon: Link2 },
  contabilizzato: { label: "Contabilizzato", color: "bg-green-500", icon: CheckCircle },
};

const tipoAllocazioneOptions = [
  { value: "incasso_fattura", label: "Incasso fattura" },
  { value: "pagamento_fattura", label: "Pagamento fattura" },
  { value: "anticipo_cliente", label: "Anticipo cliente" },
  { value: "anticipo_fornitore", label: "Anticipo fornitore" },
  { value: "rimborso_dipendente", label: "Rimborso dipendente" },
  { value: "spesa_cassa", label: "Spesa cassa/carta" },
  { value: "giroconto", label: "Giroconto" },
  { value: "altro", label: "Altro" },
];

export default function MovimentiFinanziariPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStato, setFilterStato] = useState<string>("all");
  const [filterDirezione, setFilterDirezione] = useState<string>("all");
  const [showClassifyDialog, setShowClassifyDialog] = useState(false);
  const [selectedMovimento, setSelectedMovimento] = useState<MovimentoFinanziario | null>(null);
  const [classificationData, setClassificationData] = useState({
    tipo_allocazione: "",
    note_cfo: "",
  });

  // Fetch movimenti finanziari
  const { data: movimenti = [], isLoading } = useQuery({
    queryKey: ["movimenti-finanziari"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimenti_finanziari")
        .select("*")
        .order("data_movimento", { ascending: false });
      
      if (error) throw error;
      return data as MovimentoFinanziario[];
    },
  });

  // Classify mutation
  const classifyMutation = useMutation({
    mutationFn: async ({ id, movimento, data }: { id: string; movimento: MovimentoFinanziario; data: { tipo_allocazione: string; note_cfo: string } }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Update movimento finanziario
      const { error: updateError } = await supabase
        .from("movimenti_finanziari")
        .update({
          tipo_allocazione: data.tipo_allocazione,
          note_cfo: data.note_cfo,
          stato: "allocato" as const,
          classificato_da: userData.user?.id,
          classificato_at: new Date().toISOString(),
        })
        .eq("id", id);
      
      if (updateError) throw updateError;

      // Create entry in accounting_entries for classification
      const { error: insertError } = await supabase
        .from("accounting_entries")
        .insert({
          direction: movimento.direzione === "entrata" ? "entrata" : "uscita",
          document_type: "movimento_finanziario",
          amount: Number(movimento.importo),
          document_date: movimento.data_movimento,
          attachment_url: movimento.allegato_url || "",
          payment_method: movimento.metodo_pagamento,
          subject_type: movimento.soggetto_tipo,
          note: `${data.tipo_allocazione}${data.note_cfo ? ` - ${data.note_cfo}` : ""} | Soggetto: ${movimento.soggetto_nome || "N/A"}`,
          status: "da_classificare",
          user_id: userData.user?.id,
          cfo_notes: data.note_cfo,
        });
      
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movimenti-finanziari"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      toast.success("Movimento classificato e inviato a Classificazione Eventi");
      setShowClassifyDialog(false);
      setSelectedMovimento(null);
    },
    onError: (error) => {
      console.error("Classification error:", error);
      toast.error("Errore durante la classificazione");
    },
  });

  const handleClassify = (movimento: MovimentoFinanziario) => {
    setSelectedMovimento(movimento);
    setClassificationData({
      tipo_allocazione: movimento.tipo_allocazione || "",
      note_cfo: movimento.note_cfo || "",
    });
    setShowClassifyDialog(true);
  };

  const submitClassification = () => {
    if (!selectedMovimento || !classificationData.tipo_allocazione) {
      toast.error("Seleziona il tipo di allocazione");
      return;
    }
    
    classifyMutation.mutate({
      id: selectedMovimento.id,
      movimento: selectedMovimento,
      data: classificationData,
    });
  };

  // Filter movimenti
  const filteredMovimenti = movimenti.filter((m) => {
    const matchesSearch = 
      (m.soggetto_nome?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (m.riferimento?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
      (m.descrizione?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    
    const matchesStato = filterStato === "all" || m.stato === filterStato;
    const matchesDirezione = filterDirezione === "all" || m.direzione === filterDirezione;
    
    return matchesSearch && matchesStato && matchesDirezione;
  });

  // Stats
  const stats = {
    totale: movimenti.length,
    grezzi: movimenti.filter((m) => m.stato === "grezzo" || m.stato === "da_verificare" || m.stato === "da_classificare").length,
    allocati: movimenti.filter((m) => m.stato === "allocato").length,
    contabilizzati: movimenti.filter((m) => m.stato === "contabilizzato").length,
    entrate: movimenti.filter((m) => m.direzione === "entrata").reduce((sum, m) => sum + Number(m.importo), 0),
    uscite: movimenti.filter((m) => m.direzione === "uscita").reduce((sum, m) => sum + Number(m.importo), 0),
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Movimenti Finanziari</h1>
          <p className="text-muted-foreground">
            Gestione incassi, pagamenti, anticipi e rimborsi
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Da Classificare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.grezzi}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Allocati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.allocati}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contabilizzati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.contabilizzati}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Entrate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.entrate)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Totale Uscite
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.uscite)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per soggetto, riferimento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterStato} onValueChange={setFilterStato}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="grezzo">Grezzo</SelectItem>
                <SelectItem value="da_verificare">Da Verificare</SelectItem>
                <SelectItem value="da_classificare">Da Classificare</SelectItem>
                <SelectItem value="allocato">Allocato</SelectItem>
                <SelectItem value="contabilizzato">Contabilizzato</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDirezione} onValueChange={setFilterDirezione}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Direzione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte</SelectItem>
                <SelectItem value="entrata">Entrate</SelectItem>
                <SelectItem value="uscita">Uscite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Caricamento...
            </div>
          ) : filteredMovimenti.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun movimento trovato
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Direzione</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Soggetto</TableHead>
                  <TableHead>Tipo Allocazione</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovimenti.map((movimento) => {
                  const statoInfo = statoConfig[movimento.stato];
                  const StatoIcon = statoInfo.icon;
                  
                  return (
                    <TableRow key={movimento.id}>
                      <TableCell>
                        {format(new Date(movimento.data_movimento), "dd/MM/yyyy", { locale: it })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {movimento.direzione === "entrata" ? (
                            <ArrowUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={movimento.direzione === "entrata" ? "text-green-600" : "text-red-600"}>
                            {movimento.direzione === "entrata" ? "Entrata" : "Uscita"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(Number(movimento.importo))}
                      </TableCell>
                      <TableCell className="capitalize">
                        {movimento.metodo_pagamento}
                      </TableCell>
                      <TableCell>
                        {movimento.soggetto_nome || "-"}
                      </TableCell>
                      <TableCell>
                        {movimento.tipo_allocazione ? (
                          tipoAllocazioneOptions.find((t) => t.value === movimento.tipo_allocazione)?.label || movimento.tipo_allocazione
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statoInfo.color} text-white`}>
                          <StatoIcon className="h-3 w-3 mr-1" />
                          {statoInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {movimento.allegato_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(movimento.allegato_url!, "_blank")}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {(movimento.stato === "grezzo" || movimento.stato === "da_verificare" || movimento.stato === "da_classificare") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleClassify(movimento)}
                            >
                              <Pencil className="h-4 w-4 mr-1" />
                              Classifica
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Classification Dialog */}
      <Dialog open={showClassifyDialog} onOpenChange={setShowClassifyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Classifica Movimento</DialogTitle>
          </DialogHeader>
          
          {selectedMovimento && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data:</span>
                  <span className="font-medium">
                    {format(new Date(selectedMovimento.data_movimento), "dd/MM/yyyy", { locale: it })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Importo:</span>
                  <span className={`font-medium ${selectedMovimento.direzione === "entrata" ? "text-green-600" : "text-red-600"}`}>
                    {selectedMovimento.direzione === "entrata" ? "+" : "-"}
                    {formatCurrency(Number(selectedMovimento.importo))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metodo:</span>
                  <span className="font-medium capitalize">{selectedMovimento.metodo_pagamento}</span>
                </div>
                {selectedMovimento.soggetto_nome && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Soggetto:</span>
                    <span className="font-medium">{selectedMovimento.soggetto_nome}</span>
                  </div>
                )}
                {selectedMovimento.riferimento && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Riferimento:</span>
                    <span className="font-medium">{selectedMovimento.riferimento}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipo Allocazione *</Label>
                <Select
                  value={classificationData.tipo_allocazione}
                  onValueChange={(value) => setClassificationData((prev) => ({ ...prev, tipo_allocazione: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo allocazione" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipoAllocazioneOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Note CFO</Label>
                <Textarea
                  value={classificationData.note_cfo}
                  onChange={(e) => setClassificationData((prev) => ({ ...prev, note_cfo: e.target.value }))}
                  placeholder="Note aggiuntive..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClassifyDialog(false)}>
              Annulla
            </Button>
            <Button onClick={submitClassification} disabled={classifyMutation.isPending}>
              {classifyMutation.isPending ? "Salvataggio..." : "Salva Classificazione"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
