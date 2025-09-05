import { useState, useEffect } from "react";
import { Plus, Search, Trash2, Calculator, Save, FileText } from "lucide-react";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Material {
  id: string;
  code: string;
  name: string;
  cost: number;
  unit: string;
  supplier_id?: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  code: string;
  company_name?: string;
  email?: string;
  phone?: string;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number;
  specializations: string[];
}

interface Machinery {
  id: string;
  name: string;
  machinery_model: string;
  description?: string;
  cost?: number;
}

interface CostDraft {
  id: string;
  draft_number: string;
  customer_name: string;
  description: string;
  total_cost: number;
  status: string;
  created_at: string;
}

interface DraftItem {
  id: string;
  type: "material" | "technician" | "custom_material" | "machinery";
  name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  unit?: string;
  hours?: number;
  notes?: string;
  draft_id?: string;
  material_id?: string;
  machinery_id?: string;
  created_at?: string;
  updated_at?: string;
}

export default function WorkCostCalculatorPage() {
  const [costDrafts, setCostDrafts] = useState<CostDraft[]>([]);
  const [currentDraft, setCurrentDraft] = useState<CostDraft | null>(null);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [machinery, setMachinery] = useState<Machinery[]>([]);
  
  const [searchMaterial, setSearchMaterial] = useState("");
  const [searchTechnician, setSearchTechnician] = useState("");
  const [searchMachinery, setSearchMachinery] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showCreateDraftDialog, setShowCreateDraftDialog] = useState(false);
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showTechnicianDialog, setShowTechnicianDialog] = useState(false);
  const [showMachineryDialog, setShowMachineryDialog] = useState(false);
  const [showNewMaterialDialog, setShowNewMaterialDialog] = useState(false);
  const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);
  
  // Form states
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedMachinery, setSelectedMachinery] = useState<Machinery | null>(null);
  const [materialQuantity, setMaterialQuantity] = useState<number>(1);
  const [technicianHours, setTechnicianHours] = useState<number>(1);
  const [machineryHours, setMachineryHours] = useState<number>(1);
  const [machineryCost, setMachineryCost] = useState<number>(0);
  
  // New draft form
  const [newDraft, setNewDraft] = useState({
    customer_id: "",
    customer_name: "",
    description: ""
  });

  // New material form (for adding to database)
  const [newMaterial, setNewMaterial] = useState({
    code: "",
    name: "",
    description: "",
    material_type: "raw_material",
    category: "",
    cost: 0,
    unit: "pcs",
    supplier_id: "",
    quantity: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load cost drafts
      const { data: draftsData, error: draftsError } = await supabase
        .from("customer_cost_drafts")
        .select("*")
        .order("created_at", { ascending: false });

      if (draftsError) throw draftsError;

      // Load materials with supplier info
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select(`
          id, code, name, cost, unit, supplier_id,
          suppliers!materials_supplier_id_fkey(name)
        `)
        .eq("active", true)
        .order("name");

      if (materialsError) throw materialsError;

      // Load suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("id, code, name")
        .eq("active", true)
        .order("name");

      if (suppliersError) throw suppliersError;

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, name, code, company_name, email, phone")
        .eq("active", true)
        .order("name");

      if (customersError) throw customersError;

      // Load technicians
      const { data: techniciansData, error: techniciansError } = await supabase
        .from("technicians")
        .select("id, first_name, last_name, hourly_rate, specializations")
        .eq("active", true)
        .order("first_name");

      if (techniciansError) throw techniciansError;

      // Load machinery (level 0 BOMs)
      const { data: machineryData, error: machineryError } = await supabase
        .from("boms")
        .select("id, name, machinery_model, description")
        .eq("level", 0)
        .order("name");

      if (machineryError) throw machineryError;

      setCostDrafts(draftsData || []);
      setMaterials(materialsData || []);
      setSuppliers(suppliersData || []);
      setCustomers(customersData || []);
      setTechnicians(techniciansData || []);
      setMachinery(machineryData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDraftItems = async (draftId: string) => {
    try {
      const { data, error } = await supabase
        .from("cost_draft_items")
        .select("*")
        .eq("draft_id", draftId)
        .order("created_at");

      if (error) throw error;
      setDraftItems((data || []).map(item => ({
        ...item,
        type: item.type as "material" | "technician" | "custom_material" | "machinery"
      })));
    } catch (error) {
      console.error("Error loading draft items:", error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli elementi della bozza",
        variant: "destructive",
      });
    }
  };

  const createDraft = async () => {
    if (!newDraft.customer_id) {
      toast({
        title: "Errore",
        description: "Seleziona un cliente dall'anagrafica",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("customer_cost_drafts")
        .insert({
          customer_id: newDraft.customer_id,
          customer_name: newDraft.customer_name,
          description: newDraft.description,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          draft_number: '' // Will be auto-generated by trigger
        })
        .select()
        .single();

      if (error) throw error;

      setCostDrafts([data, ...costDrafts]);
      setCurrentDraft(data);
      setDraftItems([]);
      setShowCreateDraftDialog(false);
      setNewDraft({ customer_id: "", customer_name: "", description: "" });

      toast({
        title: "Bozza creata",
        description: `Bozza ${data.draft_number} creata con successo`,
      });
    } catch (error: any) {
      console.error("Error creating draft:", error);
      toast({
        title: "Errore",
        description: `Errore nella creazione della bozza: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const selectDraft = (draft: CostDraft) => {
    setCurrentDraft(draft);
    loadDraftItems(draft.id);
  };

  const addMaterial = async () => {
    if (!selectedMaterial || !currentDraft) return;

    try {
      const totalCost = materialQuantity * selectedMaterial.cost;
      
      const { data, error } = await supabase
        .from("cost_draft_items")
        .insert({
          draft_id: currentDraft.id,
          type: "material",
          material_id: selectedMaterial.id,
          name: `${selectedMaterial.name} (${selectedMaterial.code})`,
          quantity: materialQuantity,
          unit_cost: selectedMaterial.cost,
          total_cost: totalCost,
          unit: selectedMaterial.unit
        })
        .select()
        .single();

      if (error) throw error;

      setDraftItems([...draftItems, {
        ...data,
        type: data.type as "material" | "technician" | "custom_material"
      }]);
      setShowMaterialDialog(false);
      setSelectedMaterial(null);
      setMaterialQuantity(1);
      
      await updateDraftTotal();
      
      toast({
        title: "Materiale aggiunto",
        description: `${selectedMaterial.name} aggiunto alla bozza`,
      });
    } catch (error: any) {
      console.error("Error adding material:", error);
      toast({
        title: "Errore",
        description: `Errore nell'aggiunta del materiale: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const addTechnician = async () => {
    if (!selectedTechnician || !currentDraft) return;

    try {
      const totalCost = technicianHours * selectedTechnician.hourly_rate;
      
      const { data, error } = await supabase
        .from("cost_draft_items")
        .insert({
          draft_id: currentDraft.id,
          type: "technician",
          technician_id: selectedTechnician.id,
          name: `${selectedTechnician.first_name} ${selectedTechnician.last_name}`,
          quantity: technicianHours,
          unit_cost: selectedTechnician.hourly_rate,
          total_cost: totalCost,
          unit: "ore",
          hours: technicianHours
        })
        .select()
        .single();

      if (error) throw error;

      setDraftItems([...draftItems, {
        ...data,
        type: data.type as "material" | "technician" | "custom_material"
      }]);
      setShowTechnicianDialog(false);
      setSelectedTechnician(null);
      setTechnicianHours(1);
      
      await updateDraftTotal();
      
      toast({
        title: "Tecnico aggiunto",
        description: `${selectedTechnician.first_name} ${selectedTechnician.last_name} aggiunto alla bozza`,
      });
    } catch (error: any) {
      console.error("Error adding technician:", error);
      toast({
        title: "Errore",
        description: `Errore nell'aggiunta del tecnico: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const addMachinery = async () => {
    if (!selectedMachinery || !currentDraft) return;

    try {
      const totalCost = machineryHours * machineryCost;
      
      const { data, error } = await supabase
        .from("cost_draft_items")
        .insert({
          draft_id: currentDraft.id,
          type: "machinery",
          machinery_id: selectedMachinery.id,
          name: `${selectedMachinery.name} (${selectedMachinery.machinery_model || 'N/A'})`,
          quantity: machineryHours,
          unit_cost: machineryCost,
          total_cost: totalCost,
          unit: "ore",
          hours: machineryHours
        })
        .select()
        .single();

      if (error) throw error;

      setDraftItems([...draftItems, {
        ...data,
        type: data.type as "material" | "technician" | "custom_material" | "machinery"
      }]);
      setShowMachineryDialog(false);
      setSelectedMachinery(null);
      setMachineryHours(1);
      setMachineryCost(0);
      
      await updateDraftTotal();
      
      toast({
        title: "Macchinario aggiunto",
        description: `${selectedMachinery.name} aggiunto alla bozza`,
      });
    } catch (error: any) {
      console.error("Error adding machinery:", error);
      toast({
        title: "Errore",
        description: `Errore nell'aggiunta del macchinario: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const addNewMaterialToDatabase = async () => {
    if (!newMaterial.name || !newMaterial.code || newMaterial.cost <= 0 || !currentDraft) {
      toast({
        title: "Errore",
        description: "Inserisci codice, nome e costo del materiale",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: materialData, error: materialError } = await supabase
        .from("materials")
        .insert([{
          code: newMaterial.code,
          name: newMaterial.name,
          description: newMaterial.description,
          material_type: newMaterial.material_type,
          category: newMaterial.category,
          cost: newMaterial.cost,
          unit: newMaterial.unit,
          supplier_id: newMaterial.supplier_id || null,
          active: true
        }])
        .select()
        .single();

      if (materialError) throw materialError;

      // Add the new material to the local materials list
      setMaterials([...materials, materialData]);

      // Add it to the draft items
      const totalCost = newMaterial.quantity * materialData.cost;
      
      const { data: itemData, error: itemError } = await supabase
        .from("cost_draft_items")
        .insert({
          draft_id: currentDraft.id,
          type: "material",
          material_id: materialData.id,
          name: `${materialData.name} (${materialData.code})`,
          quantity: newMaterial.quantity,
          unit_cost: materialData.cost,
          total_cost: totalCost,
          unit: materialData.unit
        })
        .select()
        .single();

      if (itemError) throw itemError;

      setDraftItems([...draftItems, {
        ...itemData,
        type: itemData.type as "material" | "technician" | "custom_material"
      }]);
      setShowNewMaterialDialog(false);
      setNewMaterial({
        code: "",
        name: "",
        description: "",
        material_type: "raw_material",
        category: "",
        cost: 0,
        unit: "pcs",
        supplier_id: "",
        quantity: 1
      });

      await updateDraftTotal();

      toast({
        title: "Materiale creato e aggiunto",
        description: `${materialData.name} è stato aggiunto all'anagrafica e alla bozza`,
      });
    } catch (error: any) {
      console.error("Error creating material:", error);
      toast({
        title: "Errore",
        description: `Errore nella creazione del materiale: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("cost_draft_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      setDraftItems(draftItems.filter(item => item.id !== itemId));
      await updateDraftTotal();
      
      toast({
        title: "Elemento rimosso",
        description: "Elemento rimosso dalla bozza",
      });
    } catch (error: any) {
      console.error("Error removing item:", error);
      toast({
        title: "Errore",
        description: `Errore nella rimozione dell'elemento: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  const updateDraftTotal = async () => {
    if (!currentDraft) return;

    const total = draftItems.reduce((sum, item) => sum + item.total_cost, 0);
    
    try {
      const { error } = await supabase
        .from("customer_cost_drafts")
        .update({ total_cost: total })
        .eq("id", currentDraft.id);

      if (error) throw error;

      setCurrentDraft({ ...currentDraft, total_cost: total });
      setCostDrafts(costDrafts.map(draft => 
        draft.id === currentDraft.id ? { ...draft, total_cost: total } : draft
      ));
    } catch (error) {
      console.error("Error updating draft total:", error);
    }
  };

  const getTotalCost = () => {
    return draftItems.reduce((total, item) => total + item.total_cost, 0);
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchMaterial.toLowerCase()) ||
                         material.code.toLowerCase().includes(searchMaterial.toLowerCase());
    const matchesSupplier = selectedSupplier === "all" || !selectedSupplier || material.supplier_id === selectedSupplier;
    return matchesSearch && matchesSupplier;
  });

  const filteredTechnicians = technicians.filter(tech =>
    `${tech.first_name} ${tech.last_name}`.toLowerCase().includes(searchTechnician.toLowerCase())
  );

  const filteredMachinery = machinery.filter(machine =>
    machine.name.toLowerCase().includes(searchMachinery.toLowerCase()) ||
    (machine.machinery_model && machine.machinery_model.toLowerCase().includes(searchMachinery.toLowerCase()))
  );

  const calculateBOMCost = async (bomId: string): Promise<number> => {
    try {
      // Get all BOM inclusions for this BOM
      const { data: inclusions, error: inclusionsError } = await supabase
        .from("bom_inclusions")
        .select(`
          quantity,
          included_bom:boms!bom_inclusions_included_bom_id_fkey(
            id,
            material_id,
            materials(cost)
          )
        `)
        .eq("parent_bom_id", bomId);

      if (inclusionsError) throw inclusionsError;

      let totalCost = 0;

      // Calculate cost for each inclusion
      for (const inclusion of inclusions || []) {
        if (inclusion.included_bom?.material_id && inclusion.included_bom.materials?.cost) {
          totalCost += inclusion.quantity * inclusion.included_bom.materials.cost;
        } else if (inclusion.included_bom?.id) {
          // Recursively calculate cost for included BOMs
          const nestedCost = await calculateBOMCost(inclusion.included_bom.id);
          totalCost += inclusion.quantity * nestedCost;
        }
      }

      return totalCost;
    } catch (error) {
      console.error("Error calculating BOM cost:", error);
      return 0;
    }
  };

  const handleMachinerySelection = async (machine: Machinery) => {
    setSelectedMachinery(machine);
    // Calculate and set the BOM cost automatically
    const bomCost = await calculateBOMCost(machine.id);
    setMachineryCost(bomCost);
  };

  const handleCustomerCreated = (customer: Customer) => {
    setCustomers([...customers, customer]);
    setNewDraft({
      ...newDraft,
      customer_id: customer.id,
      customer_name: customer.name
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Caricamento...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Calcolatore Costi Commessa</h1>
        <p className="text-muted-foreground">
          Crea e gestisci bozze costi per i clienti includendo materiali e tecnici
        </p>
      </div>

      {/* Cost Drafts Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Bozze Costi Cliente
              </CardTitle>
              <CardDescription>
                Gestisci le bozze di calcolo costi per i clienti
              </CardDescription>
            </div>
            <Dialog open={showCreateDraftDialog} onOpenChange={setShowCreateDraftDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuova Bozza
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crea Nuova Bozza Costi</DialogTitle>
                  <DialogDescription>
                    Crea una nuova bozza di calcolo costi per un cliente
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="customer-select">Cliente</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={newDraft.customer_id} 
                        onValueChange={(value) => {
                          const customer = customers.find(c => c.id === value);
                          setNewDraft({ 
                            ...newDraft, 
                            customer_id: value,
                            customer_name: customer?.name || ""
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name} {customer.company_name && `(${customer.company_name})`} - {customer.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => setShowCreateCustomerDialog(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Descrizione</Label>
                    <Textarea
                      id="description"
                      value={newDraft.description}
                      onChange={(e) => setNewDraft({ ...newDraft, description: e.target.value })}
                      placeholder="Descrizione della commessa"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDraftDialog(false)}>
                    Annulla
                  </Button>
                  <Button onClick={createDraft} disabled={!newDraft.customer_id}>
                    Crea Bozza
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {costDrafts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna bozza costi presente</p>
              <p className="text-sm">Crea la prima bozza per iniziare</p>
            </div>
          ) : (
            <div className="space-y-2">
              {costDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    currentDraft?.id === draft.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => selectDraft(draft)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{draft.draft_number}</span>
                        <Badge variant={draft.status === 'draft' ? 'secondary' : 'default'}>
                          {draft.status === 'draft' ? 'Bozza' : draft.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Cliente: {draft.customer_name}</div>
                        {draft.description && <div>{draft.description}</div>}
                        <div>Creata: {new Date(draft.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-medium">€{draft.total_cost.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Draft Details */}
      {currentDraft && (
        <>
          {/* Actions */}
          <div className="flex flex-wrap gap-4">
            <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Materiale
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Aggiungi Materiale da Anagrafica</DialogTitle>
                  <DialogDescription>
                    Seleziona un materiale dall'anagrafica e specifica la quantità
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="supplier-filter">Filtra per Fornitore</Label>
                      <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tutti i fornitori" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti i fornitori</SelectItem>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name} ({supplier.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="search-material">Cerca Materiale</Label>
                      <Input
                        id="search-material"
                        placeholder="Cerca per nome o codice..."
                        value={searchMaterial}
                        onChange={(e) => setSearchMaterial(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto border rounded-md">
                    {filteredMaterials.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <p>Nessun materiale trovato</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMaterialDialog(false);
                            setShowNewMaterialDialog(true);
                          }}
                          className="mt-2 text-primary hover:underline"
                        >
                          Aggiungi nuovo materiale all'anagrafica
                        </button>
                      </div>
                    ) : (
                      filteredMaterials.map((material) => (
                        <div
                          key={material.id}
                          className={`p-3 cursor-pointer hover:bg-muted ${selectedMaterial?.id === material.id ? 'bg-primary/10' : ''}`}
                          onClick={() => setSelectedMaterial(material)}
                        >
                          <div className="font-medium">{material.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Codice: {material.code} | Costo: €{material.cost} / {material.unit}
                            {material.supplier_id && (
                              <div>Fornitore: {suppliers.find(s => s.id === material.supplier_id)?.name}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedMaterial && (
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantità</Label>
                      <Input
                        id="quantity"
                        type="number"
                        value={materialQuantity}
                        onChange={(e) => setMaterialQuantity(parseFloat(e.target.value) || 1)}
                        min="0.1"
                        step="0.1"
                      />
                      <div className="text-sm text-muted-foreground">
                        Costo totale: €{(materialQuantity * selectedMaterial.cost).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowMaterialDialog(false)}>
                    Annulla
                  </Button>
                  <Button onClick={addMaterial} disabled={!selectedMaterial}>
                    Aggiungi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showTechnicianDialog} onOpenChange={setShowTechnicianDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Tecnico
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Aggiungi Tecnico</DialogTitle>
                  <DialogDescription>
                    Seleziona un tecnico e specifica le ore di lavoro
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="search-technician">Cerca Tecnico</Label>
                    <Input
                      id="search-technician"
                      placeholder="Cerca per nome..."
                      value={searchTechnician}
                      onChange={(e) => setSearchTechnician(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {filteredTechnicians.map((tech) => (
                      <div
                        key={tech.id}
                        className={`p-3 cursor-pointer hover:bg-muted ${selectedTechnician?.id === tech.id ? 'bg-primary/10' : ''}`}
                        onClick={() => setSelectedTechnician(tech)}
                      >
                        <div className="font-medium">{tech.first_name} {tech.last_name}</div>
                        <div className="text-sm text-muted-foreground">
                          Tariffa oraria: €{tech.hourly_rate}/ora
                          {tech.specializations && tech.specializations.length > 0 && (
                            <div>Specializzazioni: {tech.specializations.join(", ")}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedTechnician && (
                    <div className="space-y-2">
                      <Label htmlFor="hours">Ore di Lavoro</Label>
                      <Input
                        id="hours"
                        type="number"
                        value={technicianHours}
                        onChange={(e) => setTechnicianHours(parseFloat(e.target.value) || 1)}
                        min="0.1"
                        step="0.1"
                      />
                      <div className="text-sm text-muted-foreground">
                        Costo totale: €{(technicianHours * selectedTechnician.hourly_rate).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTechnicianDialog(false)}>
                    Annulla
                  </Button>
                  <Button onClick={addTechnician} disabled={!selectedTechnician}>
                    Aggiungi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showMachineryDialog} onOpenChange={setShowMachineryDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Macchinario
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Aggiungi Macchinario</DialogTitle>
                  <DialogDescription>
                    Seleziona un macchinario dalla distinta base livello 0 e specifica ore e costo
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="search-machinery">Cerca Macchinario</Label>
                    <Input
                      id="search-machinery"
                      placeholder="Cerca per nome o modello..."
                      value={searchMachinery}
                      onChange={(e) => setSearchMachinery(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    {filteredMachinery.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <p>Nessun macchinario trovato</p>
                      </div>
                    ) : (
                      filteredMachinery.map((machine) => (
                        <div
                          key={machine.id}
                          className={`p-3 cursor-pointer hover:bg-muted ${selectedMachinery?.id === machine.id ? 'bg-primary/10' : ''}`}
                          onClick={() => handleMachinerySelection(machine)}
                        >
                          <div className="font-medium">{machine.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Modello: {machine.machinery_model || 'N/A'}
                            {machine.description && (
                              <div>Descrizione: {machine.description}</div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedMachinery && (
                    <div className="space-y-4 border-t pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="machinery-hours">Ore di Utilizzo</Label>
                          <Input
                            id="machinery-hours"
                            type="number"
                            value={machineryHours}
                            onChange={(e) => setMachineryHours(parseFloat(e.target.value) || 1)}
                            min="0.1"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="machinery-cost">Costo Orario (€)</Label>
                          <Input
                            id="machinery-cost"
                            type="number"
                            value={machineryCost}
                            onChange={(e) => setMachineryCost(parseFloat(e.target.value) || 0)}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Costo totale: €{(machineryHours * machineryCost).toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowMachineryDialog(false)}>
                    Annulla
                  </Button>
                  <Button onClick={addMachinery} disabled={!selectedMachinery || machineryCost <= 0}>
                    Aggiungi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={showNewMaterialDialog} onOpenChange={setShowNewMaterialDialog}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Aggiungi Nuovo Materiale all'Anagrafica</DialogTitle>
                  <DialogDescription>
                    Crea un nuovo materiale che verrà aggiunto all'anagrafica e alla bozza
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new-code">Codice Materiale *</Label>
                      <Input
                        id="new-code"
                        value={newMaterial.code}
                        onChange={(e) => setNewMaterial({ ...newMaterial, code: e.target.value })}
                        placeholder="MAT-001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-name">Nome Materiale *</Label>
                      <Input
                        id="new-name"
                        value={newMaterial.name}
                        onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                        placeholder="Nome del materiale"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="new-description">Descrizione</Label>
                    <Input
                      id="new-description"
                      value={newMaterial.description}
                      onChange={(e) => setNewMaterial({ ...newMaterial, description: e.target.value })}
                      placeholder="Descrizione del materiale"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new-supplier">Fornitore</Label>
                      <Select 
                        value={newMaterial.supplier_id} 
                        onValueChange={(value) => setNewMaterial({ ...newMaterial, supplier_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona fornitore" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.name} ({supplier.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="new-type">Tipo Materiale</Label>
                      <Select 
                        value={newMaterial.material_type} 
                        onValueChange={(value) => setNewMaterial({ ...newMaterial, material_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="raw_material">Materia Prima</SelectItem>
                          <SelectItem value="component">Componente</SelectItem>
                          <SelectItem value="finished_good">Prodotto Finito</SelectItem>
                          <SelectItem value="consumable">Consumabile</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="new-cost">Costo Unitario (€) *</Label>
                      <Input
                        id="new-cost"
                        type="number"
                        value={newMaterial.cost}
                        onChange={(e) => setNewMaterial({ ...newMaterial, cost: parseFloat(e.target.value) || 0 })}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-unit">Unità di Misura</Label>
                      <Select 
                        value={newMaterial.unit} 
                        onValueChange={(value) => setNewMaterial({ ...newMaterial, unit: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pcs">Pezzi</SelectItem>
                          <SelectItem value="kg">Kg</SelectItem>
                          <SelectItem value="mt">Metri</SelectItem>
                          <SelectItem value="mq">Metri quadri</SelectItem>
                          <SelectItem value="lt">Litri</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="new-category">Categoria</Label>
                      <Input
                        id="new-category"
                        value={newMaterial.category}
                        onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                        placeholder="Categoria"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-quantity">Quantità da Aggiungere</Label>
                      <Input
                        id="new-quantity"
                        type="number"
                        value={newMaterial.quantity}
                        onChange={(e) => setNewMaterial({ ...newMaterial, quantity: parseFloat(e.target.value) || 1 })}
                        min="0.1"
                        step="0.1"
                      />
                    </div>
                  </div>
                  
                  {newMaterial.name && newMaterial.code && newMaterial.cost > 0 && (
                    <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded">
                      Il materiale <strong>{newMaterial.name}</strong> (codice: {newMaterial.code}) verrà aggiunto all'anagrafica con costo €{newMaterial.cost}/{newMaterial.unit} e aggiunto alla bozza con quantità {newMaterial.quantity} per un totale di €{(newMaterial.quantity * newMaterial.cost).toFixed(2)}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewMaterialDialog(false)}>
                    Annulla
                  </Button>
                  <Button 
                    onClick={addNewMaterialToDatabase} 
                    disabled={!newMaterial.name || !newMaterial.code || newMaterial.cost <= 0}
                  >
                    Crea e Aggiungi
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Current Draft Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                {currentDraft.draft_number} - {currentDraft.customer_name}
              </CardTitle>
              <CardDescription>
                Elementi inclusi nella bozza costi
              </CardDescription>
            </CardHeader>
            <CardContent>
              {draftItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun elemento aggiunto alla bozza</p>
                  <p className="text-sm">Aggiungi materiali o tecnici per iniziare il calcolo</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Quantità/Ore</TableHead>
                        <TableHead>Costo Unitario</TableHead>
                        <TableHead>Costo Totale</TableHead>
                        <TableHead className="w-[50px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant={
                              item.type === 'material' ? 'default' :
                              item.type === 'technician' ? 'secondary' : 
                              item.type === 'machinery' ? 'destructive' : 'outline'
                            }>
                              {item.type === 'material' ? 'Materiale' :
                               item.type === 'technician' ? 'Tecnico' : 
                               item.type === 'machinery' ? 'Macchinario' : 'Custom'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell>€{item.unit_cost.toFixed(2)}</TableCell>
                          <TableCell className="font-medium">€{item.total_cost.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Total */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Costo Totale Bozza:</span>
                      <span className="text-primary">€{getTotalCost().toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Customer Dialog */}
      <CreateCustomerDialog
        open={showCreateCustomerDialog}
        onOpenChange={setShowCreateCustomerDialog}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}