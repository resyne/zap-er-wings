import React, { useState, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Search, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface BrandAsset {
  id: string;
  name: string;
  type: "color" | "icon" | "logo";
  file_url: string;
  file_size?: number;
  mime_type?: string;
  created_at?: string;
}

interface Brand {
  id: string;
  name: string;
  colorPalette: BrandAsset[];
  icons: BrandAsset[];
  logos: BrandAsset[];
}

const BrandkitPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  const brandNames = ["ZAPPER", "ZAPPER Pro", "Vesuviano", "VesuvioBuono"];

  // Load brand assets from database
  useEffect(() => {
    loadBrandAssets();
  }, []);

  const loadBrandAssets = async () => {
    try {
      const { data: assets, error } = await supabase
        .from('brand_assets')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group assets by brand and type
      const brandMap: Record<string, Brand> = {};
      
      brandNames.forEach(brandName => {
        brandMap[brandName] = {
          id: brandName.toLowerCase().replace(/\s+/g, '-'),
          name: brandName,
          colorPalette: [],
          icons: [],
          logos: []
        };
      });

      assets?.forEach(asset => {
        if (brandMap[asset.brand_name]) {
          const brandAsset: BrandAsset = {
            id: asset.id,
            name: asset.asset_name,
            type: asset.asset_type as "color" | "icon" | "logo",
            file_url: asset.file_url,
            file_size: asset.file_size,
            mime_type: asset.mime_type,
            created_at: asset.created_at
          };

          if (asset.asset_type === 'color') {
            brandMap[asset.brand_name].colorPalette.push(brandAsset);
          } else if (asset.asset_type === 'icon') {
            brandMap[asset.brand_name].icons.push(brandAsset);
          } else if (asset.asset_type === 'logo') {
            brandMap[asset.brand_name].logos.push(brandAsset);
          }
        }
      });

      setBrands(Object.values(brandMap));
    } catch (error) {
      console.error('Error loading brand assets:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare gli asset del brand.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = useCallback(async (result: DropResult) => {
    console.log('Drag end result:', result);
    if (!result.destination) {
      console.log('No destination, drag cancelled');
      return;
    }

    const { source, destination } = result;
    const [sourceBrandId, sourceSection] = source.droppableId.split('-');
    const [destBrandId, destSection] = destination.droppableId.split('-');
    
    if (source.droppableId === destination.droppableId) {
      // Reorder within the same section - no DB update needed for order
      setBrands(prev => prev.map(brand => {
        if (brand.id === sourceBrandId) {
          const section = sourceSection as keyof Pick<Brand, 'colorPalette' | 'icons' | 'logos'>;
          const newAssets = Array.from(brand[section]);
          const [reorderedAsset] = newAssets.splice(source.index, 1);
          newAssets.splice(destination.index, 0, reorderedAsset);
          return { ...brand, [section]: newAssets };
        }
        return brand;
      }));
    } else {
      // Move asset between sections or brands - update DB
      const sourceBrand = brands.find(b => b.id === sourceBrandId);
      const destBrand = brands.find(b => b.id === destBrandId);
      
      if (!sourceBrand || !destBrand) return;
      
      const sourceSection_ = sourceSection as keyof Pick<Brand, 'colorPalette' | 'icons' | 'logos'>;
      const destSection_ = destSection as keyof Pick<Brand, 'colorPalette' | 'icons' | 'logos'>;
      
      const sourceAssets = Array.from(sourceBrand[sourceSection_]);
      const movedAsset = sourceAssets[source.index];
      
      if (!movedAsset) return;
      
      try {
        // Update asset in database
        const newAssetType = destSection === "colorPalette" ? "color" : destSection === "icons" ? "icon" : "logo";
        
        const { error } = await supabase
          .from('brand_assets')
          .update({
            brand_name: destBrand.name,
            asset_type: newAssetType
          })
          .eq('id', movedAsset.id);

        if (error) throw error;

        // Update local state
        setBrands(prev => {
          const sourceBrand = prev.find(b => b.id === sourceBrandId);
          const destBrand = prev.find(b => b.id === destBrandId);
          
          if (!sourceBrand || !destBrand) return prev;
          
          const sourceAssets = Array.from(sourceBrand[sourceSection_]);
          const destAssets = Array.from(destBrand[destSection_]);
          const [movedAsset] = sourceAssets.splice(source.index, 1);
          
          // Update asset type when moving between sections
          if (sourceSection !== destSection) {
            movedAsset.type = destSection as "color" | "icon" | "logo";
          }
          
          destAssets.splice(destination.index, 0, movedAsset);
          
          return prev.map(brand => {
            if (brand.id === sourceBrandId) {
              return { ...brand, [sourceSection_]: sourceAssets };
            }
            if (brand.id === destBrandId) {
              return { ...brand, [destSection_]: destAssets };
            }
            return brand;
          });
        });
        
        toast({
          title: "Asset spostato",
          description: "L'asset è stato spostato nella nuova sezione.",
        });
      } catch (error) {
        console.error('Error updating asset:', error);
        toast({
          title: "Errore",
          description: "Impossibile spostare l'asset.",
          variant: "destructive"
        });
      }
    }
  }, [toast, brands]);

  const handleFileUpload = useCallback(async (brandName: string, section: "colorPalette" | "icons" | "logos", files: FileList | null) => {
    if (!files) return;
    
    const assetType = section === "colorPalette" ? "color" : section === "icons" ? "icon" : "logo";
    
    for (const file of Array.from(files)) {
      // Only accept image files
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Formato non supportato",
          description: "Sono accettati solo file immagine.",
          variant: "destructive"
        });
        continue;
      }

      try {
        // Upload file to Supabase storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${brandName.toLowerCase()}/${assetType}/${Date.now()}-${Math.random()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(fileName);

        // Save to database
        const { data: assetData, error: dbError } = await supabase
          .from('brand_assets')
          .insert({
            brand_name: brandName,
            asset_type: assetType,
            asset_name: file.name,
            file_url: publicUrl,
            file_size: file.size,
            mime_type: file.type
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Reload assets
        await loadBrandAssets();
        
        toast({
          title: "File caricato",
          description: `${file.name} caricato con successo.`,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Errore upload",
          description: `Impossibile caricare ${file.name}.`,
          variant: "destructive"
        });
      }
    }
  }, [toast, loadBrandAssets]);


  const handleDeleteAsset = useCallback(async (brandName: string, section: "colorPalette" | "icons" | "logos", assetId: string) => {
    try {
      // Find the asset to get file path
      const brand = brands.find(b => b.name === brandName);
      if (!brand) return;
      
      const allAssets = [...brand.colorPalette, ...brand.icons, ...brand.logos];
      const asset = allAssets.find(a => a.id === assetId);
      if (!asset) return;

      // Delete from storage
      const filePath = asset.file_url.split('/').slice(-3).join('/'); // Extract path after bucket name
      await supabase.storage
        .from('brand-assets')
        .remove([filePath]);

      // Delete from database
      const { error } = await supabase
        .from('brand_assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;

      // Reload assets
      await loadBrandAssets();
      
      toast({
        title: "Asset eliminato",
        description: "L'asset è stato rimosso dal brand.",
      });
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'asset.",
        variant: "destructive"
      });
    }
  }, [brands, loadBrandAssets, toast]);

  const getBrandColor = (brandId: string) => {
    const colors = {
      "zapper": "bg-blue-50 border-blue-200",
      "zapper-pro": "bg-purple-50 border-purple-200", 
      "vesuviano": "bg-orange-50 border-orange-200",
      "vesuvio-buono": "bg-green-50 border-green-200"
    };
    return colors[brandId as keyof typeof colors] || "bg-gray-50 border-gray-200";
  };

  const handlePreviewAsset = useCallback((asset: BrandAsset) => {
    if (asset.file_url) {
      window.open(asset.file_url, '_blank');
    }
  }, []);

  const filteredBrands = brands.filter(brand => 
    brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    [...brand.colorPalette, ...brand.icons, ...brand.logos].some(asset => 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Caricamento asset del brand...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brandkit</h1>
          <p className="text-gray-600 mt-2">Gestisci i loghi dei tuoi brand</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Cerca brand o asset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
        </div>
      </div>

      <DragDropContext 
        onDragEnd={handleDragEnd}
        onDragStart={() => console.log('Drag started')}
        onDragUpdate={() => console.log('Drag updating')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredBrands.map((brand) => {
            const totalAssets = brand.colorPalette.length + brand.icons.length + brand.logos.length;
            
            const renderSection = (
              sectionName: string,
              sectionKey: "colorPalette" | "icons" | "logos",
              assets: BrandAsset[],
              placeholder: string
            ) => (
              <div key={sectionKey} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-700">{sectionName}</h4>
                  <Badge variant="outline" className="text-xs">
                    {assets.length}
                  </Badge>
                </div>
                
                {/* Upload Area for this section */}
                <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.svg"
                    onChange={(e) => handleFileUpload(brand.name, sectionKey, e.target.files)}
                    className="hidden"
                    id={`file-upload-${brand.id}-${sectionKey}`}
                  />
                  <label htmlFor={`file-upload-${brand.id}-${sectionKey}`} className="cursor-pointer block">
                    <Upload className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-600">Carica {sectionName.toLowerCase()}</p>
                  </label>
                </div>

                {/* Assets Droppable Area */}
                <Droppable droppableId={`${brand.id}-${sectionKey}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[80px] rounded-lg border border-dashed p-2 space-y-2 transition-colors ${
                        snapshot.isDraggingOver 
                          ? "border-blue-400 bg-blue-50" 
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      {assets.length === 0 && (
                        <p className="text-center text-gray-400 text-xs py-4">
                          {placeholder}
                        </p>
                      )}
                      
                      {assets.map((asset, index) => (
                        <Draggable key={asset.id} draggableId={asset.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`p-2 rounded border bg-white shadow-sm flex items-center justify-between transition-all ${
                                snapshot.isDragging ? "shadow-lg rotate-1" : "hover:shadow-md"
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {asset.file_url && (
                                  <div className="w-8 h-8 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    <img 
                                      src={asset.file_url} 
                                      alt={asset.name}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium truncate" title={asset.name}>
                                    {asset.name}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    {asset.file_size ? `${(asset.file_size / 1024).toFixed(1)} KB` : 'File'}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {asset.file_url && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePreviewAsset(asset)}
                                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                                      title="Anteprima"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = asset.file_url;
                                        link.download = asset.name;
                                        link.click();
                                      }}
                                      className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                                      title="Scarica"
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAsset(brand.name, sectionKey, asset.id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  title="Elimina"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );

            return (
              <Card key={brand.id} className={`h-fit ${getBrandColor(brand.id)}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center justify-between">
                    {brand.name}
                    <Badge variant="secondary" className="text-xs">
                      {totalAssets} asset{totalAssets !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {renderSection("Color Palette", "colorPalette", brand.colorPalette, "Nessun colore caricato")}
                  {renderSection("Icone", "icons", brand.icons, "Nessuna icona caricata")}
                  {renderSection("Loghi", "logos", brand.logos, "Nessun logo caricato")}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

export default BrandkitPage;