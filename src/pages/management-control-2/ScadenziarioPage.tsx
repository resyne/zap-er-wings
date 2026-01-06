import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Euro,
  Calendar,
  History,
  Filter,
} from "lucide-react";

interface Scadenza {
  id: string;
  evento_id: string | null;
  prima_nota_id: string | null;
  tipo: "credito" | "debito";
  soggetto_tipo: string | null;
  soggetto_nome: string | null;
  soggetto_id: string | null;
  data_documento: string;
  data_scadenza: string;
  importo_totale: number;
  importo_residuo: number;
  stato: "aperta" | "parziale" | "chiusa" | "saldata" | "stornata";
  iva_mode: string | null;
  conto_economico: string | null;
  centro_id: string | null;
  termini_pagamento: number | null;
  note: string | null;
  created_at: string;
}

interface ScadenzaMovimento {
  id: string;
  scadenza_id: string;
  evento_finanziario_id: string | null;
  prima_nota_id: string | null;
  importo: number;
  data_movimento: string;
  metodo_pagamento: string | null;
  note: string | null;
  created_at: string;
}

export default function ScadenziarioPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tutti" | "crediti" | "debiti">("tutti");
  const [statoFilter, setStatoFilter] = useState<"tutti" | "aperta" | "parziale" | "chiusa">("tutti");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [registraDialogOpen, setRegistraDialogOpen] = useState(false);
  const [selectedScadenza, setSelectedScadenza] = useState<Scadenza | null>(null);
  const [importoRegistrazione, setImportoRegistrazione] = useState<string>("");
  const [dataRegistrazione, setDataRegistrazione] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [metodoRegistrazione, setMetodoRegistrazione] = useState<string>("banca");
  const [noteRegistrazione, setNoteRegistrazione] = useState<string>("");

  // Fetch scadenze
  const { data: scadenze, isLoading } = useQuery({
    queryKey: ["scadenze", activeTab, statoFilter],
    queryFn: async () => {
      let query = supabase
        .from("scadenze")
        .select("*")
        .order("data_scadenza", { ascending: true });

      if (activeTab === "crediti") {
        query = query.eq("tipo", "credito");
      } else if (activeTab === "debiti") {
        query = query.eq("tipo", "debito");
      }

      if (statoFilter !== "tutti") {
        query = query.eq("stato", statoFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let scadenze = (data as Scadenza[]) ?? [];

      // AUTO-FIX: se una scadenza è stata messa "stornata" a residuo 0 dopo lo storno,
      // ma l'evento nel Registro Contabile è stato poi RI-CONTABILIZZATO,
      // riallinea la scadenza (aperta + residuo = totale) così i totali tornano corretti.
      const candidateIds = scadenze
        .filter((s) => s.stato === "stornata" && Number(s.importo_residuo) === 0)
        .map((s) => s.id);

      if (candidateIds.length > 0) {
        type InvoiceRegistryForFix = {
          scadenza_id: string | null;
          status: string;
          contabilizzazione_valida: boolean | null;
          financial_status: string;
          total_amount: number;
          invoice_number: string;
          invoice_date: string;
          due_date: string | null;
          subject_name: string;
          subject_type: string;
          accounting_entry_id: string | null;
          prima_nota_id: string | null;
        };

        const { data: invs, error: invError } = await supabase
          .from("invoice_registry")
          .select(
            "scadenza_id,status,contabilizzazione_valida,financial_status,total_amount,invoice_number,invoice_date,due_date,subject_name,subject_type,accounting_entry_id,prima_nota_id"
          )
          .in("scadenza_id", candidateIds);

        if (!invError && invs && invs.length > 0) {
          const invByScadenza = new Map(
            (invs as InvoiceRegistryForFix[])
              .filter((i) => !!i.scadenza_id)
              .map((i) => [i.scadenza_id as string, i])
          );

          const isValidForFinancialStats = (i: InvoiceRegistryForFix) =>
            i.contabilizzazione_valida !== false &&
            !["da_riclassificare", "rettificato", "bozza"].includes(i.status);

          const shouldBeOpenInScadenziario = (i: InvoiceRegistryForFix) =>
            isValidForFinancialStats(i) &&
            (i.financial_status === "da_incassare" || i.financial_status === "da_pagare");

          const fixes = scadenze
            .map((s) => {
              const inv = invByScadenza.get(s.id);
              if (!inv || !shouldBeOpenInScadenziario(inv)) return null;

              const patch: Partial<Scadenza> = {
                stato: "aperta",
                importo_totale: inv.total_amount,
                importo_residuo: inv.total_amount,
                data_documento: inv.invoice_date,
                data_scadenza: inv.due_date || inv.invoice_date,
                soggetto_nome: inv.subject_name,
                soggetto_tipo: inv.subject_type,
                note: `Fattura ${inv.invoice_number}`,
                evento_id: inv.accounting_entry_id,
                prima_nota_id: inv.prima_nota_id,
              };

              return { id: s.id, patch };
            })
            .filter(Boolean) as Array<{ id: string; patch: Partial<Scadenza> }>;

          if (fixes.length > 0) {
            const results = await Promise.all(
              fixes.map(({ id, patch }) => supabase.from("scadenze").update(patch).eq("id", id))
            );
            const firstErr = results.find((r) => r.error)?.error;
            if (firstErr) {
              console.warn("Scadenziario auto-fix scadenze fallito:", firstErr);
            }

            scadenze = scadenze.map((s) => {
              const fix = fixes.find((f) => f.id === s.id);
              return fix ? ({ ...s, ...fix.patch } as Scadenza) : s;
            });
          }
        }
      }

      return scadenze;
    },
  });

  // Fetch movimenti per scadenza espansa
  const { data: movimenti } = useQuery({
    queryKey: ["scadenza-movimenti", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const { data, error } = await supabase
        .from("scadenza_movimenti")
        .select("*")
        .eq("scadenza_id", expandedId)
        .order("data_movimento", { ascending: false });
      if (error) throw error;
      return data as ScadenzaMovimento[];
    },
    enabled: !!expandedId,
  });

  // Mutation per registrare incasso/pagamento
  const registraMutation = useMutation({
    mutationFn: async ({
      scadenza,
      importo,
      data,
      metodo,
      note,
    }: {
      scadenza: Scadenza;
      importo: number;
      data: string;
      metodo: string;
      note: string;
    }) => {
      // 1. Crea evento finanziario
      const eventoFinanziario = {
        document_date: data,
        document_type: "documento_interno",
        direction: scadenza.tipo === "credito" ? "entrata" : "uscita",
        amount: importo,
        totale: importo,
        status: "registrato",
        financial_status: scadenza.tipo === "credito" ? "incassato" : "pagato",
        payment_method: metodo,
        payment_date: data,
        affects_income_statement: false,
        note: note || `${scadenza.tipo === "credito" ? "Incasso" : "Pagamento"} per scadenza`,
        attachment_url: "",
      };

      const { data: eventoData, error: eventoError } = await supabase
        .from("accounting_entries")
        .insert(eventoFinanziario)
        .select()
        .single();

      if (eventoError) throw eventoError;

      // 2. Crea movimento prima nota finanziaria
      const primaNotaData = {
        accounting_entry_id: eventoData.id,
        movement_type: scadenza.tipo === "credito" ? "incasso" : "pagamento",
        competence_date: data,
        amount: importo,
        description: `${scadenza.tipo === "credito" ? "Incasso" : "Pagamento"} - ${scadenza.soggetto_nome || "N/D"}`,
        status: "registrato",
        payment_method: metodo,
      };

      const { data: primaNotaResult, error: primaNotaError } = await supabase
        .from("prima_nota")
        .insert(primaNotaData)
        .select()
        .single();

      if (primaNotaError) throw primaNotaError;

      // 3. Genera righe prima nota (partita doppia)
      const righe: Array<{
        prima_nota_id: string;
        line_order: number;
        account_type: string;
        dynamic_account_key: string;
        dare: number;
        avere: number;
        description: string;
      }> = [];
      if (scadenza.tipo === "credito") {
        // Incasso: DARE Banca, AVERE Crediti clienti
        righe.push({
          prima_nota_id: primaNotaResult.id,
          line_order: 1,
          account_type: "structural",
          dynamic_account_key: "BANCA",
          dare: importo,
          avere: 0,
          description: "Incasso da cliente",
        });
        righe.push({
          prima_nota_id: primaNotaResult.id,
          line_order: 2,
          account_type: "structural",
          dynamic_account_key: "CREDITI_CLIENTI",
          dare: 0,
          avere: importo,
          description: "Chiusura credito",
        });
      } else {
        // Pagamento: DARE Debiti fornitori, AVERE Banca
        righe.push({
          prima_nota_id: primaNotaResult.id,
          line_order: 1,
          account_type: "structural",
          dynamic_account_key: "DEBITI_FORNITORI",
          dare: importo,
          avere: 0,
          description: "Chiusura debito",
        });
        righe.push({
          prima_nota_id: primaNotaResult.id,
          line_order: 2,
          account_type: "structural",
          dynamic_account_key: "BANCA",
          dare: 0,
          avere: importo,
          description: "Pagamento a fornitore",
        });
      }

      const { error: righeError } = await supabase.from("prima_nota_lines").insert(righe);
      if (righeError) throw righeError;

      // 4. Crea movimento scadenza
      const { error: movimentoError } = await supabase.from("scadenza_movimenti").insert({
        scadenza_id: scadenza.id,
        evento_finanziario_id: eventoData.id,
        prima_nota_id: primaNotaResult.id,
        importo,
        data_movimento: data,
        metodo_pagamento: metodo,
        note,
      });

      if (movimentoError) throw movimentoError;

      // 5. Aggiorna scadenza
      const nuovoResiduo = scadenza.importo_residuo - importo;
      const nuovoStato = nuovoResiduo <= 0 ? "chiusa" : "parziale";

      const { error: updateError } = await supabase
        .from("scadenze")
        .update({
          importo_residuo: Math.max(0, nuovoResiduo),
          stato: nuovoStato,
        })
        .eq("id", scadenza.id);

      if (updateError) throw updateError;

      return { success: true };
    },
    onSuccess: () => {
      toast.success(
        selectedScadenza?.tipo === "credito"
          ? "Incasso registrato con successo"
          : "Pagamento registrato con successo"
      );
      queryClient.invalidateQueries({ queryKey: ["scadenze"] });
      queryClient.invalidateQueries({ queryKey: ["scadenza-movimenti"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      setRegistraDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Errore durante la registrazione: " + error.message);
    },
  });

  const resetForm = () => {
    setSelectedScadenza(null);
    setImportoRegistrazione("");
    setDataRegistrazione(format(new Date(), "yyyy-MM-dd"));
    setMetodoRegistrazione("banca");
    setNoteRegistrazione("");
  };

  const openRegistraDialog = (scadenza: Scadenza) => {
    setSelectedScadenza(scadenza);
    setImportoRegistrazione(scadenza.importo_residuo.toString());
    setRegistraDialogOpen(true);
  };

  const handleRegistra = () => {
    if (!selectedScadenza) return;
    const importo = parseFloat(importoRegistrazione);
    if (isNaN(importo) || importo <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    if (importo > selectedScadenza.importo_residuo) {
      toast.error("L'importo non può superare il residuo");
      return;
    }

    registraMutation.mutate({
      scadenza: selectedScadenza,
      importo,
      data: dataRegistrazione,
      metodo: metodoRegistrazione,
      note: noteRegistrazione,
    });
  };

  const getGiorniScadenza = (dataScadenza: string) => {
    const oggi = new Date();
    const scadenza = parseISO(dataScadenza);
    return differenceInDays(scadenza, oggi);
  };

  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case "aperta":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Aperta</Badge>;
      case "parziale":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Parziale</Badge>;
      case "chiusa":
      case "saldata":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Chiusa</Badge>;
      case "stornata":
        return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">Stornata</Badge>;
      default:
        return <Badge variant="outline">{stato}</Badge>;
    }
  };

  const getGiorniBadge = (giorni: number) => {
    if (giorni < 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Scaduto da {Math.abs(giorni)} gg
        </Badge>
      );
    }
    if (giorni <= 7) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <Clock className="h-3 w-3" />
          {giorni} gg
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
        <CheckCircle className="h-3 w-3" />
        {giorni} gg
      </Badge>
    );
  };

  const isClosedScadenza = (s: Scadenza) => s.stato === "chiusa" || s.stato === "saldata";

  // Calcolo totali - escludi solo scadenze chiuse (le stornate possono essere ri-registrate)
  const totali = scadenze?.reduce(
    (acc, s) => {
      // Escludi solo le scadenze chiuse (completamente saldate)
      if (!isClosedScadenza(s)) {
        if (s.tipo === "credito") {
          acc.crediti += s.importo_residuo;
        } else {
          acc.debiti += s.importo_residuo;
        }
      }
      return acc;
    },
    { crediti: 0, debiti: 0 }
  ) || { crediti: 0, debiti: 0 };

  const scaduteCount =
    scadenze?.filter((s) => !isClosedScadenza(s) && getGiorniScadenza(s.data_scadenza) < 0).length || 0;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scadenziario</h1>
          <p className="text-muted-foreground">
            Gestione crediti e debiti in scadenza
          </p>
        </div>
      </div>

      {/* Cards riassuntive */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crediti da incassare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-600">
                € {totali.crediti.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Debiti da pagare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">
                € {totali.debiti.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Saldo netto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              <span
                className={`text-2xl font-bold ${
                  totali.crediti - totali.debiti >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                € {(totali.crediti - totali.debiti).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scadenze scadute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${scaduteCount > 0 ? "text-red-600" : "text-muted-foreground"}`} />
              <span className={`text-2xl font-bold ${scaduteCount > 0 ? "text-red-600" : ""}`}>
                {scaduteCount}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs e filtri */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
              <TabsList>
                <TabsTrigger value="tutti">Tutti</TabsTrigger>
                <TabsTrigger value="crediti" className="gap-1">
                  <ArrowUpCircle className="h-4 w-4" />
                  Crediti
                </TabsTrigger>
                <TabsTrigger value="debiti" className="gap-1">
                  <ArrowDownCircle className="h-4 w-4" />
                  Debiti
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statoFilter} onValueChange={(v) => setStatoFilter(v as typeof statoFilter)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti gli stati</SelectItem>
                  <SelectItem value="aperta">Aperte</SelectItem>
                  <SelectItem value="parziale">Parziali</SelectItem>
                  <SelectItem value="chiusa">Chiuse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Data Documento</TableHead>
                <TableHead>Data Scadenza</TableHead>
                <TableHead className="text-right">Importo Totale</TableHead>
                <TableHead className="text-right">Residuo</TableHead>
                <TableHead>Giorni</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scadenze?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nessuna scadenza trovata
                  </TableCell>
                </TableRow>
              ) : (
                scadenze?.map((scadenza) => {
                  const giorni = getGiorniScadenza(scadenza.data_scadenza);
                  const isExpanded = expandedId === scadenza.id;

                  return (
                    <Collapsible key={scadenza.id} open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : scadenza.id)}>
                      <TableRow className={scadenza.stato === "chiusa" ? "opacity-60" : ""}>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          {scadenza.tipo === "credito" ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
                              <ArrowUpCircle className="h-3 w-3" />
                              Credito
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
                              <ArrowDownCircle className="h-3 w-3" />
                              Debito
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{scadenza.soggetto_nome || "N/D"}</div>
                            <div className="text-xs text-muted-foreground">{scadenza.soggetto_tipo}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(scadenza.data_documento), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          {format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          € {scadenza.importo_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          € {scadenza.importo_residuo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {scadenza.stato !== "chiusa" && getGiorniBadge(giorni)}
                        </TableCell>
                        <TableCell>{getStatoBadge(scadenza.stato)}</TableCell>
                        <TableCell>
                          {scadenza.stato !== "chiusa" && (
                            <Button
                              size="sm"
                              onClick={() => openRegistraDialog(scadenza)}
                            >
                              {scadenza.tipo === "credito" ? "Registra Incasso" : "Registra Pagamento"}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/30 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <History className="h-4 w-4" />
                                Storico Movimenti
                              </div>
                              {movimenti && movimenti.length > 0 ? (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Data</TableHead>
                                      <TableHead>Importo</TableHead>
                                      <TableHead>Metodo</TableHead>
                                      <TableHead>Note</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {movimenti.map((mov) => (
                                      <TableRow key={mov.id}>
                                        <TableCell>
                                          {format(parseISO(mov.data_movimento), "dd/MM/yyyy", { locale: it })}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          € {mov.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant="outline">{mov.metodo_pagamento || "N/D"}</Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {mov.note || "-"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  Nessun movimento registrato
                                </p>
                              )}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-muted-foreground">IVA Mode:</span>{" "}
                                  <span className="font-medium">{scadenza.iva_mode || "N/D"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Conto:</span>{" "}
                                  <span className="font-medium">{scadenza.conto_economico || "N/D"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Termini:</span>{" "}
                                  <span className="font-medium">{scadenza.termini_pagamento || 30} gg</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Creata il:</span>{" "}
                                  <span className="font-medium">
                                    {format(parseISO(scadenza.created_at), "dd/MM/yyyy HH:mm", { locale: it })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog registrazione incasso/pagamento */}
      <Dialog open={registraDialogOpen} onOpenChange={setRegistraDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedScadenza?.tipo === "credito" ? "Registra Incasso" : "Registra Pagamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedScadenza && (
              <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Soggetto:</span>
                  <span className="font-medium">{selectedScadenza.soggetto_nome || "N/D"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Importo totale:</span>
                  <span className="font-medium">
                    € {selectedScadenza.importo_totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Residuo:</span>
                  <span className="font-bold">
                    € {selectedScadenza.importo_residuo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="importo">Importo</Label>
              <Input
                id="importo"
                type="number"
                step="0.01"
                value={importoRegistrazione}
                onChange={(e) => setImportoRegistrazione(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data {selectedScadenza?.tipo === "credito" ? "incasso" : "pagamento"}</Label>
              <Input
                id="data"
                type="date"
                value={dataRegistrazione}
                onChange={(e) => setDataRegistrazione(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodo">Metodo</Label>
              <Select value={metodoRegistrazione} onValueChange={setMetodoRegistrazione}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="anticipo_personale">Anticipo Personale</SelectItem>
                  <SelectItem value="non_so">Non specificato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (opzionale)</Label>
              <Textarea
                id="note"
                value={noteRegistrazione}
                onChange={(e) => setNoteRegistrazione(e.target.value)}
                placeholder="Eventuali note..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistraDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleRegistra} disabled={registraMutation.isPending}>
              {registraMutation.isPending ? "Registrazione..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
