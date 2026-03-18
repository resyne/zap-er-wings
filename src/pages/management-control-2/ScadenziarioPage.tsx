import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
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
  Upload,
  X,
  File,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  // Helper function - defined early to be used in useMemo
  const getGiorniScadenza = (dataScadenza: string) => {
    const oggi = new Date();
    const scadenza = parseISO(dataScadenza);
    return differenceInDays(scadenza, oggi);
  };

  const isClosedScadenza = (s: Scadenza) => s.stato === "chiusa" || s.stato === "saldata";

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

    const allGroups = Array.from(grouped.values()).sort((a, b) => {
      if (a.scadenzeScadute !== b.scadenzeScadute) {
        return b.scadenzeScadute - a.scadenzeScadute;
      }
      return b.totaleResiduo - a.totaleResiduo;
    });

    // Filter out fully closed groups unless showClosed is true
    if (!showClosed) {
      return allGroups.filter(g => g.totaleResiduo > 0 || g.scadenzeAperte > 0);
    }
    return allGroups;
  }, [scadenze, searchQuery, showClosed]);

  const closedGroupsCount = useMemo(() => {
    if (!scadenze) return 0;
    const grouped = new Map<string, { residuo: number; aperte: number }>();
    scadenze.forEach(s => {
      const key = `${s.soggetto_nome || "Sconosciuto"}-${s.tipo}`;
      if (!grouped.has(key)) grouped.set(key, { residuo: 0, aperte: 0 });
      const g = grouped.get(key)!;
      g.residuo += Number(s.importo_residuo);
      if (s.stato === "aperta" || s.stato === "parziale") g.aperte++;
    });
    return Array.from(grouped.values()).filter(g => g.residuo <= 0 && g.aperte === 0).length;
  }, [scadenze]);

  const registraMutation = useMutation({
    mutationFn: async ({
      scadenza,
      importo,
      data,
      metodo,
      note,
      files,
    }: {
      scadenza: Scadenza;
      importo: number;
      data: string;
      metodo: string;
      note: string;
      files: File[];
    }) => {
      // Upload files first
      const uploadedFiles: { path: string; name: string; size: number; type: string }[] = [];
      
      if (files.length > 0) {
        setUploadingFiles(true);
        try {
          for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `payments/${scadenza.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('accounting-files')
              .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) {
              console.error('File upload error:', uploadError);
              // Continue with other files
            } else if (uploadData) {
              uploadedFiles.push({
                path: uploadData.path,
                name: file.name,
                size: file.size,
                type: file.type
              });
            }
          }
        } finally {
          setUploadingFiles(false);
        }
      }
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

      // 4. Crea movimento scadenza with file attachments
      const { error: movimentoError } = await supabase.from("scadenza_movimenti").insert({
        scadenza_id: scadenza.id,
        evento_finanziario_id: eventoData.id,
        prima_nota_id: primaNotaResult.id,
        importo,
        data_movimento: data,
        metodo_pagamento: metodo,
        note: note + (uploadedFiles.length > 0 ? `\n\nAllegati: ${uploadedFiles.map(f => f.name).join(', ')}` : ''),
        attachments: uploadedFiles.length > 0 ? uploadedFiles : null,
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
    setPaymentFiles([]);
  };

  const openRegistraDialog = (scadenza: Scadenza) => {
    setSelectedScadenza(scadenza);
    setImportoRegistrazione(scadenza.importo_residuo.toString());
    setPaymentFiles([]);
    setRegistraDialogOpen(true);
  };

  const onDropFiles = useCallback((acceptedFiles: File[]) => {
    setPaymentFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropFiles,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
      'application/pdf': ['.pdf'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const removeFile = (index: number) => {
    setPaymentFiles(prev => prev.filter((_, i) => i !== index));
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
      files: paymentFiles,
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
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <Clock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scadenziario</h1>
          <p className="text-sm text-muted-foreground">Gestione crediti e debiti raggruppati per soggetto</p>
        </div>
      </div>

      {/* KPI Bar compatta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <ArrowUpCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Crediti</p>
            <p className="text-lg font-bold text-emerald-700 truncate">
              € {totali.crediti.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <ArrowDownCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Debiti</p>
            <p className="text-lg font-bold text-red-700 truncate">
              € {totali.debiti.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <Euro className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Saldo Netto</p>
            <p className={cn("text-lg font-bold truncate", totali.crediti - totali.debiti >= 0 ? "text-emerald-700" : "text-red-700")}>
              € {(totali.crediti - totali.debiti).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <AlertTriangle className={cn("h-5 w-5 shrink-0", scaduteCount > 0 ? "text-orange-600" : "text-muted-foreground")} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Scadute</p>
            <p className={cn("text-lg font-bold", scaduteCount > 0 ? "text-orange-700" : "text-muted-foreground")}>
              {scaduteCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1">
          <TabsList>
            <TabsTrigger value="tutti">Tutti</TabsTrigger>
            <TabsTrigger value="crediti" className="gap-1.5">
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Crediti
            </TabsTrigger>
            <TabsTrigger value="debiti" className="gap-1.5">
              <ArrowDownCircle className="h-3.5 w-3.5" />
              Debiti
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca cliente o fattura..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={statoFilter} onValueChange={(v) => setStatoFilter(v as typeof statoFilter)}>
            <SelectTrigger className="w-28 h-9">
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

      {/* Client Groups - Compact */}
      <Card className="border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {clientiGroups.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nessuna scadenza trovata</p>
            </div>
          ) : (
            <div className="divide-y">
              {clientiGroups.map((group) => {
                const clientKey = `${group.nome}-${group.tipo}`;
                const isExpanded = expandedClients.has(clientKey);
                const percentualePagato = group.totaleImporto > 0 
                  ? ((group.totaleImporto - group.totaleResiduo) / group.totaleImporto) * 100 
                  : 0;

                return (
                  <Collapsible key={clientKey} open={isExpanded} onOpenChange={() => toggleClientExpand(clientKey)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        
                        <div className={cn("p-1.5 rounded-md shrink-0", group.tipo === "credito" ? "bg-emerald-100" : "bg-red-100")}>
                          <Building2 className={cn("h-4 w-4", group.tipo === "credito" ? "text-emerald-700" : "text-red-700")} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm truncate">{group.nome}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", group.tipo === "credito" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200")}>
                              {group.tipo === "credito" ? "Cliente" : "Fornitore"}
                            </Badge>
                            {group.scadenzeScadute > 0 && (
                              <Badge variant="destructive" className="gap-0.5 text-[10px] px-1.5 py-0">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {group.scadenzeScadute} scadute
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.scadenze.length} fattur{group.scadenze.length === 1 ? "a" : "e"} · {group.scadenzeAperte} apert{group.scadenzeAperte === 1 ? "a" : "e"}
                          </p>
                        </div>

                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Residuo / Totale</p>
                          <div className="flex items-baseline gap-1.5 justify-end">
                            <span className={cn("font-bold text-sm", group.tipo === "credito" ? "text-emerald-700" : "text-red-700")}>
                              € {group.totaleResiduo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              / € {group.totaleImporto.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          {percentualePagato > 0 && (
                            <Progress value={percentualePagato} className="h-1 mt-1 w-32 ml-auto" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t bg-muted/20">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="w-8 pl-12"></TableHead>
                              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fattura</TableHead>
                              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data Doc.</TableHead>
                              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scadenza</TableHead>
                              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Importo</TableHead>
                              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">Residuo</TableHead>
                              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stato</TableHead>
                              <TableHead className="w-24"></TableHead>
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
                                    className={cn(
                                      isClosedScadenza(scadenza) && "opacity-50",
                                      giorni < 0 && !isClosedScadenza(scadenza) && "bg-orange-50/50"
                                    )}
                                  >
                                    <TableCell className="pl-12">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setExpandedScadenza(isScadenzaExpanded ? null : scadenza.id)}
                                      >
                                        {isScadenzaExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      </Button>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                          <span className="font-mono font-medium text-sm">{scadenza.invoice_number || "N/D"}</span>
                                          {scadenza.note && (
                                            <p className="text-xs text-muted-foreground truncate max-w-36">{scadenza.note}</p>
                                          )}
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {format(parseISO(scadenza.data_documento), "dd/MM/yyyy")}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm">{format(parseISO(scadenza.data_scadenza), "dd/MM/yyyy")}</span>
                                        {getGiorniBadge(giorni, scadenza.stato)}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">
                                      € {Number(scadenza.importo_totale).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className={cn("text-right font-semibold text-sm", group.tipo === "credito" ? "text-emerald-700" : "text-red-700")}>
                                      € {Number(scadenza.importo_residuo).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell>{getStatoBadge(scadenza.stato)}</TableCell>
                                    <TableCell>
                                      {!isClosedScadenza(scadenza) && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => openRegistraDialog(scadenza)}
                                          className="gap-1 h-7 text-xs"
                                        >
                                          <CreditCard className="h-3 w-3" />
                                          {scadenza.tipo === "credito" ? "Incassa" : "Paga"}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>

                                  {isScadenzaExpanded && (
                                    <TableRow>
                                      <TableCell colSpan={8} className="bg-muted/30 p-4 pl-14">
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            <History className="h-3.5 w-3.5" />
                                            Storico Movimenti
                                          </div>
                                          {movimenti && movimenti.length > 0 ? (
                                            <div className="space-y-1.5">
                                              {movimenti.map((mov) => (
                                                <div 
                                                  key={mov.id}
                                                  className="flex items-center justify-between p-2.5 bg-background rounded-md border text-sm"
                                                >
                                                  <div className="flex items-center gap-2.5">
                                                    <div className={cn("p-1.5 rounded-full", group.tipo === "credito" ? "bg-emerald-100" : "bg-red-100")}>
                                                      <CreditCard className={cn("h-3.5 w-3.5", group.tipo === "credito" ? "text-emerald-700" : "text-red-700")} />
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">
                                                        € {mov.importo.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                                      </span>
                                                      <span className="text-muted-foreground ml-2 text-xs">
                                                        {format(parseISO(mov.data_movimento), "dd/MM/yyyy", { locale: it })}
                                                        {mov.metodo_pagamento && ` · ${mov.metodo_pagamento}`}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  {mov.note && (
                                                    <span className="text-xs text-muted-foreground max-w-xs truncate">{mov.note}</span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-sm text-muted-foreground py-1">Nessun movimento registrato</p>
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
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toggle scadenze chiuse */}
      {closedGroupsCount > 0 && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClosed(!showClosed)}
            className="gap-2 text-muted-foreground"
          >
            <CheckCircle className="h-4 w-4" />
            {showClosed ? "Nascondi" : "Mostra"} {closedGroupsCount} soggett{closedGroupsCount === 1 ? "o" : "i"} saldat{closedGroupsCount === 1 ? "o" : "i"}
          </Button>
        </div>
      )}

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

            {/* File Upload Area */}
            <div className="space-y-2">
              <Label>Prova di pagamento (opzionale)</Label>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary hover:bg-accent/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                {isDragActive ? (
                  <p className="text-sm text-primary">Rilascia i file qui...</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Trascina qui ricevute, screenshot o documenti (max 20MB)
                  </p>
                )}
              </div>
              
              {/* File List */}
              {paymentFiles.length > 0 && (
                <div className="space-y-1 mt-2">
                  {paymentFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {file.type.startsWith('image/') ? (
                          <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
