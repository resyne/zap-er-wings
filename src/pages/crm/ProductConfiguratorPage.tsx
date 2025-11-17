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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Search, Settings, Link2, Image, Video, Trash2, ExternalLink, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function ProductConfiguratorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  // Fetch products (only ovens)
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["configurator-products", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .eq("product_type", "oven")
        .eq("is_active", true)
        .order("name");

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch configurations for selected product
  const { data: configurations } = useQuery({
    queryKey: ["product-configurations", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      const { data, error } = await supabase
        .from("product_configurations")
        .select("*")
        .eq("product_id", selectedProduct.id)
        .order("model_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct?.id,
  });

  // Fetch media for selected product
  const { data: media } = useQuery({
    queryKey: ["product-media", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      const { data, error } = await supabase
        .from("product_configurator_media")
        .select("*")
        .eq("product_id", selectedProduct.id)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct?.id,
  });

  // Fetch configurator links
  const { data: links } = useQuery({
    queryKey: ["configurator-links", selectedProduct?.id],
    queryFn: async () => {
      if (!selectedProduct?.id) return [];
      const { data, error } = await supabase
        .from("product_configurator_links")
        .select(`
          *,
          leads(company_name, contact_name),
          products(name, code)
        `)
        .eq("product_id", selectedProduct.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct?.id,
  });

  // Create configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      const { error } = await supabase.from("product_configurations").insert([config]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-configurations"] });
      toast.success("Configurazione creata");
      setConfigDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Create media mutation
  const createMediaMutation = useMutation({
    mutationFn: async (mediaData: any) => {
      const { error } = await supabase.from("product_configurator_media").insert([mediaData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-media"] });
      toast.success("Media aggiunto");
      setMediaDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: async (linkData: any) => {
      const { data, error } = await supabase
        .from("product_configurator_links")
        .insert([{ ...linkData, created_by: user?.id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["configurator-links"] });
      const link = `${window.location.origin}/configurator/${data.unique_code}`;
      navigator.clipboard.writeText(link);
      toast.success("Link creato e copiato negli appunti");
      setLinkDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Delete media mutation
  const deleteMediaMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_configurator_media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-media"] });
      toast.success("Media eliminato");
    },
  });

  const handleCreateConfiguration = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createConfigMutation.mutate({
      product_id: selectedProduct.id,
      model_name: formData.get("model_name"),
      power_type: formData.get("power_type"),
      size: formData.get("size"),
      installation_type: formData.get("installation_type"),
    });
  };

  const handleCreateMedia = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMediaMutation.mutate({
      product_id: selectedProduct.id,
      media_type: formData.get("media_type"),
      media_url: formData.get("media_url"),
      title: formData.get("title"),
      description: formData.get("description"),
      display_order: parseInt(formData.get("display_order") as string) || 0,
    });
  };

  const handleCreateLink = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const expiresAt = formData.get("expires_at");
    createLinkMutation.mutate({
      product_id: selectedProduct.id,
      title: formData.get("title"),
      description: formData.get("description"),
      expires_at: expiresAt ? new Date(expiresAt as string).toISOString() : null,
    });
  };

  const copyLink = (code: string) => {
    const link = `${window.location.origin}/configurator/${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiato");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuratore Prodotti</h1>
          <p className="text-muted-foreground">Gestisci configurazioni, media e link per i forni</p>
        </div>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Prodotti</TabsTrigger>
          <TabsTrigger value="configurations" disabled={!selectedProduct}>
            Configurazioni
          </TabsTrigger>
          <TabsTrigger value="media" disabled={!selectedProduct}>
            Media
          </TabsTrigger>
          <TabsTrigger value="links" disabled={!selectedProduct}>
            Link Pubblici
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca forni..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productsLoading ? (
              <p>Caricamento...</p>
            ) : products?.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">
                Nessun forno trovato
              </p>
            ) : (
              products?.map((product: any) => (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all ${
                    selectedProduct?.id === product.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription>{product.code}</CardDescription>
                      </div>
                      <Badge className="bg-orange-500">Forno</Badge>
                    </div>
                  </CardHeader>
                  {product.description && (
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="configurations" className="space-y-4">
          {selectedProduct && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Gestisci le configurazioni disponibili
                  </p>
                </div>
                <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Nuova Configurazione
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Crea Configurazione</DialogTitle>
                      <DialogDescription>
                        Aggiungi una nuova configurazione per {selectedProduct.name}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateConfiguration} className="space-y-4">
                      <div>
                        <Label htmlFor="model_name">Modello</Label>
                        <Input id="model_name" name="model_name" required />
                      </div>
                      <div>
                        <Label htmlFor="power_type">Alimentazione</Label>
                        <Select name="power_type" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="electric">Elettrico</SelectItem>
                            <SelectItem value="gas">Gas</SelectItem>
                            <SelectItem value="mixed">Misto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="size">Dimensione</Label>
                        <Input id="size" name="size" placeholder="es. 60x40, 80x60" required />
                      </div>
                      <div>
                        <Label htmlFor="installation_type">Tipo Installazione</Label>
                        <Select name="installation_type" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shipped">Spedito</SelectItem>
                            <SelectItem value="installed">Montato sul posto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="submit" className="w-full">
                        Crea Configurazione
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {configurations?.map((config: any) => (
                  <Card key={config.id}>
                    <CardHeader>
                      <CardTitle className="text-base">{config.model_name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Alimentazione:</span>
                        <Badge variant="outline">{config.power_type}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Dimensione:</span>
                        <span>{config.size}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Installazione:</span>
                        <Badge variant={config.installation_type === "installed" ? "default" : "secondary"}>
                          {config.installation_type === "installed" ? "Montato" : "Spedito"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {configurations?.length === 0 && (
                  <p className="text-muted-foreground col-span-full text-center py-8">
                    Nessuna configurazione disponibile
                  </p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="media" className="space-y-4">
          {selectedProduct && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Gestisci foto e video per il configuratore
                  </p>
                </div>
                <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi Media
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Aggiungi Media</DialogTitle>
                      <DialogDescription>
                        Aggiungi foto o video per {selectedProduct.name}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateMedia} className="space-y-4">
                      <div>
                        <Label htmlFor="media_type">Tipo</Label>
                        <Select name="media_type" required>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="image">Immagine</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="media_url">URL</Label>
                        <Input id="media_url" name="media_url" type="url" required />
                      </div>
                      <div>
                        <Label htmlFor="title">Titolo</Label>
                        <Input id="title" name="title" />
                      </div>
                      <div>
                        <Label htmlFor="description">Descrizione</Label>
                        <Textarea id="description" name="description" />
                      </div>
                      <div>
                        <Label htmlFor="display_order">Ordine</Label>
                        <Input id="display_order" name="display_order" type="number" defaultValue="0" />
                      </div>
                      <Button type="submit" className="w-full">
                        Aggiungi Media
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {media?.map((item: any) => (
                  <Card key={item.id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                          {item.media_type === "image" ? (
                            <Image className="h-12 w-12 text-muted-foreground" />
                          ) : (
                            <Video className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                        {item.title && <p className="font-medium text-sm">{item.title}</p>}
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => window.open(item.media_url, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMediaMutation.mutate(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {media?.length === 0 && (
                  <p className="text-muted-foreground col-span-full text-center py-8">
                    Nessun media disponibile
                  </p>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          {selectedProduct && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Crea link pubblici condivisibili
                  </p>
                </div>
                <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea Link
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Crea Link Pubblico</DialogTitle>
                      <DialogDescription>
                        Crea un link univoco per {selectedProduct.name}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateLink} className="space-y-4">
                      <div>
                        <Label htmlFor="title">Titolo</Label>
                        <Input id="title" name="title" required />
                      </div>
                      <div>
                        <Label htmlFor="description">Descrizione</Label>
                        <Textarea id="description" name="description" />
                      </div>
                      <div>
                        <Label htmlFor="expires_at">Scadenza (opzionale)</Label>
                        <Input id="expires_at" name="expires_at" type="datetime-local" />
                      </div>
                      <Button type="submit" className="w-full">
                        Crea Link
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {links?.map((link: any) => (
                  <Card key={link.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{link.title}</CardTitle>
                          {link.description && (
                            <CardDescription>{link.description}</CardDescription>
                          )}
                        </div>
                        <Badge variant={link.is_active ? "default" : "secondary"}>
                          {link.is_active ? "Attivo" : "Inattivo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <code className="flex-1 bg-muted px-2 py-1 rounded text-xs">
                          {window.location.origin}/configurator/{link.unique_code}
                        </code>
                        <Button size="sm" variant="ghost" onClick={() => copyLink(link.unique_code)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(`/configurator/${link.unique_code}`, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {link.view_count || 0} visualizzazioni
                        </span>
                        {link.expires_at && (
                          <span>Scade: {new Date(link.expires_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {links?.length === 0 && (
                  <p className="text-muted-foreground text-center py-8">
                    Nessun link creato
                  </p>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
