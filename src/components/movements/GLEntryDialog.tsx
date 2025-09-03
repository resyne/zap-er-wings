import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GLEntryLine {
  id?: string;
  gl_account_id: string;
  debit: number;
  credit: number;
  vat_rate?: number;
  cost_center_id?: string;
  profit_center_id?: string;
  job_id?: string;
  notes?: string;
}

interface GLEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function GLEntryDialog({ open, onOpenChange, onSuccess }: GLEntryDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [profitCenters, setProfitCenters] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  const [entry, setEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    doc_type: 'Manual' as const,
    doc_ref: '',
    description: '',
    cost_center_id: '',
    profit_center_id: '',
    job_id: '',
    origin_module: 'Manual' as const
  });

  const [lines, setLines] = useState<GLEntryLine[]>([
    { gl_account_id: '', debit: 0, credit: 0 },
    { gl_account_id: '', debit: 0, credit: 0 }
  ]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [accountsRes, costCentersRes, profitCentersRes, jobsRes] = await Promise.all([
        supabase.from('chart_of_accounts').select('*').eq('is_active', true).order('code'),
        supabase.from('profit_centers').select('*').eq('is_active', true).order('code'),
        supabase.from('profit_centers').select('*').eq('is_active', true).order('code'),
        supabase.from('management_projects').select('*').eq('status', 'active').order('code')
      ]);

      setAccounts(accountsRes.data || []);
      setCostCenters(costCentersRes.data || []);
      setProfitCenters(profitCentersRes.data || []);
      setJobs(jobsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const addLine = () => {
    setLines([...lines, { gl_account_id: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const updateLine = (index: number, field: keyof GLEntryLine, value: any) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const balanceEntries = () => {
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    const difference = totalDebit - totalCredit;

    if (difference !== 0) {
      const newLines = [...lines];
      const lastIndex = newLines.length - 1;
      
      if (difference > 0) {
        // More debit, add credit
        newLines[lastIndex].credit = (newLines[lastIndex].credit || 0) + difference;
      } else {
        // More credit, add debit
        newLines[lastIndex].debit = (newLines[lastIndex].debit || 0) + Math.abs(difference);
      }
      
      setLines(newLines);
    }
  };

  const validateEntry = () => {
    if (!entry.description) return "Descrizione obbligatoria";
    if (lines.some(line => !line.gl_account_id)) return "Tutti i conti sono obbligatori";
    
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) return "Dare e Avere devono essere bilanciati";
    
    return null;
  };

  const handleSave = async () => {
    const error = validateEntry();
    if (error) {
      toast({
        title: "Errore di validazione",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create GL entry
      const { data: glEntry, error: entryError } = await supabase
        .from('gl_entry')
        .insert([{
          ...entry,
          cost_center_id: entry.cost_center_id || null,
          profit_center_id: entry.profit_center_id || null,
          job_id: entry.job_id || null,
          created_by: (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();

      if (entryError) throw entryError;

      // Create GL entry lines
      const linesToInsert = lines
        .filter(line => line.gl_account_id && (line.debit > 0 || line.credit > 0))
        .map(line => ({
          gl_entry_id: glEntry.id,
          ...line,
          cost_center_id: line.cost_center_id || entry.cost_center_id || null,
          profit_center_id: line.profit_center_id || entry.profit_center_id || null,
          job_id: line.job_id || entry.job_id || null
        }));

      const { error: linesError } = await supabase
        .from('gl_entry_line')
        .insert(linesToInsert);

      if (linesError) throw linesError;

      toast({
        title: "Successo",
        description: "Movimento contabile creato con successo",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error saving entry:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio del movimento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEntry({
      date: new Date().toISOString().split('T')[0],
      doc_type: 'Manual',
      doc_ref: '',
      description: '',
      cost_center_id: '',
      profit_center_id: '',
      job_id: '',
      origin_module: 'Manual'
    });
    setLines([
      { gl_account_id: '', debit: 0, credit: 0 },
      { gl_account_id: '', debit: 0, credit: 0 }
    ]);
  };

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Movimento Contabile</DialogTitle>
          <DialogDescription>
            Crea un nuovo movimento con righe contabili bilanciate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header section */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={entry.date}
                onChange={(e) => setEntry(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo Documento</Label>
              <Select value={entry.doc_type} onValueChange={(value: any) => setEntry(prev => ({ ...prev, doc_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manuale</SelectItem>
                  <SelectItem value="SaleInvoice">Fattura di Vendita</SelectItem>
                  <SelectItem value="PurchaseInvoice">Fattura di Acquisto</SelectItem>
                  <SelectItem value="Timesheet">Timesheet</SelectItem>
                  <SelectItem value="MaterialIssue">Scarico Materiali</SelectItem>
                  <SelectItem value="Logistics">Logistica</SelectItem>
                  <SelectItem value="Adjustment">Rettifica</SelectItem>
                  <SelectItem value="Opening">Apertura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Riferimento Documento</Label>
              <Input
                value={entry.doc_ref}
                onChange={(e) => setEntry(prev => ({ ...prev, doc_ref: e.target.value }))}
                placeholder="N. fattura, ordine, ecc."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrizione *</Label>
            <Textarea
              value={entry.description}
              onChange={(e) => setEntry(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrizione del movimento"
            />
          </div>

          {/* Dimensions section */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Centro di Costo</Label>
              <Select value={entry.cost_center_id} onValueChange={(value) => setEntry(prev => ({ ...prev, cost_center_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona centro di costo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuno</SelectItem>
                  {costCenters.map(cc => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro di Profitto</Label>
              <Select value={entry.profit_center_id} onValueChange={(value) => setEntry(prev => ({ ...prev, profit_center_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona centro di profitto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuno</SelectItem>
                  {profitCenters.map(pc => (
                    <SelectItem key={pc.id} value={pc.id}>
                      {pc.code} - {pc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Commessa</Label>
              <Select value={entry.job_id} onValueChange={(value) => setEntry(prev => ({ ...prev, job_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona commessa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuna</SelectItem>
                  {jobs.map(job => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.code} - {job.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lines section */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Righe Contabili</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={balanceEntries}>
                  <Scale className="w-4 h-4 mr-2" />
                  Bilancia
                </Button>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Riga
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conto *</TableHead>
                    <TableHead className="w-24">Dare</TableHead>
                    <TableHead className="w-24">Avere</TableHead>
                    <TableHead className="w-20">IVA %</TableHead>
                    <TableHead>Centro Costo</TableHead>
                    <TableHead>Centro Profitto</TableHead>
                    <TableHead>Commessa</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.gl_account_id}
                          onValueChange={(value) => updateLine(index, 'gl_account_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona conto" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(account => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => {
                            updateLine(index, 'credit', 0);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                          onFocus={(e) => {
                            updateLine(index, 'debit', 0);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={line.vat_rate || ''}
                          onChange={(e) => updateLine(index, 'vat_rate', parseFloat(e.target.value) || undefined)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={line.cost_center_id || ''}
                          onValueChange={(value) => updateLine(index, 'cost_center_id', value || undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Eredita</SelectItem>
                            {costCenters.map(cc => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={line.profit_center_id || ''}
                          onValueChange={(value) => updateLine(index, 'profit_center_id', value || undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Eredita</SelectItem>
                            {profitCenters.map(pc => (
                              <SelectItem key={pc.id} value={pc.id}>
                                {pc.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={line.job_id || ''}
                          onValueChange={(value) => updateLine(index, 'job_id', value || undefined)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Eredita</SelectItem>
                            {jobs.map(job => (
                              <SelectItem key={job.id} value={job.id}>
                                {job.code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                          disabled={lines.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="flex justify-end gap-4 text-sm">
              <div className={`px-3 py-2 rounded ${isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                Totale Dare: €{totalDebit.toFixed(2)}
              </div>
              <div className={`px-3 py-2 rounded ${isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                Totale Avere: €{totalCredit.toFixed(2)}
              </div>
              <div className={`px-3 py-2 rounded font-medium ${isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {isBalanced ? '✓ Bilanciato' : `⚠ Sbilancio: €${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={loading || !isBalanced}>
              {loading ? "Salvataggio..." : "Salva Movimento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}