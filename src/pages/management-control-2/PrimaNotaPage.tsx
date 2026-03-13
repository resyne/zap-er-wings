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
  Calendar
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatEuro } from "@/lib/accounting-utils";

// =====================================================
// TYPES
// =====================================================
interface FinancialMovement {
  id: string;
  date: string;
  type: 'entrata' | 'uscita' | 'movimento_interno';
  amount: number;
  description: string;
  financial_account: string; // banca, cassa, carta, contanti
  notes: string | null;
  created_at: string;
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
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['prima-nota-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .in('event_type', ['movimento_finanziario', 'costo', 'ricavo'])
        .order('document_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map(e => ({
        id: e.id,
        date: e.document_date,
        type: e.direction === 'entrata' ? 'entrata' as const : 'uscita' as const,
        amount: e.amount,
        description: e.note || '',
        financial_account: e.payment_method || '',
        notes: e.cfo_notes,
        created_at: e.created_at,
      }));
    }
  });

  // Create movement
  const createMutation = useMutation({
    mutationFn: async (data: MovementFormData) => {
      const { data: user } = await supabase.auth.getUser();
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

  const openCreateDialog = (preset: Partial<MovementFormData>) => {
    setFormData({ ...initialFormData, ...preset });
    setShowCreateDialog(true);
  };

  // Stats
  const totEntrate = movements.filter(m => m.type === 'entrata').reduce((s, m) => s + m.amount, 0);
  const totUscite = movements.filter(m => m.type === 'uscita').reduce((s, m) => s + m.amount, 0);
  const saldo = totEntrate - totUscite;

  // Filtered
  const filtered = movements.filter(m => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (searchTerm && !m.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prima Nota</h1>
          <p className="text-sm text-muted-foreground">Movimenti finanziari — entrate, uscite e giroconti</p>
        </div>
      </div>

      {/* Guida collassabile */}
      <GuideSection />

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ArrowUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Entrate</p>
              <p className="text-lg font-bold text-emerald-600">{formatEuro(totEntrate)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ArrowDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Uscite</p>
              <p className="text-lg font-bold text-red-600">{formatEuro(totUscite)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={cn("text-lg font-bold", saldo >= 0 ? "text-emerald-600" : "text-red-600")}>{formatEuro(saldo)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Buttons — prominent */}
      <div className="grid grid-cols-3 gap-3">
        {/* ENTRATA */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex items-center gap-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-950/10 p-4 hover:border-emerald-400 hover:shadow-md active:scale-[0.97] transition-all duration-200 text-left w-full">
              <div className="h-11 w-11 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 transition-colors">
                <ArrowUpRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-emerald-700 dark:text-emerald-400">Entrata</span>
                <p className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 hidden lg:block">Incassi e bonifici ricevuti</p>
              </div>
              <ChevronDown className="h-4 w-4 text-emerald-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Tipo di entrata</DropdownMenuLabel>
            {[
              { label: "Incasso fattura cliente", account: "banca" },
              { label: "Vendita in contanti", account: "contanti" },
              { label: "Bonifico ricevuto", account: "banca" },
              { label: "Incasso POS", account: "carta" },
              { label: "Altro incasso", account: "" },
            ].map((item) => (
              <DropdownMenuItem key={item.label} onClick={() => openCreateDialog({ type: 'entrata', description: item.label, financial_account: item.account })}>
                <span className="font-medium">{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* USCITA */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex items-center gap-3 rounded-xl border-2 border-red-200 dark:border-red-800/50 bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-950/10 p-4 hover:border-red-400 hover:shadow-md active:scale-[0.97] transition-all duration-200 text-left w-full">
              <div className="h-11 w-11 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0 group-hover:bg-red-200 dark:group-hover:bg-red-800/40 transition-colors">
                <ArrowDownLeft className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-red-700 dark:text-red-400">Uscita</span>
                <p className="text-[10px] text-red-600/60 dark:text-red-400/50 hidden lg:block">Pagamenti e spese</p>
              </div>
              <ChevronDown className="h-4 w-4 text-red-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
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
                <span className="font-medium">{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* MOVIMENTO INTERNO */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="group flex items-center gap-3 rounded-xl border-2 border-blue-200 dark:border-blue-800/50 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-950/10 p-4 hover:border-blue-400 hover:shadow-md active:scale-[0.97] transition-all duration-200 text-left w-full">
              <div className="h-11 w-11 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                <ArrowLeftRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-sm text-blue-700 dark:text-blue-400">Mov. Interno</span>
                <p className="text-[10px] text-blue-600/60 dark:text-blue-400/50 hidden lg:block">Giroconti e trasferimenti</p>
              </div>
              <ChevronDown className="h-4 w-4 text-blue-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Tipo di movimento interno</DropdownMenuLabel>
            {[
              { label: "Giroconto banca → cassa", account: "banca" },
              { label: "Giroconto cassa → banca", account: "cassa" },
              { label: "Prelievo contanti", account: "banca" },
              { label: "Versamento contanti", account: "contanti" },
            ].map((item) => (
              <DropdownMenuItem key={item.label} onClick={() => openCreateDialog({ type: 'movimento_interno', description: item.label, financial_account: item.account })}>
                <span className="font-medium">{item.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca movimenti..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="entrata">Entrate</SelectItem>
            <SelectItem value="uscita">Uscite</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Movements table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[110px]">Data</TableHead>
                <TableHead className="w-[100px]">Tipo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead className="w-[140px]">Conto</TableHead>
                <TableHead className="w-[130px] text-right">Importo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nessun movimento trovato</TableCell></TableRow>
              ) : filtered.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-sm">{format(new Date(m.date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      m.type === 'entrata' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400",
                      m.type === 'uscita' && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400",
                    )}>
                      {m.type === 'entrata' ? '↑ Entrata' : '↓ Uscita'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{m.description || '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{FINANCIAL_ACCOUNTS[m.financial_account] || m.financial_account || '-'}</TableCell>
                  <TableCell className={cn(
                    "text-sm font-semibold text-right",
                    m.type === 'entrata' ? "text-emerald-600" : "text-red-600"
                  )}>
                    {m.type === 'entrata' ? '+' : '-'} {formatEuro(m.amount, { absolute: true })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formData.type === 'entrata' ? '↑ Nuova Entrata' : formData.type === 'uscita' ? '↓ Nuova Uscita' : '↔ Movimento Interno'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Data */}
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.type} onValueChange={(v: 'entrata' | 'uscita' | 'movimento_interno') => setFormData(prev => ({ ...prev, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrata">↑ Entrata</SelectItem>
                  <SelectItem value="uscita">↓ Uscita</SelectItem>
                  <SelectItem value="movimento_interno">↔ Mov. Interno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Importo */}
            <div className="space-y-2">
              <Label>Importo (€) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0,00"
              />
            </div>

            {/* Conto finanziario */}
            <div className="space-y-2">
              <Label>Conto finanziario *</Label>
              <Select value={formData.financial_account} onValueChange={(v) => setFormData(prev => ({ ...prev, financial_account: v }))}>
                <SelectTrigger><SelectValue placeholder="Dove è transitato?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="banca">🏦 Banca</SelectItem>
                  <SelectItem value="cassa">💵 Cassa</SelectItem>
                  <SelectItem value="carta">💳 Carta</SelectItem>
                  <SelectItem value="american_express">💳 American Express</SelectItem>
                  <SelectItem value="contanti">🪙 Contanti</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Descrizione */}
            <div className="col-span-2 space-y-2">
              <Label>Descrizione *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Es: Pagamento fattura fornitore XYZ..."
                rows={2}
              />
            </div>

            {/* Note aggiuntive */}
            <div className="col-span-2 space-y-2">
              <Label>Note (opzionale)</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annulla</Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.amount || !formData.financial_account || !formData.description || createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvataggio...' : 'Registra Movimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =====================================================
// GUIDE SECTION
// =====================================================
function GuideSection() {
  return (
    <Collapsible>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Come utilizzare la Prima Nota</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                <ChevronDown className="h-4 w-4" />
                Dettagli
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Registra tutti i movimenti di denaro — per ricostruire il flusso di cassa, allineare cassa e banca.
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-2">
            <div className="grid gap-4 md:grid-cols-3">
              <GuideCard icon={<ArrowUp className="h-4 w-4 text-emerald-600" />} title="Entrate" color="bg-emerald-100 dark:bg-emerald-900/30" dotColor="bg-emerald-500"
                items={["Incasso fattura cliente", "Vendita in contanti", "Bonifico ricevuto", "Incasso POS"]} />
              <GuideCard icon={<ArrowDown className="h-4 w-4 text-red-600" />} title="Uscite" color="bg-red-100 dark:bg-red-900/30" dotColor="bg-red-500"
                items={["Pagamento fornitore", "Spese bancarie", "Pagamento stipendi", "Pagamento F24", "Acquisto pagato subito"]} />
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
    <div className="rounded-lg border bg-background p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center`}>{icon}</div>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1 pl-2">
        {items.map(item => (
          <li key={item} className="flex items-center gap-2"><span className={`h-1 w-1 rounded-full ${dotColor}`} />{item}</li>
        ))}
      </ul>
    </div>
  );
}
