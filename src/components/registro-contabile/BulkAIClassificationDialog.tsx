import React, { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Brain, Check, X, Loader2, ChevronRight, Sparkles, AlertCircle, SkipForward } from "lucide-react";

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'reviewing'>('idle');
  const abortRef = useRef(false);

  const bozzaInvoices = invoices.filter(inv => inv.status === 'bozza');

  const startAnalysis = useCallback(async () => {
    if (bozzaInvoices.length === 0) {
      toast.info('Nessuna fattura in bozza da analizzare');
      return;
    }

    abortRef.current = false;
    setPhase('analyzing');
    setIsProcessing(true);
    
    const newItems: InvoiceWithSuggestion[] = bozzaInvoices.map(inv => ({
      invoice: inv,
      suggestion: null,
      status: 'pending' as const,
    }));
    setItems(newItems);

    for (let i = 0; i < newItems.length; i++) {
      if (abortRef.current) break;

      setItems(prev => prev.map((item, idx) => 
        idx === i ? { ...item, status: 'analyzing' } : item
      ));

      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const { data, error } = await supabase.functions.invoke('ai-accounting-analysis', {
          body: {
            invoice: {
              invoice_type: newItems[i].invoice.invoice_type,
              subject_name: newItems[i].invoice.subject_name,
              subject_type: newItems[i].invoice.subject_type,
              imponibile: newItems[i].invoice.imponibile,
              iva_rate: newItems[i].invoice.iva_rate,
              vat_regime: newItems[i].invoice.vat_regime,
              financial_status: newItems[i].invoice.financial_status,
              invoice_date: newItems[i].invoice.invoice_date,
              notes: newItems[i].invoice.notes,
            },
            chartOfAccounts: accounts,
            costCenters,
            profitCenters,
          },
        });
        
        clearTimeout(timeoutId);

        if (error) throw error;
        if (data?.success && data?.suggestion) {
          setItems(prev => prev.map((item, idx) =>
            idx === i ? { ...item, suggestion: data.suggestion, status: 'ready' } : item
          ));
        } else {
          throw new Error(data?.error || 'Risposta AI non valida');
        }
      } catch (err: any) {
        console.error(`AI analysis error for invoice ${newItems[i].invoice.invoice_number}:`, err);
        setItems(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', error: err.message || 'Timeout o errore di rete' } : item
        ));
      }

      // Small delay between requests to avoid rate limiting
      if (i < newItems.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsProcessing(false);
    setPhase('reviewing');
    setCurrentIndex(0);
  }, [bozzaInvoices, accounts, costCenters, profitCenters]);

  const handleApprove = async (index: number) => {
    const item = items[index];
    if (!item?.suggestion) return;

    try {
      await onApprove(item.invoice.id, item.suggestion);
      setItems(prev => prev.map((it, idx) =>
        idx === index ? { ...it, status: 'approved' } : it
      ));
      toast.success(`Fattura ${item.invoice.invoice_number} classificata`);
      // Auto-advance to next
      const nextIdx = items.findIndex((it, idx) => idx > index && it.status === 'ready');
      if (nextIdx !== -1) setCurrentIndex(nextIdx);
    } catch (err: any) {
      toast.error('Errore: ' + err.message);
    }
  };

  const handleSkip = (index: number) => {
    setItems(prev => prev.map((it, idx) =>
      idx === index ? { ...it, status: 'skipped' } : it
    ));
    const nextIdx = items.findIndex((it, idx) => idx > index && it.status === 'ready');
    if (nextIdx !== -1) setCurrentIndex(nextIdx);
  };

  const handleClose = () => {
    abortRef.current = true;
    setPhase('idle');
    setItems([]);
    setCurrentIndex(0);
    onOpenChange(false);
    const approved = items.filter(i => i.status === 'approved').length;
    if (approved > 0) onComplete();
  };

  const analyzedCount = items.filter(i => ['ready', 'approved', 'skipped', 'error'].includes(i.status)).length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const readyCount = items.filter(i => i.status === 'ready').length;

  const getAccountName = (id?: string) => {
    if (!id) return '—';
    const acc = accounts.find(a => a.id === id);
    return acc ? `${acc.code} - ${acc.name}` : id;
  };

  const getCenterName = (id?: string, type: 'cost' | 'profit' = 'cost') => {
    if (!id) return '—';
    const list = type === 'cost' ? costCenters : profitCenters;
    const c = list.find(x => x.id === id);
    return c ? `${c.code} - ${c.name}` : id;
  };

  const currentItem = items[currentIndex];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
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
                Potrai approvare o saltare ogni suggerimento.
              </p>
            </div>
            <Button size="lg" onClick={startAnalysis} className="gap-2 mt-2" disabled={bozzaInvoices.length === 0}>
              <Brain className="w-4 h-4" />
              Avvia analisi AI
            </Button>
          </div>
        )}

        {phase === 'analyzing' && (
          <div className="flex-1 space-y-4 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Analisi in corso...</span>
              <span className="text-sm text-muted-foreground">{analyzedCount}/{items.length}</span>
            </div>
            <Progress value={(analyzedCount / items.length) * 100} className="h-2" />
            
            <ScrollArea className="h-[350px]">
              <div className="space-y-2 pr-4">
                {items.map((item, idx) => (
                  <div key={item.invoice.id} className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                    item.status === 'analyzing' && "bg-primary/5 border-primary/30",
                    item.status === 'ready' && "bg-green-500/5 border-green-500/30",
                    item.status === 'error' && "bg-destructive/5 border-destructive/30",
                    item.status === 'pending' && "bg-muted/30",
                  )}>
                    {item.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />}
                    {item.status === 'analyzing' && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                    {item.status === 'ready' && <Check className="w-5 h-5 text-green-600" />}
                    {item.status === 'error' && <AlertCircle className="w-5 h-5 text-destructive" />}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.invoice.invoice_number} — {item.invoice.subject_name}</p>
                      <p className="text-xs text-muted-foreground">€{item.invoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                    </div>
                    
                    {item.suggestion && (
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        item.suggestion.confidence === 'high' && "border-green-500/50 text-green-600",
                        item.suggestion.confidence === 'medium' && "border-amber-500/50 text-amber-600",
                        item.suggestion.confidence === 'low' && "border-red-500/50 text-red-600",
                      )}>
                        {item.suggestion.confidence === 'high' ? '🎯' : item.suggestion.confidence === 'medium' ? '⚡' : '⚠️'}
                      </Badge>
                    )}
                    {item.error && <span className="text-xs text-destructive">{item.error}</span>}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Button variant="outline" onClick={() => { abortRef.current = true; }} size="sm">
              Interrompi
            </Button>
          </div>
        )}

        {phase === 'reviewing' && (
          <div className="flex-1 space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{approvedCount} approvate</Badge>
                <Badge variant="outline" className="text-muted-foreground">{readyCount} da revisionare</Badge>
              </div>
              <Progress value={(approvedCount / Math.max(items.filter(i => i.status !== 'error').length, 1)) * 100} className="w-32 h-2" />
            </div>

            {readyCount === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <Check className="w-12 h-12 text-green-600" />
                <h3 className="text-lg font-semibold">Revisione completata!</h3>
                <p className="text-sm text-muted-foreground">{approvedCount} fatture classificate con successo.</p>
                <Button onClick={handleClose} className="mt-2">Chiudi</Button>
              </div>
            ) : currentItem && currentItem.status === 'ready' ? (
              <div className="space-y-4">
                {/* Invoice header */}
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{currentItem.invoice.invoice_number}</h4>
                    <Badge variant={currentItem.invoice.invoice_type === 'acquisto' ? 'destructive' : 'default'}>
                      {currentItem.invoice.invoice_type === 'acquisto' ? 'Acquisto' : currentItem.invoice.invoice_type === 'vendita' ? 'Vendita' : 'Nota Credito'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Soggetto</span>
                      <p className="font-medium">{currentItem.invoice.subject_name}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Imponibile</span>
                      <p className="font-medium">€{currentItem.invoice.imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Totale</span>
                      <p className="font-semibold">€{currentItem.invoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>

                {/* AI suggestion */}
                {currentItem.suggestion && (
                  <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">Suggerimento AI</span>
                      <Badge className={cn(
                        "ml-auto text-xs",
                        currentItem.suggestion.confidence === 'high' ? 'bg-green-500/20 text-green-600 border-green-500/30' :
                        currentItem.suggestion.confidence === 'medium' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' :
                        'bg-red-500/20 text-red-600 border-red-500/30'
                      )}>
                        {currentItem.suggestion.confidence === 'high' ? '🎯 Alta' :
                         currentItem.suggestion.confidence === 'medium' ? '⚡ Media' : '⚠️ Bassa'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {currentItem.invoice.invoice_type === 'acquisto' ? (
                        <>
                          <div>
                            <span className="text-muted-foreground text-xs">Conto di Costo</span>
                            <p className="font-medium">{getAccountName(currentItem.suggestion.cost_account_id)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Centro di Costo</span>
                            <p className="font-medium">{getCenterName(currentItem.suggestion.cost_center_id, 'cost')}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div>
                            <span className="text-muted-foreground text-xs">Conto di Ricavo</span>
                            <p className="font-medium">{getAccountName(currentItem.suggestion.revenue_account_id)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Centro di Ricavo</span>
                            <p className="font-medium">{getCenterName(currentItem.suggestion.profit_center_id, 'profit')}</p>
                          </div>
                        </>
                      )}
                      <div>
                        <span className="text-muted-foreground text-xs">Regime IVA</span>
                        <p className="font-medium">{currentItem.suggestion.vat_regime || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Aliquota IVA</span>
                        <p className="font-medium">{currentItem.suggestion.iva_rate !== undefined ? `${currentItem.suggestion.iva_rate}%` : '—'}</p>
                      </div>
                    </div>

                    {currentItem.suggestion.reasoning && (
                      <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
                        💡 {currentItem.suggestion.reasoning}
                      </p>
                    )}

                    {currentItem.suggestion.warnings && currentItem.suggestion.warnings.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {currentItem.suggestion.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    {currentIndex + 1} di {items.length}
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => handleSkip(currentIndex)} className="gap-1.5">
                      <SkipForward className="w-3.5 h-3.5" />
                      Salta
                    </Button>
                    <Button onClick={() => handleApprove(currentIndex)} className="gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Approva e classifica
                    </Button>
                  </div>
                </div>

                {/* Sidebar list */}
                <ScrollArea className="h-[150px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {items.map((item, idx) => (
                      <button
                        key={item.invoice.id}
                        onClick={() => item.status === 'ready' && setCurrentIndex(idx)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                          idx === currentIndex && "bg-primary/10 ring-1 ring-primary/30",
                          item.status === 'approved' && "opacity-50",
                          item.status === 'skipped' && "opacity-40",
                          item.status === 'ready' && idx !== currentIndex && "hover:bg-muted/50 cursor-pointer",
                        )}
                        disabled={item.status !== 'ready'}
                      >
                        {item.status === 'approved' && <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />}
                        {item.status === 'skipped' && <SkipForward className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                        {item.status === 'ready' && <ChevronRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        {item.status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                        <span className="truncate">{item.invoice.invoice_number} — {item.invoice.subject_name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">€{item.invoice.total_amount.toLocaleString('it-IT')}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              // Find next ready item
              <div className="flex flex-col items-center gap-3 py-6">
                <p className="text-muted-foreground">Seleziona una fattura dalla lista sottostante</p>
                <ScrollArea className="h-[300px] w-full border rounded-lg">
                  <div className="p-2 space-y-1">
                    {items.map((item, idx) => (
                      <button
                        key={item.invoice.id}
                        onClick={() => item.status === 'ready' && setCurrentIndex(idx)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2",
                          item.status === 'approved' && "opacity-50",
                          item.status === 'ready' && "hover:bg-muted/50 cursor-pointer",
                        )}
                        disabled={item.status !== 'ready'}
                      >
                        {item.status === 'approved' && <Check className="w-3.5 h-3.5 text-green-600" />}
                        {item.status === 'skipped' && <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />}
                        {item.status === 'ready' && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                        <span className="truncate">{item.invoice.invoice_number} — {item.invoice.subject_name}</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {phase === 'reviewing' && approvedCount > 0 ? 'Chiudi e salva' : 'Chiudi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
