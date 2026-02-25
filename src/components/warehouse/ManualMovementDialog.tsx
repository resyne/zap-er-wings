import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Loader2, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ManualMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: "carico" | "scarico";
}

export function ManualMovementDialog({ open, onOpenChange, movementType }: ManualMovementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const [formData, setFormData] = useState({
    item_description: "",
    quantity: "",
    unit: "pz",
    warehouse: "sede-principale",
    notes: "",
    supplier_id: "",
    product_id: "",
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-for-movement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, code")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-movement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, code, unit_of_measure")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // Filter products based on search
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  // Get selected supplier/product names for display
  const selectedSupplier = suppliers.find((s) => s.id === formData.supplier_id);
  const selectedProduct = products.find((p) => p.id === formData.product_id);

  // Auto-fill description and unit when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setFormData((prev) => ({
        ...prev,
        item_description: selectedProduct.name,
        unit: selectedProduct.unit_of_measure || prev.unit,
      }));
    }
  }, [selectedProduct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_description || !formData.quantity) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("stock_movements").insert({
        movement_date: new Date().toISOString(),
        movement_type: movementType,
        origin_type: "Manuale",
        item_description: formData.item_description,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        warehouse: formData.warehouse,
        status: "confermato",
        notes: formData.notes || null,
        created_by: user?.id,
        supplier_id: formData.supplier_id || null,
        material_id: formData.product_id || null,
      });

      if (error) throw error;

      toast({ title: "Movimento creato", description: `${movementType === "carico" ? "Carico" : "Scarico"} registrato con successo` });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-movements"] });
      onOpenChange(false);
      setFormData({ item_description: "", quantity: "", unit: "pz", warehouse: "sede-principale", notes: "", supplier_id: "", product_id: "" });
      setSupplierSearch("");
      setProductSearch("");
    } catch (error) {
      console.error("Error creating movement:", error);
      toast({ title: "Errore", description: "Impossibile creare il movimento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Icon = movementType === "carico" ? TrendingUp : TrendingDown;
  const color = movementType === "carico" ? "text-green-600" : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            {movementType === "carico" ? "Carico Merci" : "Scarico Merci"}
          </DialogTitle>
          <DialogDescription>
            Registra un movimento manuale di {movementType === "carico" ? "carico" : "scarico"} merci
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier Selection */}
          <div className="space-y-2">
            <Label>Fornitore</Label>
            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedSupplier ? (
                    <span>{selectedSupplier.name} ({selectedSupplier.code})</span>
                  ) : (
                    <span className="text-muted-foreground">Seleziona fornitore...</span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Cerca fornitore..."
                    value={supplierSearch}
                    onValueChange={setSupplierSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nessun fornitore trovato</CommandEmpty>
                    <CommandGroup>
                      {filteredSuppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.id}
                          onSelect={() => {
                            setFormData({ ...formData, supplier_id: supplier.id });
                            setSupplierOpen(false);
                            setSupplierSearch("");
                          }}
                        >
                          <span className="font-medium">{supplier.name}</span>
                          <span className="ml-2 text-muted-foreground">({supplier.code})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label>Prodotto</Label>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={productOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedProduct ? (
                    <span>{selectedProduct.name} ({selectedProduct.code})</span>
                  ) : (
                    <span className="text-muted-foreground">Seleziona prodotto...</span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Cerca prodotto..."
                    value={productSearch}
                    onValueChange={setProductSearch}
                  />
                  <CommandList>
                    <CommandEmpty>Nessun prodotto trovato</CommandEmpty>
                    <CommandGroup>
                      {filteredProducts.map((product) => (
                        <CommandItem
                          key={product.id}
                          value={product.id}
                          onSelect={() => {
                            setFormData({ ...formData, product_id: product.id });
                            setProductOpen(false);
                            setProductSearch("");
                          }}
                        >
                          <span className="font-medium">{product.name}</span>
                          <span className="ml-2 text-muted-foreground">({product.code})</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item_description">Descrizione Articolo *</Label>
            <Input
              id="item_description"
              value={formData.item_description}
              onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
              placeholder="Es. Forno rotativo mod. XYZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantità *</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unità di Misura</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pz">Pezzi</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="mt">Metri</SelectItem>
                  <SelectItem value="lt">Litri</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="warehouse">Deposito</Label>
            <Select value={formData.warehouse} onValueChange={(v) => setFormData({ ...formData, warehouse: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sede-principale">Sede Principale</SelectItem>
                <SelectItem value="magazzino-esterno">Magazzino Esterno</SelectItem>
                <SelectItem value="produzione">Produzione</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Note aggiuntive sul movimento..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading} className={movementType === "carico" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registra {movementType === "carico" ? "Carico" : "Scarico"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}