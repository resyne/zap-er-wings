import { useState, useEffect } from "react";
import { Plus, Search, Trash2, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Material {
  id: string;
  code: string;
  name: string;
  cost: number;
  unit: string;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number;
  specializations: string[];
}

interface WorkCostItem {
  id: string;
  type: "material" | "technician" | "custom_material";
  name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  unit?: string;
  hours?: number;
}

export default function WorkCostCalculatorPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workItems, setWorkItems] = useState<WorkCostItem[]>([]);
  const [searchMaterial, setSearchMaterial] = useState("");
  const [searchTechnician, setSearchTechnician] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showMaterialDialog, setShowMaterialDialog] = useState(false);
  const [showTechnicianDialog, setShowTechnicianDialog] = useState(false);
  const [showCustomMaterialDialog, setShowCustomMaterialDialog] = useState(false);
  const [showNewMaterialDialog, setShowNewMaterialDialog] = useState(false);
  
  // Form states
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [materialQuantity, setMaterialQuantity] = useState<number>(1);
  const [technicianHours, setTechnicianHours] = useState<number>(1);
  
  // Custom material form
  const [customMaterial, setCustomMaterial] = useState({
    name: "",
    cost: 0,
    quantity: 1,
    unit: "pcs"
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
    quantity: 1
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load materials
      const { data: materialsData, error: materialsError } = await supabase
        .from("materials")
        .select("id, code, name, cost, unit")
        .eq("active", true)
        .order("name");

      if (materialsError) throw materialsError;

      // Load technicians
      const { data: techniciansData, error: techniciansError } = await supabase
        .from("technicians")
        .select("id, first_name, last_name, hourly_rate, specializations")
        .eq("active", true)
        .order("first_name");

      if (techniciansError) throw techniciansError;

      setMaterials(materialsData || []);
      setTechnicians(techniciansData || []);
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

  const addMaterial = () => {
    if (!selectedMaterial) return;

    const newItem: WorkCostItem = {
      id: `material-${Date.now()}`,
      type: "material",
      name: `${selectedMaterial.name} (${selectedMaterial.code})`,
      quantity: materialQuantity,
      unit_cost: selectedMaterial.cost,
      total_cost: materialQuantity * selectedMaterial.cost,
      unit: selectedMaterial.unit
    };

    setWorkItems([...workItems, newItem]);
    setShowMaterialDialog(false);
    setSelectedMaterial(null);
    setMaterialQuantity(1);
    
    toast({
      title: "Materiale aggiunto",
      description: `${selectedMaterial.name} aggiunto al calcolo`,
    });
  };

  const addTechnician = () => {
    if (!selectedTechnician) return;

    const newItem: WorkCostItem = {
      id: `technician-${Date.now()}`,
      type: "technician",
      name: `${selectedTechnician.first_name} ${selectedTechnician.last_name}`,
      quantity: technicianHours,
      unit_cost: selectedTechnician.hourly_rate,
      total_cost: technicianHours * selectedTechnician.hourly_rate,
      unit: "ore",
      hours: technicianHours
    };

    setWorkItems([...workItems, newItem]);
    setShowTechnicianDialog(false);
    setSelectedTechnician(null);
    setTechnicianHours(1);
    
    toast({
      title: "Tecnico aggiunto",
      description: `${selectedTechnician.first_name} ${selectedTechnician.last_name} aggiunto al calcolo`,
    });
  };

  const addCustomMaterial = () => {
    if (!customMaterial.name || customMaterial.cost <= 0) {
      toast({
        title: "Errore",
        description: "Inserisci nome e costo del materiale",
        variant: "destructive",
      });
      return;
    }

    const newItem: WorkCostItem = {
      id: `custom-${Date.now()}`,
      type: "custom_material",
      name: customMaterial.name,
      quantity: customMaterial.quantity,
      unit_cost: customMaterial.cost,
      total_cost: customMaterial.quantity * customMaterial.cost,
      unit: customMaterial.unit
    };

    setWorkItems([...workItems, newItem]);
    setShowCustomMaterialDialog(false);
    setCustomMaterial({ name: "", cost: 0, quantity: 1, unit: "pcs" });
    
    toast({
      title: "Materiale personalizzato aggiunto",
      description: `${customMaterial.name} aggiunto al calcolo`,
    });
  };

  const addNewMaterialToDatabase = async () => {
    if (!newMaterial.name || !newMaterial.code || newMaterial.cost <= 0) {
      toast({
        title: "Errore",
        description: "Inserisci codice, nome e costo del materiale",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("materials")
        .insert([{
          code: newMaterial.code,
          name: newMaterial.name,
          description: newMaterial.description,
          material_type: newMaterial.material_type,
          category: newMaterial.category,
          cost: newMaterial.cost,
          unit: newMaterial.unit,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;

      // Add the new material to the local materials list
      setMaterials([...materials, data]);

      // Add it to the work items
      const newItem: WorkCostItem = {
        id: `material-${Date.now()}`,
        type: "material",
        name: `${data.name} (${data.code})`,
        quantity: newMaterial.quantity,
        unit_cost: data.cost,
        total_cost: newMaterial.quantity * data.cost,
        unit: data.unit
      };

      setWorkItems([...workItems, newItem]);
      setShowNewMaterialDialog(false);
      setNewMaterial({
        code: "",
        name: "",
        description: "",
        material_type: "raw_material",
        category: "",
        cost: 0,
        unit: "pcs",
        quantity: 1
      });

      toast({
        title: "Materiale creato e aggiunto",
        description: `${data.name} è stato aggiunto all'anagrafica e al calcolo`,
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

  const removeItem = (id: string) => {
    setWorkItems(workItems.filter(item => item.id !== id));
    toast({
      title: "Elemento rimosso",
      description: "Elemento rimosso dal calcolo",
    });
  };

  const getTotalCost = () => {
    return workItems.reduce((total, item) => total + item.total_cost, 0);
  };

  const filteredMaterials = materials.filter(material =>
    material.name.toLowerCase().includes(searchMaterial.toLowerCase()) ||
    material.code.toLowerCase().includes(searchMaterial.toLowerCase())
  );

  const filteredTechnicians = technicians.filter(tech =>
    `${tech.first_name} ${tech.last_name}`.toLowerCase().includes(searchTechnician.toLowerCase())
  );

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
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Calcolatore Costi Lavoro</h1>
        <p className="text-muted-foreground">
          Calcola i costi dei lavori includendo materiali e tecnici
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Dialog open={showMaterialDialog} onOpenChange={setShowMaterialDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Materiale
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aggiungi Materiale da Anagrafica</DialogTitle>
              <DialogDescription>
                Seleziona un materiale dall'anagrafica e specifica la quantità
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="search-material">Cerca Materiale</Label>
                <Input
                  id="search-material"
                  placeholder="Cerca per nome o codice..."
                  value={searchMaterial}
                  onChange={(e) => setSearchMaterial(e.target.value)}
                />
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md">
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

        <Dialog open={showNewMaterialDialog} onOpenChange={setShowNewMaterialDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Materiale all'Anagrafica</DialogTitle>
              <DialogDescription>
                Crea un nuovo materiale che verrà aggiunto all'anagrafica e al calcolo
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
                <div>
                  <Label htmlFor="new-category">Categoria</Label>
                  <Input
                    id="new-category"
                    value={newMaterial.category}
                    onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value })}
                    placeholder="Categoria"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                  Il materiale <strong>{newMaterial.name}</strong> (codice: {newMaterial.code}) verrà aggiunto all'anagrafica con costo €{newMaterial.cost}/{newMaterial.unit} e aggiunto al calcolo con quantità {newMaterial.quantity} per un totale di €{(newMaterial.quantity * newMaterial.cost).toFixed(2)}
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

        <Dialog open={showCustomMaterialDialog} onOpenChange={setShowCustomMaterialDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Materiale Personalizzato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Materiale Personalizzato</DialogTitle>
              <DialogDescription>
                Aggiungi un materiale non presente in anagrafica
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="custom-name">Nome Materiale</Label>
                <Input
                  id="custom-name"
                  value={customMaterial.name}
                  onChange={(e) => setCustomMaterial({ ...customMaterial, name: e.target.value })}
                  placeholder="Nome del materiale"
                />
              </div>
              <div>
                <Label htmlFor="custom-cost">Costo Unitario (€)</Label>
                <Input
                  id="custom-cost"
                  type="number"
                  value={customMaterial.cost}
                  onChange={(e) => setCustomMaterial({ ...customMaterial, cost: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Label htmlFor="custom-quantity">Quantità</Label>
                <Input
                  id="custom-quantity"
                  type="number"
                  value={customMaterial.quantity}
                  onChange={(e) => setCustomMaterial({ ...customMaterial, quantity: parseFloat(e.target.value) || 1 })}
                  min="0.1"
                  step="0.1"
                />
              </div>
              <div>
                <Label htmlFor="custom-unit">Unità di Misura</Label>
                <Select 
                  value={customMaterial.unit} 
                  onValueChange={(value) => setCustomMaterial({ ...customMaterial, unit: value })}
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
              {customMaterial.name && customMaterial.cost > 0 && (
                <div className="text-sm text-muted-foreground">
                  Costo totale: €{(customMaterial.quantity * customMaterial.cost).toFixed(2)}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCustomMaterialDialog(false)}>
                Annulla
              </Button>
              <Button onClick={addCustomMaterial} disabled={!customMaterial.name || customMaterial.cost <= 0}>
                Aggiungi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cost Calculation Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calcolo Costi Lavoro
          </CardTitle>
          <CardDescription>
            Elementi inclusi nel calcolo del costo del lavoro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun elemento aggiunto al calcolo</p>
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
                  {workItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.type === 'material' ? 'bg-blue-100 text-blue-800' :
                          item.type === 'technician' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {item.type === 'material' ? 'Materiale' :
                           item.type === 'technician' ? 'Tecnico' : 'Custom'}
                        </span>
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
                  <span>Costo Totale Lavoro:</span>
                  <span className="text-primary">€{getTotalCost().toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}