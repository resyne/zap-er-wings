import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, Copy, Trash2, Wrench, Factory, Package, Component, Layers, Package2, Link as LinkIcon } from "lucide-react";
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
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { formatAmount } from "@/lib/formatAmount";

interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  product_type?: string;
}

interface BOM {
  id: string;
  name: string;
  version: string;
  parent_id?: string;
  parent_bom?: {
    id: string;
    name: string;
    version: string;
  };
  description?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  component_count: number;
  level: number;
  machinery_model?: string; // Deprecated
  material_id?: string;
  product_id?: string;
  children?: BOM[];
  variants?: BOM[]; // For model families (parent BOMs)
  material?: {
    id: string;
    name: string;
    code: string;
    current_stock: number;
    unit: string;
    cost?: number;
  };
  product?: Product;
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
  0: "Prodotti",
  1: "Parent Groups", 
  2: "Child Elements",
  3: "Accessories"
};

const levelIcons = {
  0: Package2,
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
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [activeTab, setActiveTab] = useState("0");
  const [includableBoms, setIncludableBoms] = useState<IncludableBOM[]>([]);
  const [bomInclusions, setBomInclusions] = useState<BOMInclusion[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("all");
  const [selectedProductType, setSelectedProductType] = useState<string>("all");
  const [bomDetails, setBomDetails] = useState<any>(null);
  const [includableBomsSearch, setIncludableBomsSearch] = useState("");
  const [productsSearch, setProductsSearch] = useState("");
  const { toast } = useToast();
  const { hideAmounts } = useHideAmounts();

  const [formData, setFormData] = useState({
    name: "",
    parent_id: "",
    variant_name: "",
    version: "",
    description: "",
    notes: "",
    level: 0,
    material_id: "",
    product_id: ""
  });

  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [linkProductDialogOpen, setLinkProductDialogOpen] = useState(false);
  const [linkingModelId, setLinkingModelId] = useState<string | null>(null);
  const [selectedProductForLink, setSelectedProductForLink] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [bomProducts, setBomProducts] = useState<{ bom_id: string; product_id: string }[]>([]);

  const [machineryFormData, setMachineryFormData] = useState({
    name: "",
    model: "",
    description: ""
  });

  const resetForm = () => {
    setFormData({
      name: "",
      parent_id: "",
      variant_name: "",
      version: "",
      description: "",
      notes: "",
      level: 1,
      material_id: "",
      product_id: ""
    });
    setSelectedLevel(1);
    setSelectedSupplierId("all");
    setIncludableBoms([]);
    setSelectedProductIds([]);
    setIncludableBomsSearch("");
    setProductsSearch("");
  };

  useEffect(() => {
    fetchBoms();
    fetchMaterials();
    fetchSuppliers();
    fetchProducts();
    fetchBomProducts();

    // Real-time updates for materials changes
    const materialsChannel = supabase
      .channel('materials-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'materials'
        },
        () => {
          console.log('Material changed, refreshing BOMs...');
          fetchBoms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(materialsChannel);
    };
  }, []);

  useEffect(() => {
    // Only fetch includable BOMs when creating new (not editing)
    // When editing, handleEdit already loads the correct data with selection state
    if (isDialogOpen && selectedLevel < 2 && !selectedBom) {
      fetchIncludableBoms();
    }
  }, [selectedLevel, formData.parent_id, isDialogOpen, selectedBom]);

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

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, code, name, description, product_type')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchBomProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('bom_products')
        .select('bom_id, product_id');

      if (error) throw error;
      setBomProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching bom_products:', error);
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
          material:materials!left(id, name, code, current_stock, unit, cost),
          product:products!boms_product_id_fkey(id, code, name, description, product_type),
          parent_bom:boms!parent_id(id, name, version),
          bom_inclusions!parent_bom_id(
            id,
            included_bom_id,
            quantity,
            notes,
            included_bom:boms!included_bom_id(
              *,
              material:materials!left(id, name, code, current_stock, unit, cost),
              bom_inclusions!parent_bom_id(
                id,
                included_bom_id,
                quantity,
                notes,
                included_bom:boms!included_bom_id(
                  *,
                  material:materials!left(id, name, code, current_stock, unit, cost)
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
      const bomName = formData.name;

      // Get next version automatically
      const { data: nextVersion, error: versionError } = await supabase
        .rpc('get_next_bom_version', {
          p_name: bomName,
          p_variant: null,
          p_level: selectedLevel,
          p_parent_id: null
        });

      if (versionError) throw versionError;

      const submitData = {
        name: bomName,
        parent_id: null,
        version: nextVersion,
        description: formData.description,
        notes: formData.notes,
        level: selectedLevel,
        material_id: selectedLevel === 2 && formData.material_id ? formData.material_id : null,
        product_id: null // Now using bom_products junction table
      };

      let bomId: string;

      if (selectedBom) {
        // For Level 1 BOMs: update in place without creating new versions
        if (selectedLevel === 1) {
          const { data, error } = await supabase
            .from('boms')
            .update({
              name: submitData.name,
              description: submitData.description,
              notes: submitData.notes,
              updated_at: new Date().toISOString()
            })
            .eq('id', selectedBom.id)
            .select()
            .single();

          if (error) throw error;
          bomId = data.id;
        } else {
          // For other levels: create a new version
          const { data, error } = await supabase
            .from('boms')
            .insert([submitData])
            .select()
            .single();

          if (error) throw error;
          bomId = data.id;
        }

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
          description: "BOM creato con successo",
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

      // Handle product links for Level 1 BOMs
      if (selectedLevel === 1) {
        // Delete existing product links if editing
        if (selectedBom) {
          await supabase
            .from('bom_products')
            .delete()
            .eq('bom_id', bomId);
        }

        // Insert new product links
        if (selectedProductIds.length > 0) {
          console.log('Saving product links for BOM:', bomId, 'Products:', selectedProductIds);
          
          const productLinks = selectedProductIds.map(productId => ({
            bom_id: bomId,
            product_id: productId
          }));

          const { data: insertedLinks, error: productLinkError } = await supabase
            .from('bom_products')
            .insert(productLinks)
            .select();

          if (productLinkError) {
            console.error('Error saving product links:', productLinkError);
            throw productLinkError;
          }
          
          console.log('Product links saved successfully:', insertedLinks);
        }
      }

      setIsDialogOpen(false);
      setSelectedBom(null);
      resetForm();
      fetchBoms();
      fetchBomProducts();
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
      name: bom.parent_id && bom.parent_bom ? bom.parent_bom.name : bom.name,
      parent_id: bom.parent_id || "",
      variant_name: bom.parent_id ? bom.name : "",
      version: bom.version,
      description: bom.description || "",
      notes: bom.notes || "",
      level: bom.level,
      material_id: bom.material_id || "",
      product_id: ""
    });

    // Load linked products for Level 1 BOMs
    if (bom.level === 1) {
      const linkedProductIds = bomProducts
        .filter(bp => bp.bom_id === bom.id)
        .map(bp => bp.product_id);
      setSelectedProductIds(linkedProductIds);
    } else {
      setSelectedProductIds([]);
    }

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
    if (!confirm("Sei sicuro di voler eliminare questo BOM? Verranno rimosse anche le sue inclusioni, ma non i BOM inclusi.")) return;

    try {
      // Check if this BOM is used in any work orders
      const { data: workOrders, error: checkError } = await supabase
        .from('work_orders')
        .select('id, number')
        .eq('bom_id', id);

      if (checkError) throw checkError;

      if (workOrders && workOrders.length > 0) {
        const workOrderNumbers = workOrders.map(wo => wo.number).join(', ');
        const confirmDelete = confirm(
          `Questo BOM è collegato a ${workOrders.length} commessa/e di produzione (${workOrderNumbers}). ` +
          `Vuoi eliminare anche tutte le commesse collegate?`
        );
        
        if (!confirmDelete) {
          return;
        }

        // Delete related work orders
        for (const workOrder of workOrders) {
          // First, unlink or delete related service work orders
          const { error: serviceWorkOrdersError } = await supabase
            .from('service_work_orders')
            .update({ production_work_order_id: null })
            .eq('production_work_order_id', workOrder.id);

          if (serviceWorkOrdersError) throw serviceWorkOrdersError;

          // Delete work order articles first
          const { error: articlesError } = await supabase
            .from('work_order_article_items')
            .delete()
            .eq('work_order_id', workOrder.id);

          if (articlesError) throw articlesError;

          // Delete executions
          const { error: executionsError } = await supabase
            .from('executions')
            .delete()
            .eq('work_order_id', workOrder.id);

          if (executionsError) throw executionsError;

          // Finally delete the work order itself
          const { error: workOrderError } = await supabase
            .from('work_orders')
            .delete()
            .eq('id', workOrder.id);

          if (workOrderError) throw workOrderError;
        }

        toast({
          title: "Commesse eliminate",
          description: `${workOrders.length} commessa/e di produzione eliminate con successo`,
        });
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
        title: "Successo",
        description: "BOM eliminato con successo",
      });
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleLinkProduct = async () => {
    if (!linkingModelId) return;
    
    try {
      const { error } = await supabase
        .from('boms')
        .update({ product_id: selectedProductForLink || null })
        .eq('id', linkingModelId);
      
      if (error) throw error;
      
      toast({
        title: "Successo",
        description: selectedProductForLink ? "Prodotto collegato con successo" : "Collegamento prodotto rimosso",
      });
      
      setLinkProductDialogOpen(false);
      setLinkingModelId(null);
      setSelectedProductForLink("");
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openLinkProductDialog = (modelId: string, currentProductId?: string) => {
    setLinkingModelId(modelId);
    setSelectedProductForLink(currentProductId || "");
    setLinkProductDialogOpen(true);
  };

  const handleDuplicate = async (bom: BOM) => {
    try {
      // Create duplicate BOM with modified name
      // Get next version for the duplicate
      const { data: nextVersion, error: versionError } = await supabase
        .rpc('get_next_bom_version', {
          p_name: bom.name,
          p_variant: null,
          p_level: bom.level,
          p_parent_id: bom.parent_id || null
        });

      if (versionError) throw versionError;

      const duplicateData = {
        name: bom.name,
        parent_id: bom.parent_id,
        version: nextVersion,
        description: bom.description,
        notes: `${bom.notes || ''}\n[Duplicato da versione ${bom.version}]`.trim(),
        level: bom.level,
        material_id: bom.material_id
      };

      const { data: newBom, error: bomError } = await supabase
        .from('boms')
        .insert([duplicateData])
        .select()
        .single();

      if (bomError) throw bomError;

      // If the BOM has inclusions, duplicate them too
      if (bom.level < 2) {
        const { data: inclusions, error: inclusionsError } = await supabase
          .from('bom_inclusions')
          .select('included_bom_id, quantity, notes')
          .eq('parent_bom_id', bom.id);

        if (inclusionsError) throw inclusionsError;

        if (inclusions && inclusions.length > 0) {
          const newInclusions = inclusions.map(inc => ({
            parent_bom_id: newBom.id,
            included_bom_id: inc.included_bom_id,
            quantity: inc.quantity,
            notes: inc.notes
          }));

          const { error: newInclusionsError } = await supabase
            .from('bom_inclusions')
            .insert(newInclusions);

          if (newInclusionsError) throw newInclusionsError;
        }
      }

      toast({
        title: "Successo",
        description: "BOM duplicato con successo",
      });
      
      fetchBoms();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const importCoemGrundfosMaterials = async () => {
    try {
      console.log('Starting import...');
      
      // First, get COEM and Grundfos supplier IDs
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, code')
        .or('code.eq.SUP716347,name.ilike.%Grundfos%');

      if (suppliersError) throw suppliersError;
      
      console.log('Found suppliers:', suppliers);

      if (!suppliers || suppliers.length === 0) {
        toast({
          title: "Errore",
          description: "Fornitori COEM o Grundfos non trovati",
          variant: "destructive",
        });
        return;
      }

      const supplierIds = suppliers.map(s => s.id);

      // Get all materials from these suppliers
      const { data: materials, error: materialsError } = await supabase
        .from('materials')
        .select('id, name, code, supplier_id')
        .in('supplier_id', supplierIds);

      if (materialsError) throw materialsError;

      console.log('Found materials:', materials?.length);

      if (!materials || materials.length === 0) {
        toast({
          title: "Nessun materiale trovato",
          description: "Nessun materiale COEM o Grundfos trovato",
          variant: "destructive",
        });
        return;
      }

      // Get all material names to check for existing BOMs
      const materialNames = materials.map(m => m.name);

      // Get existing BOMs to avoid duplicates by checking name+version combination
      const { data: existingBoms, error: existingError } = await supabase
        .from('boms')
        .select('name')
        .eq('version', '1')
        .in('name', materialNames);

      if (existingError) throw existingError;

      const existingBomNames = new Set(existingBoms?.map(b => b.name) || []);

      // Build a map to ensure we import at most one BOM per distinct material name
      const uniqueMaterialsByName = new Map<string, typeof materials[0]>();
      for (const m of materials) {
        // Skip if a BOM with this name+version already exists
        if (existingBomNames.has(m.name)) continue;
        // Skip if we already queued a material with the same name in this batch
        if (uniqueMaterialsByName.has(m.name)) continue;
        uniqueMaterialsByName.set(m.name, m);
      }

      const materialsToImport = Array.from(uniqueMaterialsByName.values());

      console.log('Materials to import:', materialsToImport.length);

      if (materialsToImport.length === 0) {
        toast({
          title: "Info",
          description: "Tutti i materiali COEM e Grundfos sono già stati importati come BOM",
        });
        return;
      }

      // Create BOM level 2 for each new material
      const bomsToCreate = materialsToImport.map(material => {
        const supplier = suppliers.find(s => s.id === material.supplier_id);
        return {
          name: material.name,
          version: '1',
          level: 2,
          material_id: material.id,
          description: `Importato da ${supplier?.name || 'fornitore'}`
        };
      });

      console.log('Creating BOMs:', bomsToCreate.length);

      const { error: insertError } = await supabase
        .from('boms')
        .insert(bomsToCreate);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      toast({
        title: "Successo",
        description: `${bomsToCreate.length} BOM importati con successo${existingBomNames.size > 0 ? ` (${existingBomNames.size} già esistenti)` : ''}`,
      });
      
      fetchBoms();
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Errore",
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
    (bom.description && bom.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedBoms = filteredBoms.reduce((acc, bom) => {
    if (!acc[bom.level]) acc[bom.level] = [];
    acc[bom.level].push(bom);
    return acc;
  }, {} as Record<number, BOM[]>);

  // Raggruppa i BOM Level 0 per modello base
  const groupedLevel0Boms = groupedBoms[0]?.reduce((acc, bom) => {
    // Se è un modello base (senza parent_id)
    if (!bom.parent_id) {
      if (!acc[bom.id]) {
        acc[bom.id] = {
          model: bom,
          variants: []
        };
      }
    } else if (bom.parent_bom) {
      // Se è una variante, aggiungila al suo modello base
      const parentId = bom.parent_id;
      if (!acc[parentId]) {
        acc[parentId] = {
          model: bom.parent_bom as any,
          variants: []
        };
      }
      acc[parentId].variants.push(bom);
    }
    return acc;
  }, {} as Record<string, { model: BOM; variants: BOM[] }>);

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
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={importCoemGrundfosMaterials}
          >
            <Download className="mr-2 h-4 w-4" />
            Importa COEM/Grundfos
          </Button>
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
                    <SelectItem value="1">Level 1 - Parent Group</SelectItem>
                    <SelectItem value="2">Level 2 - Child Element</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedLevel === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Prodotti Collegati</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Seleziona uno o più prodotti da collegare a questo BOM Level 1
                    </p>
                    <Input
                      placeholder="Cerca prodotto..."
                      value={productsSearch}
                      onChange={(e) => setProductsSearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2">
                      {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nessun prodotto disponibile</p>
                      ) : (
                        products
                          .filter(product => 
                            !productsSearch || 
                            product.name.toLowerCase().includes(productsSearch.toLowerCase()) ||
                            product.code.toLowerCase().includes(productsSearch.toLowerCase())
                          )
                          .map((product) => (
                          <div key={product.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`product-${product.id}`}
                              checked={selectedProductIds.includes(product.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedProductIds(prev => [...prev, product.id]);
                                  // Auto-suggest name from first selected product
                                  if (selectedProductIds.length === 0 && !formData.name) {
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      name: `${product.name} - Gruppo`
                                    }));
                                  }
                                } else {
                                  setSelectedProductIds(prev => prev.filter(id => id !== product.id));
                                }
                              }}
                            />
                            <label 
                              htmlFor={`product-${product.id}`} 
                              className="text-sm flex-1 cursor-pointer"
                            >
                              <span className="font-medium">{product.name}</span>
                              <span className="text-muted-foreground ml-2">
                                ({product.code}){product.product_type && ` - ${product.product_type}`}
                              </span>
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedProductIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedProductIds.map(id => {
                          const product = products.find(p => p.id === id);
                          return product ? (
                            <Badge key={id} variant="secondary" className="gap-1">
                              {product.name}
                              <button 
                                type="button"
                                onClick={() => setSelectedProductIds(prev => prev.filter(pid => pid !== id))}
                                className="ml-1 hover:text-destructive"
                              >
                                ×
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedLevel === 2 && (
                <div className="space-y-4">
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Importa da Anagrafica Materiali
                    </h4>
                    
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="supplier_filter">Filtra per Fornitore</Label>
                        <Select 
                          value={selectedSupplierId} 
                          onValueChange={setSelectedSupplierId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Tutti i fornitori" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md max-h-[300px] overflow-y-auto z-50">
                            <SelectItem value="all">Tutti i fornitori</SelectItem>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name} ({supplier.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="material_id">Seleziona Materiale</Label>
                        <Select 
                          value={formData.material_id} 
                          onValueChange={(value) => {
                            const material = materials.find(m => m.id === value);
                            if (material) {
                              setFormData(prev => ({ 
                                ...prev, 
                                material_id: value,
                                name: material.name,
                                version: "v1",
                                description: `${material.name} - ${material.code}`
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona un materiale dall'anagrafica" />
                          </SelectTrigger>
                          <SelectContent className="bg-background border shadow-md max-h-[300px] overflow-y-auto z-50">
                            {materials.map((material) => (
                              <SelectItem key={material.id} value={material.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{material.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {material.code} | Stock: {material.current_stock} {material.unit}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {selectedSupplierId && selectedSupplierId !== 'all' ? 
                            `${materials.length} materiali dal fornitore selezionato` :
                            `${materials.length} materiali totali`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter BOM name"
                  required
                />
              </div>
              
              <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {selectedLevel === 1 ? 'Modifica Diretta' : 'Versionamento Automatico'}
                    </h4>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      {selectedLevel === 1 
                        ? (selectedBom ? 'Le modifiche verranno salvate direttamente sul BOM esistente.' : 'La versione verrà generata automaticamente (v.01, v.02, ecc.).')
                        : (selectedBom ? 'Salvando, verrà creata una nuova versione di questo BOM.' : 'La versione verrà generata automaticamente (v.01, v.02, ecc.).')
                      }
                    </p>
                  </div>
                </div>
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

              {selectedLevel === 1 && includableBoms.length > 0 && (
                <div className="space-y-2">
                  <Label>Include BOMs di Level 2</Label>
                  <p className="text-xs text-muted-foreground">
                    Seleziona i BOM di livello 2 che compongono questo gruppo
                  </p>
                  <Input
                    placeholder="Cerca elemento..."
                    value={includableBomsSearch}
                    onChange={(e) => setIncludableBomsSearch(e.target.value)}
                    className="mb-2"
                  />
                  <div className="border rounded-md p-4 max-h-60 overflow-y-auto space-y-2">
                    {includableBoms
                      .filter(bom => 
                        !includableBomsSearch || 
                        bom.name.toLowerCase().includes(includableBomsSearch.toLowerCase())
                      )
                      .map((bom) => (
                      <div key={bom.id} className="flex items-center justify-between space-x-2 p-2 hover:bg-muted/50 rounded">
                        <div className="flex items-center space-x-2 flex-1">
                          <Checkbox
                            checked={bom.selected}
                            onCheckedChange={(checked) => handleInclusionToggle(bom.id, checked as boolean)}
                          />
                          <span className="text-sm font-medium">{bom.name}</span>
                          <Badge variant="outline" className="text-xs">{bom.version}</Badge>
                        </div>
                        {bom.selected && (
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs">Quantità:</Label>
                            <Input
                              type="number"
                              min="1"
                              value={bom.quantity}
                              onChange={(e) => handleQuantityChange(bom.id, parseInt(e.target.value) || 1)}
                              className="w-20 text-xs"
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
                  {selectedBom ? (selectedLevel === 1 ? "Salva" : "Crea Nuova Versione") : "Crea BOM"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* BOM View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Package2 className="h-5 w-5" />
              <span>BOM Details: {viewingBom?.level === 2 && viewingBom?.material ? viewingBom.material.name : viewingBom?.name}</span>
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
                  <p className="text-sm text-muted-foreground">
                    {bomDetails.level === 2 && bomDetails.material ? bomDetails.material.name : bomDetails.name}
                  </p>
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
                {bomDetails.level === 0 && !bomDetails.parent_id && (
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">Prodotto Collegato</Label>
                    {viewingBom?.product ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="secondary">
                          {viewingBom.product.name} ({viewingBom.product.code})
                        </Badge>
                        {viewingBom.product.product_type && (
                          <span className="text-sm text-muted-foreground">
                            {viewingBom.product.product_type}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 italic">Nessun prodotto collegato</p>
                    )}
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
                            <TableCell>
                              {inclusion.included_bom.level === 2 && inclusion.included_bom.material 
                                ? inclusion.included_bom.material.name 
                                : inclusion.included_bom.name}
                            </TableCell>
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
                                   {formatAmount(Number(inclusion.included_bom.material.cost) * inclusion.quantity, hideAmounts)}
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

      {/* Link Product Dialog */}
      <Dialog open={linkProductDialogOpen} onOpenChange={setLinkProductDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Collega Prodotto al Modello</DialogTitle>
            <DialogDescription>
              Seleziona un prodotto da collegare a questo modello BOM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Prodotto</Label>
              <Select
                value={selectedProductForLink}
                onValueChange={setSelectedProductForLink}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona prodotto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessun prodotto</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLinkProductDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleLinkProduct}>
                Salva
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Level Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Products Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prodotti</CardTitle>
            <Package2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground">Anagrafica Prodotti</p>
          </CardContent>
        </Card>
        {/* Level 1, 2, 3 Cards */}
        {[1, 2, 3].map((level) => {
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
                <p className="text-xs text-muted-foreground">Level {level} BOMs</p>
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
                placeholder="Cerca BOM per nome, versione o descrizione..."
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
                <Package2 className="h-4 w-4" />
                <span>Prodotti</span>
                <Badge variant="outline">{products.length}</Badge>
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
            
            {/* Products Tab */}
            <TabsContent value="0">
              {/* Product Type Filter */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Filtra per tipo:</Label>
                </div>
                <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Tutti i tipi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    {[...new Set(products.map(p => p.product_type).filter(Boolean))].sort().map((type) => (
                      <SelectItem key={type} value={type as string}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProductType !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    {selectedProductType}
                    <button 
                      onClick={() => setSelectedProductType("all")}
                      className="ml-1 hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                )}
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Codice</TableHead>
                      <TableHead>Nome Prodotto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead>BOM Level 1 Collegati</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          Caricamento...
                        </TableCell>
                      </TableRow>
                    ) : products.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          Nessun prodotto in anagrafica. Vai alla sezione Prodotti per aggiungerne.
                        </TableCell>
                      </TableRow>
                    ) : (
                      products
                        .filter(p => selectedProductType === "all" || p.product_type === selectedProductType)
                        .map((product) => {
                        // Find Level 1 BOMs linked to this product via bom_products junction table
                        const linkedBomIds = bomProducts.filter(bp => bp.product_id === product.id).map(bp => bp.bom_id);
                        const linkedBoms = boms.filter(b => b.level === 1 && linkedBomIds.includes(b.id));
                        return (
                          <TableRow key={product.id} className="hover:bg-muted/50">
                            <TableCell className="font-mono text-sm">
                              {product.code}
                            </TableCell>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <Package2 className="h-4 w-4 text-primary" />
                                {product.name}
                              </div>
                            </TableCell>
                            <TableCell>
                              {product.product_type ? (
                                <Badge variant="outline">{product.product_type}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {product.description || (
                                <span className="text-muted-foreground italic">Nessuna descrizione</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {linkedBoms.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {linkedBoms.map(bom => (
                                    <Badge 
                                      key={bom.id} 
                                      variant="secondary"
                                      className="cursor-pointer hover:bg-primary/20"
                                      onClick={() => handleView(bom)}
                                    >
                                      {bom.name} ({bom.version})
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm italic">
                                  Nessun BOM collegato
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Level 1, 2, 3 BOMs Tabs */}
            {[1, 2, 3].map((level) => (
              <TabsContent key={level} value={level.toString()}>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Description</TableHead>
                        {level === 1 && <TableHead>Prodotti</TableHead>}
                        {level === 2 && <TableHead>Material</TableHead>}
                        {level === 1 && <TableHead>Includes</TableHead>}
                        <TableHead>Components</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead>Last Modified</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8">
                            Loading BOMs...
                          </TableCell>
                        </TableRow>
                      ) : !groupedBoms[level] || groupedBoms[level].length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8">
                            No Level {level} BOMs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        groupedBoms[level].map((bom) => (
                          <TableRow key={bom.id}>
                            <TableCell className="font-medium">
                              {level === 2 && bom.material ? bom.material.name : bom.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{bom.version}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {bom.description || (
                                <span className="text-muted-foreground italic">Nessuna descrizione</span>
                              )}
                            </TableCell>
                            {level === 1 && (
                              <TableCell>
                                {(() => {
                                  const linkedProductIds = bomProducts.filter(bp => bp.bom_id === bom.id).map(bp => bp.product_id);
                                  const linkedProducts = products.filter(p => linkedProductIds.includes(p.id));
                                  return linkedProducts.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {linkedProducts.map(product => (
                                        <Badge key={product.id} variant="outline" className="text-xs">
                                          {product.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic">Non collegato</span>
                                  );
                                })()}
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
                            {level === 1 && (
                              <TableCell>
                                <Badge variant="secondary">
                                  {bom.bom_inclusions?.length || 0} included
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
                                    {formatAmount(bom.totalCost, hideAmounts)}
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
                                <Button variant="ghost" size="sm" onClick={() => handleDuplicate(bom)}>
                                  <Copy className="h-4 w-4" />
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