import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Package, TrendingUp, TrendingDown, AlertTriangle, Loader2, ChevronDown, ChevronRight, Building2, Filter, ClipboardCheck, ClipboardList, Settings, Eye, EyeOff, Box, MapPin, Euro, Layers, Droplets, Wrench, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ManualMovementDialog } from "@/components/warehouse/ManualMovementDialog";
import { InventoryDialog } from "@/components/warehouse/InventoryDialog";
import { WarehouseCategorySettings } from "@/components/warehouse/WarehouseCategorySettings";
import { ProductCategorySettings } from "@/components/warehouse/ProductCategorySettings";
import { InventoryLogDialog } from "@/components/warehouse/InventoryLogDialog";
import { ProductMovementDialog } from "@/components/warehouse/ProductMovementDialog";
import { MaterialDetailDialog } from "@/components/warehouse/MaterialDetailDialog";
import { ProductDetailDialog } from "@/components/warehouse/ProductDetailDialog";
import { AddMaterialDialog } from "@/components/warehouse/AddMaterialDialog";
import { AddProductDialog } from "@/components/warehouse/AddProductDialog";
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
  last_inventory_date?: string | null;
  warehouse_category_id?: string | null;
  warehouse_subcategory_id?: string | null;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
  show_in_warehouse: boolean;
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

function MaterialRow({ m, getStockBadge, onClick }: { m: Material; getStockBadge: (m: Material) => React.ReactNode; onClick: () => void }) {
  return (
    <div className="bg-card rounded-lg p-2.5 shadow-sm border border-border flex items-center gap-2.5 cursor-pointer hover:bg-muted/50 transition-colors" onClick={onClick}>
      <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${m.current_stock <= m.minimum_stock ? "bg-destructive/10" : "bg-green-50"}`}>
        <Package className={`h-4 w-4 ${m.current_stock <= m.minimum_stock ? "text-destructive" : "text-green-500"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[13px] truncate">{m.name}</p>
        <p className="text-[11px] text-muted-foreground">{m.code}</p>
        {m.last_inventory_date && (
          <p className="text-[10px] text-primary">
            Inventario: {format(new Date(m.last_inventory_date), "dd/MM/yy", { locale: it })}
          </p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-bold text-[13px]">{m.current_stock} <span className="text-[11px] font-normal text-muted-foreground">{m.unit}</span></p>
        {getStockBadge(m)}
      </div>
    </div>
  );
}

function ProductCard({ p, onAssign, onClick, categories }: { p: any; onAssign: () => void; onClick: () => void; categories: any[] }) {
  const isLow = p.current_stock <= (p.minimum_stock || 0) && p.current_stock > 0;
  const isOut = p.current_stock <= 0;
  return (
    <div className="bg-card rounded-xl p-3 shadow-sm border border-border cursor-pointer hover:bg-muted/50 transition-colors" onClick={onClick}>
      <div className="flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOut ? "bg-destructive/10" : isLow ? "bg-amber-50" : "bg-primary/10"}`}>
          <Box className={`h-4 w-4 ${isOut ? "text-destructive" : isLow ? "text-amber-500" : "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[13px] truncate">{p.name}</p>
          <p className="text-[11px] text-muted-foreground">{p.code}</p>
          {p.warehouse_location && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" /> {p.warehouse_location}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 space-y-0.5">
          <p className="font-bold text-[13px]">{p.current_stock} <span className="text-[11px] font-normal text-muted-foreground">{p.unit_of_measure || "pz"}</span></p>
          {isOut ? (
            <Badge variant="destructive" className="text-[10px] px-1.5">Esaurito</Badge>
          ) : isLow ? (
            <Badge variant="destructive" className="text-[10px] px-1.5">Sotto scorta</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 text-green-700 border-green-300">OK</Badge>
          )}
          {(p.sale_price || 0) > 0 && (
            <p className="text-[10px] text-muted-foreground flex items-center justify-end gap-0.5">
              <Euro className="h-2.5 w-2.5" /> {Number(p.sale_price).toLocaleString("it-IT")}
            </p>
          )}
        </div>
        {categories.length > 0 && !p.product_category_id && (
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => { e.stopPropagation(); onAssign(); }} title="Assegna categoria">
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}

function AssignProductForm({ productId, categories, subcategories, onDone }: {
  productId: string;
  categories: { id: string; name: string; sort_order: number }[];
  subcategories: { id: string; category_id: string; name: string; sort_order: number }[];
  onDone: () => void;
}) {
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedSub, setSelectedSub] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const filteredSubs = subcategories.filter(s => s.category_id === selectedCat);

  const handleSave = async () => {
    if (!selectedCat) return;
    setSaving(true);
    const { error } = await supabase.from("products").update({
      product_category_id: selectedCat,
      product_subcategory_id: selectedSub || null,
    }).eq("id", productId);
    setSaving(false);
    if (error) { toast({ title: "Errore", variant: "destructive" }); return; }
    toast({ title: "Categoria assegnata" });
    onDone();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Categoria *</Label>
        <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setSelectedSub(""); }}>
          <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filteredSubs.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Sottocategoria</Label>
          <Select value={selectedSub} onValueChange={setSelectedSub}>
            <SelectTrigger><SelectValue placeholder="Opzionale" /></SelectTrigger>
            <SelectContent>
              {filteredSubs.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onDone} disabled={saving}>Annulla</Button>
        <Button onClick={handleSave} disabled={!selectedCat || saving}>
          {saving ? "Salvataggio..." : "Assegna"}
        </Button>
      </div>
    </div>
  );
}

export default function ZAppMagazzino() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [caricoOpen, setCaricoOpen] = useState(false);
  const [scaricoOpen, setScaricoOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [productCaricoOpen, setProductCaricoOpen] = useState(false);
  const [productScaricoOpen, setProductScaricoOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productSettingsOpen, setProductSettingsOpen] = useState(false);
  const [assigningProduct, setAssigningProduct] = useState<string | null>(null);
  const [expandedProductCats, setExpandedProductCats] = useState<Set<string>>(new Set());
  const [expandedProductSubs, setExpandedProductSubs] = useState<Set<string>>(new Set());
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [addMaterialOpen, setAddMaterialOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  // Fetch all suppliers for settings
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ["zapp-all-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, code, show_in_warehouse")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as Supplier[];
    },
  });

  // Toggle supplier visibility
  const toggleSupplierMutation = useMutation({
    mutationFn: async ({ id, show }: { id: string; show: boolean }) => {
      const { error } = await supabase
        .from("suppliers")
        .update({ show_in_warehouse: show })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapp-all-suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
    },
  });

  // Get enabled supplier IDs
  const enabledSupplierIds = useMemo(() => {
    return new Set(allSuppliers.filter(s => s.show_in_warehouse).map(s => s.id));
  }, [allSuppliers]);

  // Fetch materials with supplier name
  const { data: materials = [], isLoading: loadingMaterials } = useQuery({
    queryKey: ["zapp-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, unit, current_stock, minimum_stock, maximum_stock, category, supplier_id, last_inventory_date, warehouse_category_id, warehouse_subcategory_id, suppliers(name)")
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

  // Fetch warehouse categories
  const { data: warehouseCategories = [] } = useQuery({
    queryKey: ["warehouse-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_categories")
        .select("id, name, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch warehouse subcategories
  const { data: warehouseSubcategories = [] } = useQuery({
    queryKey: ["warehouse-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouse_subcategories")
        .select("id, category_id, name, supplier_id, sort_order, suppliers(name)")
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products (finished goods)
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["zapp-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, unit_of_measure, current_stock, minimum_stock, maximum_stock, production_cost, sale_price, warehouse_location, last_inventory_date, product_category_id, product_subcategory_id")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch product categories
  const { data: productCategories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("product_categories").select("id, name, sort_order").order("sort_order");
      return data || [];
    },
  });

  // Fetch product subcategories
  const { data: productSubcategories = [] } = useQuery({
    queryKey: ["product-subcategories"],
    queryFn: async () => {
      const { data } = await supabase.from("product_subcategories").select("id, category_id, name, sort_order").order("sort_order");
      return data || [];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    const term = productSearch.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)
    );
  }, [products, productSearch]);

  // Group products by category → subcategory
  const groupedProducts = useMemo(() => {
    const groups: Record<string, {
      catId: string;
      subcategories: Record<string, { subId: string; products: typeof filteredProducts }>;
      uncategorized: typeof filteredProducts;
    }> = {};
    const uncategorized: typeof filteredProducts = [];

    for (const p of filteredProducts) {
      const catId = (p as any).product_category_id;
      const subId = (p as any).product_subcategory_id;

      if (!catId) {
        uncategorized.push(p);
        continue;
      }

      const cat = productCategories.find(c => c.id === catId);
      if (!cat) { uncategorized.push(p); continue; }

      if (!groups[cat.name]) {
        groups[cat.name] = { catId: cat.id, subcategories: {}, uncategorized: [] };
      }

      if (subId) {
        const sub = productSubcategories.find(s => s.id === subId);
        const subName = sub?.name || "Generale";
        if (!groups[cat.name].subcategories[subName]) {
          groups[cat.name].subcategories[subName] = { subId: sub?.id || "", products: [] };
        }
        groups[cat.name].subcategories[subName].products.push(p);
      } else {
        groups[cat.name].uncategorized.push(p);
      }
    }

    return { groups, uncategorized };
  }, [filteredProducts, productCategories, productSubcategories]);

  const hasProductCategories = productCategories.length > 0;

  // Build supplier→category map from DB data
  const SUPPLIER_CATEGORY_MAP = useMemo(() => {
    const map: Record<string, { category: string; subcategory: string }> = {};
    for (const sub of warehouseSubcategories) {
      if (sub.supplier_id) {
        const cat = warehouseCategories.find(c => c.id === sub.category_id);
        if (cat) {
          map[sub.supplier_id] = { category: cat.name, subcategory: sub.name };
        }
      }
    }
    return map;
  }, [warehouseCategories, warehouseSubcategories]);

  // Filter materials by enabled suppliers + search + stock filter
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (!m.supplier_id || !enabledSupplierIds.has(m.supplier_id)) return false;
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = stockFilter === "all" ||
        (stockFilter === "low" && m.current_stock <= m.minimum_stock) ||
        (stockFilter === "ok" && m.current_stock > m.minimum_stock && m.current_stock < m.maximum_stock) ||
        (stockFilter === "excess" && m.current_stock >= m.maximum_stock);
      return matchesSearch && matchesFilter;
    });
  }, [materials, searchTerm, stockFilter, enabledSupplierIds]);

  // Group by category → subcategory
  const groupedByCategory = useMemo(() => {
    const categories: Record<string, {
      subcategories: Record<string, { supplierName: string; materials: Material[] }>;
    }> = {};

    for (const m of filteredMaterials) {
      // Priority: direct category assignment > supplier mapping
      let catName = "Altro";
      let subName = m.suppliers?.name || "Generale";

      if (m.warehouse_category_id) {
        const directCat = warehouseCategories.find(c => c.id === m.warehouse_category_id);
        if (directCat) catName = directCat.name;
        if (m.warehouse_subcategory_id) {
          const directSub = warehouseSubcategories.find(s => s.id === m.warehouse_subcategory_id);
          if (directSub) subName = directSub.name;
        }
      } else {
        const mapping = m.supplier_id ? SUPPLIER_CATEGORY_MAP[m.supplier_id] : null;
        if (mapping) {
          catName = mapping.category;
          subName = mapping.subcategory;
        }
      }

      if (!categories[catName]) {
        categories[catName] = { subcategories: {} };
      }
      if (!categories[catName].subcategories[subName]) {
        categories[catName].subcategories[subName] = { supplierName: m.suppliers?.name || "", materials: [] };
      }
      categories[catName].subcategories[subName].materials.push(m);
    }

    const order = ["Materiale di assemblaggio", "Materiale di consumo"];
    return Object.entries(categories).sort(([a], [b]) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [filteredMaterials, warehouseCategories, warehouseSubcategories, SUPPLIER_CATEGORY_MAP]);

  const lowStockCount = filteredMaterials.filter((m) => m.current_stock <= m.minimum_stock).length;

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const toggleSub = (key: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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

  const enabledCount = allSuppliers.filter(s => s.show_in_warehouse).length;

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
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-5 w-5" />
          </Button>
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1 bg-red-500/80 rounded-full px-2.5 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{lowStockCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        <Button onClick={() => setCaricoOpen(true)} className="h-14 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5">
          <TrendingUp className="h-5 w-5" />
          <span className="font-semibold text-xs">Carico</span>
        </Button>
        <Button onClick={() => setScaricoOpen(true)} className="h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5">
          <TrendingDown className="h-5 w-5" />
          <span className="font-semibold text-xs">Scarico</span>
        </Button>
        <Button onClick={() => setInventoryOpen(true)} className="h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm flex items-center justify-center gap-1.5">
          <ClipboardCheck className="h-5 w-5" />
          <span className="font-semibold text-xs">Inventario</span>
        </Button>
        <Button onClick={() => setLogOpen(true)} variant="outline" className="h-14 rounded-xl shadow-sm flex items-center justify-center gap-1.5">
          <ClipboardList className="h-5 w-5" />
          <span className="font-semibold text-xs">Storico</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scorte" className="px-4">
        <TabsList className="w-full grid grid-cols-3 h-10 rounded-xl">
          <TabsTrigger value="scorte" className="rounded-lg text-xs">
            <Package className="h-3.5 w-3.5 mr-1" />
            Materiali
          </TabsTrigger>
          <TabsTrigger value="prodotti" className="rounded-lg text-xs">
            <Box className="h-3.5 w-3.5 mr-1" />
            Prodotti
          </TabsTrigger>
          <TabsTrigger value="movimenti" className="rounded-lg text-xs">
            <TrendingUp className="h-3.5 w-3.5 mr-1" />
            Movimenti
          </TabsTrigger>
        </TabsList>

        {/* Stock Tab */}
        <TabsContent value="scorte" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca materiale..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 rounded-xl bg-white" />
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

          <p className="text-xs text-muted-foreground">
            {filteredMaterials.length} articoli in {groupedByCategory.length} categorie
            {enabledCount === 0 && " · Attiva almeno un fornitore dalle impostazioni ⚙️"}
          </p>

          {loadingMaterials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : enabledCount === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Settings className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground text-sm">Nessun fornitore attivato</p>
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>Configura fornitori</Button>
            </div>
          ) : groupedByCategory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nessun materiale trovato</div>
          ) : (
            <div className="space-y-4">
              {groupedByCategory.map(([catName, catData]) => {
                const allCatMaterials = Object.values(catData.subcategories).flatMap(s => s.materials);
                const catLowStock = allCatMaterials.filter(m => m.current_stock <= m.minimum_stock).length;
                const isCatOpen = expandedCategories.has(catName);
                const catIcon = catName === "Materiale di assemblaggio" ? <Wrench className="h-4 w-4 text-blue-700" /> : <Droplets className="h-4 w-4 text-emerald-700" />;
                const catBg = catName === "Materiale di assemblaggio" ? "bg-blue-100" : "bg-emerald-100";

                return (
                  <div key={catName}>
                    <Collapsible open={isCatOpen} onOpenChange={() => toggleCategory(catName)}>
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center gap-2 bg-card rounded-xl px-3 py-3 shadow-sm border border-border hover:bg-muted/50 transition-colors">
                          <div className={`h-9 w-9 rounded-lg ${catBg} flex items-center justify-center flex-shrink-0`}>
                            {catIcon}
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-bold text-sm">{catName}</p>
                            <p className="text-[11px] text-muted-foreground">{allCatMaterials.length} articoli · {Object.keys(catData.subcategories).length} sottocategorie</p>
                          </div>
                          {catLowStock > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 mr-1">{catLowStock} ⚠</Badge>
                          )}
                          {isCatOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2 mt-2 ml-2 border-l-2 border-border pl-2">
                          {Object.entries(catData.subcategories).map(([subName, subData]) => {
                            const subKey = `${catName}__${subName}`;
                            const isSubOpen = expandedSubs.has(subKey);
                            const subLowStock = subData.materials.filter(m => m.current_stock <= m.minimum_stock).length;

                            // If there's only one subcategory with empty name, show materials directly
                            const showSubHeader = Object.keys(catData.subcategories).length > 1 || subName !== "";

                            if (!showSubHeader) {
                              return (
                                <div key={subKey} className="space-y-1.5">
                                  {subData.materials.map((m) => (
                                    <MaterialRow key={m.id} m={m} getStockBadge={getStockBadge} onClick={() => setSelectedMaterial(m)} />
                                  ))}
                                </div>
                              );
                            }

                            return (
                              <Collapsible key={subKey} open={isSubOpen} onOpenChange={() => toggleSub(subKey)}>
                                <CollapsibleTrigger asChild>
                                  <button className="w-full flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border hover:bg-muted/50 transition-colors">
                                    <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-semibold text-[13px] flex-1 text-left">{subName}</span>
                                    <span className="text-[11px] text-muted-foreground mr-1">{subData.materials.length}</span>
                                    {subLowStock > 0 && <Badge variant="destructive" className="text-[9px] px-1 mr-1">{subLowStock} ⚠</Badge>}
                                    {isSubOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="space-y-1.5 mt-1.5 ml-2 border-l-2 border-muted pl-2">
                                    {subData.materials.map((m) => (
                                      <MaterialRow key={m.id} m={m} getStockBadge={getStockBadge} onClick={() => setSelectedMaterial(m)} />
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="prodotti" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Cerca prodotto..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="pl-9 rounded-xl bg-card" />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setProductSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setProductCaricoOpen(true)} size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs h-9">
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Carico
            </Button>
            <Button onClick={() => setProductScaricoOpen(true)} size="sm" className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs h-9">
              <TrendingDown className="h-3.5 w-3.5 mr-1" /> Scarico
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">{filteredProducts.length} prodotti finiti · {productCategories.length} categorie</p>

          {loadingProducts ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Nessun prodotto trovato</div>
          ) : !hasProductCategories ? (
            // Flat list when no categories exist
            <div className="space-y-2">
              {filteredProducts.map((p) => <ProductCard key={p.id} p={p} onAssign={() => setAssigningProduct(p.id)} onClick={() => setSelectedProduct(p)} categories={productCategories} />)}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Categorized products */}
              {Object.entries(groupedProducts.groups).map(([catName, catData]) => {
                const allProducts = [...catData.uncategorized, ...Object.values(catData.subcategories).flatMap(s => s.products)];
                const isCatOpen = expandedProductCats.has(catName);

                return (
                  <Collapsible key={catName} open={isCatOpen} onOpenChange={() => {
                    setExpandedProductCats(prev => {
                      const n = new Set(prev);
                      n.has(catName) ? n.delete(catName) : n.add(catName);
                      return n;
                    });
                  }}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-2 bg-card rounded-xl px-3 py-3 shadow-sm border border-border hover:bg-muted/50 transition-colors">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Box className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-bold text-sm">{catName}</p>
                          <p className="text-[11px] text-muted-foreground">{allProducts.length} prodotti</p>
                        </div>
                        {isCatOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2 mt-2 ml-2 border-l-2 border-border pl-2">
                        {/* Subcategories */}
                        {Object.entries(catData.subcategories).map(([subName, subData]) => {
                          const subKey = `${catName}__${subName}`;
                          const isSubOpen = expandedProductSubs.has(subKey);

                          return (
                            <Collapsible key={subKey} open={isSubOpen} onOpenChange={() => {
                              setExpandedProductSubs(prev => {
                                const n = new Set(prev);
                                n.has(subKey) ? n.delete(subKey) : n.add(subKey);
                                return n;
                              });
                            }}>
                              <CollapsibleTrigger asChild>
                                <button className="w-full flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-2 border border-border hover:bg-muted/50 transition-colors">
                                  <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-semibold text-[13px] flex-1 text-left">{subName}</span>
                                  <span className="text-[11px] text-muted-foreground mr-1">{subData.products.length}</span>
                                  {isSubOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="space-y-1.5 mt-1.5 ml-2 border-l-2 border-muted pl-2">
                                  {subData.products.map((p) => <ProductCard key={p.id} p={p} onAssign={() => setAssigningProduct(p.id)} onClick={() => setSelectedProduct(p)} categories={productCategories} />)}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                        {/* Uncategorized within category */}
                        {catData.uncategorized.map((p) => <ProductCard key={p.id} p={p} onAssign={() => setAssigningProduct(p.id)} onClick={() => setSelectedProduct(p)} categories={productCategories} />)}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}

              {/* Uncategorized products */}
              {groupedProducts.uncategorized.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left px-1 py-1 hover:bg-muted/50 rounded">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                    <span className="text-xs font-semibold text-muted-foreground">Senza categoria ({groupedProducts.uncategorized.length})</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 mt-1.5">
                      {groupedProducts.uncategorized.map((p) => <ProductCard key={p.id} p={p} onAssign={() => setAssigningProduct(p.id)} onClick={() => setSelectedProduct(p)} categories={productCategories} />)}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
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
            <div className="text-center py-12 text-muted-foreground text-sm">Nessun movimento registrato</div>
          ) : (
            movements.map((mov) => (
              <div key={mov.id} className="bg-white rounded-xl p-3 shadow-sm border border-border">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${mov.movement_type === "carico" ? "bg-green-100" : "bg-red-100"}`}>
                    {mov.movement_type === "carico" ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{mov.item_description}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(mov.created_at), "dd MMM yyyy HH:mm", { locale: it })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${mov.movement_type === "carico" ? "text-green-600" : "text-red-600"}`}>
                      {mov.movement_type === "carico" ? "+" : "-"}{mov.quantity} {mov.unit}
                    </p>
                    {getStatusBadge(mov.status)}
                  </div>
                </div>
                {mov.notes && <p className="text-xs text-muted-foreground mt-2 pl-12 truncate">{mov.notes}</p>}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Category Settings Dialog */}
      <WarehouseCategorySettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        categories={warehouseCategories}
        subcategories={warehouseSubcategories as any}
        suppliers={allSuppliers.map(s => ({ id: s.id, name: s.name }))}
      />

      {/* Product Category Settings */}
      <ProductCategorySettings
        open={productSettingsOpen}
        onOpenChange={setProductSettingsOpen}
        categories={productCategories}
        subcategories={productSubcategories}
      />

      {/* Assign Product to Category Dialog */}
      {assigningProduct && (
        <Dialog open={!!assigningProduct} onOpenChange={() => setAssigningProduct(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Assegna Categoria</DialogTitle>
              <DialogDescription>Seleziona categoria e sottocategoria per questo prodotto</DialogDescription>
            </DialogHeader>
            <AssignProductForm
              productId={assigningProduct}
              categories={productCategories}
              subcategories={productSubcategories}
              onDone={() => {
                setAssigningProduct(null);
                queryClient.invalidateQueries({ queryKey: ["zapp-products"] });
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogs */}
      <ManualMovementDialog open={caricoOpen} onOpenChange={setCaricoOpen} movementType="carico" />
      <ManualMovementDialog open={scaricoOpen} onOpenChange={setScaricoOpen} movementType="scarico" />
      <InventoryDialog open={inventoryOpen} onOpenChange={setInventoryOpen} materials={filteredMaterials} />
      <InventoryLogDialog open={logOpen} onOpenChange={setLogOpen} />
      <ProductMovementDialog open={productCaricoOpen} onOpenChange={setProductCaricoOpen} movementType="carico" products={products.map(p => ({ id: p.id, code: p.code, name: p.name, unit_of_measure: p.unit_of_measure, current_stock: Number(p.current_stock) }))} />
      <ProductMovementDialog open={productScaricoOpen} onOpenChange={setProductScaricoOpen} movementType="scarico" products={products.map(p => ({ id: p.id, code: p.code, name: p.name, unit_of_measure: p.unit_of_measure, current_stock: Number(p.current_stock) }))} />
      <MaterialDetailDialog
        open={!!selectedMaterial}
        onOpenChange={(open) => !open && setSelectedMaterial(null)}
        material={selectedMaterial}
        warehouseCategories={warehouseCategories}
        warehouseSubcategories={warehouseSubcategories as any}
      />
      <ProductDetailDialog
        open={!!selectedProduct}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
        product={selectedProduct}
        categories={productCategories}
        subcategories={productSubcategories}
      />
    </div>
  );
}
