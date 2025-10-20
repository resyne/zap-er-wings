import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Plus, Search, Edit, Trash2, Package2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { formatAmount } from "@/lib/formatAmount";

const materialSchema = z.object({
  name: z.string().min(1, "Nome obbligatorio"),
  description: z.string().optional(),
  material_type: z.enum(["materia_prima", "semilavorato", "materiale"]),
  category: z.string().optional(),
  unit: z.string().default("pcs"),
  cost: z.number().min(0).default(0),
  supplier_id: z.string().optional(),
  minimum_stock: z.number().min(0).default(0),
  maximum_stock: z.number().min(0).default(0),
  current_stock: z.number().min(0).default(0),
  location: z.string().optional(),
});

type MaterialFormData = z.infer<typeof materialSchema>;

interface Material {
  id: string;
  code: string;
  name: string;
  description?: string;
  material_type: "materia_prima" | "semilavorato" | "materiale";
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
  suppliers?: {
    name: string;
  };
}

interface Supplier {
  id: string;
  name: string;
}

const materialTypeLabels = {
  materia_prima: "Materia Prima",
  semilavorato: "Semilavorato", 
  materiale: "Materiale"
};

const materialTypeBadgeVariants = {
  materia_prima: "default",
  semilavorato: "secondary",
  materiale: "outline"
} as const;

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { hideAmounts } = useHideAmounts();

  const form = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      description: "",
      material_type: "materiale",
      category: "",
      unit: "pcs",
      cost: 0,
      minimum_stock: 0,
      maximum_stock: 0,
      current_stock: 0,
      location: "",
    },
  });

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials' as any)
        .select(`
          id,
          code,
          name,
          description,
          material_type,
          category,
          unit,
          cost,
          supplier_id,
          minimum_stock,
          maximum_stock,
          current_stock,
          location,
          active,
          created_at,
          updated_at
        `)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch supplier names separately
      const materialsWithSuppliers = await Promise.all(
        (data || []).map(async (material: any) => {
          if (material.supplier_id) {
            const { data: supplier } = await supabase
              .from('suppliers')
              .select('name')
              .eq('id', material.supplier_id)
              .single();
            
            return {
              ...material,
              suppliers: supplier
            };
          }
          return material;
        })
      );

      setMaterials(materialsWithSuppliers);
    } catch (error) {
      console.error('Error fetching materials:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i materiali",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchSuppliers();
  }, []);

  const handleSubmit = async (data: MaterialFormData) => {
    try {
      const submitData = {
        ...data,
        supplier_id: data.supplier_id || null,
      };

      if (editingMaterial) {
        const { error } = await supabase
          .from('materials' as any)
          .update(submitData)
          .eq('id', editingMaterial.id);

        if (error) throw error;

        toast({
          title: "Materiale aggiornato",
          description: "Il materiale è stato aggiornato con successo",
        });
      } else {
        const { error } = await supabase
          .from('materials' as any)
          .insert(submitData);

        if (error) throw error;

        toast({
          title: "Materiale creato",
          description: "Il materiale è stato creato con successo",
        });
      }

      setIsDialogOpen(false);
      setEditingMaterial(null);
      form.reset();
      fetchMaterials();
    } catch (error) {
      console.error('Error saving material:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il materiale",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (material: Material) => {
    setEditingMaterial(material);
    form.reset({
      name: material.name,
      description: material.description || "",
      material_type: material.material_type,
      category: material.category || "",
      unit: material.unit,
      cost: material.cost,
      supplier_id: material.supplier_id || "",
      minimum_stock: material.minimum_stock,
      maximum_stock: material.maximum_stock,
      current_stock: material.current_stock,
      location: material.location || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo materiale?')) return;

    try {
      const { error } = await supabase
        .from('materials' as any)
        .update({ active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Materiale eliminato",
        description: "Il materiale è stato eliminato con successo",
      });

      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il materiale",
        variant: "destructive",
      });
    }
  };

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      material.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      materialTypeLabels[material.material_type].toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSupplier = !selectedSupplier || material.supplier_id === selectedSupplier;
    
    return matchesSearch && matchesSupplier;
  });

  return (
    <div className="flex-1 space-y-6 p-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Anagrafica Materiali</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Package2 className="h-6 w-6" />
          <h1 className="text-3xl font-bold tracking-tight">Anagrafica Materiali</h1>
        </div>
        {selectedSupplier && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingMaterial(null);
                  form.reset();
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Materiale
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMaterial ? "Modifica Materiale" : "Nuovo Materiale"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="material_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo Materiale *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="materia_prima">Materia Prima</SelectItem>
                            <SelectItem value="semilavorato">Semilavorato</SelectItem>
                            <SelectItem value="materiale">Materiale</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrizione</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoria</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unità di Misura</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pcs">Pezzi</SelectItem>
                            <SelectItem value="kg">Chilogrammi</SelectItem>
                            <SelectItem value="mt">Metri</SelectItem>
                            <SelectItem value="mq">Metri Quadri</SelectItem>
                            <SelectItem value="mc">Metri Cubi</SelectItem>
                            <SelectItem value="lt">Litri</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fornitore</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona fornitore" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ubicazione</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="minimum_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scorta Minima</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maximum_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scorta Massima</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="current_stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scorta Attuale</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingMaterial(null);
                    }}
                  >
                    Annulla
                  </Button>
                  <Button type="submit">
                    {editingMaterial ? "Aggiorna" : "Crea"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selezione Fornitore</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium min-w-fit">Seleziona Fornitore:</label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Scegli un fornitore..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers
                    .filter(supplier => supplier.id)
                    .map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedSupplier && (
              <p className="text-sm text-muted-foreground">
                Seleziona un fornitore per visualizzare i suoi materiali.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedSupplier && (
        <Card>
          <CardHeader>
            <CardTitle>Ricerca Materiali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per nome, codice, categoria o tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {selectedSupplier && (
        <Card>
          <CardHeader>
            <CardTitle>Elenco Materiali</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Caricamento...</div>
            ) : filteredMaterials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nessun materiale trovato per questo fornitore
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Fornitore</TableHead>
                    <TableHead>Scorte</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((material) => (
                    <TableRow key={material.id}>
                      <TableCell className="font-mono">{material.code}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{material.name}</div>
                          {material.description && (
                            <div className="text-sm text-muted-foreground">
                              {material.description.length > 50 
                                ? material.description.substring(0, 50) + "..."
                                : material.description
                              }
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={materialTypeBadgeVariants[material.material_type]}>
                          {materialTypeLabels[material.material_type]}
                        </Badge>
                      </TableCell>
                      <TableCell>{material.category || "-"}</TableCell>
                      <TableCell>{material.suppliers?.name || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>Attuale: {material.current_stock} {material.unit}</div>
                          <div className="text-muted-foreground">
                            Min: {material.minimum_stock} / Max: {material.maximum_stock}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatAmount(material.cost, hideAmounts)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(material)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(material.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}