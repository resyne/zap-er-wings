import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, Copy, Trash2, Wrench, Factory, Package, Component, Layers, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BOM {
  id: string;
  name: string;
  version: string;
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  component_count: number;
  level: number;
  machinery_model?: string;
  material_id?: string;
  children?: BOM[];
  material?: {
    id: string;
    name: string;
    code: string;
    current_stock: number;
    unit: string;
    cost?: number;
  };
  totalCost?: number;
  bom_inclusions?: BOMInclusion[];
}

interface Machinery {
  id: string;
  name: string;
  model: string;
  description?: string;
  created_at: string;
  boms: BOM[];
}


interface BOMInclusion {
  id: string;
  parent_bom_id?: string;
  included_bom_id: string;
  quantity: number;
  notes?: string;
  included_bom: any; // Simplified to avoid deep nesting issues
}

interface IncludableBOM {
  id: string;
  name: string;
  version: string;
  selected: boolean;
  quantity: number;
}

interface Material {
  id: string;
  name: string;
  code: string;
  current_stock: number;
  unit: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

const levelLabels = {
  0: "Machinery Models",
  1: "Parent Groups", 
  2: "Child Elements",
  3: "Accessories"
};

const levelIcons = {
  0: Factory,
  1: Package,
  2: Component,
  3: Wrench
};

export default function BomPage() {
  const [boms, setBoms] = useState<BOM[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState<BOM | null>(null);
  const [viewingBom, setViewingBom] = useState<BOM | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<number>(0);
  const [activeTab, setActiveTab] = useState("0");
  const [includableBoms, setIncludableBoms] = useState<IncludableBOM[]>([]);
  const [bomInclusions, setBomInclusions] = useState<BOMInclusion[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [bomDetails, setBomDetails] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    version: "",
    description: "",
    notes: "",
    level: 0,
    machinery_model: "",
    material_id: ""
  });

  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);

  const [machineryFormData, setMachineryFormData] = useState({
    name: "",
    model: "",
    description: ""
  });

  const resetForm = () => {
    setFormData({
      name: "",
      version: "",
      description: "",
      notes: "",
      level: 0,
      machinery_model: "",
      material_id: ""
    });
    setSelectedLevel(0);
    setSelectedSupplierId("all");
    setIncludableBoms([]);
  };

  useEffect(() => {
    fetchBoms();
    fetchMaterials();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedLevel < 2) {
      fetchIncludableBoms();
    }
  }, [selectedLevel]);

  useEffect(() => {
    fetchMaterials();
  }, [selectedSupplierId]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchMaterials = async () => {
    try {
      let query = supabase
        .from('materials')
        .select('id, name, code, current_stock, unit')
        .eq('active', true);

      // Filter by supplier if selected
      if (selectedSupplierId && selectedSupplierId !== 'all') {
        query = query.eq('supplier_id', selectedSupplierId);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      setMaterials(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateBomCost = (bom: any): number => {
    let totalCost = 0;

    // Level 2: Direct material cost
    if (bom.level === 2 && bom.material?.cost) {
      totalCost = Number(bom.material.cost);
    }

    // Level 0 and 1: Sum costs from included BOMs
    if (bom.bom_inclusions && bom.bom_inclusions.length > 0) {
      bom.bom_inclusions.forEach((inclusion: any) => {
        const includedBomCost = calculateBomCost(inclusion.included_bom);
        const quantity = Number(inclusion.quantity) || 1;
        totalCost += includedBomCost * quantity;
      });
    }

    return totalCost;
  };

  const fetchBoms = async () => {
    try {
      const { data, error } = await supabase
        .from('boms')
        .select(`
          *,
          bom_items(count),
          material:materials(id, name, code, current_stock, unit, cost),
          bom_inclusions!parent_bom_id(
            id,
            included_bom_id,
            quantity,
            notes,
            included_bom:boms!included_bom_id(
              *,
              material:materials(id, name, code, current_stock, unit, cost),
              bom_inclusions!parent_bom_id(
                id,
                included_bom_id,
                quantity,
                notes,
                included_bom:boms!included_bom_id(
                  *,
                  material:materials(id, name, code, current_stock, unit, cost)
                )
              )
            )
          )
        `)
        .order('level', { ascending: true })
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const bomsWithCount = data?.map((bom: any) => ({
        ...bom,
        component_count: Array.isArray(bom.bom_items) ? bom.bom_items.length : 0,
        totalCost: calculateBomCost(bom)
      })) || [];

      setBoms(bomsWithCount);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const fetchIncludableBoms = async () => {
    try {
      const targetLevel = selectedLevel + 1;
      
      if (targetLevel > 2) {
        setIncludableBoms([]);
        return;
      }

      const { data, error } = await supabase
        .from('boms')
        .select('id, name, version, machinery_model')
        .eq('level', targetLevel)
        .order('name');

      if (error) throw error;
      
      const includableBoms = data?.map(bom => ({
        ...bom,
        selected: false,
        quantity: 1
      })) || [];
      
      setIncludableBoms(includableBoms);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchBomDetails = async (bomId: string) => {
    try {
      const { data, error } = await supabase
        .from('boms')
        .select(`
          *,
          material:materials(id, name, code, current_stock, unit),
          bom_items(
            id,
            item_id,
            quantity,
            item:items(id, name, code, type, unit)
          ),
          bom_inclusions!parent_bom_id(
            id,
            included_bom_id,
            quantity,
            notes,
            included_bom:boms!included_bom_id(
              id,
              name,
              version,
              level,
              material:materials(id, name, code, current_stock, unit)
            )
          )
        `)
        .eq('id', bomId)
        .single();

      if (error) throw error;
      setBomDetails(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleView = async (bom: BOM) => {
    setViewingBom(bom);
    await fetchBomDetails(bom.id);
    setIsViewDialogOpen(true);
  };

  const handleMachinerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // This function is no longer needed since Level 0 = Machinery
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        level: selectedLevel,
        machinery_model: selectedLevel === 0 ? formData.machinery_model : null,
        material_id: selectedLevel === 2 && formData.material_id ? formData.material_id : null
      };

      let bomId: string;

      if (selectedBom) {
        // Update
        const { error } = await supabase
          .from('boms')
          .update(submitData)
          .eq('id', selectedBom.id);

        if (error) throw error;
        bomId = selectedBom.id;

        toast({
          title: "Success",
          description: "BOM updated successfully",
        });
      } else {
        // Create
        const { data, error } = await supabase
          .from('boms')
          .insert([submitData])
          .select()
          .single();

        if (error) throw error;
        bomId = data.id;

        toast({
          title: "Success",
          description: "BOM created successfully",
        });
      }

      // Handle BOM inclusions (solo per Level 0 e 1 che possono includere livelli inferiori)
      if (selectedLevel < 2) {
        // Delete existing inclusions if updating
        if (selectedBom) {
          await supabase
            .from('bom_inclusions')
            .delete()
            .eq('parent_bom_id', bomId);
        }

        // Insert new inclusions
        const selectedInclusions = includableBoms
          .filter(bom => bom.selected)
          .map(bom => ({
            parent_bom_id: bomId,
            included_bom_id: bom.id,
            quantity: bom.quantity
          }));

        if (selectedInclusions.length > 0) {
          const { error: inclusionError } = await supabase
            .from('bom_inclusions')
            .insert(selectedInclusions);

          if (inclusionError) throw inclusionError;
        }
      }

      setIsDialogOpen(false);
      setSelectedBom(null);
      resetForm();
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = async (bom: BOM) => {
    setSelectedBom(bom);
    setSelectedLevel(bom.level);
    setFormData({
      name: bom.name,
      version: bom.version,
      description: bom.description || "",
      notes: bom.notes || "",
      level: bom.level,
      machinery_model: bom.machinery_model || "",
      material_id: bom.material_id || ""
    });

    // Fetch existing inclusions for this BOM (per Level 0 e 1)
    if (bom.level < 2) {
      try {
        const { data: inclusions, error } = await supabase
          .from('bom_inclusions')
          .select(`
            included_bom_id,
            quantity,
            included_bom:boms!included_bom_id(id, name, version)
          `)
          .eq('parent_bom_id', bom.id);

        if (error) throw error;

        // Fetch all available BOMs for the next level (children)
        const targetLevel = bom.level + 1;
        const { data: availableBoms, error: bomError } = await supabase
          .from('boms')
          .select('id, name, version')
          .eq('level', targetLevel)
          .order('name');

        if (bomError) throw bomError;

        const includableBoms = availableBoms?.map(availableBom => {
          const existing = inclusions?.find(inc => inc.included_bom_id === availableBom.id);
          return {
            ...availableBom,
            selected: !!existing,
            quantity: existing?.quantity || 1
          };
        }) || [];

        setIncludableBoms(includableBoms);
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
    }

    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this BOM? This will remove it and its inclusions, but not the included BOMs.")) return;

    try {
      // Check if this BOM is used in any work orders
      const { data: workOrders, error: checkError } = await supabase
        .from('work_orders')
        .select('id, number')
        .eq('bom_id', id)
        .limit(1);

      if (checkError) throw checkError;

      if (workOrders && workOrders.length > 0) {
        toast({
          title: "Cannot Delete BOM",
          description: "This BOM is being used by one or more work orders. Please remove or update those work orders first.",
          variant: "destructive",
        });
        return;
      }

      // First, delete all inclusions where this BOM is the parent
      const { error: inclusionsError } = await supabase
        .from('bom_inclusions')
        .delete()
        .eq('parent_bom_id', id);

      if (inclusionsError) throw inclusionsError;

      // Then delete the BOM itself
      const { error } = await supabase
        .from('boms')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "BOM deleted successfully",
      });
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleInclusionToggle = (bomId: string, checked: boolean) => {
    setIncludableBoms(prev => 
      prev.map(bom => 
        bom.id === bomId ? { ...bom, selected: checked } : bom
      )
    );
  };

  const handleQuantityChange = (bomId: string, quantity: number) => {
    setIncludableBoms(prev => 
      prev.map(bom => 
        bom.id === bomId ? { ...bom, quantity: Math.max(1, quantity) } : bom
      )
    );
  };

  const filteredBoms = boms.filter(bom =>
    bom.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bom.version.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bom.machinery_model && bom.machinery_model.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedBoms = filteredBoms.reduce((acc, bom) => {
    if (!acc[bom.level]) acc[bom.level] = [];
    acc[bom.level].push(bom);
    return acc;
  }, {} as Record<number, BOM[]>);

  const getLevelBadgeVariant = (level: number) => {
    switch (level) {
      case 0: return "default";
      case 1: return "secondary";
      case 2: return "outline";
      case 3: return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/mfg">Production</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>BOMs</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hierarchical Bill of Materials</h1>
          <p className="text-muted-foreground">
            Manage machinery models, parent groups, and child elements with automatic warehouse integration
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setSelectedBom(null); resetForm(); }}>
              <Plus className="mr-2 h-4 w-4" />
              New BOM
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedBom ? "Edit BOM" : "Create New BOM"}</DialogTitle>
              <DialogDescription>
                {selectedBom ? "Update the BOM details below." : "Add a new hierarchical bill of materials to your system."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="level">Level *</Label>
                <Select 
                  value={selectedLevel.toString()} 
                  onValueChange={(value) => setSelectedLevel(parseInt(value))}
                  disabled={!!selectedBom}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select BOM level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Level 0 - Machinery Model</SelectItem>
                    <SelectItem value="1">Level 1 - Parent Group</SelectItem>
                    <SelectItem value="2">Level 2 - Child Element</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedLevel === 1 && (
                <div className="space-y-2">
                  <Label>Questo Level 1 BOM fa parte di:</Label>
                  <p className="text-sm text-muted-foreground">
                    Verrà collegato tramite le Inclusions BOMs di Level 0
                  </p>
                </div>
              )}

              {selectedLevel === 0 && (
                <div className="space-y-2">
                  <Label htmlFor="machinery_model">Machinery Model *</Label>
                  <Input
                    id="machinery_model"
                    value={formData.machinery_model}
                    onChange={(e) => setFormData(prev => ({ ...prev, machinery_model: e.target.value }))}
                    placeholder="Enter machinery model name"
                    required={selectedLevel === 0}
                  />
                </div>
              )}

              {selectedLevel === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier_filter">Filter by Supplier (optional)</Label>
                    <Select 
                      value={selectedSupplierId} 
                      onValueChange={setSelectedSupplierId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All suppliers" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md max-h-[300px] overflow-y-auto z-50">
                        <SelectItem value="all">All suppliers</SelectItem>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="material_id">Warehouse Material</Label>
                    <Select 
                      value={formData.material_id} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, material_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Connect to warehouse material (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-md max-h-[300px] overflow-y-auto z-50">
                        {materials.map((material) => (
                          <SelectItem key={material.id} value={material.id}>
                            {material.name} ({material.code}) - Stock: {material.current_stock} {material.unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {selectedSupplierId && selectedSupplierId !== 'all' ? 
                        `Showing materials from selected supplier (${materials.length} items)` :
                        `Showing all materials (${materials.length} items)`
                      }
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter BOM name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version *</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="e.g., v1.0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione dell'elemento per selezione offerte"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this BOM"
                />
              </div>

              {selectedLevel < 3 && includableBoms.length > 0 && (
                <div className="space-y-2">
                  <Label>Include BOMs di Level {selectedLevel + 1} (che fanno parte di questo BOM)</Label>
                  <p className="text-xs text-muted-foreground">
                    Seleziona i BOM di livello inferiore che sono inclusi in questo BOM
                  </p>
                  <div className="border rounded-md p-4 max-h-40 overflow-y-auto space-y-2">
                    {includableBoms.map((bom) => (
                      <div key={bom.id} className="flex items-center justify-between space-x-2">
                        <div className="flex items-center space-x-2 flex-1">
                          <Checkbox
                            checked={bom.selected}
                            onCheckedChange={(checked) => handleInclusionToggle(bom.id, checked as boolean)}
                          />
                          <span className="text-sm">{bom.name} ({bom.version})</span>
                        </div>
                        {bom.selected && (
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs">Qty:</Label>
                            <Input
                              type="number"
                              min="1"
                              value={bom.quantity}
                              onChange={(e) => handleQuantityChange(bom.id, parseInt(e.target.value) || 1)}
                              className="w-16 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedBom ? "Update" : "Create"} BOM
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* BOM View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Package2 className="h-5 w-5" />
              <span>BOM Details: {viewingBom?.name}</span>
            </DialogTitle>
            <DialogDescription>
              View all components and inclusions for this BOM
            </DialogDescription>
          </DialogHeader>
          
          {bomDetails && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{bomDetails.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Version</Label>
                  <p className="text-sm text-muted-foreground">{bomDetails.version}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Level</Label>
                  <Badge variant={getLevelBadgeVariant(bomDetails.level)}>
                    Level {bomDetails.level}
                  </Badge>
                </div>
                {bomDetails.machinery_model && (
                  <div>
                    <Label className="text-sm font-medium">Machinery Model</Label>
                    <p className="text-sm text-muted-foreground">{bomDetails.machinery_model}</p>
                  </div>
                )}
                 {bomDetails.material && (
                   <div className="col-span-2">
                     <Label className="text-sm font-medium">Warehouse Material</Label>
                     <div className="flex items-center space-x-2 mt-1">
                       <Badge variant="secondary">
                         {bomDetails.material.name} ({bomDetails.material.code})
                       </Badge>
                       <span className="text-sm text-muted-foreground">
                         Stock: {bomDetails.material.current_stock} {bomDetails.material.unit}
                       </span>
                       {bomDetails.material.cost && (
                         <span className="font-medium text-green-600">
                           €{Number(bomDetails.material.cost).toFixed(2)}
                         </span>
                       )}
                     </div>
                   </div>
                 )}
                 <div>
                   <Label className="text-sm font-medium">Total BOM Cost</Label>
                   <div className="mt-1">
                     {(() => {
                       const totalCost = calculateBomCost(bomDetails);
                       return totalCost > 0 ? (
                         <span className="text-lg font-bold text-green-600">
                           €{totalCost.toFixed(2)}
                         </span>
                       ) : (
                         <span className="text-muted-foreground">Not calculated</span>
                       );
                     })()}
                   </div>
                 </div>
               </div>

              {/* BOM Inclusions */}
              {bomDetails.bom_inclusions && bomDetails.bom_inclusions.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Included BOMs</Label>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bomDetails.bom_inclusions.map((inclusion: any) => (
                          <TableRow key={inclusion.id}>
                            <TableCell>{inclusion.included_bom.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{inclusion.included_bom.version}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getLevelBadgeVariant(inclusion.included_bom.level)}>
                                L{inclusion.included_bom.level}
                              </Badge>
                            </TableCell>
                            <TableCell>{inclusion.quantity}</TableCell>
                             <TableCell>
                               {inclusion.included_bom.material ? (
                                 <div className="flex flex-col">
                                   <span className="text-sm font-medium">
                                     {inclusion.included_bom.material.name}
                                   </span>
                                   <span className="text-xs text-muted-foreground">
                                     Stock: {inclusion.included_bom.material.current_stock} {inclusion.included_bom.material.unit}
                                   </span>
                                 </div>
                               ) : (
                                 <span className="text-muted-foreground">-</span>
                               )}
                             </TableCell>
                             <TableCell>
                               {inclusion.included_bom.material?.cost ? (
                                 <span className="font-medium text-green-600">
                                   €{(Number(inclusion.included_bom.material.cost) * inclusion.quantity).toFixed(2)}
                                 </span>
                               ) : (
                                 <span className="text-muted-foreground">-</span>
                               )}
                             </TableCell>
                           </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Items */}
              {bomDetails.bom_items && bomDetails.bom_items.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Direct Items</Label>
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Code</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bomDetails.bom_items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.item.name}</TableCell>
                            <TableCell>{item.item.code}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.item.type}</Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{item.item.unit}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {bomDetails.notes && (
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <p className="text-sm text-muted-foreground mt-1">{bomDetails.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((level) => {
          const Icon = levelIcons[level as keyof typeof levelIcons];
          const count = groupedBoms[level]?.length || 0;
          return (
            <Card key={level}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {levelLabels[level as keyof typeof levelLabels]}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground">
                  Level {level} BOMs
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search BOMs by name, version, or machinery model..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* BOMs by Level - Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Layers className="h-5 w-5" />
            <span>BOMs by Level</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="0" className="flex items-center space-x-2">
                <Factory className="h-4 w-4" />
                <span>Level 0 - Machinery</span>
                <Badge variant="outline">{groupedBoms[0]?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="1" className="flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Level 1 - Groups</span>
                <Badge variant="outline">{groupedBoms[1]?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="2" className="flex items-center space-x-2">
                <Component className="h-4 w-4" />
                <span>Level 2 - Elements</span>
                <Badge variant="outline">{groupedBoms[2]?.length || 0}</Badge>
              </TabsTrigger>
              <TabsTrigger value="3" className="flex items-center space-x-2">
                <Wrench className="h-4 w-4" />
                <span>Level 3 - Accessories</span>
                <Badge variant="outline">{groupedBoms[3]?.length || 0}</Badge>
              </TabsTrigger>
            </TabsList>
            
            {[0, 1, 2, 3].map((level) => (
              <TabsContent key={level} value={level.toString()}>
                <div className="rounded-md border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Description</TableHead>
                          {level === 0 && <TableHead>Machinery Model</TableHead>}
                          {level === 2 && <TableHead>Material</TableHead>}
                          {level > 0 && level < 2 && <TableHead>Includes</TableHead>}
                          <TableHead>Components</TableHead>
                          <TableHead>Total Cost</TableHead>
                          <TableHead>Last Modified</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                     </TableHeader>
                    <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={level === 0 ? 8 : level === 2 ? 8 : level > 0 && level < 2 ? 8 : 7} className="text-center py-8">
                              Loading BOMs...
                            </TableCell>
                          </TableRow>
                        ) : !groupedBoms[level] || groupedBoms[level].length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={level === 0 ? 8 : level === 2 ? 8 : level > 0 && level < 2 ? 8 : 7} className="text-center py-8">
                              No Level {level} BOMs found
                            </TableCell>
                          </TableRow>
                      ) : (
                        groupedBoms[level].map((bom) => (
                           <TableRow key={bom.id}>
                             <TableCell className="font-medium">{bom.name}</TableCell>
                             <TableCell>
                               <Badge variant="outline">{bom.version}</Badge>
                             </TableCell>
                             <TableCell className="max-w-xs truncate">
                               {bom.description || (
                                 <span className="text-muted-foreground italic">Nessuna descrizione</span>
                               )}
                             </TableCell>
                            {level === 0 && (
                              <TableCell>
                                {bom.machinery_model ? (
                                  <Badge variant="default">{bom.machinery_model}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            )}
                            {level === 2 && (
                              <TableCell>
                                {bom.material ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">{bom.material.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      Stock: {bom.material.current_stock} {bom.material.unit}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Not connected</span>
                                )}
                              </TableCell>
                            )}
                            {level > 0 && level < 2 && (
                              <TableCell>
                                <Badge variant="secondary">
                                  {(bom as any).inclusions?.length || 0} included
                                </Badge>
                              </TableCell>
                            )}
                             <TableCell>
                               <Badge variant="secondary">
                                 {bom.component_count} items
                               </Badge>
                             </TableCell>
                             <TableCell>
                               {bom.totalCost && bom.totalCost > 0 ? (
                                 <div className="flex flex-col">
                                   <span className="font-medium text-green-600">
                                     €{bom.totalCost.toFixed(2)}
                                   </span>
                                   <span className="text-xs text-muted-foreground">
                                     Total BOM cost
                                   </span>
                                 </div>
                               ) : (
                                 <span className="text-muted-foreground">-</span>
                               )}
                             </TableCell>
                             <TableCell>
                               {new Date(bom.updated_at).toLocaleDateString()}
                             </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <Button variant="ghost" size="sm" onClick={() => handleView(bom)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(bom)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Wrench className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(bom.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}