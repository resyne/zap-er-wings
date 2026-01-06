import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, getYear, getMonth } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Landmark, CreditCard, Wallet, ArrowUpDown, Receipt,
  TrendingUp, TrendingDown, Eye, ArrowLeft, Calendar
} from "lucide-react";

// =====================================================
// INTERFACES
// =====================================================

interface PrimaNotaLine {
  id: string;
  prima_nota_id: string;
  line_order: number;
  chart_account_id: string | null;
  structural_account_id: string | null;
  account_type: string;
  dynamic_account_key: string | null;
  dare: number;
  avere: number;
  description: string | null;
  created_at: string;
  prima_nota?: {
    competence_date: string;
    description: string | null;
    status: string;
    is_rectification?: boolean;
  } | null;
  chart_account?: { code: string; name: string } | null;
  structural_account?: { code: string; name: string } | null;
}

interface AccountSummary {
  key: string;
  name: string;
  icon: React.ComponentType<any>;
  dare: number;
  avere: number;
  saldo: number;
  lines: PrimaNotaLine[];
}

// =====================================================
// ACCOUNT DEFINITIONS
// =====================================================

const FINANCIAL_ACCOUNTS = [
  { key: "BANCA", name: "Banca", icon: Landmark },
  { key: "CARTA", name: "Carta", icon: CreditCard },
  { key: "CASSA", name: "Cassa", icon: Wallet },
];

const IVA_ACCOUNTS = [
  { key: "IVA_CREDITO", name: "IVA a Credito", icon: TrendingUp },
  { key: "IVA_DEBITO", name: "IVA a Debito", icon: TrendingDown },
];

const ECONOMIC_ACCOUNTS = [
  { key: "CONTO_RICAVI", name: "Ricavi", icon: TrendingUp },
  { key: "CONTO_COSTI", name: "Costi", icon: TrendingDown },
];

const CREDIT_DEBT_ACCOUNTS = [
  { key: "CREDITI_CLIENTI", name: "Crediti verso Clienti", icon: TrendingUp },
  { key: "DEBITI_FORNITORI", name: "Debiti verso Fornitori", icon: TrendingDown },
];

const ALL_ACCOUNTS = [
  ...FINANCIAL_ACCOUNTS,
  ...IVA_ACCOUNTS,
  ...ECONOMIC_ACCOUNTS,
  ...CREDIT_DEBT_ACCOUNTS,
];

// =====================================================
// MAIN COMPONENT
// =====================================================

const MONTHS = [
  { value: "all", label: "Tutti i mesi" },
  { value: "1", label: "Gennaio" },
  { value: "2", label: "Febbraio" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Aprile" },
  { value: "5", label: "Maggio" },
  { value: "6", label: "Giugno" },
  { value: "7", label: "Luglio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Settembre" },
  { value: "10", label: "Ottobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Dicembre" },
];

export default function MastrinoPage() {
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Generate years (last 5 years + current)
  const years = useMemo(() => {
    const result = [{ value: "all", label: "Tutti gli anni" }];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      result.push({ value: y.toString(), label: y.toString() });
    }
    return result;
  }, [currentYear]);

  // Fetch all prima_nota_lines with their parent prima_nota
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["mastrino-lines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prima_nota_lines")
        .select(`
          *,
          prima_nota:prima_nota_id(competence_date, description, status, is_rectification),
          chart_account:chart_of_accounts(code, name),
          structural_account:structural_accounts(code, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter out lines where:
      // 1. prima_nota status is "rettificato" (cancelled/reversed entries)
      // 2. prima_nota is_rectification is true (the reversal entries themselves)
      return (data as PrimaNotaLine[]).filter(
        line => line.prima_nota?.status !== "rettificato" && 
                !line.prima_nota?.is_rectification
      );
    },
  });

  // Filter lines by year/month
  const filteredLines = useMemo(() => {
    return lines.filter(line => {
      const dateStr = line.prima_nota?.competence_date || line.created_at;
      if (!dateStr) return false;
      
      const date = new Date(dateStr);
      const lineYear = getYear(date);
      const lineMonth = getMonth(date) + 1; // getMonth is 0-indexed
      
      if (selectedYear !== "all" && lineYear !== parseInt(selectedYear)) {
        return false;
      }
      if (selectedMonth !== "all" && lineMonth !== parseInt(selectedMonth)) {
        return false;
      }
      return true;
    });
  }, [lines, selectedYear, selectedMonth]);

  // Group lines by dynamic_account_key and calculate summaries
  const accountSummaries = useMemo(() => {
    const summaries: Map<string, AccountSummary> = new Map();

    // Initialize all accounts
    ALL_ACCOUNTS.forEach(acc => {
      summaries.set(acc.key, {
        key: acc.key,
        name: acc.name,
        icon: acc.icon,
        dare: 0,
        avere: 0,
        saldo: 0,
        lines: [],
      });
    });

    // Aggregate lines (use filteredLines instead of lines)
    filteredLines.forEach(line => {
      const key = line.dynamic_account_key;
      if (!key) return;

      const summary = summaries.get(key);
      if (summary) {
        summary.dare += line.dare || 0;
        summary.avere += line.avere || 0;
        summary.lines.push(line);
      }
    });

    // Calculate saldi
    summaries.forEach(summary => {
      summary.saldo = summary.dare - summary.avere;
    });

    return summaries;
  }, [filteredLines]);

  // Get account group summaries
  const financialSummary = FINANCIAL_ACCOUNTS.map(acc => accountSummaries.get(acc.key)!);
  const ivaSummary = IVA_ACCOUNTS.map(acc => accountSummaries.get(acc.key)!);
  const economicSummary = ECONOMIC_ACCOUNTS.map(acc => accountSummaries.get(acc.key)!);
  const creditDebtSummary = CREDIT_DEBT_ACCOUNTS.map(acc => accountSummaries.get(acc.key)!);

  // Calculate IVA netta
  const ivaCredito = accountSummaries.get("IVA_CREDITO")?.saldo || 0;
  const ivaDebito = accountSummaries.get("IVA_DEBITO")?.saldo || 0;
  const ivaNetta = ivaDebito - ivaCredito;

  const formatCurrency = (amount: number) => {
    return `€ ${amount.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const AccountTable = ({ 
    title, 
    accounts, 
    showNetRow 
  }: { 
    title: string; 
    accounts: AccountSummary[];
    showNetRow?: { label: string; value: number };
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conto</TableHead>
              <TableHead className="text-right">Dare</TableHead>
              <TableHead className="text-right">Avere</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map(acc => {
              const Icon = acc.icon;
              const hasMovements = acc.lines.length > 0;
              return (
                <TableRow key={acc.key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{acc.name}</span>
                      {hasMovements && (
                        <Badge variant="secondary" className="text-xs">
                          {acc.lines.length}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(acc.dare)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(acc.avere)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${acc.saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(acc.saldo)}
                  </TableCell>
                  <TableCell>
                    {hasMovements && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setSelectedAccount(acc)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {showNetRow && (
              <>
                <TableRow>
                  <TableCell colSpan={5}>
                    <Separator />
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>{showNetRow.label}</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell className={`text-right font-mono ${showNetRow.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(showNetRow.value)}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // Detail Dialog - Mastrino di conto
  const MastrinoDialog = () => {
    if (!selectedAccount) return null;

    // Sort lines by date and calculate running balance
    const sortedLines = [...selectedAccount.lines].sort((a, b) => {
      const dateA = a.prima_nota?.competence_date || a.created_at;
      const dateB = b.prima_nota?.competence_date || b.created_at;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    let runningBalance = 0;
    const linesWithBalance = sortedLines.map(line => {
      runningBalance += (line.dare || 0) - (line.avere || 0);
      return { ...line, runningBalance };
    });

    const Icon = selectedAccount.icon;

    return (
      <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              Mastrino: {selectedAccount.name}
            </DialogTitle>
          </DialogHeader>
          
          {/* Summary Row */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Movimenti</p>
              <p className="text-xl font-bold">{selectedAccount.lines.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Totale Dare</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(selectedAccount.dare)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Totale Avere</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(selectedAccount.avere)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold ${selectedAccount.saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(selectedAccount.saldo)}
              </p>
            </div>
          </div>

          {/* Lines Table */}
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Dare</TableHead>
                  <TableHead className="text-right">Avere</TableHead>
                  <TableHead className="text-right">Saldo Progressivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linesWithBalance.map((line, idx) => (
                  <TableRow key={line.id}>
                    <TableCell className="font-mono text-sm">
                      {line.prima_nota?.competence_date 
                        ? format(new Date(line.prima_nota.competence_date), "dd/MM/yyyy", { locale: it })
                        : "-"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="truncate">{line.description || line.prima_nota?.description || "-"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.dare > 0 ? formatCurrency(line.dare) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.avere > 0 ? formatCurrency(line.avere) : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${line.runningBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(line.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <div className="text-center py-12 text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowUpDown className="h-6 w-6" />
            Mastrino Contabile
          </h1>
          <p className="text-muted-foreground">
            Saldi e movimenti per conto derivati dalla Prima Nota
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Anno" />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Mese" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Financial Accounts */}
        <AccountTable 
          title="📊 Conti Finanziari" 
          accounts={financialSummary}
        />

        {/* IVA Accounts */}
        <AccountTable 
          title="📋 Conti IVA" 
          accounts={ivaSummary}
          showNetRow={{ 
            label: "IVA Netta (Debito - Credito)", 
            value: ivaNetta 
          }}
        />

        {/* Economic Accounts */}
        <AccountTable 
          title="📈 Conti Economici" 
          accounts={economicSummary}
        />

        {/* Credits/Debts */}
        <AccountTable 
          title="💳 Crediti e Debiti" 
          accounts={creditDebtSummary}
        />
      </div>

      <MastrinoDialog />
    </div>
  );
}
