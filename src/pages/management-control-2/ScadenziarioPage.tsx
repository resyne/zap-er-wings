import { useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Euro,
  FileText,
  History,
  Building2,
  CreditCard,
  Receipt,
  Search,
  Plus,
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
  invoice_number?: string;
  invoice_date?: string;
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

interface ClienteGroup {
  nome: string;
  tipo: "credito" | "debito";
  scadenze: Scadenza[];
  totaleImporto: number;
  totaleResiduo: number;
  scadenzeAperte: number;
  scadenzeScadute: number;
}

export default function ScadenziarioPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tutti" | "crediti" | "debiti">("tutti");
  const [statoFilter, setStatoFilter] = useState<"tutti" | "aperta" | "parziale" | "chiusa">("tutti");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedScadenza, setExpandedScadenza] = useState<string | null>(null);
  const [registraDialogOpen, setRegistraDialogOpen] = useState(false);
  const [selectedScadenza, setSelectedScadenza] = useState<Scadenza | null>(null);
  const [importoRegistrazione, setImportoRegistrazione] = useState<string>("");
  const [dataRegistrazione, setDataRegistrazione] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [metodoRegistrazione, setMetodoRegistrazione] = useState<string>("bonifico");
  const [noteRegistrazione, setNoteRegistrazione] = useState<string>("");

  // Fetch scadenze con dettagli fattura
  const { data: scadenze, isLoading } = useQuery({
    queryKey: ["scadenze-dettagliate", activeTab, statoFilter],
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

      const scadenzeBase = (data as Scadenza[]) ?? [];

      // Fetch invoice details for each scadenza
      const scadenzeIds = scadenzeBase.map(s => s.id);
      if (scadenzeIds.length > 0) {
        const { data: invoices } = await supabase
          .from("invoice_registry")
          .select("scadenza_id, invoice_number, invoice_date")
          .in("scadenza_id", scadenzeIds);

        const invoiceMap = new Map(invoices?.map(inv => [inv.scadenza_id, inv]) || []);
        
        return scadenzeBase.map(s => ({
          ...s,
          invoice_number: invoiceMap.get(s.id)?.invoice_number,
          invoice_date: invoiceMap.get(s.id)?.invoice_date,
        }));
      }

      return scadenzeBase;
    },
  });

  // Fetch movimenti per scadenza espansa
  const { data: movimenti } = useQuery({
    queryKey: ["scadenza-movimenti", expandedScadenza],
    queryFn: async () => {
      if (!expandedScadenza) return [];
      const { data, error } = await supabase
        .from("scadenza_movimenti")
        .select("*")
        .eq("scadenza_id", expandedScadenza)
        .order("data_movimento", { ascending: false });
      if (error) throw error;
      return data as ScadenzaMovimento[];
    },
    enabled: !!expandedScadenza,
  });

  // Raggruppa scadenze per cliente
  const clientiGroups = useMemo(() => {
    if (!scadenze) return [];

    const filteredScadenze = searchQuery
      ? scadenze.filter(s => 
          s.soggetto_nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : scadenze;

    const grouped = new Map<string, ClienteGroup>();

    filteredScadenze.forEach(s => {
      const key = `${s.soggetto_nome || "Sconosciuto"}-${s.tipo}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          nome: s.soggetto_nome || "Sconosciuto",
          tipo: s.tipo,
          scadenze: [],
          totaleImporto: 0,
          totaleResiduo: 0,
          scadenzeAperte: 0,
          scadenzeScadute: 0,
        });
      }

      const group = grouped.get(key)!;
      group.scadenze.push(s);
      group.totaleImporto += Number(s.importo_totale);
      group.totaleResiduo += Number(s.importo_residuo);
      
      if (s.stato === "aperta" || s.stato === "parziale") {
        group.scadenzeAperte++;
        if (getGiorniScadenza(s.data_scadenza) < 0) {
          group.scadenzeScadute++;
        }
      }
    });

    return Array.from(grouped.values()).sort((a, b) => {
      // Prima per scadenze scadute
      if (a.scadenzeScadute !== b.scadenzeScadute) {
        return b.scadenzeScadute - a.scadenzeScadute;
      }
      // Poi per residuo
      return b.totaleResiduo - a.totaleResiduo;
    });
  }, [scadenze, searchQuery]);

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
        movement_type: "finanziario",
        competence_date: data,
        amount: importo,
        description: `${scadenza.tipo === "credito" ? "Incasso" : "Pagamento"} - ${scadenza.soggetto_nome || "N/D"} - ${scadenza.invoice_number || ""}`,
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
      const nuovoResiduo = Number(scadenza.importo_residuo) - importo;
      const nuovoStato = nuovoResiduo <= 0 ? "chiusa" : nuovoResiduo < Number(scadenza.importo_totale) ? "parziale" : "aperta";

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
      toast.success("Movimento registrato con successo");
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["scadenza-movimenti"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      resetForm();
    },
    onError: (error) => {
      console.error("Errore registrazione:", error);
      toast.error(`Errore durante la registrazione: ${error.message}`);
    },
  });

  const resetForm = () => {
    setRegistraDialogOpen(false);
    setSelectedScadenza(null);
    setImportoRegistrazione("");
    setDataRegistrazione(format(new Date(), "yyyy-MM-dd"));
    setMetodoRegistrazione("bonifico");
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

  const toggleClientExpand = (clientKey: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientKey)) {
      newExpanded.delete(clientKey);
    } else {
      newExpanded.add(clientKey);
    }
    setExpandedClients(newExpanded);
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

  const getGiorniBadge = (giorni: number, stato: string) => {
    if (stato === "chiusa" || stato === "saldata") return null;
    
    if (giorni < 0) {
      return (
        <Badge variant="destructive" className="gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          -{Math.abs(giorni)}gg
        </Badge>
      );
    }
    if (giorni <= 7) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
          <Clock className="h-3 w-3" />
          {giorni}gg
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
        {giorni}gg
      </Badge>
    );
  };

  const isClosedScadenza = (s: Scadenza) => s.stato === "chiusa" || s.stato === "saldata";

  // Calcolo totali
  const totali = scadenze?.reduce(
    (acc, s) => {
      if (!isClosedScadenza(s)) {
        if (s.tipo === "credito") {
          acc.crediti += Number(s.importo_residuo);
        } else {
          acc.debiti += Number(s.importo_residuo);
        }
      }
      return acc;
    },
    { crediti: 0, debiti: 0 }
  ) || { crediti: 0, debiti: 0 };

  const scaduteCount = scadenze?.filter((s) => !isClosedScadenza(s) && getGiorniScadenza(s.data_scadenza) < 0).length || 0;

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
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Scadenziario</h1>
        <p className="text-muted-foreground">
          Gestione crediti e debiti raggruppati per cliente
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Crediti</p>
                <p className="text-2xl font-bold text-green-800">
                  € {totali.crediti.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <ArrowUpCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">Debiti</p>
                <p className="text-2xl font-bold text-red-800">
                  € {totali.debiti.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <ArrowDownCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 font-medium">Saldo Netto</p>
                <p className={`text-2xl font-bold ${totali.crediti - totali.debiti >= 0 ? "text-green-800" : "text-red-800"}`}>
                  € {(totali.crediti - totali.debiti).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Euro className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${scaduteCount > 0 ? "from-orange-50 to-orange-100/50 border-orange-200" : "from-gray-50 to-gray-100/50 border-gray-200"}`}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${scaduteCount > 0 ? "text-orange-700" : "text-gray-700"}`}>Scadute</p>
                <p className={`text-2xl font-bold ${scaduteCount > 0 ? "text-orange-800" : "text-gray-800"}`}>
                  {scaduteCount}
                </p>
              </div>
              <AlertTriangle className={`h-8 w-8 ${scaduteCount > 0 ? "text-orange-600" : "text-gray-400"}`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
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

            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca cliente o fattura..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statoFilter} onValueChange={(v) => setStatoFilter(v as typeof statoFilter)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutti">Tutti</SelectItem>
                  <SelectItem value="aperta">Aperte</SelectItem>
                  <SelectItem value="parziale">Parziali</SelectItem>
                  <SelectItem value="chiusa">Chiuse</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Groups */}
      <div className="space-y-3">
        {clientiGroups.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna scadenza trovata</p>
            </CardContent>
          </Card>
        ) : (
          clientiGroups.map((group) => {
            const clientKey = `${group.nome}-${group.tipo}`;
            const isExpanded = expandedClients.has(clientKey);
            const percentualePagato = group.totaleImporto > 0 
              ? ((group.totaleImporto - group.totaleResiduo) / group.totaleImporto) * 100 
              : 0;

            return (
              <Card key={clientKey} className={`overflow-hidden transition-all ${group.scadenzeScadute > 0 ? "border-orange-300" : ""}`}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleClientExpand(clientKey)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center gap-4">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        
                        <div className={`p-2 rounded-lg ${group.tipo === "credito" ? "bg-green-100" : "bg-red-100"}`}>
                          <Building2 className={`h-5 w-5 ${group.tipo === "credito" ? "text-green-700" : "text-red-700"}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{group.nome}</h3>
                            <Badge variant="outline" className={group.tipo === "credito" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                              {group.tipo === "credito" ? "Cliente" : "Fornitore"}
                            </Badge>
                            {group.scadenzeScadute > 0 && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {group.scadenzeScadute} scadute
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span>{group.scadenze.length} fattur{group.scadenze.length === 1 ? "a" : "e"}</span>
                            <span>•</span>
                            <span>{group.scadenzeAperte} apert{group.scadenzeAperte === 1 ? "a" : "e"}</span>
                          </div>
                        </div>

                        <div className="text-right hidden md:block">
                          <div className="text-sm text-muted-foreground mb-1">Residuo / Totale</div>
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${group.tipo === "credito" ? "text-green-700" : "text-red-700"}`}>
                              € {group.totaleResiduo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">
                              € {group.totaleImporto.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <Progress value={percentualePagato} className="h-1.5 mt-2 w-40" />
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="w-10"></TableHead>
                              <TableHead>Fattura</TableHead>
                              <TableHead>Data Doc.</TableHead>
                              <TableHead>Scadenza</TableHead>
                              <TableHead className="text-right">Importo</TableHead>
                              <TableHead className="text-right">Residuo</TableHead>
                              <TableHead>Stato</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.scadenze.map((scadenza) => {
                              const giorni = getGiorniScadenza(scadenza.data_scadenza);
                              const isScadenzaExpanded = expandedScadenza === scadenza.id;

                              return (
                                <>
                                  <TableRow 
                                    key={scadenza.id} 
                                    className={`${isClosedScadenza(scadenza) ? "opacity-60" : ""} ${giorni < 0 && !isClosedScadenza(scadenza) ? "bg-orange-50/50" : ""}`}
                                  >
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setExpandedScadenza(isScadenzaExpanded ? null : scadenza.id)}
                                      >
                                        {isScadenzaExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Receipt className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                          <div className="font-medium">{scadenza.invoice_number || "N/D"}</div>
                                          {scadenza.note && (
                                            <div className="text-xs text-muted-foreground truncate max-w-40">
                                              {scadenza.note}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                      {format(parseISO(scadenza.data_documento), "dd/MM/yyyy")}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm">
                                          {format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy")}
                                        </span>
                                        {getGiorniBadge(giorni, scadenza.stato)}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                      € {Number(scadenza.importo_totale).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className={`text-right font-bold ${group.tipo === "credito" ? "text-green-700" : "text-red-700"}`}>
                                      € {Number(scadenza.importo_residuo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>
                                      {getStatoBadge(scadenza.stato)}
                                    </TableCell>
                                    <TableCell>
                                      {!isClosedScadenza(scadenza) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openRegistraDialog(scadenza)}
                                          className="gap-1"
                                        >
                                          <CreditCard className="h-3 w-3" />
                                          {scadenza.tipo === "credito" ? "Incassa" : "Paga"}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>

                                  {/* Expanded row for movements */}
                                  {isScadenzaExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={8} className="bg-muted/30 p-4">
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-sm font-medium">
                                            <History className="h-4 w-4" />
                                            Storico Movimenti
                                          </div>
                                          {movimenti && movimenti.length > 0 ? (
                                            <div className="space-y-2">
                                              {movimenti.map((mov) => (
                                                <div 
                                                  key={mov.id}
                                                  className="flex items-center justify-between p-3 bg-background rounded-lg border"
                                                >
                                                  <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-full ${group.tipo === "credito" ? "bg-green-100" : "bg-red-100"}`}>
                                                      <CreditCard className={`h-4 w-4 ${group.tipo === "credito" ? "text-green-700" : "text-red-700"}`} />
                                                    </div>
                                                    <div>
                                                      <div className="font-medium">
                                                        € {mov.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                                      </div>
                                                      <div className="text-sm text-muted-foreground">
                                                        {format(parseISO(mov.data_movimento), "dd/MM/yyyy", { locale: it })}
                                                        {mov.metodo_pagamento && ` • ${mov.metodo_pagamento}`}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  {mov.note && (
                                                    <div className="text-sm text-muted-foreground max-w-xs truncate">
                                                      {mov.note}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-sm text-muted-foreground py-2">
                                              Nessun movimento registrato
                                            </p>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog registrazione */}
      <Dialog open={registraDialogOpen} onOpenChange={setRegistraDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {selectedScadenza?.tipo === "credito" ? "Registra Incasso" : "Registra Pagamento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedScadenza && (
              <Card className="bg-muted/50">
                <CardContent className="py-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Cliente/Fornitore</span>
                    <span className="font-medium">{selectedScadenza.soggetto_nome}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Fattura</span>
                    <span className="font-medium">{selectedScadenza.invoice_number || "N/D"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Importo totale</span>
                    <span>€ {Number(selectedScadenza.importo_totale).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Residuo</span>
                    <span className="font-bold text-lg">
                      € {Number(selectedScadenza.importo_residuo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label htmlFor="importo">Importo da registrare</Label>
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
              <Label htmlFor="data">Data</Label>
              <Input
                id="data"
                type="date"
                value={dataRegistrazione}
                onChange={(e) => setDataRegistrazione(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodo">Metodo di pagamento</Label>
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
