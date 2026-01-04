import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, HelpCircle, BookOpen, AlertCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  category: string | null;
  description: string | null;
  default_competence: string | null;
  requires_cost_center: boolean | null;
  visibility: string | null;
  is_active: boolean | null;
  created_at: string;
}

const defaultFormData = {
  code: "",
  name: "",
  account_type: "",
  category: "",
  description: "",
  default_competence: "immediata",
  requires_cost_center: false,
  visibility: "classificazione",
  is_active: true,
};

const accountTypes = [
  { value: "costo", label: "Costo" },
  { value: "ricavo", label: "Ricavo" },
  { value: "patrimoniale", label: "Patrimoniale" },
  { value: "finanziario", label: "Finanziario" },
];

const macroCategories = [
  "Marketing",
  "Produzione",
  "Amministrazione",
  "IT",
  "Vendite",
  "Logistica",
  "Risorse Umane",
  "Ricerca e Sviluppo",
  "Acquisti",
  "Servizi Generali",
  "Finanza",
];

const competenceOptions = [
  { value: "immediata", label: "Immediata" },
  { value: "differita", label: "Spesso differita" },
  { value: "rateizzata", label: "Spesso rateizzata" },
];

const visibilityOptions = [
  { value: "classificazione", label: "Usabile in classificazione eventi" },
  { value: "reporting", label: "Solo reporting" },
  { value: "assestamenti", label: "Solo assestamenti" },
];

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chart_of_accounts")
      .select("*")
      .order("code", { ascending: true });

    if (error) {
      toast.error("Errore nel caricamento dei conti");
      console.error(error);
    } else {
      setAccounts(data || []);
    }
    setLoading(false);
  };

  const handleOpenDialog = (account?: Account) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        code: account.code || "",
        name: account.name || "",
        account_type: account.account_type || "",
        category: account.category || "",
        description: account.description || "",
        default_competence: account.default_competence || "immediata",
        requires_cost_center: account.requires_cost_center || false,
        visibility: account.visibility || "classificazione",
        is_active: account.is_active ?? true,
      });
    } else {
      setEditingAccount(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Il nome del conto è obbligatorio");
      return;
    }
    if (!formData.account_type) {
      toast.error("La natura del conto è obbligatoria");
      return;
    }
    if (!formData.category) {
      toast.error("La macro-categoria è obbligatoria");
      return;
    }

    const payload = {
      code: formData.code || null,
      name: formData.name,
      account_type: formData.account_type,
      category: formData.category,
      description: formData.description || null,
      default_competence: formData.default_competence,
      requires_cost_center: formData.requires_cost_center,
      visibility: formData.visibility,
      is_active: formData.is_active,
    };

    if (editingAccount) {
      const { error } = await supabase
        .from("chart_of_accounts")
        .update(payload)
        .eq("id", editingAccount.id);

      if (error) {
        toast.error("Errore durante l'aggiornamento");
        console.error(error);
      } else {
        toast.success("Conto aggiornato con successo");
        fetchAccounts();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase.from("chart_of_accounts").insert([payload]);

      if (error) {
        toast.error("Errore durante la creazione");
        console.error(error);
      } else {
        toast.success("Conto creato con successo");
        fetchAccounts();
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;

    const { error } = await supabase
      .from("chart_of_accounts")
      .delete()
      .eq("id", accountToDelete.id);

    if (error) {
      toast.error("Errore durante l'eliminazione. Il conto potrebbe essere in uso.");
      console.error(error);
    } else {
      toast.success("Conto eliminato con successo");
      fetchAccounts();
    }
    setDeleteDialogOpen(false);
    setAccountToDelete(null);
  };

  const handleToggleActive = async (account: Account) => {
    const { error } = await supabase
      .from("chart_of_accounts")
      .update({ is_active: !account.is_active })
      .eq("id", account.id);

    if (error) {
      toast.error("Errore durante l'aggiornamento dello stato");
      console.error(error);
    } else {
      toast.success(account.is_active ? "Conto disattivato" : "Conto attivato");
      fetchAccounts();
    }
  };

  const getAccountTypeBadge = (type: string) => {
    switch (type) {
      case "costo":
        return <Badge variant="destructive">Costo</Badge>;
      case "ricavo":
        return <Badge className="bg-green-600 hover:bg-green-700">Ricavo</Badge>;
      case "patrimoniale":
        return <Badge variant="secondary">Patrimoniale</Badge>;
      case "finanziario":
        return <Badge variant="outline">Finanziario</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const incideOnCE = (type: string) => {
    return type === "costo" || type === "ricavo";
  };

  const filteredAccounts = accounts.filter((account) => {
    const matchesSearch =
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.code && account.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (account.category && account.category.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === "all" || account.account_type === filterType;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && account.is_active) ||
      (filterStatus === "inactive" && !account.is_active);

    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: accounts.length,
    active: accounts.filter((a) => a.is_active).length,
    costi: accounts.filter((a) => a.account_type === "costo").length,
    ricavi: accounts.filter((a) => a.account_type === "ricavo").length,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Piano dei Conti
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci la struttura dei conti per la classificazione degli eventi
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const exportData = accounts.map(a => ({
              "Codice": a.code || "",
              "Nome Conto": a.name,
              "Natura": a.account_type,
              "Macro-categoria": a.category || "",
              "Descrizione": a.description || "",
              "Competenza Default": a.default_competence || "",
              "Richiede CdC": a.requires_cost_center ? "Sì" : "No",
              "Visibilità": a.visibility || "",
              "Attivo": a.is_active ? "Sì" : "No",
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Piano dei Conti");
            XLSX.writeFile(wb, `piano_dei_conti_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success("Piano dei conti esportato");
          }}>
            <Download className="mr-2 h-4 w-4" />
            Esporta Excel
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Nuovo Conto
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totale Conti</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conti Attivi</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conti di Costo</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.costi}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conti di Ricavo</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{stats.ricavi}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per nome, codice o categoria..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Natura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le nature</SelectItem>
                {accountTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="inactive">Disattivati</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Codice</TableHead>
                <TableHead>Nome Conto</TableHead>
                <TableHead>Natura</TableHead>
                <TableHead>Macro-categoria</TableHead>
                <TableHead className="text-center">Incide CE</TableHead>
                <TableHead className="text-center">Richiede CdC</TableHead>
                <TableHead className="text-center">Stato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nessun conto trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id} className={!account.is_active ? "opacity-50" : ""}>
                    <TableCell className="font-mono text-sm">
                      {account.code || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{account.name}</span>
                        {account.description && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground truncate max-w-[300px] cursor-help">
                                {account.description.slice(0, 50)}...
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-md">
                              <p>{account.description}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getAccountTypeBadge(account.account_type)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{account.category || "-"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {incideOnCE(account.account_type) ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Sì
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {account.requires_cost_center ? (
                        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          Sì
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={account.is_active ?? true}
                        onCheckedChange={() => handleToggleActive(account)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAccountToDelete(account);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Modifica Conto" : "Nuovo Conto"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Modifica le informazioni del conto"
                : "Compila i campi per creare un nuovo conto nel piano dei conti"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Identità del conto */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Identità del Conto
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    Nome del Conto <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Es. Spese di marketing"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code" className="flex items-center gap-2">
                    Codice Conto
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>Utile per esportazioni, integrazioni e ordinamento. Non è obbligatorio seguire la logica civilistica.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Es. C-MKT-01"
                  />
                </div>
              </div>
            </div>

            {/* Natura e Categoria */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Classificazione
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Natura del Conto <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona natura" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Macro-categoria <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {macroCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Incide CE - Derivato */}
              {formData.account_type && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    Incide sul Conto Economico:{" "}
                    <span className={incideOnCE(formData.account_type) ? "text-green-600 font-semibold" : "font-semibold"}>
                      {incideOnCE(formData.account_type) ? "Sì" : "No"}
                    </span>
                    <span className="text-muted-foreground ml-2">(derivato dalla natura)</span>
                  </span>
                </div>
              )}
            </div>

            {/* Regole d'uso */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Regole d'Uso
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2">
                  Descrizione / Istruzioni
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p>Scrivi quando usare questo conto e quando NON usarlo. Riduce i dubbi futuri.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Es. Usare per spese di parcheggio, pedaggi e accessori di trasferta. Non usare per carburante o manutenzione veicoli."
                  rows={3}
                />
              </div>
            </div>

            {/* Impostazioni avanzate */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Impostazioni Avanzate
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Gestione Competenza
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p>Suggerisce come gestire la competenza. Non vincola, ma aiuta nelle automazioni future.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={formData.default_competence}
                    onValueChange={(value) => setFormData({ ...formData, default_competence: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {competenceOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Visibilità / Uso
                  </Label>
                  <Select
                    value={formData.visibility}
                    onValueChange={(value) => setFormData({ ...formData, visibility: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {visibilityOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="requires_cost_center" className="cursor-pointer">
                    Richiede Centro di Costo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Attiva se questo conto deve sempre essere associato a un centro di costo
                  </p>
                </div>
                <Switch
                  id="requires_cost_center"
                  checked={formData.requires_cost_center}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_cost_center: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Conto Attivo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    I conti disattivati non sono selezionabili nella classificazione eventi
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingAccount ? "Salva Modifiche" : "Crea Conto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma Eliminazione</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare il conto "{accountToDelete?.name}"?
              <br />
              <span className="text-amber-600 font-medium">
                Consiglio: disattiva il conto invece di eliminarlo per preservare lo storico.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (accountToDelete) {
                  handleToggleActive(accountToDelete);
                }
                setDeleteDialogOpen(false);
              }}
            >
              Disattiva invece
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Elimina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
