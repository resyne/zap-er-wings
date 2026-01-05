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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, HelpCircle, Building2, ChevronRight, ChevronDown, Users, FolderTree } from "lucide-react";

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  center_type: string | null;
  category: string | null;
  parent_id: string | null;
  responsible_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

const defaultFormData = {
  code: "",
  name: "",
  description: "",
  center_type: "costo",
  category: "",
  parent_id: "",
  responsible_id: "",
  is_active: true,
};

const centerTypes = [
  { value: "costo", label: "Centro di Costo", color: "text-red-600" },
  { value: "ricavo", label: "Centro di Ricavo", color: "text-green-600" },
  { value: "misto", label: "Centro Misto", color: "text-blue-600" },
];

const categories = [
  { value: "reparto", label: "Reparto" },
  { value: "prodotto", label: "Prodotto / Servizio" },
  { value: "cliente", label: "Cliente / Commessa" },
  { value: "team", label: "Persona / Team" },
  { value: "progetto", label: "Progetto / Iniziativa" },
];

interface CostCentersPageProps {
  embedded?: boolean;
}

export default function CostCentersPage({ embedded = false }: CostCentersPageProps) {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [centerToDelete, setCenterToDelete] = useState<CostCenter | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchCenters();
    fetchProfiles();
  }, []);

  const fetchCenters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cost_centers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      toast.error("Errore nel caricamento dei centri");
      console.error(error);
    } else {
      setCenters(data || []);
    }
    setLoading(false);
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email");

    if (error) {
      console.error("Error fetching profiles:", error);
    } else {
      setProfiles(data || []);
    }
  };

  const handleOpenDialog = (center?: CostCenter) => {
    if (center) {
      setEditingCenter(center);
      setFormData({
        code: center.code || "",
        name: center.name || "",
        description: center.description || "",
        center_type: center.center_type || "costo",
        category: center.category || "",
        parent_id: center.parent_id || "",
        responsible_id: center.responsible_id || "",
        is_active: center.is_active ?? true,
      });
    } else {
      setEditingCenter(null);
      setFormData(defaultFormData);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Il nome del centro è obbligatorio");
      return;
    }
    if (!formData.center_type) {
      toast.error("Il tipo di centro è obbligatorio");
      return;
    }
    if (!formData.category) {
      toast.error("La categoria è obbligatoria");
      return;
    }

    const payload = {
      code: formData.code || formData.name.substring(0, 10).toUpperCase().replace(/\s/g, "-"),
      name: formData.name,
      description: formData.description || null,
      center_type: formData.center_type,
      category: formData.category,
      parent_id: formData.parent_id || null,
      responsible_id: formData.responsible_id || null,
      is_active: formData.is_active,
    };

    if (editingCenter) {
      const { error } = await supabase
        .from("cost_centers")
        .update(payload)
        .eq("id", editingCenter.id);

      if (error) {
        toast.error("Errore durante l'aggiornamento");
        console.error(error);
      } else {
        toast.success("Centro aggiornato con successo");
        fetchCenters();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase.from("cost_centers").insert([payload]);

      if (error) {
        toast.error("Errore durante la creazione");
        console.error(error);
      } else {
        toast.success("Centro creato con successo");
        fetchCenters();
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!centerToDelete) return;

    // Check if center has children
    const hasChildren = centers.some((c) => c.parent_id === centerToDelete.id);
    if (hasChildren) {
      toast.error("Non puoi eliminare un centro che ha sotto-centri. Rimuovi prima i figli.");
      setDeleteDialogOpen(false);
      return;
    }

    const { error } = await supabase
      .from("cost_centers")
      .delete()
      .eq("id", centerToDelete.id);

    if (error) {
      toast.error("Errore durante l'eliminazione. Il centro potrebbe essere in uso.");
      console.error(error);
    } else {
      toast.success("Centro eliminato con successo");
      fetchCenters();
    }
    setDeleteDialogOpen(false);
    setCenterToDelete(null);
  };

  const handleToggleActive = async (center: CostCenter) => {
    const { error } = await supabase
      .from("cost_centers")
      .update({ is_active: !center.is_active })
      .eq("id", center.id);

    if (error) {
      toast.error("Errore durante l'aggiornamento dello stato");
      console.error(error);
    } else {
      toast.success(center.is_active ? "Centro disattivato" : "Centro attivato");
      fetchCenters();
    }
  };

  const getCenterTypeBadge = (type: string | null) => {
    switch (type) {
      case "costo":
        return <Badge variant="destructive">Costo</Badge>;
      case "ricavo":
        return <Badge className="bg-green-600 hover:bg-green-700">Ricavo</Badge>;
      case "misto":
        return <Badge className="bg-blue-600 hover:bg-blue-700">Misto</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getCategoryBadge = (category: string | null) => {
    const cat = categories.find((c) => c.value === category);
    return <Badge variant="outline">{cat?.label || category || "-"}</Badge>;
  };

  const getResponsibleName = (responsibleId: string | null) => {
    if (!responsibleId) return "-";
    const profile = profiles.find((p) => p.id === responsibleId);
    if (!profile) return "-";
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email || "-";
  };

  const getParentName = (parentId: string | null) => {
    if (!parentId) return null;
    const parent = centers.find((c) => c.id === parentId);
    return parent?.name || null;
  };

  const filteredCenters = centers.filter((center) => {
    const matchesSearch =
      center.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (center.code && center.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (center.description && center.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = filterType === "all" || center.center_type === filterType;
    const matchesCategory = filterCategory === "all" || center.category === filterCategory;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && center.is_active) ||
      (filterStatus === "inactive" && !center.is_active);

    return matchesSearch && matchesType && matchesCategory && matchesStatus;
  });

  // Build tree structure
  const treeData = useMemo(() => {
    const rootCenters = filteredCenters.filter((c) => !c.parent_id);
    const getChildren = (parentId: string): CostCenter[] => {
      return filteredCenters.filter((c) => c.parent_id === parentId);
    };
    return { rootCenters, getChildren };
  }, [filteredCenters]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderTreeNode = (center: CostCenter, level: number = 0) => {
    const children = treeData.getChildren(center.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(center.id);

    return (
      <div key={center.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-lg ${
            !center.is_active ? "opacity-50" : ""
          }`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleNode(center.id)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <div className="flex-1 flex items-center gap-3">
            <span className="font-medium">{center.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{center.code}</span>
            {getCenterTypeBadge(center.center_type)}
            {getCategoryBadge(center.category)}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={center.is_active ?? true}
              onCheckedChange={() => handleToggleActive(center)}
            />
            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(center)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCenterToDelete(center);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const stats = {
    total: centers.length,
    active: centers.filter((c) => c.is_active).length,
    costo: centers.filter((c) => c.center_type === "costo").length,
    ricavo: centers.filter((c) => c.center_type === "ricavo").length,
  };

  // Available parents (exclude self and descendants)
  const availableParents = useMemo(() => {
    if (!editingCenter) return centers.filter((c) => c.is_active);

    const getDescendantIds = (id: string): string[] => {
      const children = centers.filter((c) => c.parent_id === id);
      return [id, ...children.flatMap((c) => getDescendantIds(c.id))];
    };

    const excludeIds = getDescendantIds(editingCenter.id);
    return centers.filter((c) => c.is_active && !excludeIds.includes(c.id));
  }, [centers, editingCenter]);

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto py-6 space-y-6"}>
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Centri di Costo / Ricavo
          </h1>
          <p className="text-muted-foreground mt-1">
            Definisci dove nasce economicamente un costo o un ricavo
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Centro
        </Button>
      </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Totale Centri</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Centri Attivi</CardDescription>
            <CardTitle className="text-2xl text-green-600">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Centri di Costo</CardDescription>
            <CardTitle className="text-2xl text-red-600">{stats.costo}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Centri di Ricavo</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{stats.ricavo}</CardTitle>
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
                  placeholder="Cerca per nome, codice o descrizione..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                {centerTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="inactive">Disattivati</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                Lista
              </Button>
              <Button
                variant={viewMode === "tree" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("tree")}
              >
                <FolderTree className="h-4 w-4 mr-1" />
                Albero
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card>
        <CardContent className="p-0">
          {viewMode === "list" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Codice</TableHead>
                  <TableHead>Nome Centro</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Centro Padre</TableHead>
                  <TableHead>Responsabile</TableHead>
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
                ) : filteredCenters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nessun centro trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCenters.map((center) => (
                    <TableRow key={center.id} className={!center.is_active ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-sm">{center.code || "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{center.name}</span>
                          {center.description && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-xs text-muted-foreground truncate max-w-[250px] cursor-help">
                                  {center.description.slice(0, 40)}...
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-md">
                                <p>{center.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getCenterTypeBadge(center.center_type)}</TableCell>
                      <TableCell>{getCategoryBadge(center.category)}</TableCell>
                      <TableCell>
                        {getParentName(center.parent_id) || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{getResponsibleName(center.responsible_id)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={center.is_active ?? true}
                          onCheckedChange={() => handleToggleActive(center)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(center)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCenterToDelete(center);
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
          ) : (
            <div className="p-4">
              {loading ? (
                <p className="text-center py-8 text-muted-foreground">Caricamento...</p>
              ) : treeData.rootCenters.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nessun centro trovato</p>
              ) : (
                <div className="space-y-1">
                  {treeData.rootCenters.map((center) => renderTreeNode(center))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCenter ? "Modifica Centro" : "Nuovo Centro"}
            </DialogTitle>
            <DialogDescription>
              {editingCenter
                ? "Modifica le informazioni del centro"
                : "Compila i campi per creare un nuovo centro di costo o ricavo"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Identità */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Identità del Centro
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-1">
                    Nome Centro <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Es. Marketing Digitale"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Codice</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Auto-generato se vuoto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Tipo Centro <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.center_type}
                    onValueChange={(value) => setFormData({ ...formData, center_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {centerTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className={type.color}>{type.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Categoria <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Regole d'uso */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Descrizione / Regole d'Uso
              </h3>

              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2">
                  Descrizione
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-sm">
                      <p>Chiarisci quando usare questo centro e cosa include/esclude</p>
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Es. Include tutti i costi pubblicitari Meta e Google per FastLook"
                  rows={3}
                />
              </div>
            </div>

            {/* Gerarchia e Responsabile */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Gerarchia e Responsabilità
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Centro Padre
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <p>Seleziona un centro padre per creare una struttura gerarchica (utile per reporting aggregato)</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(value) => setFormData({ ...formData, parent_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nessun centro padre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessun centro padre</SelectItem>
                      {availableParents.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    Responsabile
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-sm">
                        <p>Persona o ruolo responsabile manageriale del centro</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Select
                    value={formData.responsible_id}
                    onValueChange={(value) => setFormData({ ...formData, responsible_id: value === "__none__" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nessun responsabile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessun responsabile</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {`${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Stato */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="is_active" className="cursor-pointer">
                  Centro Attivo
                </Label>
                <p className="text-sm text-muted-foreground">
                  I centri disattivati non sono selezionabili nella classificazione eventi
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSave}>
              {editingCenter ? "Salva Modifiche" : "Crea Centro"}
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
              Sei sicuro di voler eliminare il centro "{centerToDelete?.name}"?
              <br />
              <span className="text-amber-600 font-medium">
                Consiglio: disattiva il centro invece di eliminarlo per preservare lo storico.
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
                if (centerToDelete) {
                  handleToggleActive(centerToDelete);
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
