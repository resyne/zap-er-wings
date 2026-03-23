import React, { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Brain, Check, X, Loader2, ChevronRight, Sparkles, AlertCircle, SkipForward, Play, RotateCcw, Pencil } from "lucide-react";

interface InvoiceRegistry {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  subject_name: string;
  subject_type: string;
  imponibile: number;
  iva_rate: number;
  iva_amount: number;
  total_amount: number;
  vat_regime: string;
  status: string;
  financial_status: string;
  notes?: string;
  cost_account_id?: string;
  revenue_account_id?: string;
  cost_center_id?: string;
  profit_center_id?: string;
}

interface AISuggestion {
  cost_account_id?: string;
  revenue_account_id?: string;
  cost_center_id?: string;
  profit_center_id?: string;
  vat_regime?: string;
  iva_rate?: number;
  financial_status?: string;
  reasoning?: string;
  confidence?: string;
  warnings?: string[];
}

interface InvoiceWithSuggestion {
  invoice: InvoiceRegistry;
  suggestion: AISuggestion | null;
  editedSuggestion: AISuggestion | null;
  status: 'pending' | 'analyzing' | 'ready' | 'approved' | 'skipped' | 'error';
  error?: string;
}

interface BulkAIClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: InvoiceRegistry[];
  accounts: { id: string; name: string; code: string; account_type: string }[];
  costCenters: { id: string; name: string; code: string }[];
  profitCenters: { id: string; name: string; code: string }[];
  onApprove: (invoiceId: string, suggestion: AISuggestion) => Promise<void>;
  onComplete: () => void;
}

const VAT_REGIMES = [
  { value: 'domestica_imponibile', label: 'Ordinario (22%)', rate: 22 },
  { value: 'domestica_ridotta_10', label: 'Ridotta (10%)', rate: 10 },
  { value: 'domestica_ridotta_4', label: 'Minima (4%)', rate: 4 },
  { value: 'esente', label: 'Esente IVA', rate: 0 },
  { value: 'non_imponibile', label: 'Non imponibile', rate: 0 },
  { value: 'reverse_charge', label: 'Reverse Charge', rate: 0 },
  { value: 'intracomunitaria', label: 'Intracomunitaria', rate: 0 },
  { value: 'extracomunitaria', label: 'Extracomunitaria', rate: 0 },
];

export const BulkAIClassificationDialog: React.FC<BulkAIClassificationDialogProps> = ({
  open,
  onOpenChange,
  invoices,
  accounts,
  costCenters,
  profitCenters,
  onApprove,
  onComplete,
}) => {
  const [items, setItems] = useState<InvoiceWithSuggestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<'idle' | 'active'>('idle');
  const abortRef = useRef(false);
  const itemsRef = useRef<InvoiceWithSuggestion[]>([]);

  useEffect(() => { itemsRef.current = items; }, [items]);

  const bozzaInvoices = invoices.filter(inv => inv.status === 'bozza');

  // Load saved AI suggestions from DB when dialog opens
  const loadSavedSuggestions = useCallback(async () => {
    const invoicesWithSaved: InvoiceWithSuggestion[] = bozzaInvoices.map(inv => {
      const saved = (inv as any).ai_suggestion as AISuggestion | null;
      if (saved && saved.reasoning) {
        return {
          invoice: inv,
          suggestion: saved,
          editedSuggestion: { ...saved },
          status: 'ready' as const,
        };
      }
      return {
        invoice: inv,
        suggestion: null,
        editedSuggestion: null,
        status: 'pending' as const,
      };
    });
    return invoicesWithSaved;
  }, [bozzaInvoices]);

  const analyzeFrom = useCallback(async (startIdx: number) => {
    abortRef.current = false;
    setIsProcessing(true);

    for (let i = startIdx; i < itemsRef.current.length; i++) {
      if (abortRef.current) {
        toast.info('Analisi in pausa. Puoi revisionare le fatture già analizzate o riprendere.');
        break;
      }

      const currentItem = itemsRef.current[i];
      if (['ready', 'approved', 'skipped'].includes(currentItem.status)) continue;

      setItems(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'analyzing', error: undefined } : item
      ));

      try {
        const { data, error } = await supabase.functions.invoke('ai-accounting-analysis', {
          body: {
            invoice: {
              invoice_type: currentItem.invoice.invoice_type,
              subject_name: currentItem.invoice.subject_name,
              subject_type: currentItem.invoice.subject_type,
              imponibile: currentItem.invoice.imponibile,
              iva_rate: currentItem.invoice.iva_rate,
              vat_regime: currentItem.invoice.vat_regime,
              financial_status: currentItem.invoice.financial_status,
              invoice_date: currentItem.invoice.invoice_date,
              notes: currentItem.invoice.notes,
            },
            chartOfAccounts: accounts,
            costCenters,
            profitCenters,
          },
        });

        if (error) throw error;
        if (data?.success && data?.suggestion) {
          // Save suggestion to DB immediately
          await supabase
            .from('invoice_registry')
            .update({ ai_suggestion: data.suggestion })
            .eq('id', currentItem.invoice.id);

          setItems(prev => prev.map((item, idx) =>
            idx === i ? {
              ...item,
              suggestion: data.suggestion,
              editedSuggestion: { ...data.suggestion },
              status: 'ready'
            } : item
          ));
          setSelectedIndex(prev => prev === null ? i : prev);
        } else {
          throw new Error(data?.error || 'Risposta AI non valida');
        }
      } catch (err: any) {
        console.error(`AI analysis error for invoice ${currentItem.invoice.invoice_number}:`, err);
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', error: err.message || 'Timeout o errore di rete' } : item
        ));
      }

      if (i < itemsRef.current.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    setIsProcessing(false);
  }, [accounts, costCenters, profitCenters]);

  const startAnalysis = useCallback(async () => {
    if (bozzaInvoices.length === 0) {
      toast.info('Nessuna fattura in bozza da analizzare');
      return;
    }

    const savedItems = await loadSavedSuggestions();
    setItems(savedItems);
    itemsRef.current = savedItems;
    setPhase('active');

    // Auto-select first ready item if any
    const firstReady = savedItems.findIndex(it => it.status === 'ready');
    setSelectedIndex(firstReady !== -1 ? firstReady : null);

    // Only analyze pending ones
    const firstPending = savedItems.findIndex(it => it.status === 'pending');
    if (firstPending !== -1) {
      analyzeFrom(firstPending);
    } else {
      toast.info('Tutte le fatture sono già state analizzate. Puoi revisionarle.');
    }
  }, [bozzaInvoices, analyzeFrom, loadSavedSuggestions]);

  const resumeAnalysis = useCallback(() => {
    const resumeIdx = itemsRef.current.findIndex(it => ['pending', 'error'].includes(it.status));
    if (resumeIdx === -1) {
      toast.info('Tutte le fatture sono già state analizzate');
      return;
    }
    analyzeFrom(resumeIdx);
  }, [analyzeFrom]);

  const updateEditedField = (index: number, field: string, value: any) => {
    setItems(prev => prev.map((it, idx) =>
      idx === index ? {
        ...it,
        editedSuggestion: { ...it.editedSuggestion, [field]: value }
      } : it
    ));
  };

  const handleApprove = async (index: number) => {
    const item = items[index];
    if (!item?.editedSuggestion) return;

    try {
      await onApprove(item.invoice.id, item.editedSuggestion);
      setItems(prev => prev.map((it, idx) =>
        idx === index ? { ...it, status: 'approved' } : it
      ));
      toast.success(`Fattura ${item.invoice.invoice_number} classificata`);
      const nextIdx = items.findIndex((it, idx) => idx > index && it.status === 'ready');
      if (nextIdx !== -1) setSelectedIndex(nextIdx);
      else {
        const fromStart = items.findIndex((it, idx) => idx !== index && it.status === 'ready');
        if (fromStart !== -1) setSelectedIndex(fromStart);
        else setSelectedIndex(null);
      }
    } catch (err: any) {
      toast.error('Errore: ' + err.message);
    }
  };

  const handleSkip = (index: number) => {
    setItems(prev => prev.map((it, idx) =>
      idx === index ? { ...it, status: 'skipped' } : it
    ));
    const nextIdx = items.findIndex((it, idx) => idx > index && it.status === 'ready');
    if (nextIdx !== -1) setSelectedIndex(nextIdx);
    else setSelectedIndex(null);
  };

  const handleClose = () => {
    abortRef.current = true;
    const approved = items.filter(i => i.status === 'approved').length;
    setPhase('idle');
    setItems([]);
    setSelectedIndex(null);
    onOpenChange(false);
    if (approved > 0) onComplete();
  };

  const analyzedCount = items.filter(i => ['ready', 'approved', 'skipped', 'error'].includes(i.status)).length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const readyCount = items.filter(i => i.status === 'ready').length;
  const pendingOrErrorCount = items.filter(i => ['pending', 'error'].includes(i.status)).length;

  const costAccounts = accounts.filter(a => ['costo', 'expense', 'cost'].includes(a.account_type?.toLowerCase() || ''));
  const revenueAccounts = accounts.filter(a => ['ricavo', 'revenue', 'income'].includes(a.account_type?.toLowerCase() || ''));

  const selectedItem = selectedIndex !== null ? items[selectedIndex] : null;
  const edited = selectedItem?.editedSuggestion;

  const getStatusIcon = (item: InvoiceWithSuggestion) => {
    switch (item.status) {
      case 'pending': return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />;
      case 'analyzing': return <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />;
      case 'ready': return <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />;
      case 'approved': return <Check className="w-4 h-4 text-green-600 flex-shrink-0" />;
      case 'skipped': return <SkipForward className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Contabilizzazione AI — {bozzaInvoices.length} fatture in bozza
          </DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Classificazione automatica con AI</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                L'AI analizzerà {bozzaInvoices.length} fatture in bozza e suggerirà conto, centro di costo/ricavo e regime IVA.
                Puoi modificare i suggerimenti prima di approvare.
              </p>
            </div>
            <Button size="lg" onClick={startAnalysis} className="gap-2 mt-2" disabled={bozzaInvoices.length === 0}>
              <Brain className="w-4 h-4" />
              Avvia analisi AI
            </Button>
          </div>
        )}

        {phase === 'active' && (
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left panel */}
            <div className="w-[300px] flex flex-col gap-3 flex-shrink-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {isProcessing ? 'Analisi in corso...' : 'Analisi in pausa'}
                  </span>
                  <span className="text-xs text-muted-foreground">{analyzedCount}/{items.length}</span>
                </div>
                <Progress value={(analyzedCount / Math.max(items.length, 1)) * 100} className="h-1.5" />
                <div className="flex gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Check className="w-3 h-3 text-green-600" /> {approvedCount}
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <ChevronRight className="w-3 h-3 text-primary" /> {readyCount}
                  </Badge>
                </div>
              </div>

              <div className="flex gap-2">
                {isProcessing ? (
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => { abortRef.current = true; }}>
                    <X className="w-3.5 h-3.5" /> Pausa
                  </Button>
                ) : pendingOrErrorCount > 0 ? (
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={resumeAnalysis}>
                    <Play className="w-3.5 h-3.5" /> Riprendi ({pendingOrErrorCount})
                  </Button>
                ) : null}
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-1 pr-2">
                  {items.map((item, idx) => (
                    <button
                      key={item.invoice.id}
                      onClick={() => item.status === 'ready' && setSelectedIndex(idx)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors",
                        idx === selectedIndex && "bg-primary/10 ring-1 ring-primary/30",
                        item.status === 'approved' && "opacity-50",
                        item.status === 'skipped' && "opacity-40",
                        item.status === 'ready' && idx !== selectedIndex && "hover:bg-muted/50 cursor-pointer",
                        item.status === 'analyzing' && "bg-primary/5",
                      )}
                      disabled={item.status !== 'ready'}
                    >
                      {getStatusIcon(item)}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium">{item.invoice.invoice_number}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{item.invoice.subject_name}</p>
                      </div>
                      {item.suggestion?.confidence && (
                        <Badge variant="outline" className={cn(
                          "text-[10px] px-1.5 py-0",
                          item.suggestion.confidence === 'high' && "border-green-500/50 text-green-600",
                          item.suggestion.confidence === 'medium' && "border-amber-500/50 text-amber-600",
                          item.suggestion.confidence === 'low' && "border-red-500/50 text-red-600",
                        )}>
                          {item.suggestion.confidence === 'high' ? '🎯' : item.suggestion.confidence === 'medium' ? '⚡' : '⚠️'}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
              {selectedItem && selectedItem.status === 'ready' && edited ? (
                <div className="space-y-4">
                  {/* Invoice header */}
                  <div className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{selectedItem.invoice.invoice_number}</h4>
                      <Badge variant={selectedItem.invoice.invoice_type === 'acquisto' ? 'destructive' : 'default'}>
                        {selectedItem.invoice.invoice_type === 'acquisto' ? 'Acquisto' : selectedItem.invoice.invoice_type === 'vendita' ? 'Vendita' : 'Nota Credito'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Soggetto</span>
                        <p className="font-medium">{selectedItem.invoice.subject_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Imponibile</span>
                        <p className="font-medium">€{selectedItem.invoice.imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Totale</span>
                        <p className="font-semibold">€{selectedItem.invoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Editable suggestion */}
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-4">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">Suggerimento AI</span>
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Modificabile</span>
                      {selectedItem.suggestion?.confidence && (
                        <Badge className={cn(
                          "ml-auto text-xs",
                          selectedItem.suggestion.confidence === 'high' ? 'bg-green-500/20 text-green-600 border-green-500/30' :
                          selectedItem.suggestion.confidence === 'medium' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' :
                          'bg-red-500/20 text-red-600 border-red-500/30'
                        )}>
                          {selectedItem.suggestion.confidence === 'high' ? '🎯 Alta' :
                           selectedItem.suggestion.confidence === 'medium' ? '⚡ Media' : '⚠️ Bassa'}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {selectedItem.invoice.invoice_type === 'acquisto' ? (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Conto di Costo</Label>
                            <Select
                              value={edited.cost_account_id || ''}
                              onValueChange={(v) => updateEditedField(selectedIndex!, 'cost_account_id', v)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Seleziona conto" />
                              </SelectTrigger>
                              <SelectContent>
                                {(costAccounts.length > 0 ? costAccounts : accounts).map(a => (
                                  <SelectItem key={a.id} value={a.id} className="text-xs">
                                    {a.code} - {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Centro di Costo</Label>
                            <Select
                              value={edited.cost_center_id || ''}
                              onValueChange={(v) => updateEditedField(selectedIndex!, 'cost_center_id', v)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Seleziona centro" />
                              </SelectTrigger>
                              <SelectContent>
                                {costCenters.map(c => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">
                                    {c.code} - {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Conto di Ricavo</Label>
                            <Select
                              value={edited.revenue_account_id || ''}
                              onValueChange={(v) => updateEditedField(selectedIndex!, 'revenue_account_id', v)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Seleziona conto" />
                              </SelectTrigger>
                              <SelectContent>
                                {(revenueAccounts.length > 0 ? revenueAccounts : accounts).map(a => (
                                  <SelectItem key={a.id} value={a.id} className="text-xs">
                                    {a.code} - {a.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Centro di Ricavo</Label>
                            <Select
                              value={edited.profit_center_id || ''}
                              onValueChange={(v) => updateEditedField(selectedIndex!, 'profit_center_id', v)}
                            >
                              <SelectTrigger className="h-9 text-xs">
                                <SelectValue placeholder="Seleziona centro" />
                              </SelectTrigger>
                              <SelectContent>
                                {profitCenters.map(c => (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">
                                    {c.code} - {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Regime IVA</Label>
                        <Select
                          value={edited.vat_regime || ''}
                          onValueChange={(v) => {
                            const regime = VAT_REGIMES.find(r => r.value === v);
                            updateEditedField(selectedIndex!, 'vat_regime', v);
                            if (regime) updateEditedField(selectedIndex!, 'iva_rate', regime.rate);
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Seleziona regime" />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_REGIMES.map(r => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Aliquota IVA (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-9 text-xs"
                          value={edited.iva_rate ?? ''}
                          onChange={(e) => updateEditedField(selectedIndex!, 'iva_rate', e.target.value ? Number(e.target.value) : undefined)}
                        />
                      </div>
                    </div>

                    {selectedItem.suggestion?.reasoning && (
                      <p className="text-xs text-muted-foreground italic border-t pt-2">
                        💡 {selectedItem.suggestion.reasoning}
                      </p>
                    )}

                    {selectedItem.suggestion?.warnings && selectedItem.suggestion.warnings.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {selectedItem.suggestion.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => handleSkip(selectedIndex!)} className="gap-1.5">
                      <SkipForward className="w-3.5 h-3.5" />
                      Salta
                    </Button>
                    <Button onClick={() => handleApprove(selectedIndex!)} className="gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Approva e classifica
                    </Button>
                  </div>
                </div>
              ) : readyCount === 0 && !isProcessing && analyzedCount === items.length && items.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Check className="w-12 h-12 text-green-600" />
                  <h3 className="text-lg font-semibold">Revisione completata!</h3>
                  <p className="text-sm text-muted-foreground">{approvedCount} fatture classificate con successo.</p>
                  <Button onClick={handleClose} className="mt-2">Chiudi</Button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      <p className="text-sm text-muted-foreground">
                        Analisi in corso... Seleziona una fattura già analizzata dalla lista per approvarla.
                      </p>
                    </>
                  ) : readyCount > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Seleziona una fattura dalla lista per revisionarla.
                    </p>
                  ) : pendingOrErrorCount > 0 ? (
                    <>
                      <RotateCcw className="w-8 h-8 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        L'analisi è stata interrotta. Clicca "Riprendi" per continuare dalle {pendingOrErrorCount} fatture rimanenti.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nessuna fattura da revisionare.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {approvedCount > 0 ? 'Chiudi e salva' : 'Chiudi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};