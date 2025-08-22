import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, FileText, Calendar, DollarSign, Clock } from "lucide-react";

interface Quote {
  id: string;
  number: string;
  customer_id?: string;
  date?: string;
  valid_until?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  status?: string;
  notes?: string;
  created_at: string;
}

const quoteStatuses = ["draft", "sent", "approved", "rejected", "expired"];

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [newQuote, setNewQuote] = useState({
    number: "",
    customer_id: "",
    date: new Date().toISOString().split('T')[0],
    valid_until: "",
    subtotal: "",
    tax_amount: "",
    total_amount: "",
    status: "draft",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadQuotes();
    loadCustomers();
  }, []);

  const loadQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i preventivi: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, code")
        .eq("active", true);

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Error loading customers:", error);
    }
  };

  const handleCreateQuote = async () => {
    try {
      const quoteData = {
        ...newQuote,
        customer_id: newQuote.customer_id || null,
        subtotal: newQuote.subtotal ? parseFloat(newQuote.subtotal) : null,
        tax_amount: newQuote.tax_amount ? parseFloat(newQuote.tax_amount) : null,
        total_amount: newQuote.total_amount ? parseFloat(newQuote.total_amount) : null,
        valid_until: newQuote.valid_until || null,
      };

      const { error } = await supabase
        .from("quotes")
        .insert([quoteData]);

      if (error) throw error;

      toast({
        title: "Preventivo creato",
        description: "Il preventivo è stato creato con successo",
      });

      setIsDialogOpen(false);
      setNewQuote({
        number: "",
        customer_id: "",
        date: new Date().toISOString().split('T')[0],
        valid_until: "",
        subtotal: "",
        tax_amount: "",
        total_amount: "",
        status: "draft",
        notes: "",
      });
      await loadQuotes();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il preventivo: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "approved":
        return "default";
      case "rejected":
      case "expired":
        return "destructive";
      case "sent":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredQuotes = quotes.filter(quote =>
    `${quote.number} ${quote.notes || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredQuotes.reduce((sum, quote) => sum + (quote.total_amount || 0), 0);
  const approvedQuotes = filteredQuotes.filter(quote => quote.status === "approved");
  const approvedValue = approvedQuotes.reduce((sum, quote) => sum + (quote.total_amount || 0), 0);
  const sentQuotes = filteredQuotes.filter(quote => quote.status === "sent");

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento preventivi...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Preventivi</h1>
          <p className="text-muted-foreground">Gestisci i tuoi preventivi e offerte commerciali</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Preventivo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Preventivo</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="number">Numero Preventivo *</Label>
                <Input
                  id="number"
                  value={newQuote.number}
                  onChange={(e) => setNewQuote({...newQuote, number: e.target.value})}
                  placeholder="QT-2024-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customer_id">Cliente</Label>
                <Select value={newQuote.customer_id} onValueChange={(value) => setNewQuote({...newQuote, customer_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Data Preventivo</Label>
                <Input
                  id="date"
                  type="date"
                  value={newQuote.date}
                  onChange={(e) => setNewQuote({...newQuote, date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="valid_until">Valido Fino Al</Label>
                <Input
                  id="valid_until"
                  type="date"
                  value={newQuote.valid_until}
                  onChange={(e) => setNewQuote({...newQuote, valid_until: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="subtotal">Subtotale (€)</Label>
                <Input
                  id="subtotal"
                  type="number"
                  step="0.01"
                  value={newQuote.subtotal}
                  onChange={(e) => setNewQuote({...newQuote, subtotal: e.target.value})}
                  placeholder="1000.00"
                />
              </div>
              <div>
                <Label htmlFor="tax_amount">IVA (€)</Label>
                <Input
                  id="tax_amount"
                  type="number"
                  step="0.01"
                  value={newQuote.tax_amount}
                  onChange={(e) => setNewQuote({...newQuote, tax_amount: e.target.value})}
                  placeholder="220.00"
                />
              </div>
              <div>
                <Label htmlFor="total_amount">Totale (€)</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={newQuote.total_amount}
                  onChange={(e) => setNewQuote({...newQuote, total_amount: e.target.value})}
                  placeholder="1220.00"
                />
              </div>
              <div>
                <Label htmlFor="status">Stato</Label>
                <Select value={newQuote.status} onValueChange={(value) => setNewQuote({...newQuote, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                  <SelectContent>
                    {quoteStatuses.map(status => (
                      <SelectItem key={status} value={status}>
                        {status.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">Note</Label>
                <Input
                  id="notes"
                  value={newQuote.notes}
                  onChange={(e) => setNewQuote({...newQuote, notes: e.target.value})}
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleCreateQuote} disabled={!newQuote.number}>
                Crea Preventivo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {filteredQuotes.length} preventivi totali
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approvati</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{approvedValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {approvedQuotes.length} preventivi approvati
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Attesa</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentQuotes.length}</div>
            <p className="text-xs text-muted-foreground">
              Preventivi inviati in attesa
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso Approvazione</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredQuotes.length > 0 ? Math.round((approvedQuotes.length / filteredQuotes.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Preventivi approvati vs totali
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Preventivi ({filteredQuotes.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca preventivi..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valido Fino</TableHead>
                <TableHead>Subtotale</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Totale</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium">{quote.number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {quote.date && (
                      <span className="text-sm">
                        {new Date(quote.date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {quote.valid_until && (
                      <span className="text-sm">
                        {new Date(quote.valid_until).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {quote.subtotal && (
                      <span className="text-sm">€{quote.subtotal.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {quote.tax_amount && (
                      <span className="text-sm">€{quote.tax_amount.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {quote.total_amount && (
                      <span className="font-medium">€{quote.total_amount.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {quote.status && (
                      <Badge variant={getStatusColor(quote.status)}>
                        {quote.status.toUpperCase()}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredQuotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun preventivo trovato" : "Nessun preventivo presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}