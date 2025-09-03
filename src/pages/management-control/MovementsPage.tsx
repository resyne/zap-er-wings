import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, TrendingUp, TrendingDown, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_type: 'sale' | 'purchase' | 'other';
  amount: number;
  description: string;
  reference_number?: string;
  profit_center_id?: string;
  project_id?: string;
  account_id: string;
  document_type?: string;
  document_number?: string;
  supplier_customer_name?: string;
  vat_amount: number;
  total_amount: number;
  status: 'draft' | 'confirmed' | 'posted';
  is_imported: boolean;
  import_source?: string;
  created_at: string;
  profit_center?: { name: string; code: string };
  project?: { customer_name: string; code: string };
  account?: { name: string; code: string };
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface ProfitCenter {
  id: string;
  code: string;
  name: string;
}

interface Project {
  id: string;
  code: string;
  customer_name: string;
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [profitCenters, setProfitCenters] = useState<ProfitCenter[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  // New movement form state
  const [newMovement, setNewMovement] = useState({
    entry_type: 'sale' as const,
    amount: '',
    description: '',
    reference_number: '',
    profit_center_id: 'none',
    project_id: 'none',
    account_id: '',
    document_type: '',
    document_number: '',
    supplier_customer_name: '',
    vat_amount: '',
    entry_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('journal_entries')
        .select(`
          *,
          profit_center:profit_centers(name, code),
          project:management_projects(customer_name, code),
          account:chart_of_accounts(name, code)
        `)
        .order('entry_date', { ascending: false }) as { data: JournalEntry[] | null, error: any };

      if (movementsError) throw movementsError;

      // Load accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (accountsError) throw accountsError;

      // Load profit centers
      const { data: profitCentersData, error: profitCentersError } = await supabase
        .from('profit_centers')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (profitCentersError) throw profitCentersError;

      // Load projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('management_projects')
        .select('*')
        .eq('status', 'active')
        .order('code');

      if (projectsError) throw projectsError;

      setMovements(movementsData || []);
      setAccounts(accountsData || []);
      setProfitCenters(profitCentersData || []);
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = 
      movement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.supplier_customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.document_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === "all" || movement.entry_type === selectedType;
    const matchesStatus = selectedStatus === "all" || movement.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'purchase': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'other': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'posted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'sale': return 'Vendita';
      case 'purchase': return 'Acquisto';
      case 'other': return 'Altro';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Bozza';
      case 'confirmed': return 'Confermato';
      case 'posted': return 'Registrato';
      default: return status;
    }
  };

  const handleAddMovement = async () => {
    try {
      const totalAmount = parseFloat(newMovement.amount) + parseFloat(newMovement.vat_amount || '0');
      
      const { data, error } = await supabase
        .from('journal_entries')
        .insert([{
          entry_type: newMovement.entry_type,
          amount: parseFloat(newMovement.amount),
          description: newMovement.description,
          reference_number: newMovement.reference_number || null,
          profit_center_id: newMovement.profit_center_id === "none" ? null : newMovement.profit_center_id,
          project_id: newMovement.project_id === "none" ? null : newMovement.project_id,
          account_id: newMovement.account_id,
          document_type: newMovement.document_type || null,
          document_number: newMovement.document_number || null,
          supplier_customer_name: newMovement.supplier_customer_name || null,
          vat_amount: parseFloat(newMovement.vat_amount || '0'),
          total_amount: totalAmount,
          entry_date: newMovement.entry_date,
          status: 'draft'
        }])
        .select();

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Movimento aggiunto con successo",
      });

      setIsAddDialogOpen(false);
      setNewMovement({
        entry_type: 'sale',
        amount: '',
        description: '',
        reference_number: '',
        profit_center_id: 'none',
        project_id: 'none',
        account_id: '',
        document_type: '',
        document_number: '',
        supplier_customer_name: '',
        vat_amount: '',
        entry_date: new Date().toISOString().split('T')[0]
      });
      loadData();
    } catch (error) {
      console.error('Error adding movement:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiunta del movimento",
        variant: "destructive",
      });
    }
  };

  // Calculate summary
  const summary = {
    totalSales: movements.filter(m => m.entry_type === 'sale').reduce((sum, m) => sum + m.total_amount, 0),
    totalPurchases: movements.filter(m => m.entry_type === 'purchase').reduce((sum, m) => sum + m.total_amount, 0),
    totalMovements: movements.length,
    draftMovements: movements.filter(m => m.status === 'draft').length
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimenti Contabili</h1>
          <p className="text-muted-foreground">
            Gestisci vendite e acquisti collegati a centri di costo e commesse
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Importa
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Movimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuovo Movimento Contabile</DialogTitle>
                <DialogDescription>
                  Aggiungi un nuovo movimento di vendita o acquisto
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_type">Tipo Movimento</Label>
                  <Select value={newMovement.entry_type} onValueChange={(value: any) => setNewMovement(prev => ({ ...prev, entry_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Vendita</SelectItem>
                      <SelectItem value="purchase">Acquisto</SelectItem>
                      <SelectItem value="other">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry_date">Data</Label>
                  <Input
                    type="date"
                    value={newMovement.entry_date}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, entry_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Importo</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newMovement.amount}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_amount">IVA</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newMovement.vat_amount}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, vat_amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea
                    value={newMovement.description}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account_id">Conto</Label>
                  <Select value={newMovement.account_id} onValueChange={(value) => setNewMovement(prev => ({ ...prev, account_id: value }))}>
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profit_center_id">Centro di Profitto</Label>
                  <Select value={newMovement.profit_center_id || "none"} onValueChange={(value) => setNewMovement(prev => ({ ...prev, profit_center_id: value === "none" ? "" : value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona centro di profitto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuno</SelectItem>
                      {profitCenters.map(pc => (
                        <SelectItem key={pc.id} value={pc.id}>
                          {pc.code} - {pc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_id">Commessa</Label>
                  <Select value={newMovement.project_id || "none"} onValueChange={(value) => setNewMovement(prev => ({ ...prev, project_id: value === "none" ? "" : value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona commessa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna</SelectItem>
                      {projects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.code} - {project.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supplier_customer_name">Cliente/Fornitore</Label>
                  <Input
                    value={newMovement.supplier_customer_name}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, supplier_customer_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document_type">Tipo Documento</Label>
                  <Input
                    value={newMovement.document_type}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, document_type: e.target.value }))}
                    placeholder="Fattura, Ricevuta, ecc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document_number">Numero Documento</Label>
                  <Input
                    value={newMovement.document_number}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, document_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference_number">Riferimento</Label>
                  <Input
                    value={newMovement.reference_number}
                    onChange={(e) => setNewMovement(prev => ({ ...prev, reference_number: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleAddMovement} disabled={!newMovement.description || !newMovement.amount || !newMovement.account_id}>
                  Aggiungi Movimento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendite Totali</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.totalSales.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acquisti Totali</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.totalPurchases.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimenti Totali</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalMovements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Bozza</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.draftMovements}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca movimenti..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo movimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="sale">Vendite</SelectItem>
                <SelectItem value="purchase">Acquisti</SelectItem>
                <SelectItem value="other">Altri</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="draft">Bozza</SelectItem>
                <SelectItem value="confirmed">Confermato</SelectItem>
                <SelectItem value="posted">Registrato</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Movimenti Contabili</CardTitle>
          <CardDescription>
            Lista completa dei movimenti di vendita e acquisto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Cliente/Fornitore</TableHead>
                <TableHead>Conto</TableHead>
                <TableHead>Centro Profitto</TableHead>
                <TableHead>Commessa</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Totale</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{new Date(movement.entry_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(movement.entry_type)}>
                      {getTypeLabel(movement.entry_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{movement.description}</TableCell>
                  <TableCell>{movement.supplier_customer_name || '-'}</TableCell>
                  <TableCell>
                    {movement.account ? `${movement.account.code} - ${movement.account.name}` : '-'}
                  </TableCell>
                  <TableCell>
                    {movement.profit_center ? `${movement.profit_center.code} - ${movement.profit_center.name}` : '-'}
                  </TableCell>
                  <TableCell>
                    {movement.project ? `${movement.project.code} - ${movement.project.customer_name}` : '-'}
                  </TableCell>
                  <TableCell>€{movement.amount.toLocaleString()}</TableCell>
                  <TableCell>€{movement.vat_amount.toLocaleString()}</TableCell>
                  <TableCell className="font-medium">€{movement.total_amount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(movement.status)}>
                      {getStatusLabel(movement.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}