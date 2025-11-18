import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Image as ImageIcon, Video, Pencil, Package } from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/ui/file-upload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OvenModelManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedModelForProduct, setSelectedModelForProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({ product_id: "" });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    power_types: [] as string[],
    sizes_available: [] as number[],
  });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  const { data: models, isLoading } = useQuery({
    queryKey: ["oven-models"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oven_models")
        .select(`
          *,
          oven_model_products (
            id,
            price,
            product:products (
              id,
              name,
              code
            )
          )
        `)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, code, base_price")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const uploadMediaFiles = async (files: File[]) => {
    const urls: string[] = [];
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('oven-models')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('oven-models')
        .getPublicUrl(filePath);

      urls.push(publicUrl);
    }
    return urls;
  };

  const saveModelMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      setUploadingFiles(true);
      
      let imageUrls: string[] = editingModel?.image_urls || [];
      let videoUrls: string[] = editingModel?.video_urls || [];

      if (mediaFiles.length > 0) {
        const images = mediaFiles.filter(f => f.type.startsWith('image/'));
        const videos = mediaFiles.filter(f => f.type.startsWith('video/'));
        
        if (images.length > 0) {
          const newImageUrls = await uploadMediaFiles(images);
          imageUrls = [...imageUrls, ...newImageUrls];
        }
        if (videos.length > 0) {
          const newVideoUrls = await uploadMediaFiles(videos);
          videoUrls = [...videoUrls, ...newVideoUrls];
        }
      }

      if (editingModel) {
        const { error } = await supabase.from("oven_models").update({
          name: data.name,
          description: data.description,
          power_types: data.power_types,
          sizes_available: data.sizes_available,
          image_urls: imageUrls,
          video_urls: videoUrls,
        }).eq("id", editingModel.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase.from("oven_models").insert([{
          name: data.name,
          description: data.description,
          power_types: data.power_types,
          sizes_available: data.sizes_available,
          image_urls: imageUrls,
          video_urls: videoUrls,
        }]);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oven-models"] });
      handleCloseDialog();
      toast.success(editingModel ? "Modello aggiornato con successo" : "Modello creato con successo");
    },
    onError: (error: any) => {
      toast.error("Errore: " + error.message);
    },
    onSettled: () => {
      setUploadingFiles(false);
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("oven_models")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oven-models"] });
      toast.success("Modello eliminato");
    },
  });

  const togglePowerType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      power_types: prev.power_types.includes(type)
        ? prev.power_types.filter(t => t !== type)
        : [...prev.power_types, type]
    }));
  };

  const toggleSize = (size: number) => {
    setFormData(prev => ({
      ...prev,
      sizes_available: prev.sizes_available.includes(size)
        ? prev.sizes_available.filter(s => s !== size)
        : [...prev.sizes_available, size]
    }));
  };

  const handleEditModel = (model: any) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      description: model.description || "",
      power_types: model.power_types || [],
      sizes_available: model.sizes_available || [],
    });
    setMediaFiles([]);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingModel(null);
    setFormData({ name: "", description: "", power_types: [], sizes_available: [] });
    setMediaFiles([]);
  };

  const addProductMutation = useMutation({
    mutationFn: async ({ modelId, productId, price }: { modelId: string; productId: string; price: number }) => {
      const { error } = await supabase.from("oven_model_products").insert({
        oven_model_id: modelId,
        product_id: productId,
        price: price,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oven-models"] });
      setProductDialogOpen(false);
      setProductForm({ product_id: "" });
      toast.success("Prodotto collegato con successo");
    },
    onError: (error: any) => {
      toast.error("Errore: " + error.message);
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from("oven_model_products")
        .delete()
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["oven-models"] });
      toast.success("Prodotto rimosso");
    },
  });

  const handleAddProduct = (model: any) => {
    setSelectedModelForProduct(model);
    setProductForm({ product_id: "" });
    setProductDialogOpen(true);
  };

  const handleSaveProduct = () => {
    if (!productForm.product_id) {
      toast.error("Seleziona un prodotto");
      return;
    }
    const selectedProduct = products?.find(p => p.id === productForm.product_id);
    if (!selectedProduct?.base_price) {
      toast.error("Il prodotto selezionato non ha un prezzo impostato");
      return;
    }
    addProductMutation.mutate({
      modelId: selectedModelForProduct.id,
      productId: productForm.product_id,
      price: selectedProduct.base_price,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Gestione Modelli di Forni</h3>
        <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Modello
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingModel ? "Modifica Modello" : "Crea Nuovo Modello"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveModelMutation.mutate(formData); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Modello *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Alimentazioni Disponibili *</Label>
                <div className="flex flex-wrap gap-2">
                  {['Elettrico', 'Gas', 'Legna', 'Rotante'].map((type) => (
                    <Badge
                      key={type}
                      variant={formData.power_types.includes(type) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => togglePowerType(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dimensioni Disponibili (cm) *</Label>
                <div className="flex flex-wrap gap-2">
                  {[80, 100, 120, 130].map((size) => (
                    <Badge
                      key={size}
                      variant={formData.sizes_available.includes(size) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => toggleSize(size)}
                    >
                      {size}cm
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto e Video</Label>
                <FileUpload
                  value={mediaFiles}
                  onChange={setMediaFiles}
                  maxFiles={10}
                  acceptedFileTypes={[
                    'image/png', 'image/jpg', 'image/jpeg', 'image/webp',
                    'video/mp4', 'video/quicktime', 'video/x-msvideo'
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Annulla
                </Button>
                <Button type="submit" disabled={saveModelMutation.isPending || uploadingFiles}>
                  {uploadingFiles ? "Caricamento..." : (editingModel ? "Aggiorna Modello" : "Crea Modello")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Caricamento...</div>
      ) : !models || models.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nessun modello disponibile</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model: any) => (
            <Card key={model.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{model.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditModel(model)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteModelMutation.mutate(model.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {model.image_urls && model.image_urls.length > 0 && (
                  <div className="aspect-video bg-muted rounded-md overflow-hidden">
                    <img
                      src={model.image_urls[0]}
                      alt={model.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {model.description && (
                  <p className="text-sm text-muted-foreground">{model.description}</p>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Alimentazioni:</span>
                    <div className="flex flex-wrap gap-1">
                      {model.power_types?.map((type: string) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Dimensioni:</span>
                    <div className="flex flex-wrap gap-1">
                      {model.sizes_available?.map((size: number) => (
                        <Badge key={size} variant="secondary" className="text-xs">
                          {size}cm
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {model.image_urls && model.image_urls.length > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        {model.image_urls.length} foto
                      </span>
                    )}
                    {model.video_urls && model.video_urls.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        {model.video_urls.length} video
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Prodotti Collegati</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddProduct(model)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Aggiungi Prodotto
                    </Button>
                  </div>
                  {model.oven_model_products && model.oven_model_products.length > 0 ? (
                    <div className="space-y-2">
                      {model.oven_model_products.map((link: any) => (
                        <div key={link.id} className="flex items-center justify-between bg-muted/50 p-2 rounded">
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3" />
                            <span className="text-sm">{link.product?.name}</span>
                            <Badge variant="outline" className="text-xs">
                              €{link.price.toFixed(2)}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeProductMutation.mutate(link.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nessun prodotto collegato</p>
                  )}
                </div>

                <Badge variant={model.is_active ? "default" : "secondary"}>
                  {model.is_active ? "Attivo" : "Disattivo"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collega Prodotto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Prodotto</Label>
              <Select
                value={productForm.product_id}
                onValueChange={(value) => setProductForm({ product_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un prodotto" />
                </SelectTrigger>
                <SelectContent>
                  {products?.filter(p => 
                    !selectedModelForProduct?.oven_model_products?.some((link: any) => link.product?.id === p.id)
                  ).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.code} - {product.name} - €{product.base_price?.toFixed(2) || 'N/A'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Il prezzo verrà preso automaticamente dall'anagrafica prodotto
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setProductDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleSaveProduct} disabled={addProductMutation.isPending}>
                Salva
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
