import { useState, useEffect, useMemo } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, BookOpen, Download, ChevronDown, ChevronRight, TrendingDown, TrendingUp, Building2, Wallet, HelpCircle, AlertCircle, FolderPlus } from "lucide-react";
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
  is_header: boolean | null;
  parent_code: string | null;
  level: number | null;
  created_at: string;
}

interface TreeNode extends Account {
  children: TreeNode[];
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
  parent_code: "",
  level: 2,
  is_header: false,
};

const accountTypes = [
  { value: "revenue", label: "Ricavi", icon: TrendingUp, color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-950", borderColor: "border-green-200 dark:border-green-800", section: "Conto Economico" },
  { value: "cogs", label: "Costi Diretti (COGS)", icon: TrendingDown, color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-950", borderColor: "border-red-200 dark:border-red-800", section: "Conto Economico" },
  { value: "opex", label: "Costi Operativi (OPEX)", icon: TrendingDown, color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950", borderColor: "border-orange-200 dark:border-orange-800", section: "Conto Economico" },
  { value: "depreciation", label: "Ammortamenti", icon: TrendingDown, color: "text-amber-600", bgColor: "bg-amber-50 dark:bg-amber-950", borderColor: "border-amber-200 dark:border-amber-800", section: "Conto Economico" },
  { value: "extraordinary", label: "Proventi e Oneri Straordinari", icon: Wallet, color: "text-violet-600", bgColor: "bg-violet-50 dark:bg-violet-950", borderColor: "border-violet-200 dark:border-violet-800", section: "Conto Economico" },
  { value: "asset", label: "Attività", icon: Building2, color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-950", borderColor: "border-blue-200 dark:border-blue-800", section: "Stato Patrimoniale" },
  { value: "liability", label: "Passività", icon: Building2, color: "text-slate-600", bgColor: "bg-slate-50 dark:bg-slate-950", borderColor: "border-slate-200 dark:border-slate-800", section: "Stato Patrimoniale" },
  { value: "equity", label: "Patrimonio Netto", icon: Building2, color: "text-teal-600", bgColor: "bg-teal-50 dark:bg-teal-950", borderColor: "border-teal-200 dark:border-teal-800", section: "Stato Patrimoniale" },
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

interface ChartOfAccountsPageProps {
  embedded?: boolean;
}

export default function ChartOfAccountsPage({ embedded = false }: ChartOfAccountsPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

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
      // Espandi tutti i nodi di livello 1 di default
      const level1Codes = new Set((data || []).filter(a => a.level === 1).map(a => a.code));
      setExpandedNodes(level1Codes);
    }
    setLoading(false);
  };

  // Costruisce l'albero gerarchico
  const accountTree = useMemo(() => {
    const codeToAccount: Map<string, TreeNode> = new Map();
    const roots: TreeNode[] = [];

    // Prima passa: crea tutti i nodi
    accounts.forEach(account => {
      codeToAccount.set(account.code, { ...account, children: [] });
    });

    // Seconda passa: costruisce la gerarchia
    accounts.forEach(account => {
      const node = codeToAccount.get(account.code)!;
      if (account.parent_code && codeToAccount.has(account.parent_code)) {
        codeToAccount.get(account.parent_code)!.children.push(node);
      } else if (account.level === 1 || !account.parent_code) {
        roots.push(node);
      }
    });

    // Ordina i figli per codice
    const sortChildren = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach(node => sortChildren(node.children));
    };
    sortChildren(roots);

    return roots;
  }, [accounts]);

  // Filtra l'albero in base alla ricerca
  const filteredTree = useMemo(() => {
    if (!searchTerm) return accountTree;

    const matchesSearch = (account: Account): boolean => {
      return (
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.code.toLowerCase().includes(searchTerm.toLowerCase())
      );
    };

    const filterNode = (node: TreeNode): TreeNode | null => {
      const filteredChildren = node.children
        .map(child => filterNode(child))
        .filter((n): n is TreeNode => n !== null);

      if (matchesSearch(node) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      return null;
    };

    return accountTree
      .map(node => filterNode(node))
      .filter((n): n is TreeNode => n !== null);
  }, [accountTree, searchTerm]);

  const generateNextCode = (parentCode: string | null, existingChildren: Account[]): string => {
    if (!parentCode) return "";
    
    const childCodes = existingChildren
      .filter(a => a.parent_code === parentCode)
      .map(a => a.code);
    
    // Trova il prossimo numero disponibile
    const parentParts = parentCode.split(".");
    const existingNumbers = childCodes
      .map(code => {
        const parts = code.split(".");
        const lastPart = parts[parts.length - 1];
        return parseInt(lastPart, 10);
      })
      .filter(n => !isNaN(n));
    
    const nextNum = existingNumbers.length > 0 
      ? Math.max(...existingNumbers) + 1 
      : 1;
    
    return `${parentCode}.${nextNum.toString().padStart(2, "0")}`;
  };

  const handleOpenDialog = (account?: Account, parentAccount?: Account) => {
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
        parent_code: account.parent_code || "",
        level: account.level || 2,
        is_header: account.is_header || false,
      });
    } else if (parentAccount) {
      // Nuovo sotto-conto
      const newCode = generateNextCode(parentAccount.code, accounts);
      setEditingAccount(null);
      setFormData({
        ...defaultFormData,
        parent_code: parentAccount.code,
        account_type: parentAccount.account_type,
        level: (parentAccount.level || 1) + 1,
        code: newCode,
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
    if (!formData.code.trim()) {
      toast.error("Il codice del conto è obbligatorio");
      return;
    }

    const payload = {
      code: formData.code,
      name: formData.name,
      account_type: formData.account_type || null,
      category: formData.category || null,
      description: formData.description || null,
      default_competence: formData.default_competence,
      requires_cost_center: formData.requires_cost_center,
      visibility: formData.visibility,
      is_active: formData.is_active,
      parent_code: formData.parent_code || null,
      level: formData.level,
      is_header: formData.is_header,
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

    // Controlla se ha figli
    const hasChildren = accounts.some(a => a.parent_code === accountToDelete.code);
    if (hasChildren) {
      toast.error("Non puoi eliminare un conto che ha sotto-conti. Elimina prima i sotto-conti.");
      setDeleteDialogOpen(false);
      return;
    }

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

  const toggleNode = (code: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const incideOnCE = (type: string) => {
    return ["revenue", "cogs", "opex", "depreciation", "extraordinary"].includes(type);
  };

  const getTypeConfig = (type: string) => {
    return accountTypes.find(t => t.value === type) || accountTypes[0];
  };

  const selectableAccounts = accounts.filter(a => !a.is_header);
  
  const stats = {
    total: selectableAccounts.length,
    active: selectableAccounts.filter((a) => a.is_active).length,
    costi: selectableAccounts.filter((a) => ["cogs", "opex", "depreciation"].includes(a.account_type)).length,
    ricavi: selectableAccounts.filter((a) => a.account_type === "revenue").length,
  };

  // Componente ricorsivo per renderizzare un nodo dell'albero
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedNodes.has(node.code);
    const typeConfig = getTypeConfig(node.account_type);
    const isHeader = node.is_header || node.level === 1;

    return (
      <div key={node.id} className="select-none">
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded-lg transition-colors hover:bg-muted/50 ${
            !node.is_active ? "opacity-50" : ""
          } ${isHeader ? `${typeConfig.bgColor} border ${typeConfig.borderColor}` : ""}`}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {/* Expand/Collapse button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => toggleNode(node.code)}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="w-4" />
            )}
          </Button>

          {/* Code */}
          <code className={`text-sm font-mono px-2 py-0.5 rounded min-w-[80px] text-center ${
            isHeader ? `${typeConfig.color} font-bold` : "bg-muted"
          }`}>
            {node.code}
          </code>

          {/* Name */}
          <div className="flex-1 min-w-0">
            <span className={`${isHeader ? `font-semibold ${typeConfig.color}` : ""} truncate`}>
              {node.name}
            </span>
            {node.description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground truncate max-w-md cursor-help">
                    {node.description}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-md">
                  <p>{node.description}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 shrink-0">
            {node.requires_cost_center && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs">CdC</Badge>
                </TooltipTrigger>
                <TooltipContent>Richiede Centro di Costo</TooltipContent>
              </Tooltip>
            )}
            {incideOnCE(node.account_type) && !isHeader && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 text-xs">
                    CE
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Incide sul Conto Economico</TooltipContent>
              </Tooltip>
            )}
            {isHeader && (
              <Badge variant="secondary" className="text-xs">Macro</Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Add sub-account button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleOpenDialog(undefined, node)}
                >
                  <FolderPlus className="h-4 w-4 text-muted-foreground hover:text-primary" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aggiungi sotto-conto</TooltipContent>
            </Tooltip>

            {!isHeader && (
              <Switch
                checked={node.is_active ?? true}
                onCheckedChange={() => handleToggleActive(node)}
              />
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleOpenDialog(node)}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setAccountToDelete(node);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto py-6 space-y-6"}>
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Piano dei Conti
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci la struttura gerarchica dei conti
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const exportData = accounts.map(a => ({
              "Codice": a.code || "",
              "Nome Conto": a.name,
              "Codice Padre": a.parent_code || "",
              "Livello": a.level || 1,
              "Natura": a.account_type,
              "Categoria": a.category || "",
              "Header": a.is_header ? "Sì" : "No",
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
      )}

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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome o codice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                const allCodes = new Set(accounts.map(a => a.code));
                setExpandedNodes(allCodes);
              }}
            >
              Espandi tutto
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const level1Codes = new Set(accounts.filter(a => a.level === 1).map(a => a.code));
                setExpandedNodes(level1Codes);
              }}
            >
              Comprimi
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tree View */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Caricamento...
          </CardContent>
        </Card>
      ) : filteredTree.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessun conto trovato</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {filteredTree.map(node => renderTreeNode(node, 0))}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Modifica Conto" : formData.parent_code ? "Nuovo Sotto-Conto" : "Nuovo Conto"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Modifica le informazioni del conto"
                : formData.parent_code 
                  ? `Aggiungi un sotto-conto a ${formData.parent_code}`
                  : "Compila i campi per creare un nuovo conto"}
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
                  <Label htmlFor="code" className="flex items-center gap-1">
                    Codice Conto <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Es. 01.04"
                  />
                  {formData.parent_code && (
                    <p className="text-xs text-muted-foreground">
                      Padre: {formData.parent_code}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    Nome del Conto <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Es. Ricavi Accessori"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Natura del Conto</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) => setFormData({ ...formData, account_type: value })}
                    disabled={!!formData.parent_code}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona natura" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Conto Economico
                      </div>
                      {accountTypes.filter(t => t.section === "Conto Economico").map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                      <div className="my-1 border-t border-border" />
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Stato Patrimoniale
                      </div>
                      {accountTypes.filter(t => t.section === "Stato Patrimoniale").map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.parent_code && (
                    <p className="text-xs text-muted-foreground">
                      Ereditato dal padre
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
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
                  </span>
                </div>
              )}
            </div>

            {/* Descrizione */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Descrizione
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2">
                  Istruzioni d'uso
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p>Scrivi quando usare questo conto e quando NON usarlo.</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Es. Usare per ricavi da vendita accessori..."
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
                  <Label>Gestione Competenza</Label>
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
                  <Label>Visibilità / Uso</Label>
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
                    Attiva se deve essere associato a un centro di costo
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
                  <Label htmlFor="is_header" className="cursor-pointer">
                    Conto Macro (non selezionabile)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Attiva se è solo un contenitore per altri conti
                  </p>
                </div>
                <Switch
                  id="is_header"
                  checked={formData.is_header}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_header: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="cursor-pointer">
                    Conto Attivo
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    I conti disattivati non sono selezionabili
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
