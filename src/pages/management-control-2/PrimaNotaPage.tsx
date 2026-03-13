import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isWithinInterval } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  ArrowUp, ArrowDown, ArrowUpRight, ArrowDownLeft, ArrowLeftRight,
  ChevronDown, ChevronLeft, ChevronRight, Receipt, Wallet, Info, Plus, Search, Trash2,
  Calendar, AlertCircle, CheckCircle2, Eye
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatEuro } from "@/lib/accounting-utils";
import { BozzaValidaDialog } from "@/components/prima-nota/BozzaValidaDialog";
import { PrimaNotaDetailDialog } from "@/components/prima-nota/PrimaNotaDetailDialog";

// =====================================================
// TYPES
// =====================================================
interface FinancialMovement {
  id: string;
  code: string;
  date: string;
  type: 'entrata' | 'uscita' | 'movimento_interno';
  amount: number;
  description: string;
  financial_account: string;
  notes: string | null;
  created_at: string;
  status: string;
  attachment_url: string | null;
}

interface MovementFormData {
  date: string;
  type: 'entrata' | 'uscita' | 'movimento_interno';
  amount: number;
  description: string;
  financial_account: string;
  notes: string;
}

const initialFormData: MovementFormData = {
  date: format(new Date(), 'yyyy-MM-dd'),
  type: 'uscita',
  amount: 0,
  description: '',
  financial_account: '',
  notes: '',
};

const FINANCIAL_ACCOUNTS: Record<string, string> = {
  banca: "🏦 Banca",
  cassa: "💵 Cassa",
  carta: "💳 Carta",
  american_express: "💳 American Express",
  contanti: "🪙 Contanti (piccola cassa)",
};

// =====================================================
// MAIN PAGE
// =====================================================
export default function PrimaNotaPage() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<MovementFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('month');
  const [viewDate, setViewDate] = useState<Date>(new Date());

  const getDateRange = useCallback(() => {
    switch (viewMode) {
      case 'day':
        return { start: startOfDay(viewDate), end: endOfDay(viewDate) };
      case 'week':
        return { start: startOfWeek(viewDate, { weekStartsOn: 1 }), end: endOfWeek(viewDate, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(viewDate), end: endOfMonth(viewDate) };
    }
  }, [viewMode, viewDate]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    const fn = direction === 'prev'
      ? viewMode === 'day' ? subDays : viewMode === 'week' ? subWeeks : subMonths
      : viewMode === 'day' ? addDays : viewMode === 'week' ? addWeeks : addMonths;
    setViewDate(fn(viewDate, 1));
  };

  const getPeriodLabel = () => {
    const range = getDateRange();
    switch (viewMode) {
      case 'day':
        return format(viewDate, 'EEEE dd MMMM yyyy', { locale: it });
      case 'week':
        return `${format(range.start, 'dd MMM', { locale: it })} — ${format(range.end, 'dd MMM yyyy', { locale: it })}`;
      case 'month':
        return format(viewDate, 'MMMM yyyy', { locale: it });
    }
  };

  // Query movements from accounting_entries (filtered to financial movements only)
  const { data: rawEntries = [], isLoading } = useQuery({
    queryKey: ['prima-nota-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .in('status', ['classificato', 'registrato', 'segnalazione', 'da_classificare', 'in_classificazione', 'pronto_prima_nota'])
        .order('document_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    }
  });

  const movements: FinancialMovement[] = rawEntries.map(e => ({
    id: e.id,
    code: e.account_code || '',
    date: e.document_date,
    type: e.direction === 'entrata' ? 'entrata' as const : 'uscita' as const,
    amount: e.amount,
    description: e.note || '',
    financial_account: e.payment_method || '',
    notes: e.cfo_notes,
    created_at: e.created_at,
    status: e.status || 'classificato',
    attachment_url: e.attachment_url || null,
  }));

  // State for BozzaValidaDialog
  const [selectedEntryForValidation, setSelectedEntryForValidation] = useState<any>(null);
  const [bozzaDialogOpen, setBozzaDialogOpen] = useState(false);

  const openValidateDialog = (movementId: string) => {
    const fullEntry = rawEntries.find(e => e.id === movementId);
    if (fullEntry) {
      setSelectedEntryForValidation(fullEntry);
      setBozzaDialogOpen(true);
    }
  };

  const segnalazioniCount = movements.filter(m => m.status === 'segnalazione').length;

  // Generate progressive code for the date: PN-YYYYMMDD-01
  const generateCode = async (date: string) => {
    const dateFormatted = date.replace(/-/g, '');
    const prefix = `PN-${dateFormatted}`;
    
    const { count } = await supabase
      .from('accounting_entries')
      .select('*', { count: 'exact', head: true })
      .like('account_code', `${prefix}-%`);
    
    const nextNum = String((count || 0) + 1).padStart(2, '0');
    return `${prefix}-${nextNum}`;
  };

  // Create movement
  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      const { data: user } = await supabase.auth.getUser();
      const code = await generateCode(data.date);
      
      const { error } = await supabase
        .from('accounting_entries')
        .insert({
          amount: data.amount,
          direction: data.type === 'entrata' ? 'entrata' : 'uscita',
          document_type: 'movimento',
          document_date: data.date,
          status: 'classificato',
          event_type: 'movimento_finanziario',
          financial_status: data.type === 'entrata' ? 'incassata' : 'pagata',
          payment_method: data.financial_account || null,
          note: data.description,
          cfo_notes: data.notes || null,
          attachment_url: '',
          user_id: user?.user?.id,
          account_code: code,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Movimento registrato');
      setShowCreateDialog(false);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ['prima-nota-movements'] });
    },
    onError: (error) => {
      toast.error('Errore: ' + error.message);
    }
  });

  // Delete movement
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounting_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Movimento eliminato');
      queryClient.invalidateQueries({ queryKey: ['prima-nota-movements'] });
    },
    onError: (error) => {
      toast.error('Errore: ' + error.message);
    }
  });

  const openCreateDialog = (preset: Partial<MovementFormData>) => {
    setFormData({ ...initialFormData, ...preset });
    setShowCreateDialog(true);
  };

  // Filter by date range first
  const dateRange = getDateRange();
  const periodMovements = movements.filter(m => {
    const d = new Date(m.date);
    return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
  });

  // Stats (based on period)
  const totEntrate = periodMovements.filter(m => m.type === 'entrata').reduce((s, m) => s + m.amount, 0);
  const totUscite = periodMovements.filter(m => m.type === 'uscita').reduce((s, m) => s + m.amount, 0);
  const saldo = totEntrate - totUscite;

  // Filtered (search + type on top of period)
  const filtered = periodMovements.filter(m => {
    if (filterType === 'segnalazione' && m.status !== 'segnalazione') return false;
    if (filterType !== 'all' && filterType !== 'segnalazione' && m.type !== filterType) return false;
    if (searchTerm && !m.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const typeConfig = {
    entrata: { label: 'Entrata', icon: ArrowUpRight, color: 'emerald', gradient: 'from-emerald-500 to-emerald-600' },
    uscita: { label: 'Uscita', icon: ArrowDownLeft, color: 'red', gradient: 'from-red-500 to-red-600' },
    movimento_interno: { label: 'Mov. Interno', icon: ArrowLeftRight, color: 'blue', gradient: 'from-blue-500 to-blue-600' },
  };

  const currentTypeConfig = typeConfig[formData.type];

  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-5">
      {/* Header + Period selector combined */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Prima Nota</h1>
              <p className="text-sm text-muted-foreground">Movimenti finanziari — entrate, uscite e giroconti</p>
            </div>
          </div>
        </div>

        {/* Period bar */}
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              className="px-2 py-0.5 text-sm font-semibold capitalize min-w-[180px] text-center rounded-md hover:bg-muted transition-colors"
              onClick={() => setViewDate(new Date())}
              title="Vai a oggi"
            >
              {getPeriodLabel()}
            </button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigatePeriod('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'day' | 'week' | 'month')} className="bg-muted/60 rounded-lg p-0.5">
              <ToggleGroupItem value="day" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Giorno
              </ToggleGroupItem>
              <ToggleGroupItem value="week" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Settimana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Mese
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => setViewDate(new Date())}
            >
              Oggi
            </Button>
          </div>
        </div>
      </div>

      {/* Stats + Quick actions in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Stats */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-3">
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Entrate</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatEuro(totEntrate)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{periodMovements.filter(m => m.type === 'entrata').length} movimenti</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-red-400 to-red-600" />
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Uscite</p>
              <p className="text-xl font-bold text-red-600 mt-1">{formatEuro(totUscite)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{periodMovements.filter(m => m.type === 'uscita').length} movimenti</p>
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className={cn("h-1 bg-gradient-to-r", saldo >= 0 ? "from-emerald-400 to-emerald-600" : "from-red-400 to-red-600")} />
            <CardContent className="p-4">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Saldo</p>
              <p className={cn("text-xl font-bold mt-1", saldo >= 0 ? "text-emerald-600" : "text-red-600")}>{formatEuro(saldo)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{periodMovements.length} totali</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick action buttons */}
        <div className="lg:col-span-7 grid grid-cols-3 gap-3">
          {/* ENTRATA */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group relative flex flex-col items-center gap-2 rounded-xl border bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-center w-full overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowUpRight className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground">Entrata</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Incassi e bonifici</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 absolute bottom-2 right-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Tipo di entrata</DropdownMenuLabel>
              {[
                { label: "Incasso fattura cliente", account: "banca" },
                { label: "Vendita in contanti", account: "contanti" },
                { label: "Bonifico ricevuto", account: "banca" },
                { label: "Incasso POS", account: "carta" },
                { label: "Altro incasso", account: "" },
              ].map((item) => (
                <DropdownMenuItem key={item.label} onClick={() => openCreateDialog({ type: 'entrata', description: item.label, financial_account: item.account })}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* USCITA */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group relative flex flex-col items-center gap-2 rounded-xl border bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-center w-full overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-12 w-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowDownLeft className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground">Uscita</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Pagamenti e spese</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 absolute bottom-2 right-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Tipo di uscita</DropdownMenuLabel>
              {[
                { label: "Pagamento fornitore", account: "banca" },
                { label: "Spese bancarie", account: "banca" },
                { label: "Pagamento stipendi", account: "banca" },
                { label: "Pagamento F24", account: "banca" },
                { label: "Acquisto pagato subito", account: "" },
                { label: "Altra uscita", account: "" },
              ].map((item) => (
                <DropdownMenuItem key={item.label} onClick={() => openCreateDialog({ type: 'uscita', description: item.label, financial_account: item.account })}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* MOVIMENTO INTERNO */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group relative flex flex-col items-center gap-2 rounded-xl border bg-card p-5 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200 text-center w-full overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ArrowLeftRight className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground">Mov. Interno</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Giroconti</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40 absolute bottom-2 right-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Tipo di movimento interno</DropdownMenuLabel>
              {[
                { label: "Giroconto banca → cassa", account: "banca" },
                { label: "Giroconto cassa → banca", account: "cassa" },
                { label: "Prelievo contanti", account: "banca" },
                { label: "Versamento contanti", account: "contanti" },
              ].map((item) => (
                <DropdownMenuItem key={item.label} onClick={() => openCreateDialog({ type: 'movimento_interno', description: item.label, financial_account: item.account })}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Segnalazioni banner */}
      {segnalazioniCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {segnalazioniCount} segnalazion{segnalazioniCount === 1 ? 'e' : 'i'} da validare
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Movimenti segnalati dal personale operativo via Z-APP — richiedono validazione CFO</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-100 text-xs shrink-0"
            onClick={() => setFilterType('segnalazione')}
          >
            Mostra
          </Button>
        </div>
      )}

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca movimenti..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <ToggleGroup
          type="single"
          value={filterType}
          onValueChange={(v) => v && setFilterType(v)}
          className="bg-muted/50 rounded-lg p-0.5"
        >
          <ToggleGroupItem value="all" className="text-xs px-3 h-8 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">
            Tutti
          </ToggleGroupItem>
          <ToggleGroupItem value="entrata" className="text-xs px-3 h-8 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-emerald-600">
            ↑ Entrate
          </ToggleGroupItem>
          <ToggleGroupItem value="uscita" className="text-xs px-3 h-8 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-red-600">
            ↓ Uscite
          </ToggleGroupItem>
          <ToggleGroupItem value="segnalazione" className="text-xs px-3 h-8 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-amber-600">
            ⚠ Segnalazioni {segnalazioniCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px] bg-amber-100 text-amber-700">{segnalazioniCount}</Badge>}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Movements table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[130px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Codice</TableHead>
                <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data</TableHead>
                <TableHead className="w-[100px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Descrizione</TableHead>
                <TableHead className="w-[150px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conto</TableHead>
                <TableHead className="w-[110px] text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stato</TableHead>
                <TableHead className="w-[140px] text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Importo</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                        <Receipt className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">Nessun movimento nel periodo</p>
                      <p className="text-xs text-muted-foreground/60">Usa i pulsanti sopra per registrare un movimento</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((m) => (
                <TableRow 
                  key={m.id} 
                  className={cn(
                    "group hover:bg-muted/20 transition-colors cursor-pointer", 
                    m.status === 'segnalazione' && "bg-amber-50/50 dark:bg-amber-950/10"
                  )}
                  onClick={() => {
                    if (m.status === 'segnalazione') {
                      openValidateDialog(m.id);
                    }
                  }}
                >
                  <TableCell>
                    <code className={cn(
                      "text-[11px] font-mono px-1.5 py-0.5 rounded",
                      m.status === 'segnalazione' 
                        ? "text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/50" 
                        : "text-muted-foreground bg-muted/50"
                    )}>{m.code || '—'}</code>
                  </TableCell>
                  <TableCell className="text-sm font-medium tabular-nums">{format(new Date(m.date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                  <TableCell>
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                      m.type === 'entrata' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
                      m.type === 'uscita' && "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
                    )}>
                      {m.type === 'entrata' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                      {m.type === 'entrata' ? 'Entrata' : 'Uscita'}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {m.description || '—'}
                    {m.attachment_url && m.attachment_url !== '' && (
                      <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center text-[10px] text-primary hover:underline">
                        📎 allegato
                      </a>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
                      {FINANCIAL_ACCOUNTS[m.financial_account] || m.financial_account || '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {m.status === 'segnalazione' ? (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Segnalazione
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Validato
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={cn(
                    "text-sm font-bold text-right tabular-nums",
                    m.type === 'entrata' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {m.type === 'entrata' ? '+' : '−'} {formatEuro(m.amount, { absolute: true })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {m.status === 'segnalazione' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                                onClick={(e) => { e.stopPropagation(); openValidateDialog(m.id); }}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Valida segnalazione</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina movimento</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare "{m.description}" di {formatEuro(m.amount)}? Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(m.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Guida collassabile — at the bottom */}
      <GuideSection />

      {/* Create dialog — redesigned */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          {/* Colored header */}
          <div className={cn(
            "px-6 py-5 text-white bg-gradient-to-r",
            currentTypeConfig.gradient
          )}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                <currentTypeConfig.icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {formData.type === 'entrata' ? 'Nuova Entrata' : formData.type === 'uscita' ? 'Nuova Uscita' : 'Movimento Interno'}
                </h2>
                <p className="text-sm text-white/70">{formData.description || 'Inserisci i dettagli del movimento'}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Amount — prominent */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Importo</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground/50">€</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                  placeholder="0,00"
                  className="pl-12 h-14 text-2xl font-bold tabular-nums border-2 focus:border-primary"
                />
              </div>
            </div>

            {/* Date + Type row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Tipo</Label>
                <Select value={formData.type} onValueChange={(v: 'entrata' | 'uscita' | 'movimento_interno') => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrata">↑ Entrata</SelectItem>
                    <SelectItem value="uscita">↓ Uscita</SelectItem>
                    <SelectItem value="movimento_interno">↔ Mov. Interno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Financial account — visual cards */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Conto finanziario</Label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'banca', label: 'Banca', icon: '🏦' },
                  { key: 'cassa', label: 'Cassa', icon: '💵' },
                  { key: 'carta', label: 'Carta', icon: '💳' },
                  { key: 'american_express', label: 'Amex', icon: '💳' },
                  { key: 'contanti', label: 'Contanti', icon: '🪙' },
                ].map(acc => (
                  <button
                    key={acc.key}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, financial_account: acc.key }))}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 text-xs font-medium transition-all",
                      formData.financial_account === acc.key
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-transparent bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:border-muted"
                    )}
                  >
                    <span className="text-lg">{acc.icon}</span>
                    <span>{acc.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Descrizione</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Es: Pagamento fattura fornitore XYZ..."
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Note <span className="normal-case font-normal">(opzionale)</span></Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-muted/20 border-t flex items-center justify-between">
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)} className="text-muted-foreground">
              Annulla
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.amount || !formData.financial_account || !formData.description || createMutation.isPending}
              className={cn("gap-2 px-6 bg-gradient-to-r text-white shadow-md hover:shadow-lg transition-shadow", currentTypeConfig.gradient)}
            >
              <currentTypeConfig.icon className="h-4 w-4" />
              {createMutation.isPending ? 'Salvataggio...' : 'Registra Movimento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Validate segnalazione via BozzaValidaDialog */}
      <BozzaValidaDialog
        open={bozzaDialogOpen}
        onOpenChange={setBozzaDialogOpen}
        entry={selectedEntryForValidation}
      />
    </div>
  );
}

// =====================================================
// GUIDE SECTION
// =====================================================
function GuideSection() {
  return (
    <Collapsible>
      <Card className="border-dashed border-muted-foreground/20 bg-muted/10">
        <CardHeader className="pb-2 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Guida rapida alla Prima Nota</span>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground h-7">
                <ChevronDown className="h-3.5 w-3.5" />
                Mostra
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid gap-3 md:grid-cols-3">
              <GuideCard icon={<ArrowUpRight className="h-4 w-4 text-emerald-600" />} title="Entrate" color="bg-emerald-100 dark:bg-emerald-900/30" dotColor="bg-emerald-500"
                items={["Incasso fattura cliente", "Vendita in contanti", "Bonifico ricevuto", "Incasso POS"]} />
              <GuideCard icon={<ArrowDownLeft className="h-4 w-4 text-red-600" />} title="Uscite" color="bg-red-100 dark:bg-red-900/30" dotColor="bg-red-500"
                items={["Pagamento fornitore", "Spese bancarie", "Pagamento stipendi", "Pagamento F24"]} />
              <GuideCard icon={<ArrowLeftRight className="h-4 w-4 text-blue-600" />} title="Movimenti interni" color="bg-blue-100 dark:bg-blue-900/30" dotColor="bg-blue-500"
                items={["Giroconto banca → cassa", "Prelievo contanti", "Versamento contanti"]} />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function GuideCard({ icon, title, color, dotColor, items }: { icon: React.ReactNode; title: string; color: string; dotColor: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`h-7 w-7 rounded-lg ${color} flex items-center justify-center`}>{icon}</div>
        <h4 className="font-semibold text-xs">{title}</h4>
      </div>
      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
        {items.map(item => (
          <li key={item} className="flex items-center gap-1.5"><span className={`h-1 w-1 rounded-full ${dotColor}`} />{item}</li>
        ))}
      </ul>
    </div>
  );
}
