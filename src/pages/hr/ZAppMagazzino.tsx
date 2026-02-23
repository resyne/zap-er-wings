import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package, TrendingUp, TrendingDown, AlertTriangle, Loader2, ChevronDown, ChevronRight, Building2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ManualMovementDialog } from "@/components/warehouse/ManualMovementDialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  category?: string;
  supplier_id?: string;
  suppliers?: { name: string } | null;
}

interface StockMovement {
  id: string;
  movement_date: string;
  movement_type: "carico" | "scarico";
  origin_type: string;
  item_description: string;
  quantity: number;
  unit: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function ZAppMagazzino() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [caricoOpen, setCaricoOpen] = useState(false);
  const [scaricoOpen, setScaricoOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set(["__all__"]));

  // Fetch materials with supplier name
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ["zapp-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, unit, current_stock, minimum_stock, maximum_stock, category, supplier_id, suppliers(name)")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Material[];
    },
  });

  // Fetch recent movements by current user
  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["zapp-movements"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, movement_date, movement_type, origin_type, item_description, quantity, unit, status, notes, created_at")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as StockMovement[];
    },
  });

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = stockFilter === "all" ||
        (stockFilter === "low" && m.current_stock <= m.minimum_stock) ||
        (stockFilter === "ok" && m.current_stock > m.minimum_stock && m.current_stock < m.maximum_stock) ||
        (stockFilter === "excess" && m.current_stock >= m.maximum_stock);
      return matchesSearch && matchesFilter;
    });
  }, [materials, searchTerm, stockFilter]);

  // Group by supplier
  const groupedBySupplier = useMemo(() => {
    const groups: Record<string, { supplierName: string; materials: Material[] }> = {};
    for (const m of filteredMaterials) {
      const key = m.supplier_id || "__no_supplier__";
      const supplierName = m.suppliers?.name || "Senza fornitore";
      if (!groups[key]) {
        groups[key] = { supplierName, materials: [] };
      }
      groups[key].materials.push(m);
    }
    // Sort groups: named suppliers first alphabetically, "Senza fornitore" last
    return Object.entries(groups).sort(([keyA, a], [keyB, b]) => {
      if (keyA === "__no_supplier__") return 1;
      if (keyB === "__no_supplier__") return -1;
      return a.supplierName.localeCompare(b.supplierName);
    });
  }, [filteredMaterials]);

  const lowStockCount = materials.filter((m) => m.current_stock <= m.minimum_stock).length;

  const toggleSupplier = (key: string) => {
    setExpandedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Expand all on first load
  const isAllExpanded = expandedSuppliers.has("__all__");
  const isExpanded = (key: string) => isAllExpanded || expandedSuppliers.has(key);

  const getStockBadge = (m: Material) => {
    if (m.current_stock <= 0) return <Badge variant="destructive" className="text-[10px] px-1.5">Esaurito</Badge>;
    if (m.current_stock <= m.minimum_stock) return <Badge variant="destructive" className="text-[10px] px-1.5">Sotto scorta</Badge>;
    if (m.current_stock >= m.maximum_stock) return <Badge variant="secondary" className="text-[10px] px-1.5">Eccesso</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 text-green-700 border-green-300">OK</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "proposto": return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Proposto</Badge>;
      case "confermato": return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Confermato</Badge>;
      case "annullato": return <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px]">Annullato</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-amber-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Magazzino</h1>
            <p className="text-amber-100 text-xs">Scorte e movimenti</p>
          </div>
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1 bg-red-500/80 rounded-full px-2.5 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{lowStockCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 grid grid-cols-2 gap-3">
        <Button
          onClick={() => setCaricoOpen(true)}
          className="h-14 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm flex items-center justify-center gap-2"
        >
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold text-sm">Carico</span>
        </Button>
        <Button
          onClick={() => setScaricoOpen(true)}
          className="h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm flex items-center justify-center gap-2"
        >
          <TrendingDown className="h-5 w-5" />
          <span className="font-semibold text-sm">Scarico</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scorte" className="px-4">
        <TabsList className="w-full grid grid-cols-2 h-10 rounded-xl">
          <TabsTrigger value="scorte" className="rounded-lg text-sm">
            <Package className="h-4 w-4 mr-1.5" />
            Scorte
          </TabsTrigger>
          <TabsTrigger value="movimenti" className="rounded-lg text-sm">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            I miei movimenti
          </TabsTrigger>
        </TabsList>

        {/* Stock Tab */}
        <TabsContent value="scorte" className="mt-3 space-y-3">
          {/* Search + Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca materiale..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl bg-white"
              />
            </div>
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[110px] rounded-xl bg-white">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="low">Sotto scorta</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="excess">Eccesso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Count */}
          <p className="text-xs text-muted-foreground">
            {filteredMaterials.length} articoli in {groupedBySupplier.length} fornitori
          </p>

          {loadingMaterials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groupedBySupplier.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nessun materiale trovato
            </div>
          ) : (
            <div className="space-y-3">
              {groupedBySupplier.map(([key, group]) => {
                const groupLowStock = group.materials.filter((m) => m.current_stock <= m.minimum_stock).length;
                return (
                  <Collapsible
                    key={key}
                    open={isExpanded(key)}
                    onOpenChange={() => {
                      // If first interaction, remove __all__ flag
                      if (isAllExpanded) {
                        const allKeys = new Set(groupedBySupplier.map(([k]) => k));
                        allKeys.delete(key); // toggle this one off
                        setExpandedSuppliers(allKeys);
                      } else {
                        toggleSupplier(key);
                      }
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm border border-border hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-amber-700" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-semibold text-sm truncate">{group.supplierName}</p>
                          <p className="text-[11px] text-muted-foreground">{group.materials.length} articoli</p>
                        </div>
                        {groupLowStock > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 mr-1">{groupLowStock} ⚠</Badge>
                        )}
                        {isExpanded(key) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-1.5 mt-1.5 ml-2 border-l-2 border-amber-200 pl-2">
                        {group.materials.map((m) => (
                          <div
                            key={m.id}
                            className="bg-white rounded-lg p-2.5 shadow-sm border border-border flex items-center gap-2.5"
                          >
                            <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${
                              m.current_stock <= m.minimum_stock ? "bg-red-50" : "bg-green-50"
                            }`}>
                              <Package className={`h-4 w-4 ${
                                m.current_stock <= m.minimum_stock ? "text-red-500" : "text-green-500"
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-[13px] truncate">{m.name}</p>
                              <p className="text-[11px] text-muted-foreground">{m.code}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-[13px]">{m.current_stock} <span className="text-[11px] font-normal text-muted-foreground">{m.unit}</span></p>
                              {getStockBadge(m)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Movements Tab */}
        <TabsContent value="movimenti" className="mt-3 space-y-2">
          {loadingMovements ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nessun movimento registrato
            </div>
          ) : (
            movements.map((mov) => (
              <div key={mov.id} className="bg-white rounded-xl p-3 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    mov.movement_type === "carico" ? "bg-green-100" : "bg-red-100"
                  }`}>
                    {mov.movement_type === "carico" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{mov.item_description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(mov.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${mov.movement_type === "carico" ? "text-green-600" : "text-red-600"}`}>
                      {mov.movement_type === "carico" ? "+" : "-"}{mov.quantity} {mov.unit}
                    </p>
                    {getStatusBadge(mov.status)}
                  </div>
                </div>
                {mov.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pl-12 truncate">{mov.notes}</p>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ManualMovementDialog open={caricoOpen} onOpenChange={setCaricoOpen} movementType="carico" />
      <ManualMovementDialog open={scaricoOpen} onOpenChange={setScaricoOpen} movementType="scarico" />
    </div>
  );
}
