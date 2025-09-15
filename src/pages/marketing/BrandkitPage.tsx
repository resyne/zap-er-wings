import React, { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, Search, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrandAsset {
  id: string;
  name: string;
  type: "logo";
  file?: File;
  url?: string;
  description?: string;
}

interface Brand {
  id: string;
  name: string;
  assets: BrandAsset[];
}

const BrandkitPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  
  const [brands, setBrands] = useState<Brand[]>([
    {
      id: "zapper",
      name: "ZAPPER",
      assets: []
    },
    {
      id: "zapper-pro",
      name: "ZAPPER Pro",
      assets: []
    },
    {
      id: "vesuviano",
      name: "Vesuviano",
      assets: []
    },
    {
      id: "vesuvio-buono",
      name: "VesuvioBuono",
      assets: []
    }
  ]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    
    if (source.droppableId === destination.droppableId) {
      // Reorder within the same brand
      setBrands(prev => prev.map(brand => {
        if (brand.id === source.droppableId) {
          const newAssets = Array.from(brand.assets);
          const [reorderedAsset] = newAssets.splice(source.index, 1);
          newAssets.splice(destination.index, 0, reorderedAsset);
          return { ...brand, assets: newAssets };
        }
        return brand;
      }));
    } else {
      // Move asset between brands
      setBrands(prev => {
        const sourceBrand = prev.find(b => b.id === source.droppableId);
        const destBrand = prev.find(b => b.id === destination.droppableId);
        
        if (!sourceBrand || !destBrand) return prev;
        
        const sourceAssets = Array.from(sourceBrand.assets);
        const destAssets = Array.from(destBrand.assets);
        const [movedAsset] = sourceAssets.splice(source.index, 1);
        destAssets.splice(destination.index, 0, movedAsset);
        
        return prev.map(brand => {
          if (brand.id === source.droppableId) {
            return { ...brand, assets: sourceAssets };
          }
          if (brand.id === destination.droppableId) {
            return { ...brand, assets: destAssets };
          }
          return brand;
        });
      });
      
      toast({
        title: "Asset spostato",
        description: "L'asset è stato spostato nel nuovo brand.",
      });
    }
  }, [toast]);

  const handleFileUpload = useCallback((brandId: string, files: FileList | null) => {
    if (!files) return;
    
    Array.from(files).forEach(file => {
      // Only accept image files for logos
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Formato non supportato",
          description: "Sono accettati solo file immagine per i loghi.",
          variant: "destructive"
        });
        return;
      }

      const newAsset: BrandAsset = {
        id: `${brandId}-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: "logo",
        file,
        url: URL.createObjectURL(file)
      };
      
      setBrands(prev => prev.map(brand => 
        brand.id === brandId 
          ? { ...brand, assets: [...brand.assets, newAsset] }
          : brand
      ));
    });
    
    toast({
      title: "Loghi caricati",
      description: `${files.length} logo caricati con successo.`,
    });
  }, [toast]);


  const handleDeleteAsset = useCallback((brandId: string, assetId: string) => {
    setBrands(prev => prev.map(brand => 
      brand.id === brandId 
        ? { ...brand, assets: brand.assets.filter(asset => asset.id !== assetId) }
        : brand
    ));
    
    toast({
      title: "Asset eliminato",
      description: "L'asset è stato rimosso dal brand.",
    });
  }, [toast]);

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
    if (asset.url) {
      window.open(asset.url, '_blank');
    }
  }, []);

  const filteredBrands = brands.filter(brand => 
    brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    brand.assets.some(asset => asset.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {filteredBrands.map((brand) => (
            <Card key={brand.id} className={`h-fit ${getBrandColor(brand.id)}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                  {brand.name}
                  <Badge variant="secondary" className="text-xs">
                    {brand.assets.length} logo{brand.assets.length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*,.svg"
                    onChange={(e) => handleFileUpload(brand.id, e.target.files)}
                    className="hidden"
                    id={`file-upload-${brand.id}`}
                  />
                  <label htmlFor={`file-upload-${brand.id}`} className="cursor-pointer block">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Carica loghi</p>
                    <p className="text-xs text-gray-500">PNG, JPG, SVG supportati</p>
                  </label>
                </div>

                {/* Assets Droppable Area */}
                <Droppable droppableId={brand.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[100px] rounded-lg border-2 border-dashed p-2 space-y-2 transition-colors ${
                        snapshot.isDraggingOver 
                          ? "border-blue-400 bg-blue-50" 
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      {brand.assets.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-8">
                          Nessun logo caricato<br />
                          <span className="text-xs">Carica i tuoi loghi o trascinali qui</span>
                        </p>
                      )}
                      
                      {brand.assets.map((asset, index) => (
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
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {asset.url && (
                                  <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    <img 
                                      src={asset.url} 
                                      alt={asset.name}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate" title={asset.name}>
                                    {asset.name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Logo • {asset.file?.size ? `${(asset.file.size / 1024).toFixed(1)} KB` : 'File'}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {asset.url && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handlePreviewAsset(asset)}
                                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                      title="Anteprima"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = asset.url!;
                                        link.download = asset.name;
                                        link.click();
                                      }}
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                                      title="Scarica"
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAsset(brand.id, asset.id)}
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                  title="Elimina"
                                >
                                  <Trash2 className="h-4 w-4" />
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
              </CardContent>
            </Card>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};

export default BrandkitPage;