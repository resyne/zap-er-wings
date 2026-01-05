import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown, TrendingUp, TrendingDown, Package, FileText, Check, X, Loader2, Pencil, Ban } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ManualMovementDialog } from "@/components/warehouse/ManualMovementDialog";
import { EditMovementDialog } from "@/components/warehouse/EditMovementDialog";
import { SimilarMaterialDialog, MaterialMatch, SimilarMaterialAction } from "@/components/shared/SimilarMaterialDialog";
import { stringSimilarity } from "@/lib/fuzzyMatch";

interface StockMovement {
  id: string;
  movement_date: string;
  movement_type: "carico" | "scarico";
  origin_type: string;
  ddt_id: string | null;
  item_description: string;
  quantity: number;
  unit: string;
  warehouse: string;
  status: "proposto" | "confermato" | "annullato" | "escluso";
  customer_id: string | null;
  supplier_id: string | null;
  work_order_id: string | null;
  created_at: string;
  created_by: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  ddts?: { ddt_number: string } | null;
  customers?: { name: string } | null;
  suppliers?: { name: string } | null;
  work_orders?: { number: string } | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  proposto: { label: "Proposto", color: "bg-amber-50 text-amber-700 border-amber-200" },
  confermato: { label: "Confermato", color: "bg-green-50 text-green-700 border-green-200" },
  annullato: { label: "Annullato", color: "bg-red-50 text-red-700 border-red-200" },
  escluso: { label: "Escluso", color: "bg-slate-50 text-slate-700 border-slate-200" },
};

export default function MovementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [caricoDialogOpen, setCaricoDialogOpen] = useState(false);
  const [scaricoDialogOpen, setScaricoDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
  
  // Similar material dialog state
  const [similarMaterialDialogOpen, setSimilarMaterialDialogOpen] = useState(false);
  const [similarMaterialMatches, setSimilarMaterialMatches] = useState<MaterialMatch[]>([]);
  const [pendingMovementId, setPendingMovementId] = useState<string | null>(null);
  const [pendingMovementDescription, setPendingMovementDescription] = useState<string>("");
  const [processingMaterialAction, setProcessingMaterialAction] = useState(false);

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          *,
          ddts(ddt_number),
          customers(name),
          suppliers(name),
          work_orders(number)
        `)
        .order("movement_date", { ascending: false });

      if (error) throw error;
      return data as StockMovement[];
    },
  });

  // Fetch materials for fuzzy matching
  const { data: materials = [] } = useQuery({
    queryKey: ["materials-for-matching"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, unit, supplier_id")
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const findSimilarMaterials = (description: string): MaterialMatch[] => {
    const threshold = 0.85; // 85% similarity threshold for materials
    const normalizedDesc = description.toLowerCase().trim();
    
    // First check for exact match
    const exactMatch = materials.find(m => m.name.toLowerCase().trim() === normalizedDesc);
    if (exactMatch) {
      return []; // Exact match found, no need for dialog
    }
    
    // Find similar materials
    return materials
      .map(m => ({
        id: m.id,
        name: m.name,
        code: m.code,
        unit: m.unit || undefined,
        supplier_id: m.supplier_id,
        similarity: stringSimilarity(normalizedDesc, m.name.toLowerCase().trim()),
      }))
      .filter(m => m.similarity >= threshold && m.similarity < 1)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
  };

  const handleConfirmClick = async (movement: StockMovement) => {
    // Check for similar materials before confirming
    const similarMatches = findSimilarMaterials(movement.item_description);
    
    if (similarMatches.length > 0) {
      // Show dialog to let user choose
      setSimilarMaterialMatches(similarMatches);
      setPendingMovementId(movement.id);
      setPendingMovementDescription(movement.item_description);
      setSimilarMaterialDialogOpen(true);
    } else {
      // No similar materials found, proceed with confirmation
      confirmMutation.mutate(movement.id);
    }
  };

  const handleSimilarMaterialAction = async (action: SimilarMaterialAction, selectedMatch?: MaterialMatch) => {
    if (!pendingMovementId) return;
    
    setProcessingMaterialAction(true);
    
    try {
      if (action === "use_existing" && selectedMatch) {
        // Update the movement to use the existing material's description
        await supabase
          .from("stock_movements")
          .update({ item_description: selectedMatch.name })
          .eq("id", pendingMovementId);
        
        toast({
          title: "Articolo collegato",
          description: `Movimento aggiornato con "${selectedMatch.name}"`,
        });
      } else if (action === "update_existing" && selectedMatch) {
        // Update the existing material's name
        await supabase
          .from("materials")
          .update({ name: pendingMovementDescription })
          .eq("id", selectedMatch.id);
        
        toast({
          title: "Articolo aggiornato",
          description: `Nome aggiornato a "${pendingMovementDescription}"`,
        });
      }
      // For "create_new", we just proceed with the confirmation as-is
      
      // Now confirm the movement
      confirmMutation.mutate(pendingMovementId);
    } catch (error) {
      console.error("Error handling material action:", error);
      toast({
        title: "Errore",
        description: "Impossibile completare l'operazione",
        variant: "destructive",
      });
    } finally {
      setProcessingMaterialAction(false);
      setSimilarMaterialDialogOpen(false);
      setPendingMovementId(null);
      setPendingMovementDescription("");
    }
  };

  const confirmMutation = useMutation({
    mutationFn: async (movementId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the movement details
      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("id", movementId)
        .single();
      
      if (movementError || !movement) throw movementError || new Error("Movimento non trovato");
      
      // Find existing material by exact name match (normalized)
      const normalizedDesc = movement.item_description.toLowerCase().trim();
      const { data: existingMaterials } = await supabase
        .from("materials")
        .select("id, name, current_stock")
        .eq("active", true);
      
      let materialId: string | null = null;
      let materialName = movement.item_description;
      
      // Check for exact match
      const exactMatch = existingMaterials?.find(
        m => m.name.toLowerCase().trim() === normalizedDesc
      );
      
      if (exactMatch) {
        materialId = exactMatch.id;
        
        // Update the material's stock
        const stockChange = movement.movement_type === "carico" ? movement.quantity : -movement.quantity;
        await supabase
          .from("materials")
          .update({ 
            current_stock: (exactMatch.current_stock || 0) + stockChange,
            updated_at: new Date().toISOString()
          })
          .eq("id", exactMatch.id);
      } else {
        // Create new material (code is auto-generated by trigger)
        const { data: newMaterial, error: createError } = await supabase
          .from("materials")
          .insert({
            code: "", // Will be auto-generated by trigger
            name: movement.item_description,
            material_type: "component", // Default type
            unit: movement.unit || "pcs",
            supplier_id: movement.supplier_id,
            current_stock: movement.movement_type === "carico" ? movement.quantity : 0,
            active: true,
          })
          .select("id")
          .single();
        
        if (createError) throw createError;
        materialId = newMaterial?.id || null;
      }
      
      // Update the movement with confirmation and material link
      const { error } = await supabase
        .from("stock_movements")
        .update({
          status: "confermato",
          confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id,
          material_id: materialId,
        })
        .eq("id", movementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["materials-for-matching"] });
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast({ title: "Movimento confermato", description: "Scorte aggiornate correttamente" });
    },
    onError: (error) => {
      console.error("Confirm error:", error);
      toast({ title: "Errore", description: "Impossibile confermare il movimento", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (movementId: string) => {
      const { error } = await supabase
        .from("stock_movements")
        .update({ status: "annullato" })
        .eq("id", movementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "Movimento annullato" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile annullare il movimento", variant: "destructive" });
    },
  });

  const excludeMutation = useMutation({
    mutationFn: async (movementId: string) => {
      const { error } = await supabase
        .from("stock_movements")
        .update({ status: "escluso" })
        .eq("id", movementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      toast({ title: "Movimento escluso", description: "Il movimento è stato escluso e non influisce sulle scorte" });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile escludere il movimento", variant: "destructive" });
    },
  });

  const handleEditClick = (movement: StockMovement) => {
    setSelectedMovement(movement);
    setEditDialogOpen(true);
  };

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.item_description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.ddts?.ddt_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || movement.movement_type === selectedType;
    const matchesStatus = selectedStatus === "all" || movement.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getMovementTypeInfo = (type: string) => {
    switch (type) {
      case "carico":
        return { label: "Carico", icon: TrendingUp, bgColor: "bg-green-50 text-green-700 border-green-200" };
      case "scarico":
        return { label: "Scarico", icon: TrendingDown, bgColor: "bg-red-50 text-red-700 border-red-200" };
      default:
        return { label: "Sconosciuto", icon: Package, bgColor: "bg-muted text-muted-foreground border-border" };
    }
  };

  const stats = {
    total: movements.length,
    proposed: movements.filter(m => m.status === "proposto").length,
    confirmed: movements.filter(m => m.status === "confermato").length,
    todayMovements: movements.filter(m => 
      new Date(m.created_at).toDateString() === new Date().toDateString()
    ).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimenti Magazzino</h1>
          <p className="text-muted-foreground">
            Storico e gestione dei movimenti di carico/scarico
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCaricoDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
            <TrendingUp className="mr-2 h-4 w-4" />
            Carico Merci
          </Button>
          <Button onClick={() => setScaricoDialogOpen(true)} variant="destructive">
            <TrendingDown className="mr-2 h-4 w-4" />
            Scarico Merci
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Movimenti</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Da Confermare</CardTitle>
            <Package className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.proposed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confermati</CardTitle>
            <Check className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oggi</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayMovements}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per articolo, DDT o note..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Tipo movimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="carico">Carico</SelectItem>
                <SelectItem value="scarico">Scarico</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="proposto">Proposto</SelectItem>
                <SelectItem value="confermato">Confermato</SelectItem>
                <SelectItem value="escluso">Escluso</SelectItem>
                <SelectItem value="annullato">Annullato</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Storico Movimenti</CardTitle>
          <CardDescription>
            {filteredMovements.length} di {movements.length} movimenti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origine</TableHead>
                  <TableHead>Articolo</TableHead>
                  <TableHead className="text-right">Quantità</TableHead>
                  <TableHead>Deposito</TableHead>
                  <TableHead>Controparte</TableHead>
                  <TableHead>Commessa</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nessun movimento trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const typeInfo = getMovementTypeInfo(movement.movement_type);
                    const TypeIcon = typeInfo.icon;
                    const statusInfo = statusConfig[movement.status];
                    
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {format(new Date(movement.movement_date), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`gap-1 ${typeInfo.bgColor}`}>
                            <TypeIcon className="h-3 w-3" />
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{movement.origin_type}</span>
                            {movement.ddts?.ddt_number && (
                              <span className="text-xs text-muted-foreground">
                                ({movement.ddts.ddt_number})
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate" title={movement.item_description}>
                            {movement.item_description}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={movement.movement_type === "carico" ? "text-green-600" : "text-red-600"}>
                            {movement.movement_type === "carico" ? "+" : "-"}{movement.quantity} {movement.unit}
                          </span>
                        </TableCell>
                        <TableCell>{movement.warehouse}</TableCell>
                        <TableCell>
                          {movement.customers?.name || movement.suppliers?.name || "-"}
                        </TableCell>
                        <TableCell>
                          {movement.work_orders?.number || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {movement.status === "proposto" && (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(movement)}
                                title="Modifica"
                              >
                                <Pencil className="h-4 w-4 text-blue-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleConfirmClick(movement)}
                                disabled={confirmMutation.isPending || processingMaterialAction}
                                title="Conferma"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => excludeMutation.mutate(movement.id)}
                                disabled={excludeMutation.isPending}
                                title="Escludi (non influisce sulle scorte)"
                              >
                                <Ban className="h-4 w-4 text-slate-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelMutation.mutate(movement.id)}
                                disabled={cancelMutation.isPending}
                                title="Annulla"
                              >
                                <X className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ManualMovementDialog 
        open={caricoDialogOpen} 
        onOpenChange={setCaricoDialogOpen} 
        movementType="carico" 
      />
      <ManualMovementDialog 
        open={scaricoDialogOpen} 
        onOpenChange={setScaricoDialogOpen} 
        movementType="scarico" 
      />
      <EditMovementDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        movement={selectedMovement}
      />
      
      <SimilarMaterialDialog
        open={similarMaterialDialogOpen}
        onOpenChange={setSimilarMaterialDialogOpen}
        newName={pendingMovementDescription}
        matches={similarMaterialMatches}
        onAction={handleSimilarMaterialAction}
        isLoading={processingMaterialAction}
      />
    </div>
  );
}
