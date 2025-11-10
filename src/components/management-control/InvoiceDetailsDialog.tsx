import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatAmount } from "@/lib/formatAmount";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { Plus, Trash2, Loader2, CreditCard, FileText } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Advance {
  id: string;
  advance_date: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
}

interface Check {
  id: string;
  check_number: string;
  check_date: string;
  due_date: string;
  amount: number;
  bank: string | null;
  status: string;
  notes: string | null;
}

interface InvoiceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceType: 'customer' | 'supplier';
  invoiceNumber: string;
  totalAmount: number;
}

export function InvoiceDetailsDialog({ 
  open, 
  onOpenChange, 
  invoiceId, 
  invoiceType,
  invoiceNumber,
  totalAmount 
}: InvoiceDetailsDialogProps) {
  const { hideAmounts } = useHideAmounts();
  const [loading, setLoading] = useState(false);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [showAddCheck, setShowAddCheck] = useState(false);

  const [advanceForm, setAdvanceForm] = useState({
    advance_date: new Date().toISOString().split('T')[0],
    amount: "",
    payment_method: "bonifico",
    notes: "",
  });

  const [checkForm, setCheckForm] = useState({
    check_number: "",
    check_date: new Date().toISOString().split('T')[0],
    due_date: "",
    amount: "",
    bank: "",
    status: "pending",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, invoiceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const advancesTable = invoiceType === 'customer' 
        ? 'customer_invoice_advances' 
        : 'supplier_invoice_advances';
      const checksTable = invoiceType === 'customer'
        ? 'customer_invoice_checks'
        : 'supplier_invoice_checks';
      const foreignKey = invoiceType === 'customer'
        ? 'customer_invoice_id'
        : 'supplier_invoice_id';

      const [advancesRes, checksRes] = await Promise.all([
        (supabase as any)
          .from(advancesTable)
          .select('*')
          .eq(foreignKey, invoiceId)
          .order('advance_date', { ascending: false }),
        (supabase as any)
          .from(checksTable)
          .select('*')
          .eq(foreignKey, invoiceId)
          .order('due_date', { ascending: false })
      ]);

      if (advancesRes.error) throw advancesRes.error;
      if (checksRes.error) throw checksRes.error;

      setAdvances(advancesRes.data || []);
      setChecks(checksRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceForm.amount) {
      toast.error("Inserisci l'importo dell'acconto");
      return;
    }

    setLoading(true);
    try {
      const table = invoiceType === 'customer' 
        ? 'customer_invoice_advances' 
        : 'supplier_invoice_advances';
      const foreignKey = invoiceType === 'customer'
        ? 'customer_invoice_id'
        : 'supplier_invoice_id';

      const { error } = await (supabase as any)
        .from(table)
        .insert({
          [foreignKey]: invoiceId,
          advance_date: advanceForm.advance_date,
          amount: parseFloat(advanceForm.amount),
          payment_method: advanceForm.payment_method,
          notes: advanceForm.notes || null,
        });

      if (error) throw error;

      toast.success("Acconto registrato con successo");
      setShowAddAdvance(false);
      setAdvanceForm({
        advance_date: new Date().toISOString().split('T')[0],
        amount: "",
        payment_method: "bonifico",
        notes: "",
      });
      loadData();
    } catch (error: any) {
      console.error('Error adding advance:', error);
      toast.error("Errore nella registrazione dell'acconto");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkForm.check_number || !checkForm.amount || !checkForm.due_date) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    setLoading(true);
    try {
      const table = invoiceType === 'customer'
        ? 'customer_invoice_checks'
        : 'supplier_invoice_checks';
      const foreignKey = invoiceType === 'customer'
        ? 'customer_invoice_id'
        : 'supplier_invoice_id';

      const { error } = await (supabase as any)
        .from(table)
        .insert({
          [foreignKey]: invoiceId,
          check_number: checkForm.check_number,
          check_date: checkForm.check_date,
          due_date: checkForm.due_date,
          amount: parseFloat(checkForm.amount),
          bank: checkForm.bank || null,
          status: checkForm.status,
          notes: checkForm.notes || null,
        });

      if (error) throw error;

      toast.success("Assegno registrato con successo");
      setShowAddCheck(false);
      setCheckForm({
        check_number: "",
        check_date: new Date().toISOString().split('T')[0],
        due_date: "",
        amount: "",
        bank: "",
        status: "pending",
        notes: "",
      });
      loadData();
    } catch (error: any) {
      console.error('Error adding check:', error);
      toast.error("Errore nella registrazione dell'assegno");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo acconto?")) return;

    setLoading(true);
    try {
      const table = invoiceType === 'customer' 
        ? 'customer_invoice_advances' 
        : 'supplier_invoice_advances';

      const { error } = await (supabase as any)
        .from(table)
        .delete()
        .eq('id', advanceId);

      if (error) throw error;

      toast.success("Acconto eliminato con successo");
      loadData();
    } catch (error: any) {
      console.error('Error deleting advance:', error);
      toast.error("Errore nell'eliminazione dell'acconto");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCheck = async (checkId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo assegno?")) return;

    setLoading(true);
    try {
      const table = invoiceType === 'customer'
        ? 'customer_invoice_checks'
        : 'supplier_invoice_checks';

      const { error } = await (supabase as any)
        .from(table)
        .delete()
        .eq('id', checkId);

      if (error) throw error;

      toast.success("Assegno eliminato con successo");
      loadData();
    } catch (error: any) {
      console.error('Error deleting check:', error);
      toast.error("Errore nell'eliminazione dell'assegno");
    } finally {
      setLoading(false);
    }
  };

  const totalAdvances = advances.reduce((sum, adv) => sum + Number(adv.amount), 0);
  const totalChecks = checks.reduce((sum, chk) => sum + Number(chk.amount), 0);
  const remainingAmount = totalAmount - totalAdvances - totalChecks;

  const getCheckStatusBadge = (status: string) => {
    switch (status) {
      case 'cleared': return <Badge variant="outline" className="bg-green-50 text-green-700">Incassato</Badge>;
      case 'bounced': return <Badge variant="destructive">Respinto</Badge>;
      default: return <Badge variant="secondary">In attesa</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dettaglio Fattura {invoiceNumber}</DialogTitle>
          <DialogDescription>
            Gestione acconti e assegni per {invoiceType === 'customer' ? 'credito cliente' : 'debito fornitore'}
          </DialogDescription>
        </DialogHeader>

        {/* Riepilogo */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Importo totale</div>
            <div className="text-lg font-bold">{formatAmount(totalAmount, hideAmounts)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Acconti</div>
            <div className="text-lg font-bold text-blue-600">{formatAmount(totalAdvances, hideAmounts)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Assegni</div>
            <div className="text-lg font-bold text-purple-600">{formatAmount(totalChecks, hideAmounts)}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Saldo residuo</div>
            <div className={`text-lg font-bold ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
              {formatAmount(remainingAmount, hideAmounts)}
            </div>
          </div>
        </div>

        <Tabs defaultValue="advances" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="advances">
              <CreditCard className="h-4 w-4 mr-2" />
              Acconti ({advances.length})
            </TabsTrigger>
            <TabsTrigger value="checks">
              <FileText className="h-4 w-4 mr-2" />
              Assegni ({checks.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Acconti */}
          <TabsContent value="advances" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Elenco Acconti</h3>
              <Button size="sm" onClick={() => setShowAddAdvance(!showAddAdvance)}>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Acconto
              </Button>
            </div>

            {showAddAdvance && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nuovo Acconto</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddAdvance} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data *</Label>
                        <Input
                          type="date"
                          value={advanceForm.advance_date}
                          onChange={(e) => setAdvanceForm({...advanceForm, advance_date: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Importo (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={advanceForm.amount}
                          onChange={(e) => setAdvanceForm({...advanceForm, amount: e.target.value})}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Metodo di pagamento</Label>
                      <Select 
                        value={advanceForm.payment_method} 
                        onValueChange={(value) => setAdvanceForm({...advanceForm, payment_method: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bonifico">Bonifico</SelectItem>
                          <SelectItem value="contanti">Contanti</SelectItem>
                          <SelectItem value="carta">Carta di credito</SelectItem>
                          <SelectItem value="assegno">Assegno</SelectItem>
                          <SelectItem value="rid">RID</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Note</Label>
                      <Input
                        value={advanceForm.notes}
                        onChange={(e) => setAdvanceForm({...advanceForm, notes: e.target.value})}
                        placeholder="Note opzionali"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registra Acconto
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowAddAdvance(false)}>
                        Annulla
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Metodo</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nessun acconto registrato
                      </TableCell>
                    </TableRow>
                  ) : (
                    advances.map((advance) => (
                      <TableRow key={advance.id}>
                        <TableCell>{format(new Date(advance.advance_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                        <TableCell className="font-medium">{formatAmount(advance.amount, hideAmounts)}</TableCell>
                        <TableCell>
                          {advance.payment_method && (
                            <Badge variant="outline">{advance.payment_method}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{advance.notes || '-'}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAdvance(advance.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Tab Assegni */}
          <TabsContent value="checks" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">Elenco Assegni</h3>
              <Button size="sm" onClick={() => setShowAddCheck(!showAddCheck)}>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Assegno
              </Button>
            </div>

            {showAddCheck && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nuovo Assegno</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddCheck} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Numero Assegno *</Label>
                        <Input
                          value={checkForm.check_number}
                          onChange={(e) => setCheckForm({...checkForm, check_number: e.target.value})}
                          placeholder="es. 123456"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Banca</Label>
                        <Input
                          value={checkForm.bank}
                          onChange={(e) => setCheckForm({...checkForm, bank: e.target.value})}
                          placeholder="Nome banca"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data Assegno *</Label>
                        <Input
                          type="date"
                          value={checkForm.check_date}
                          onChange={(e) => setCheckForm({...checkForm, check_date: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data Scadenza *</Label>
                        <Input
                          type="date"
                          value={checkForm.due_date}
                          onChange={(e) => setCheckForm({...checkForm, due_date: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Importo (€) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={checkForm.amount}
                          onChange={(e) => setCheckForm({...checkForm, amount: e.target.value})}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Stato</Label>
                        <Select 
                          value={checkForm.status} 
                          onValueChange={(value) => setCheckForm({...checkForm, status: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">In attesa</SelectItem>
                            <SelectItem value="cleared">Incassato</SelectItem>
                            <SelectItem value="bounced">Respinto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Note</Label>
                      <Input
                        value={checkForm.notes}
                        onChange={(e) => setCheckForm({...checkForm, notes: e.target.value})}
                        placeholder="Note opzionali"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registra Assegno
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setShowAddCheck(false)}>
                        Annulla
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N. Assegno</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Banca</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nessun assegno registrato
                      </TableCell>
                    </TableRow>
                  ) : (
                    checks.map((check) => (
                      <TableRow key={check.id}>
                        <TableCell className="font-medium">{check.check_number}</TableCell>
                        <TableCell>{format(new Date(check.check_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                        <TableCell>{format(new Date(check.due_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                        <TableCell className="font-medium">{formatAmount(check.amount, hideAmounts)}</TableCell>
                        <TableCell>{check.bank || '-'}</TableCell>
                        <TableCell>{getCheckStatusBadge(check.status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCheck(check.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
