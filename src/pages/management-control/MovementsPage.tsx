import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, TrendingUp, TrendingDown, Upload, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { GLEntryDialog } from "@/components/movements/GLEntryDialog";
import { InvoiceXMLImporter } from "@/components/movements/InvoiceXMLImporter";

interface GLEntry {
  id: string;
  date: string;
  doc_type: string;
  doc_ref?: string;
  description: string;
  cost_center_id?: string;
  profit_center_id?: string;
  job_id?: string;
  origin_module: string;
  status: 'draft' | 'incomplete' | 'posted';
  created_at: string;
  cost_center?: { name: string; code: string };
  profit_center?: { name: string; code: string };
  job?: { code: string; customer_name: string };
  gl_entry_line: GLEntryLine[];
}

interface GLEntryLine {
  id: string;
  gl_account_id: string;
  debit: number;
  credit: number;
  vat_rate?: number;
  notes?: string;
  gl_account?: { name: string; code: string };
}

export default function MovementsPage() {
  console.log("Management Control MovementsPage loaded");
  const [movements, setMovements] = useState<GLEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<GLEntry | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load GL entries with lines
      const { data: movementsData, error: movementsError } = await supabase
        .from('gl_entry')
        .select(`
          *,
          cost_center:profit_centers!gl_entry_cost_center_id_fkey(name, code),
          profit_center:profit_centers!gl_entry_profit_center_id_fkey(name, code),
          job:management_projects(code, customer_name),
          gl_entry_line(
            *,
            gl_account:chart_of_accounts(name, code)
          )
        `)
        .order('date', { ascending: false }) as { data: GLEntry[] | null, error: any };

      if (movementsError) throw movementsError;
      setMovements(movementsData || []);
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
      movement.doc_ref?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.job?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = selectedType === "all" || movement.doc_type === selectedType;
    const matchesStatus = selectedStatus === "all" || movement.status === selectedStatus;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SaleInvoice': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'PurchaseInvoice': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'Manual': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Timesheet': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'MaterialIssue': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Logistics': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Adjustment': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'Opening': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'incomplete': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'posted': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'SaleInvoice': return 'Fatt. Vendita';
      case 'PurchaseInvoice': return 'Fatt. Acquisto';
      case 'Manual': return 'Manuale';
      case 'Timesheet': return 'Timesheet';
      case 'MaterialIssue': return 'Scarico Mat.';
      case 'Logistics': return 'Logistica';
      case 'Adjustment': return 'Rettifica';
      case 'Opening': return 'Apertura';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Bozza';
      case 'incomplete': return 'Incompleto';
      case 'posted': return 'Registrato';
      default: return status;
    }
  };

  const getMovementTotal = (movement: GLEntry) => {
    return movement.gl_entry_line.reduce((sum, line) => sum + Math.max(line.debit, line.credit), 0);
  };

  const handleEdit = (movement: GLEntry) => {
    setEditingMovement(movement);
  };

  const handleDelete = async (movementId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo movimento contabile? Questa azione non può essere annullata.")) {
      return;
    }

    try {
      // First delete the lines
      const { error: linesError } = await supabase
        .from('gl_entry_line')
        .delete()
        .eq('gl_entry_id', movementId);

      if (linesError) throw linesError;

      // Then delete the entry
      const { error: entryError } = await supabase
        .from('gl_entry')
        .delete()
        .eq('id', movementId);

      if (entryError) throw entryError;

      toast({
        title: "Successo",
        description: "Movimento contabile eliminato con successo",
      });

      loadData();
    } catch (error) {
      console.error('Error deleting movement:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del movimento",
        variant: "destructive",
      });
    }
  };

  // Calculate summary
  const summary = {
    totalDebits: movements.reduce((sum, m) => sum + m.gl_entry_line.reduce((lineSum, line) => lineSum + line.debit, 0), 0),
    totalCredits: movements.reduce((sum, m) => sum + m.gl_entry_line.reduce((lineSum, line) => lineSum + line.credit, 0), 0),
    totalMovements: movements.length,
    draftMovements: movements.filter(m => m.status === 'draft').length,
    incompleteMovements: movements.filter(m => m.status === 'incomplete').length
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
            Registra tutti i movimenti economico-gestionali e finanziari
          </p>
        </div>
        <div className="flex gap-2">
          <InvoiceXMLImporter onSuccess={loadData} />
          <GLEntryDialog 
            open={isAddDialogOpen} 
            onOpenChange={setIsAddDialogOpen}
            onSuccess={loadData}
          />
          {editingMovement && (
            <GLEntryDialog 
              open={!!editingMovement} 
              onOpenChange={(open) => !open && setEditingMovement(null)}
              onSuccess={() => {
                loadData();
                setEditingMovement(null);
              }}
              editData={editingMovement}
            />
          )}
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Movimento
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Dare</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.totalDebits.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Avere</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.totalCredits.toLocaleString()}</div>
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incompleti</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.incompleteMovements}</div>
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
                <SelectItem value="SaleInvoice">Fatt. Vendita</SelectItem>
                <SelectItem value="PurchaseInvoice">Fatt. Acquisto</SelectItem>
                <SelectItem value="Manual">Manuale</SelectItem>
                <SelectItem value="Timesheet">Timesheet</SelectItem>
                <SelectItem value="MaterialIssue">Scarico Mat.</SelectItem>
                <SelectItem value="Logistics">Logistica</SelectItem>
                <SelectItem value="Adjustment">Rettifica</SelectItem>
                <SelectItem value="Opening">Apertura</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="draft">Bozza</SelectItem>
                <SelectItem value="incomplete">Incompleto</SelectItem>
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
            Lista completa dei movimenti con righe contabili bilanciate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Riferimento</TableHead>
                <TableHead>Centro Costo</TableHead>
                <TableHead>Centro Profitto</TableHead>
                <TableHead>Commessa</TableHead>
                <TableHead>Righe</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{new Date(movement.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(movement.doc_type)}>
                      {getTypeLabel(movement.doc_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{movement.description}</TableCell>
                  <TableCell>{movement.doc_ref || '-'}</TableCell>
                  <TableCell>
                    {movement.cost_center ? `${movement.cost_center.code} - ${movement.cost_center.name}` : '-'}
                  </TableCell>
                  <TableCell>
                    {movement.profit_center ? `${movement.profit_center.code} - ${movement.profit_center.name}` : '-'}
                  </TableCell>
                  <TableCell>
                    {movement.job ? `${movement.job.code} - ${movement.job.customer_name}` : '-'}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {movement.gl_entry_line.length} {movement.gl_entry_line.length === 1 ? 'riga' : 'righe'}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">€{getMovementTotal(movement).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(movement.status)}>
                      {getStatusLabel(movement.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEdit(movement)}
                        title="Modifica movimento"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(movement.id)}
                        title="Elimina movimento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMovements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Nessun movimento trovato
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