import { useState, useMemo, useCallback } from "react";
import { BankReconciliationDialog } from "@/components/riconciliazione/BankReconciliationDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  differenceInDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  addMonths,
  subMonths,
  addDays,
  subDays,
  isSameMonth,
  isSameDay,
} from "date-fns";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Euro,
  FileText,
  History,
  Building2,
  CreditCard,
  Receipt,
  Search,
  Upload,
  X,
  File,
  Image as ImageIcon,
  Link2,
  Calendar,
  Users,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────
interface Scadenza {
  id: string;
  evento_id: string | null;
  prima_nota_id: string | null;
  fattura_id: string | null;
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
  invoice_type?: string;
  financial_status?: string;
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

type GroupByMode = "soggetto" | "mese" | "giorno";
type TipoFilter = "tutti" | "crediti" | "debiti";
type StatoFilter = "tutti" | "aperta" | "parziale" | "chiusa";

interface GroupData {
  key: string;
  label: string;
  sublabel?: string;
  icon: "building" | "calendar" | "day";
  tipo?: "credito" | "debito";
  scadenze: Scadenza[];
  totaleImporto: number;
  totaleResiduo: number;
  scadenzeAperte: number;
  scadenzeScadute: number;
}

// ── Helpers ────────────────────────────────────────
const getGiorniScadenza = (dataScadenza: string) => {
  return differenceInDays(parseISO(dataScadenza), new Date());
};

const isClosedScadenza = (s: Scadenza) => s.stato === "chiusa" || s.stato === "saldata";

const fmtEuro = (n: number) => `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

// ── Main Component ─────────────────────────────────
export default function ScadenziarioPage() {
  const queryClient = useQueryClient();

  // Filters
  const [activeTab, setActiveTab] = useState<TipoFilter>("tutti");
  const [statoFilter, setStatoFilter] = useState<StatoFilter>("tutti");
  const [searchQuery, setSearchQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);

  // Grouping & period
  const [groupBy, setGroupBy] = useState<GroupByMode>("mese");
  const [selectedPeriod, setSelectedPeriod] = useState(new Date());

  // UI state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedScadenza, setExpandedScadenza] = useState<string | null>(null);

  // Payment dialog
  const [registraDialogOpen, setRegistraDialogOpen] = useState(false);
  const [selectedScadenza, setSelectedScadenza] = useState<Scadenza | null>(null);
  const [importoRegistrazione, setImportoRegistrazione] = useState("");
  const [dataRegistrazione, setDataRegistrazione] = useState(format(new Date(), "yyyy-MM-dd"));
  const [metodoRegistrazione, setMetodoRegistrazione] = useState("bonifico");
  const [noteRegistrazione, setNoteRegistrazione] = useState("");
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [reconciliationOpen, setReconciliationOpen] = useState(false);

  // ── Period navigation ─────────────────────────────
  const periodLabel = useMemo(() => {
    if (groupBy === "mese") return format(selectedPeriod, "MMMM yyyy", { locale: it });
    if (groupBy === "giorno") return format(selectedPeriod, "EEEE d MMMM yyyy", { locale: it });
    return "";
  }, [groupBy, selectedPeriod]);

  const goBack = () => {
    setSelectedPeriod(p => groupBy === "mese" ? subMonths(p, 1) : subDays(p, 1));
  };
  const goForward = () => {
    setSelectedPeriod(p => groupBy === "mese" ? addMonths(p, 1) : addDays(p, 1));
  };
  const goToday = () => setSelectedPeriod(new Date());

  // ── Data fetching ─────────────────────────────────
  const { data: scadenze, isLoading } = useQuery({
    queryKey: ["scadenze-dettagliate", activeTab, statoFilter],
    queryFn: async () => {
      let query = supabase
        .from("scadenze")
        .select("*, fattura:invoice_registry!scadenze_fattura_id_fkey(id, invoice_number, invoice_date, invoice_type, financial_status)")
        .order("data_scadenza", { ascending: true });

      if (activeTab === "crediti") query = query.eq("tipo", "credito");
      else if (activeTab === "debiti") query = query.eq("tipo", "debito");
      if (statoFilter !== "tutti") query = query.eq("stato", statoFilter);

      const { data, error } = await query;
      if (error) throw error;

      return ((data as any[]) ?? []).map((s: any) => ({
        ...s,
        invoice_number: s.fattura?.invoice_number || undefined,
        invoice_date: s.fattura?.invoice_date || undefined,
        invoice_type: s.fattura?.invoice_type || undefined,
        financial_status: s.fattura?.financial_status || undefined,
        fattura_id: s.fattura_id,
        fattura: undefined,
      })) as Scadenza[];
    },
  });

  const expandedScadenzaObj = useMemo(() => {
    if (!expandedScadenza || !scadenze) return null;
    return scadenze.find((s: any) => s.id === expandedScadenza) || null;
  }, [expandedScadenza, scadenze]);

  const { data: movimenti } = useQuery({
    queryKey: ["scadenza-movimenti", expandedScadenza],
    queryFn: async () => {
      if (!expandedScadenza) return [];

      // 1) Get movements from scadenza_movimenti
      const { data: directMov } = await supabase
        .from("scadenza_movimenti")
        .select("*")
        .eq("scadenza_id", expandedScadenza)
        .order("data_movimento", { ascending: false });

      const results: ScadenzaMovimento[] = (directMov || []) as ScadenzaMovimento[];
      const existingEventIds = new Set(results.map(r => r.evento_finanziario_id).filter(Boolean));

      // 2) Also check bank_reconciliations linked to this scadenza or its fattura
      const scadObj = expandedScadenzaObj;
      const orFilters: string[] = [`scadenza_id.eq.${expandedScadenza}`];
      if (scadObj?.fattura_id) {
        orFilters.push(`invoice_id.eq.${scadObj.fattura_id}`);
      }

      const { data: recons } = await supabase
        .from("bank_reconciliations")
        .select("id, reconciled_amount, created_at, notes, prima_nota_id, bank_movement_id, bank_movements!inner(movement_date, description)")
        .or(orFilters.join(","));

      if (recons && recons.length > 0) {
        for (const r of recons) {
          // Skip if already represented in scadenza_movimenti via prima_nota_id
          if (r.prima_nota_id && existingEventIds.has(r.prima_nota_id)) continue;
          const bm = (r as any).bank_movements;
          results.push({
            id: `recon-${r.id}`,
            scadenza_id: expandedScadenza,
            evento_finanziario_id: r.prima_nota_id || null,
            prima_nota_id: r.prima_nota_id || null,
            importo: r.reconciled_amount,
            data_movimento: bm?.movement_date || r.created_at,
            metodo_pagamento: "Bonifico",
            note: r.notes || bm?.description?.substring(0, 80) || "Riconciliazione bancaria",
            created_at: r.created_at,
          });
        }
      }

      // Sort by date desc
      results.sort((a, b) => b.data_movimento.localeCompare(a.data_movimento));
      return results;
    },
    enabled: !!expandedScadenza,
  });

  // ── Grouping logic ────────────────────────────────
  const { groups, closedCount } = useMemo(() => {
    if (!scadenze) return { groups: [] as GroupData[], closedCount: 0 };

    // Text filter
    const filtered = searchQuery
      ? scadenze.filter(s =>
          s.soggetto_nome?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : scadenze;

    // Period filter for mese/giorno modes
    const periodFiltered = groupBy === "soggetto"
      ? filtered
      : filtered.filter(s => {
          const d = parseISO(s.data_scadenza);
          if (groupBy === "mese") return isSameMonth(d, selectedPeriod);
          return isSameDay(d, selectedPeriod);
        });

    const buildGroup = (key: string, label: string, sublabel: string | undefined, icon: GroupData["icon"], tipo: "credito" | "debito" | undefined, items: Scadenza[]): GroupData => {
      let totaleImporto = 0, totaleResiduo = 0, scadenzeAperte = 0, scadenzeScadute = 0;
      items.forEach(s => {
        totaleImporto += Number(s.importo_totale);
        totaleResiduo += Number(s.importo_residuo);
        if (s.stato === "aperta" || s.stato === "parziale") {
          scadenzeAperte++;
          if (getGiorniScadenza(s.data_scadenza) < 0) scadenzeScadute++;
        }
      });
      return { key, label, sublabel, icon, tipo, scadenze: items, totaleImporto, totaleResiduo, scadenzeAperte, scadenzeScadute };
    };

    let allGroups: GroupData[] = [];

    if (groupBy === "soggetto") {
      const map = new Map<string, Scadenza[]>();
      periodFiltered.forEach(s => {
        const k = `${s.soggetto_nome || "Sconosciuto"}-${s.tipo}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(s);
      });
      map.forEach((items, k) => {
        const nome = items[0].soggetto_nome || "Sconosciuto";
        const tipo = items[0].tipo;
        allGroups.push(buildGroup(k, nome, tipo === "credito" ? "Cliente" : "Fornitore", "building", tipo, items));
      });
      allGroups.sort((a, b) => b.scadenzeScadute - a.scadenzeScadute || b.totaleResiduo - a.totaleResiduo);
    } else if (groupBy === "mese") {
      // Group by day within the selected month
      const map = new Map<string, Scadenza[]>();
      periodFiltered.forEach(s => {
        const dayKey = format(parseISO(s.data_scadenza), "yyyy-MM-dd");
        if (!map.has(dayKey)) map.set(dayKey, []);
        map.get(dayKey)!.push(s);
      });
      const sorted = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
      sorted.forEach(([dayKey, items]) => {
        const d = parseISO(dayKey);
        const label = format(d, "EEEE d MMMM", { locale: it });
        const giorni = differenceInDays(d, new Date());
        let sublabel = "";
        if (giorni < 0) sublabel = `${Math.abs(giorni)} giorni fa`;
        else if (giorni === 0) sublabel = "Oggi";
        else sublabel = `Tra ${giorni} giorni`;
        allGroups.push(buildGroup(dayKey, label, sublabel, "day", undefined, items));
      });
    } else {
      // giorno: group by soggetto within the day
      const map = new Map<string, Scadenza[]>();
      periodFiltered.forEach(s => {
        const k = `${s.soggetto_nome || "Sconosciuto"}-${s.tipo}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(s);
      });
      map.forEach((items, k) => {
        const nome = items[0].soggetto_nome || "Sconosciuto";
        const tipo = items[0].tipo;
        allGroups.push(buildGroup(k, nome, tipo === "credito" ? "Cliente" : "Fornitore", "building", tipo, items));
      });
      allGroups.sort((a, b) => b.totaleResiduo - a.totaleResiduo);
    }

    const closedCount = allGroups.filter(g => g.totaleResiduo <= 0 && g.scadenzeAperte === 0).length;

    if (!showClosed) {
      allGroups = allGroups.filter(g => g.totaleResiduo > 0 || g.scadenzeAperte > 0);
    }

    return { groups: allGroups, closedCount };
  }, [scadenze, searchQuery, groupBy, selectedPeriod, showClosed]);

  // ── KPI totals ────────────────────────────────────
  const totali = useMemo(() => {
    const items = groups.flatMap(g => g.scadenze);
    return items.reduce(
      (acc, s) => {
        if (!isClosedScadenza(s)) {
          if (s.tipo === "credito") acc.crediti += Number(s.importo_residuo);
          else acc.debiti += Number(s.importo_residuo);
        }
        return acc;
      },
      { crediti: 0, debiti: 0 }
    );
  }, [groups]);

  const scaduteCount = useMemo(() => {
    return groups.flatMap(g => g.scadenze).filter(s => !isClosedScadenza(s) && getGiorniScadenza(s.data_scadenza) < 0).length;
  }, [groups]);

  // ── Mutations ─────────────────────────────────────
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
      const uploadedFiles: { path: string; name: string; size: number; type: string }[] = [];

      if (files.length > 0) {
        setUploadingFiles(true);
        try {
          for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `payments/${scadenza.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError, data: uploadData } = await supabase.storage
              .from('accounting-files')
              .upload(fileName, file, { cacheControl: '3600', upsert: false });
            if (!uploadError && uploadData) {
              uploadedFiles.push({ path: uploadData.path, name: file.name, size: file.size, type: file.type });
            }
          }
        } finally {
          setUploadingFiles(false);
        }
      }

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

      // Map payment method to dynamic account key
      const paymentAccountKey = metodo === "contanti" || metodo === "cassa" ? "CASSA" 
        : metodo === "carta" || metodo === "american_express" ? "BANCA" 
        : "BANCA";

      const righe = scadenza.tipo === "credito"
        ? [
            { prima_nota_id: primaNotaResult.id, line_order: 1, account_type: "dynamic", dynamic_account_key: paymentAccountKey, chart_account_id: null, dare: importo, avere: 0, description: `Incasso da cliente (${metodo})` },
            { prima_nota_id: primaNotaResult.id, line_order: 2, account_type: "dynamic", dynamic_account_key: "CREDITI_CLIENTI", chart_account_id: null, dare: 0, avere: importo, description: "Chiusura credito vs clienti" },
          ]
        : [
            { prima_nota_id: primaNotaResult.id, line_order: 1, account_type: "dynamic", dynamic_account_key: "DEBITI_FORNITORI", chart_account_id: null, dare: importo, avere: 0, description: "Chiusura debito vs fornitori" },
            { prima_nota_id: primaNotaResult.id, line_order: 2, account_type: "dynamic", dynamic_account_key: paymentAccountKey, chart_account_id: null, dare: 0, avere: importo, description: `Pagamento a fornitore (${metodo})` },
          ];

      const { error: righeError } = await supabase.from("prima_nota_lines").insert(righe);
      if (righeError) throw righeError;

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

      const nuovoResiduo = Number(scadenza.importo_residuo) - importo;
      const nuovoStato = nuovoResiduo <= 0 ? "chiusa" : nuovoResiduo < Number(scadenza.importo_totale) ? "parziale" : "aperta";

      const { error: updateError } = await supabase
        .from("scadenze")
        .update({ importo_residuo: Math.max(0, nuovoResiduo), stato: nuovoStato })
        .eq("id", scadenza.id);
      if (updateError) throw updateError;

      // Update linked invoice financial status
      if (scadenza.fattura_id) {
        const isFullyPaid = nuovoResiduo <= 0;
        const newFinancialStatus = isFullyPaid
          ? (scadenza.tipo === "credito" ? "incassata" : "pagata")
          : (scadenza.tipo === "credito" ? "parzialmente_incassata" : "parzialmente_pagata");
        
        await supabase
          .from("invoice_registry")
          .update({ 
            financial_status: newFinancialStatus,
            ...(isFullyPaid ? { payment_date: data, payment_method: metodo } : {}),
          })
          .eq("id", scadenza.fattura_id);
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Pagamento registrato e Prima Nota aggiornata");
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["scadenza-movimenti"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-stats"] });
      queryClient.invalidateQueries({ queryKey: ["registro-contabile"] });
      resetForm();
    },
    onError: (error) => {
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
    maxSize: 20 * 1024 * 1024,
  });

  const removeFile = (index: number) => setPaymentFiles(prev => prev.filter((_, i) => i !== index));

  const handleRegistra = () => {
    if (!selectedScadenza) return;
    const importo = parseFloat(importoRegistrazione);
    if (isNaN(importo) || importo <= 0) { toast.error("Inserisci un importo valido"); return; }
    if (importo > selectedScadenza.importo_residuo) { toast.error("L'importo non può superare il residuo"); return; }
    registraMutation.mutate({
      scadenza: selectedScadenza,
      importo,
      data: dataRegistrazione,
      metodo: metodoRegistrazione,
      note: noteRegistrazione,
      files: paymentFiles,
    });
  };

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Badge helpers ─────────────────────────────────
  const getStatoBadge = (stato: string) => {
    switch (stato) {
      case "aperta": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">Aperta</Badge>;
      case "parziale": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">Parziale</Badge>;
      case "chiusa": case "saldata": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Chiusa</Badge>;
      case "stornata": return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-[10px]">Stornata</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{stato}</Badge>;
    }
  };

  const getGiorniBadge = (giorni: number, stato: string) => {
    if (stato === "chiusa" || stato === "saldata") return null;
    if (giorni < 0) return <Badge variant="destructive" className="gap-0.5 text-[10px]"><AlertTriangle className="h-2.5 w-2.5" />-{Math.abs(giorni)}gg</Badge>;
    if (giorni <= 7) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-0.5 text-[10px]"><Clock className="h-2.5 w-2.5" />{giorni}gg</Badge>;
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">{giorni}gg</Badge>;
  };

  // ── Render ────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-4">
      {/* ── Sticky Filter Bar ─────────────────────── */}
      <div className="sticky top-3 z-10 rounded-xl border bg-card/95 backdrop-blur-sm p-4 shadow-sm space-y-3">
        {/* Row 1: Quick type filters + GroupBy + Period nav */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Quick type filters */}
          <div className="flex items-center gap-1.5">
            {([["tutti", "Tutti"], ["crediti", "Crediti"], ["debiti", "Debiti"]] as const).map(([val, label]) => (
              <Button
                key={val}
                size="sm"
                variant={activeTab === val ? "default" : "ghost"}
                className={cn("h-7 text-xs px-3 rounded-full", activeTab !== val && "text-muted-foreground hover:text-foreground")}
                onClick={() => setActiveTab(val)}
              >
                {val === "crediti" && <ArrowUpCircle className="h-3 w-3 mr-1" />}
                {val === "debiti" && <ArrowDownCircle className="h-3 w-3 mr-1" />}
                {label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* GroupBy selector */}
            <div className="flex items-center border rounded-lg bg-background overflow-hidden">
              {([["soggetto", "Soggetto", Users], ["mese", "Mese", Calendar], ["giorno", "Giorno", CalendarDays]] as const).map(([val, label, Icon]) => (
                <Button
                  key={val}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 rounded-none text-xs px-3 gap-1.5",
                    groupBy === val
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                      : "text-muted-foreground"
                  )}
                  onClick={() => setGroupBy(val)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>

            {/* Period navigator (only for mese/giorno) */}
            {groupBy !== "soggetto" && (
              <div className="flex items-center gap-1 border rounded-lg bg-background px-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button onClick={goToday} className="px-3 h-8 text-sm font-medium capitalize hover:bg-muted rounded transition-colors min-w-[160px] text-center">
                  {periodLabel}
                </button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goForward}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: KPIs inline + search + stato filter */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Compact inline KPIs */}
          <div className="flex items-center gap-4 mr-auto">
            <div className="flex items-center gap-1.5">
              <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Crediti</span>
              <span className="text-sm font-bold text-emerald-700">{fmtEuro(totali.crediti)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDownCircle className="h-4 w-4 text-red-600" />
              <span className="text-xs text-muted-foreground">Debiti</span>
              <span className="text-sm font-bold text-red-700">{fmtEuro(totali.debiti)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Euro className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Saldo</span>
              <span className={cn("text-sm font-bold", totali.crediti - totali.debiti >= 0 ? "text-emerald-700" : "text-red-700")}>
                {fmtEuro(totali.crediti - totali.debiti)}
              </span>
            </div>
            {scaduteCount > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-bold text-orange-700">{scaduteCount} scadute</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca soggetto o fattura…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-56 bg-background"
              />
            </div>
            <Select value={statoFilter} onValueChange={(v) => setStatoFilter(v as StatoFilter)}>
              <SelectTrigger className="w-28 h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti">Tutti</SelectItem>
                <SelectItem value="aperta">Aperte</SelectItem>
                <SelectItem value="parziale">Parziali</SelectItem>
                <SelectItem value="chiusa">Chiuse</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setReconciliationOpen(true)} className="gap-1.5 h-9">
              <Link2 className="h-3.5 w-3.5" />
              Riconcilia
            </Button>
          </div>
        </div>
      </div>

      {/* ── Groups ────────────────────────────────── */}
      <Card className="border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {groups.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nessuna scadenza trovata</p>
              <p className="text-sm mt-1">
                {groupBy !== "soggetto" ? "Prova a cambiare periodo o modalità di raggruppamento" : "Nessun risultato per i filtri attivi"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.key);
                const pctPaid = group.totaleImporto > 0
                  ? ((group.totaleImporto - group.totaleResiduo) / group.totaleImporto) * 100
                  : 0;

                return (
                  <Collapsible key={group.key} open={isExpanded} onOpenChange={() => toggleGroupExpand(group.key)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}

                        {/* Icon */}
                        {group.icon === "building" ? (
                          <div className={cn("p-1.5 rounded-md shrink-0", group.tipo === "credito" ? "bg-emerald-100" : "bg-red-100")}>
                            <Building2 className={cn("h-4 w-4", group.tipo === "credito" ? "text-emerald-700" : "text-red-700")} />
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                            <CalendarDays className="h-4 w-4 text-primary" />
                          </div>
                        )}

                        {/* Label */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm capitalize truncate">{group.label}</span>
                            {group.sublabel && (
                              <span className="text-xs text-muted-foreground">{group.sublabel}</span>
                            )}
                            {group.scadenzeScadute > 0 && (
                              <Badge variant="destructive" className="gap-0.5 text-[10px] px-1.5 py-0">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {group.scadenzeScadute} scadute
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.scadenze.length} scadenz{group.scadenze.length === 1 ? "a" : "e"} · {group.scadenzeAperte} apert{group.scadenzeAperte === 1 ? "a" : "e"}
                          </p>
                        </div>

                        {/* Amounts */}
                        <div className="text-right shrink-0 hidden sm:block">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Residuo / Totale</p>
                          <div className="flex items-baseline gap-1.5 justify-end">
                            <span className={cn("font-bold text-sm",
                              group.tipo === "credito" ? "text-emerald-700" : group.tipo === "debito" ? "text-red-700" : "text-foreground"
                            )}>
                              {fmtEuro(group.totaleResiduo)}
                            </span>
                            <span className="text-xs text-muted-foreground">/ {fmtEuro(group.totaleImporto)}</span>
                          </div>
                          {pctPaid > 0 && <Progress value={pctPaid} className="h-1 mt-1 w-32 ml-auto" />}
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t bg-muted/20">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="w-8 pl-12"></TableHead>
                              {groupBy !== "soggetto" && (
                                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Soggetto</TableHead>
                              )}
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
                                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandedScadenza(isScadenzaExpanded ? null : scadenza.id)}>
                                        {isScadenzaExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      </Button>
                                    </TableCell>
                                    {groupBy !== "soggetto" && (
                                      <TableCell>
                                        <div className="flex items-center gap-1.5">
                                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", scadenza.tipo === "credito" ? "bg-emerald-500" : "bg-red-500")} />
                                          <span className="text-sm font-medium truncate max-w-[150px]">{scadenza.soggetto_nome || "N/D"}</span>
                                        </div>
                                      </TableCell>
                                    )}
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                                        <div>
                                          {scadenza.fattura_id ? (
                                            <button className="font-mono font-medium text-sm text-primary hover:underline" onClick={(e) => { e.stopPropagation(); window.location.href = '/contabilita/registro-contabile'; }}>
                                              {scadenza.invoice_number || "N/D"}
                                            </button>
                                          ) : (
                                            <span className="font-mono font-medium text-sm">{scadenza.invoice_number || "N/D"}</span>
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
                                      {fmtEuro(Number(scadenza.importo_totale))}
                                    </TableCell>
                                    <TableCell className={cn("text-right font-semibold text-sm", scadenza.tipo === "credito" ? "text-emerald-700" : "text-red-700")}>
                                      {fmtEuro(Number(scadenza.importo_residuo))}
                                    </TableCell>
                                    <TableCell>{getStatoBadge(scadenza.stato)}</TableCell>
                                    <TableCell>
                                      {!isClosedScadenza(scadenza) && (
                                        <Button size="sm" variant="outline" onClick={() => openRegistraDialog(scadenza)} className="gap-1 h-7 text-xs">
                                          <CreditCard className="h-3 w-3" />
                                          {scadenza.tipo === "credito" ? "Incassa" : "Paga"}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>

                                  {isScadenzaExpanded && (
                                    <TableRow key={`${scadenza.id}-expanded`}>
                                      <TableCell colSpan={groupBy !== "soggetto" ? 9 : 8} className="bg-muted/30 p-4 pl-14">
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            <History className="h-3.5 w-3.5" />
                                            Storico Movimenti
                                          </div>
                                          {movimenti && movimenti.length > 0 ? (
                                            <div className="space-y-1.5">
                                              {movimenti.map((mov) => (
                                                <div key={mov.id} className="flex items-center justify-between p-2.5 bg-background rounded-md border text-sm">
                                                  <div className="flex items-center gap-2.5">
                                                    <div className={cn("p-1.5 rounded-full", scadenza.tipo === "credito" ? "bg-emerald-100" : "bg-red-100")}>
                                                      <CreditCard className={cn("h-3.5 w-3.5", scadenza.tipo === "credito" ? "text-emerald-700" : "text-red-700")} />
                                                    </div>
                                                    <div>
                                                      <span className="font-medium">{fmtEuro(mov.importo)}</span>
                                                      <span className="text-muted-foreground ml-2 text-xs">
                                                        {format(parseISO(mov.data_movimento), "dd/MM/yyyy", { locale: it })}
                                                        {mov.metodo_pagamento && ` · ${mov.metodo_pagamento}`}
                                                      </span>
                                                    </div>
                                                  </div>
                                                  {mov.note && <span className="text-xs text-muted-foreground max-w-xs truncate">{mov.note}</span>}
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

      {/* Toggle closed */}
      {closedCount > 0 && (
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setShowClosed(!showClosed)} className="gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            {showClosed ? "Nascondi" : "Mostra"} {closedCount} posizion{closedCount === 1 ? "e" : "i"} saldat{closedCount === 1 ? "a" : "e"}
          </Button>
        </div>
      )}

      {/* ── Payment Dialog ────────────────────────── */}
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
                    <span>{fmtEuro(Number(selectedScadenza.importo_totale))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Residuo</span>
                    <span className="font-bold text-lg">{fmtEuro(Number(selectedScadenza.importo_residuo))}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label htmlFor="importo">Importo da registrare</Label>
              <Input id="importo" type="number" step="0.01" value={importoRegistrazione} onChange={(e) => setImportoRegistrazione(e.target.value)} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" type="date" value={dataRegistrazione} onChange={(e) => setDataRegistrazione(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metodo">Metodo di pagamento</Label>
              <Select value={metodoRegistrazione} onValueChange={setMetodoRegistrazione}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonifico">Bonifico</SelectItem>
                  <SelectItem value="banca">Banca</SelectItem>
                  <SelectItem value="banca_intesa">Banca Intesa</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="american_express">American Express</SelectItem>
                  <SelectItem value="carta_aziendale">Carta Aziendale</SelectItem>
                  <SelectItem value="carta_q8">Carta Q8</SelectItem>
                  <SelectItem value="contanti">Contanti</SelectItem>
                  <SelectItem value="cassa">Cassa</SelectItem>
                  <SelectItem value="anticipo_dipendente">Anticipo Dipendente</SelectItem>
                  <SelectItem value="anticipo_personale">Anticipo Personale</SelectItem>
                  <SelectItem value="non_so">Non specificato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (opzionale)</Label>
              <Textarea id="note" value={noteRegistrazione} onChange={(e) => setNoteRegistrazione(e.target.value)} placeholder="Eventuali note..." rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Prova di pagamento (opzionale)</Label>
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary hover:bg-accent/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                {isDragActive
                  ? <p className="text-sm text-primary">Rilascia i file qui...</p>
                  : <p className="text-xs text-muted-foreground">Trascina qui ricevute, screenshot o documenti (max 20MB)</p>
                }
              </div>
              {paymentFiles.length > 0 && (
                <div className="space-y-1 mt-2">
                  {paymentFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {file.type.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" /> : <File className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className="truncate">{file.name}</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} className="shrink-0"><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistraDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleRegistra} disabled={registraMutation.isPending}>
              {registraMutation.isPending ? "Registrazione..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bank Reconciliation Dialog */}
      <BankReconciliationDialog
        open={reconciliationOpen}
        onOpenChange={setReconciliationOpen}
        scadenze={(scadenze || []).map(s => ({
          id: s.id,
          tipo: s.tipo,
          soggetto_nome: s.soggetto_nome,
          data_scadenza: s.data_scadenza,
          importo_totale: s.importo_totale,
          importo_residuo: s.importo_residuo,
          stato: s.stato,
          invoice_number: s.invoice_number,
        }))}
        onConfirmMatches={async (matches) => {
          for (const match of matches) {
            const scadenza = scadenze?.find(s => s.id === match.scadenzaId);
            if (!scadenza) continue;
            await registraMutation.mutateAsync({
              scadenza,
              importo: match.importo,
              data: match.data,
              metodo: "bonifico",
              note: "Riconciliazione bancaria automatica",
              files: [],
            });
          }
        }}
      />
    </div>
  );
}
