import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown, Building2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Material {
  id: string;
  code: string;
  name: string;
  description?: string;
  material_type: string;
  category?: string;
  unit: string;
  cost: number;
  supplier_id?: string;
  minimum_stock: number;
  maximum_stock: number;
  current_stock: number;
  location?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Supplier {
  id: string;
  name: string;
  email?: string;
}

const purchaseOrderSchema = z.object({
  quantity: z.number().min(1, "Quantità deve essere maggiore di 0"),
  deliveryTimeframe: z.string().min(1, "Seleziona un tempo di consegna"),
  priority: z.string().min(1, "Seleziona una priorità"),
  notes: z.string().optional(),
});

export default function StockPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPurchaseOrderDialogOpen, setIsPurchaseOrderDialogOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof purchaseOrderSchema>>({
    defaultValues: {
      quantity: 1,
      deliveryTimeframe: "",
      priority: "",
      notes: "",
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch materials
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials' as any)
        .select('*')
        .eq('active', true)
        .order('name');

      if (materialsError) {
        console.error('Error fetching materials:', materialsError);
        toast({
          title: "Errore",
          description: "Errore nel caricamento dei materiali",
          variant: "destructive",
        });
        return;
      }

      // Fetch suppliers
      const { data: suppliersData, error: suppliersError } = await supabase
        .from('suppliers')
        .select('id, name, email')
        .eq('active', true)
        .order('name');

      if (suppliersError) {
        console.error('Error fetching suppliers:', suppliersError);
      }

      setMaterials((materialsData as any) || []);
      setSuppliers((suppliersData as any) || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchaseOrder = (material: Material) => {
    if (!material.supplier_id) {
      toast({
        title: "Fornitore mancante",
        description: "Questo materiale non ha un fornitore associato",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedMaterial(material);
    form.reset({
      quantity: material.minimum_stock,
      deliveryTimeframe: "",
      priority: "medium",
      notes: `Riordino per ${material.name}`,
    });
    setIsPurchaseOrderDialogOpen(true);
  };

  const onSubmitPurchaseOrder = async (values: z.infer<typeof purchaseOrderSchema>) => {
    if (!selectedMaterial || !selectedMaterial.supplier_id) return;

    setCreatingOrder(true);

    try {
      const { error } = await supabase.functions.invoke('create-purchase-order', {
        body: {
          materialId: selectedMaterial.id,
          quantity: values.quantity,
          supplierId: selectedMaterial.supplier_id,
          deliveryTimeframe: values.deliveryTimeframe,
          priority: values.priority,
          notes: values.notes,
        },
      });

      if (error) {
        console.error('Error creating purchase order:', error);
        throw error;
      }

      toast({
        title: "Ordine creato",
        description: "L'ordine di acquisto è stato creato e inviato al fornitore",
      });

      setIsPurchaseOrderDialogOpen(false);
      setSelectedMaterial(null);
      form.reset();
    } catch (error: any) {
      console.error('Error creating purchase order:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione dell'ordine di acquisto",
        variant: "destructive",
      });
    } finally {
      setCreatingOrder(false);
    }
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         material.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || material.category === selectedCategory;
    const matchesType = selectedType === "all" || material.material_type === selectedType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const getStockStatus = (material: Material) => {
    if (material.current_stock <= material.minimum_stock) {
      return { status: "low", color: "destructive", icon: AlertTriangle };
    }
    if (material.current_stock >= material.maximum_stock) {
      return { status: "high", color: "secondary", icon: TrendingUp };
    }
    return { status: "normal", color: "default", icon: Package };
  };

  const categories = [...new Set(materials.map(material => material.category).filter(Boolean))];
  const types = [...new Set(materials.map(material => material.material_type).filter(Boolean))];

  const stockSummary = {
    totalItems: materials.length,
    lowStock: materials.filter(material => material.current_stock <= material.minimum_stock).length,
    totalValue: materials.reduce((sum, material) => sum + (material.current_stock * material.cost), 0),
    outOfStock: materials.filter(material => material.current_stock === 0).length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestione Stock</h1>
          <p className="text-muted-foreground">
            Monitora le scorte di magazzino e i livelli di inventario
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Movimento Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuovo Movimento Stock</DialogTitle>
              <DialogDescription>
                Registra un movimento di carico o scarico
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item">Articolo</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona articolo" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.code} - {material.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Tipo Movimento</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Carico</SelectItem>
                    <SelectItem value="out">Scarico</SelectItem>
                    <SelectItem value="adjustment">Rettifica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantità</Label>
                <Input id="quantity" type="number" placeholder="0" />
              </div>
              <div>
                <Label htmlFor="reason">Motivo</Label>
                <Input id="reason" placeholder="Descrizione movimento" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Conferma
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Purchase Order Dialog */}
        <Dialog open={isPurchaseOrderDialogOpen} onOpenChange={setIsPurchaseOrderDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crea Ordine di Acquisto</DialogTitle>
              <DialogDescription>
                Crea un nuovo ordine di acquisto per {selectedMaterial?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedMaterial && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitPurchaseOrder)} className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <h4 className="font-medium">{selectedMaterial.name}</h4>
                    <p className="text-sm text-muted-foreground">Codice: {selectedMaterial.code}</p>
                    <p className="text-sm text-muted-foreground">
                      Scorta attuale: {selectedMaterial.current_stock} {selectedMaterial.unit}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Scorta minima: {selectedMaterial.minimum_stock} {selectedMaterial.unit}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Fornitore: {suppliers.find(s => s.id === selectedMaterial.supplier_id)?.name}
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantità da ordinare *</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input 
                              {...field} 
                              type="number" 
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                            <span className="text-sm text-muted-foreground">{selectedMaterial.unit}</span>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deliveryTimeframe"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tempo di consegna richiesto *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona tempo di consegna" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 giorni</SelectItem>
                              <SelectItem value="15">15 giorni</SelectItem>
                              <SelectItem value="30">30 giorni</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priorità *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona priorità" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Bassa</SelectItem>
                              <SelectItem value="medium">Media</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                              <SelectItem value="urgent">Urgente</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note e richieste specifiche</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Eventuali note per il fornitore..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPurchaseOrderDialogOpen(false)}
                    >
                      Annulla
                    </Button>
                    <Button type="submit" disabled={creatingOrder}>
                      {creatingOrder ? "Creazione..." : "Crea Ordine"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articoli Totali</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockSummary.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scorte Basse</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stockSummary.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stockSummary.totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esauriti</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stockSummary.outOfStock}</div>
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
                    placeholder="Cerca per nome o codice..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le categorie</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category || ""}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Tipo Materiale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i tipi</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stock Table */}
        <Card>
          <CardHeader>
            <CardTitle>Inventario Stock</CardTitle>
            <CardDescription>
              {filteredMaterials.length} di {materials.length} materiali
            </CardDescription>
          </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Ubicazione</TableHead>
                  <TableHead className="text-right">Scorta Attuale</TableHead>
                  <TableHead className="text-right">Min/Max</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Valore</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredMaterials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Nessun materiale trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMaterials.map((material) => {
                    const stockStatus = getStockStatus(material);
                    const StatusIcon = stockStatus.icon;
                    const supplier = suppliers.find(s => s.id === material.supplier_id);
                    
                    return (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{material.name}</div>
                            {material.description && (
                              <div className="text-sm text-muted-foreground">{material.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {material.material_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{material.category || "-"}</TableCell>
                        <TableCell>
                          {supplier ? (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{supplier.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Nessun fornitore</span>
                          )}
                        </TableCell>
                        <TableCell>{material.location || "-"}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{material.current_stock} {material.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm">
                            <div>Min: {material.minimum_stock} {material.unit}</div>
                            <div>Max: {material.maximum_stock} {material.unit}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.color as any} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {stockStatus.status === "low" ? "Scorta bassa" : 
                             stockStatus.status === "high" ? "Scorta alta" : "Normale"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          €{(material.current_stock * material.cost).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {material.supplier_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCreatePurchaseOrder(material)}
                              className="gap-1"
                            >
                              <ShoppingCart className="h-3 w-3" />
                              Riordina
                            </Button>
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
    </div>
  );
}