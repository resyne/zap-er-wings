import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Search, Settings, Trash2, Flame, Zap, Logs } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const MODELS = ["Sebastian", "Realbosco", "Anastasia", "Ottavio"];
const SIZES = [80, 100, 120, 130];

// Power types based on model
const getPowerTypes = (model: string) => {
  if (model === "Ottavio") return ["Gas", "Legna"];
  if (model === "Realbosco") return ["Elettrico", "Gas", "Legna", "Rotante"];
  return ["Elettrico", "Gas", "Legna"];
};

// Pizza count based on size and power type
const getPizzaCount = (size: number, powerType: string) => {
  const isWood = powerType === "Legna";
  
  if (size === 80) return isWood ? "2 pizze" : "3 pizze";
  if (size === 100) return isWood ? "4 pizze" : "5-6 pizze";
  if (size === 120) return isWood ? "5 pizze" : "6-7 pizze";
  if (size === 130) return isWood ? "6 pizze" : "7-8 pizze";
  return "";
};

const getPowerIcon = (powerType: string) => {
  if (powerType === "Elettrico") return <Zap className="h-4 w-4" />;
  if (powerType === "Gas") return <Flame className="h-4 w-4" />;
  return <Logs className="h-4 w-4" />;
};

export default function ProductConfiguratorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  
  // Configuration form state
  const [configForm, setConfigForm] = useState({
    model_name: "",
    power_type: "",
    size_cm: 80,
    base_price_wood: 0,
    price_gas: 0,
    price_electric: 0,
    price_onsite_installation: 0,
  });

  // Fetch all configurations
  const { data: configurations, isLoading: configsLoading } = useQuery({
    queryKey: ["product-configurations", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("product_configurations")
        .select("*")
        .order("model_name")
        .order("size");

      if (searchQuery) {
        query = query.or(`model_name.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch shipping prices
  const { data: shippingPrices } = useQuery({
    queryKey: ["shipping-prices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_prices")
        .select("*")
        .order("size_cm");
      if (error) throw error;
      return data;
    },
  });

  // Create configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const pizzaCountWood = getPizzaCount(config.size_cm, "Legna");
      const pizzaCountGasElectric = getPizzaCount(config.size_cm, config.power_type);
      
      const { error } = await supabase.from("product_configurations").insert([{
        model_name: config.model_name,
        power_type: config.power_type,
        size: config.size_cm.toString(),
        base_price_wood: config.base_price_wood,
        price_gas: config.price_gas,
        price_electric: config.price_electric,
        price_onsite_installation: config.price_onsite_installation,
        pizza_count_wood: pizzaCountWood,
        pizza_count_gas_electric: pizzaCountGasElectric,
        is_available: true,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-configurations"] });
      setConfigDialogOpen(false);
      setConfigForm({
        model_name: "",
        power_type: "",
        size_cm: 80,
        base_price_wood: 0,
        price_gas: 0,
        price_electric: 0,
        price_onsite_installation: 0,
      });
      toast.success("Configurazione creata con successo");
    },
    onError: (error: any) => {
      toast.error("Errore nella creazione della configurazione: " + error.message);
    },
  });

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_configurations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-configurations"] });
      toast.success("Configurazione eliminata");
    },
  });

  const handleCreateConfig = (e: React.FormEvent) => {
    e.preventDefault();
    createConfigMutation.mutate(configForm);
  };

  // Group configurations by model
  const configsByModel = configurations?.reduce((acc: any, config: any) => {
    if (!acc[config.model_name]) {
      acc[config.model_name] = [];
    }
    acc[config.model_name].push(config);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Configuratore Forni</h1>
          <p className="text-muted-foreground">Gestisci i modelli, le configurazioni e i prezzi dei forni</p>
        </div>
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuova Configurazione
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuova Configurazione</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli della configurazione del forno
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modello *</Label>
                  <Select
                    value={configForm.model_name}
                    onValueChange={(value) => {
                      setConfigForm({ ...configForm, model_name: value, power_type: "" });
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona modello" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Alimentazione *</Label>
                  <Select
                    value={configForm.power_type}
                    onValueChange={(value) => setConfigForm({ ...configForm, power_type: value })}
                    required
                    disabled={!configForm.model_name}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona alimentazione" />
                    </SelectTrigger>
                    <SelectContent>
                      {configForm.model_name && getPowerTypes(configForm.model_name).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dimensione (cm) *</Label>
                  <Select
                    value={configForm.size_cm.toString()}
                    onValueChange={(value) => setConfigForm({ ...configForm, size_cm: parseInt(value) })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}cm - {getPizzaCount(size, configForm.power_type || "Legna")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prezzo Base (Legna) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={configForm.base_price_wood}
                    onChange={(e) => setConfigForm({ ...configForm, base_price_wood: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prezzo Gas</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={configForm.price_gas}
                    onChange={(e) => setConfigForm({ ...configForm, price_gas: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prezzo Elettrico</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={configForm.price_electric}
                    onChange={(e) => setConfigForm({ ...configForm, price_electric: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Prezzo Montaggio sul Posto</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={configForm.price_onsite_installation}
                    onChange={(e) => setConfigForm({ ...configForm, price_onsite_installation: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setConfigDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={createConfigMutation.isPending}>
                  Crea Configurazione
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Cerca per modello..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="configurations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="configurations">Configurazioni</TabsTrigger>
          <TabsTrigger value="shipping">Spedizione</TabsTrigger>
        </TabsList>

        <TabsContent value="configurations" className="space-y-6">
          {configsLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Caricamento configurazioni...</p>
            </div>
          ) : !configurations || configurations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nessuna configurazione</h3>
                <p className="text-muted-foreground mb-4">
                  Crea la prima configurazione per iniziare
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {MODELS.map((modelName) => {
                const modelConfigs = configsByModel?.[modelName] || [];
                if (modelConfigs.length === 0) return null;

                return (
                  <Card key={modelName}>
                    <CardHeader>
                      <CardTitle>{modelName}</CardTitle>
                      <CardDescription>
                        {modelConfigs.length} configurazioni disponibili
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4">
                        {modelConfigs.map((config: any) => (
                          <div
                            key={config.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                {getPowerIcon(config.power_type)}
                                <span className="font-medium">{config.power_type}</span>
                                <Badge variant="outline">{config.size_cm}cm</Badge>
                                <Badge variant="secondary">
                                  {config.power_type === "Legna" 
                                    ? config.pizza_count_wood 
                                    : config.pizza_count_gas_electric}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                                <div>
                                  <span className="font-medium">Base (Legna):</span> €{config.base_price_wood}
                                </div>
                                {config.price_gas > 0 && (
                                  <div>
                                    <span className="font-medium">Gas:</span> €{config.price_gas}
                                  </div>
                                )}
                                {config.price_electric > 0 && (
                                  <div>
                                    <span className="font-medium">Elettrico:</span> €{config.price_electric}
                                  </div>
                                )}
                                {config.price_onsite_installation > 0 && (
                                  <div>
                                    <span className="font-medium">Montaggio:</span> €{config.price_onsite_installation}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteConfigMutation.mutate(config.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shipping">
          <Card>
            <CardHeader>
              <CardTitle>Prezzi Spedizione</CardTitle>
              <CardDescription>
                Prezzi per la spedizione in Europa con imballaggio cassonato in legno
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {shippingPrices?.map((price: any) => (
                  <div
                    key={price.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">Forno {price.size_cm}cm</div>
                      <div className="text-sm text-muted-foreground">{price.description}</div>
                    </div>
                    <div className="text-2xl font-bold">€{price.price}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
