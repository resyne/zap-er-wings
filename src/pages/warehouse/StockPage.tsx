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
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPurchaseOrderDialogOpen, setIsPurchaseOrderDialogOpen] = useState(false);
  const [isEmailPreviewOpen, setIsEmailPreviewOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [emailPreviewData, setEmailPreviewData] = useState<any>(null);
  const [additionalEmailNotes, setAdditionalEmailNotes] = useState("");
  const [creatingOrder, setCreatingOrder] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof purchaseOrderSchema>>({
    defaultValues: {
      quantity: 1,
      deliveryTimeframe: "7",
      priority: "medium",
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
      deliveryTimeframe: "7",
      priority: "medium",
      notes: `Riordino per ${material.name}`,
    });
    setIsPurchaseOrderDialogOpen(true);
  };

  const onSubmitPurchaseOrder = async (values: z.infer<typeof purchaseOrderSchema>) => {
    if (!selectedMaterial || !selectedMaterial.supplier_id) return;

    // Prepare email preview data
    const supplier = suppliers.find(s => s.id === selectedMaterial.supplier_id);
    const deliveryDays = parseInt(values.deliveryTimeframe);
    const currentDate = new Date();
    const expectedDeliveryDate = new Date(currentDate);
    expectedDeliveryDate.setDate(currentDate.getDate() + deliveryDays);
    
    const estimatedUnitPrice = selectedMaterial.cost || 0;
    const totalPrice = values.quantity * estimatedUnitPrice;

    setEmailPreviewData({
      material: selectedMaterial,
      supplier: supplier,
      formValues: values,
      deliveryDays,
      expectedDeliveryDate,
      estimatedUnitPrice,
      totalPrice,
      subtotal: totalPrice,
      taxAmount: totalPrice * 0.22,
      totalAmount: totalPrice * 1.22
    });

    setAdditionalEmailNotes("");
    setIsPurchaseOrderDialogOpen(false);
    setIsEmailPreviewOpen(true);
  };

  const confirmAndCreateOrder = async () => {
    if (!selectedMaterial || !emailPreviewData) return;

    setCreatingOrder(true);

    try {
      const { error } = await supabase.functions.invoke('create-purchase-order', {
        body: {
          materialId: selectedMaterial.id,
          quantity: emailPreviewData.formValues.quantity,
          supplierId: selectedMaterial.supplier_id,
          deliveryTimeframe: emailPreviewData.formValues.deliveryTimeframe,
          priority: emailPreviewData.formValues.priority,
          notes: emailPreviewData.formValues.notes,
          additionalEmailNotes: additionalEmailNotes,
        },
      });

      if (error) {
        console.error('Error creating purchase order:', error);
        throw error;
      }

      toast({
        title: "Ordine creato e inviato",
        description: "L'ordine di acquisto è stato creato e l'email è stata inviata al fornitore",
      });

      setIsEmailPreviewOpen(false);
      setSelectedMaterial(null);
      setEmailPreviewData(null);
      setAdditionalEmailNotes("");
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
    const matchesSupplier = selectedSupplier === "all" || material.supplier_id === selectedSupplier;
    return matchesSearch && matchesCategory && matchesType && matchesSupplier;
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
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
                    <Button type="submit">
                      Anteprima Email
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>

        {/* Email Preview Dialog */}
        <Dialog open={isEmailPreviewOpen} onOpenChange={setIsEmailPreviewOpen}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Anteprima Email al Fornitore</DialogTitle>
              <DialogDescription>
                Verifica il contenuto dell'email prima dell'invio e aggiungi eventuali note aggiuntive
              </DialogDescription>
            </DialogHeader>
            {emailPreviewData && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Destinatario</h4>
                  <p className="text-sm">
                    <strong>{emailPreviewData.supplier?.name}</strong> - {emailPreviewData.supplier?.email || "Email non disponibile"}
                  </p>
                </div>

                <div className="border rounded-lg p-4 bg-white">
                  <div className="mb-4 text-center border-b pb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Ordine di Acquisto</h1>
                    <h2 className="text-lg text-gray-600">N° PO-{new Date().getFullYear()}-XXXX</h2>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h3 className="font-semibold mb-2 border-b border-gray-300 pb-2">Dettagli Ordine</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <p><strong>Data Ordine:</strong> {new Date().toLocaleDateString('it-IT')}</p>
                      <p><strong>Data Consegna Richiesta:</strong> {emailPreviewData.expectedDeliveryDate.toLocaleDateString('it-IT')} ({emailPreviewData.deliveryDays} giorni)</p>
                      <p><strong>Priorità:</strong> {emailPreviewData.formValues.priority.toUpperCase()}</p>
                      <p><strong>Fornitore:</strong> {emailPreviewData.supplier?.name}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h3 className="font-semibold mb-2 border-b border-gray-300 pb-2">Articoli Ordinati</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-100">
                      <th className="text-left p-2 border">Codice</th>
                      <th className="text-left p-2 border">Descrizione</th>
                      <th className="text-center p-2 border">Quantità</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border">{emailPreviewData.material.code}</td>
                      <td className="p-2 border">
                        <strong>{emailPreviewData.material.name}</strong><br />
                        <small className="text-gray-600">{emailPreviewData.material.description || ''}</small>
                      </td>
                      <td className="text-center p-2 border">{emailPreviewData.formValues.quantity} {emailPreviewData.material.unit}</td>
                    </tr>
                  </tbody>
                </table>
                  </div>


                  {emailPreviewData.formValues.notes && (
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <h3 className="font-semibold mb-2 border-b border-gray-300 pb-2">Note e Richieste</h3>
                      <p className="text-sm">{emailPreviewData.formValues.notes}</p>
                    </div>
                  )}

                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                    <h3 className="font-semibold text-yellow-800 mb-2">Richiesta di Conferma</h3>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Confermare la disponibilità dei materiali richiesti</li>
                      <li>• Confermare i tempi di produzione/consegna o comunicare eventuali tempistiche diverse</li>
                      <li>• Confermare i prezzi o comunicare le quotazioni aggiornate</li>
                      <li>• Comunicare eventuali note o richieste particolari</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="additionalNotes">Note aggiuntive per il fornitore (opzionale)</Label>
                    <Input
                      id="additionalNotes"
                      value={additionalEmailNotes}
                      onChange={(e) => setAdditionalEmailNotes(e.target.value)}
                      placeholder="Aggiungi eventuali note aggiuntive che verranno incluse nell'email..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEmailPreviewOpen(false);
                      setIsPurchaseOrderDialogOpen(true);
                    }}
                  >
                    Modifica Ordine
                  </Button>
                  <Button
                    onClick={confirmAndCreateOrder}
                    disabled={creatingOrder}
                  >
                    {creatingOrder ? "Invio in corso..." : "Conferma e Invia Email"}
                  </Button>
                </div>
              </div>
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
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Fornitore" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti i fornitori</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
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