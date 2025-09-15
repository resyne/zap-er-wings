import React, { useState, useCallback, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Upload, Download, Eye, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";

interface BrandAsset {
  id: string;
  name: string;
  type: "color" | "icon" | "logo";
  file_url: string;
  file_size?: number;
  mime_type?: string;
  created_at?: string;
}

const BrandAssetManager = () => {
  const { brandId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [assets, setAssets] = useState<{
    colorPalette: BrandAsset[];
    icons: BrandAsset[];
    logos: BrandAsset[];
  }>({
    colorPalette: [],
    icons: [],
    logos: []
  });
  
  const [loading, setLoading] = useState(true);
  
  const brandName = brandId?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || '';

  // Load brand assets from database
  useEffect(() => {
    loadBrandAssets();
  }, [brandId]);

  const loadBrandAssets = async () => {
    if (!brandName) return;
    
    try {
      const { data: assetData, error } = await supabase
        .from('brand_assets')
        .select('*')
        .eq('brand_name', brandName)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const groupedAssets = {
        colorPalette: [],
        icons: [],
        logos: []
      };

      assetData?.forEach(asset => {
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
          groupedAssets.colorPalette.push(brandAsset);
        } else if (asset.asset_type === 'icon') {
          groupedAssets.icons.push(brandAsset);
        } else if (asset.asset_type === 'logo') {
          groupedAssets.logos.push(brandAsset);
        }
      });

      setAssets(groupedAssets);
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
    const [sourceSection] = source.droppableId.split('-');
    const [destSection] = destination.droppableId.split('-');
    
    if (source.droppableId === destination.droppableId) {
      // Reorder within the same section
      setAssets(prev => {
        const section = sourceSection as keyof typeof prev;
        const newAssets = Array.from(prev[section]);
        const [reorderedAsset] = newAssets.splice(source.index, 1);
        newAssets.splice(destination.index, 0, reorderedAsset);
        return { ...prev, [section]: newAssets };
      });
    } else {
      // Move asset between sections
      const sourceAssets = assets[sourceSection as keyof typeof assets];
      const movedAsset = sourceAssets[source.index];
      
      if (!movedAsset) return;
      
      try {
        // Update asset in database
        const newAssetType = destSection === "colorPalette" ? "color" : destSection === "icons" ? "icon" : "logo";
        
        const { error } = await supabase
          .from('brand_assets')
          .update({
            asset_type: newAssetType
          })
          .eq('id', movedAsset.id);

        if (error) throw error;

        // Update local state
        setAssets(prev => {
          const sourceAssets = Array.from(prev[sourceSection as keyof typeof prev]);
          const destAssets = Array.from(prev[destSection as keyof typeof prev]);
          const [movedAsset] = sourceAssets.splice(source.index, 1);
          
          // Update asset type when moving between sections
          if (sourceSection !== destSection) {
            movedAsset.type = destSection === "colorPalette" ? "color" : destSection === "icons" ? "icon" : "logo";
          }
          
          destAssets.splice(destination.index, 0, movedAsset);
          
          return {
            ...prev,
            [sourceSection]: sourceAssets,
            [destSection]: destAssets
          };
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
  }, [toast, assets]);

  const handleFileUpload = useCallback(async (section: "colorPalette" | "icons" | "logos", files: FileList | null) => {
    console.log('🔄 Starting file upload for section:', section);
    console.log('🔄 Files:', files?.length || 0);
    console.log('🔄 Brand name:', brandName);
    
    if (!files || !brandName) {
      console.error('❌ Missing files or brand name');
      return;
    }
    
    const assetType = section === "colorPalette" ? "color" : section === "icons" ? "icon" : "logo";
    console.log('🔄 Asset type:', assetType);
    
    for (const file of Array.from(files)) {
      console.log('🔄 Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      if (!file.type.startsWith("image/")) {
        console.warn('⚠️ Invalid file type:', file.type);
        toast({
          title: "Formato non supportato",
          description: "Sono accettati solo file immagine.",
          variant: "destructive"
        });
        continue;
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${brandName.toLowerCase()}/${assetType}/${Date.now()}-${Math.random()}.${fileExt}`;
        console.log('🔄 Upload path:', fileName);
        
        console.log('🔄 Starting storage upload...');
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('brand-assets')
          .upload(fileName, file);

        if (uploadError) {
          console.error('❌ Storage upload error:', uploadError);
          throw uploadError;
        }
        console.log('✅ Storage upload successful:', uploadData);

        const { data: { publicUrl } } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(fileName);
        console.log('🔄 Public URL:', publicUrl);

        console.log('🔄 Inserting into database...');
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

        if (dbError) {
          console.error('❌ Database insert error:', dbError);
          throw dbError;
        }
        console.log('✅ Database insert successful:', assetData);

        await loadBrandAssets();
        
        toast({
          title: "File caricato",
          description: `${file.name} caricato con successo.`,
        });
        console.log('✅ Upload completed for:', file.name);
      } catch (error) {
        console.error('❌ Upload error for file:', file.name, error);
        toast({
          title: "Errore upload",
          description: `Impossibile caricare ${file.name}. ${error instanceof Error ? error.message : 'Errore sconosciuto'}`,
          variant: "destructive"
        });
      }
    }
  }, [toast, loadBrandAssets, brandName]);

  const handleDeleteAsset = useCallback(async (assetId: string) => {
    try {
      const allAssets = [...assets.colorPalette, ...assets.icons, ...assets.logos];
      const asset = allAssets.find(a => a.id === assetId);
      if (!asset) return;

      const filePath = asset.file_url.split('/').slice(-3).join('/');
      await supabase.storage
        .from('brand-assets')
        .remove([filePath]);

      const { error } = await supabase
        .from('brand_assets')
        .delete()
        .eq('id', assetId);

      if (error) throw error;

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
  }, [assets, loadBrandAssets, toast]);

  const handlePreviewAsset = useCallback((asset: BrandAsset) => {
    if (asset.file_url) {
      window.open(asset.file_url, '_blank');
    }
  }, []);

  const getBrandColor = (brandId: string) => {
    const colors = {
      "zapper": "from-blue-500 to-blue-600",
      "zapper-pro": "from-purple-500 to-purple-600", 
      "vesuviano": "from-orange-500 to-orange-600",
      "vesuvio-buono": "from-green-500 to-green-600"
    };
    return colors[brandId as keyof typeof colors] || "from-gray-500 to-gray-600";
  };

  const renderSection = (
    sectionName: string,
    sectionKey: "colorPalette" | "icons" | "logos",
    sectionAssets: BrandAsset[],
    placeholder: string
  ) => (
    <Card key={sectionKey} className="h-fit">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          {sectionName}
          <Badge variant="secondary" className="text-sm">
            {sectionAssets.length} asset{sectionAssets.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Large Upload Area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer">
          <input
            type="file"
            multiple
            accept="image/*,.svg"
            onChange={(e) => handleFileUpload(sectionKey, e.target.files)}
            className="hidden"
            id={`file-upload-${sectionKey}`}
          />
          <label htmlFor={`file-upload-${sectionKey}`} className="cursor-pointer block">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">Carica {sectionName.toLowerCase()}</p>
            <p className="text-sm text-gray-500">Trascina i file qui o clicca per selezionare</p>
          </label>
        </div>

        {/* Assets Droppable Area */}
        <Droppable droppableId={`${sectionKey}-assets`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-[120px] rounded-lg border-2 border-dashed p-4 space-y-3 transition-colors ${
                snapshot.isDraggingOver 
                  ? "border-blue-400 bg-blue-50" 
                  : "border-gray-200 bg-white"
              }`}
            >
              {sectionAssets.length === 0 && (
                <p className="text-center text-gray-400 py-8">
                  {placeholder}
                </p>
              )}
              
              {sectionAssets.map((asset, index) => (
                <Draggable key={asset.id} draggableId={asset.id} index={index} disableInteractiveElementBlocking>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`p-4 rounded-lg border bg-white shadow-sm flex items-center justify-between transition-all hover:shadow-md ${
                        snapshot.isDragging ? "shadow-lg rotate-1 scale-105" : ""
                      }`}
                    >
                      <div 
                        {...provided.dragHandleProps}
                        className="flex items-center gap-4 flex-1 min-w-0 cursor-grab active:cursor-grabbing"
                      >
                        {asset.file_url && (
                          <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
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
                          <div className="text-sm font-medium truncate" title={asset.name}>
                            {asset.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {asset.file_size ? `${(asset.file_size / 1024).toFixed(1)} KB` : 'File'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        {asset.file_url && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewAsset(asset);
                              }}
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                              title="Anteprima"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                const link = document.createElement('a');
                                link.href = asset.file_url;
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAsset(asset.id);
                          }}
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
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/marketing/brandkit')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna ai Brand
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {brandName}
            </h1>
            <p className="text-gray-600 mt-2">Gestisci gli asset del brand</p>
          </div>
        </div>
        
        <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${getBrandColor(brandId || '')} flex items-center justify-center`}>
          <div className="text-white text-xl font-bold">
            {brandName.charAt(0)}
          </div>
        </div>
      </div>

      <DragDropContext 
        onDragEnd={handleDragEnd}
        onDragStart={() => console.log('Drag started')}
        onDragUpdate={() => console.log('Drag updating')}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {renderSection("Color Palette", "colorPalette", assets.colorPalette, "Nessun colore caricato")}
          {renderSection("Icone", "icons", assets.icons, "Nessuna icona caricata")}
          {renderSection("Loghi", "logos", assets.logos, "Nessun logo caricato")}
        </div>
      </DragDropContext>
    </div>
  );
};

export default BrandAssetManager;