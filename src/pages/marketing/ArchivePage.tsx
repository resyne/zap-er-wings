import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, Image, Video, Trash2, Download, Tag } from "lucide-react";
import { FilePreview } from "@/components/ui/file-preview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface MarketingMaterial {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  equipment_type: string;
  category: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  description: string;
}

const ArchivePage = () => {
  const { user } = useAuth();
  const [selectedEquipment, setSelectedEquipment] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");

  const fetchMaterials = useCallback(async () => {
    let query = supabase
      .from('marketing_materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (selectedEquipment) {
      query = query.eq('equipment_type', selectedEquipment);
    }
    if (selectedCategory) {
      query = query.eq('category', selectedCategory);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Errore nel caricamento dei materiali");
      console.error(error);
    } else {
      setMaterials(data || []);
    }
  }, [selectedEquipment, selectedCategory]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!selectedEquipment || !selectedCategory) {
      toast.error("Seleziona prima categoria e tipo di equipaggiamento");
      return;
    }

    setUploading(true);
    
    for (const file of acceptedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${selectedEquipment}/${selectedCategory}/${fileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('marketing-materials')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save metadata to database
        const { error: dbError } = await supabase
          .from('marketing_materials')
          .insert({
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            equipment_type: selectedEquipment,
            category: selectedCategory,
            uploaded_by: user?.id,
            description,
            tags: tags ? tags.split(',').map(tag => tag.trim()) : []
          });

        if (dbError) throw dbError;

        toast.success(`File ${file.name} caricato con successo`);
      } catch (error) {
        console.error('Error uploading file:', error);
        toast.error(`Errore nel caricamento di ${file.name}`);
      }
    }

    setUploading(false);
    setDescription("");
    setTags("");
    fetchMaterials();
  }, [selectedEquipment, selectedCategory, user, description, tags, fetchMaterials]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: !selectedEquipment || !selectedCategory || uploading
  });

  const deleteMaterial = async (material: MarketingMaterial) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('marketing-materials')
        .remove([material.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('marketing_materials')
        .delete()
        .eq('id', material.id);

      if (dbError) throw dbError;

      toast.success("Materiale eliminato con successo");
      fetchMaterials();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error("Errore nell'eliminazione del materiale");
    }
  };

  const downloadMaterial = async (material: MarketingMaterial) => {
    try {
      const { data, error } = await supabase.storage
        .from('marketing-materials')
        .download(material.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = material.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error("Errore nel download del file");
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="h-6 w-6" />;
    if (fileType.startsWith('video/')) return <Video className="h-6 w-6" />;
    return <FileText className="h-6 w-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Archivio Documenti & Media</h1>
        <p className="text-gray-600">Gestisci i materiali marketing per abbattitori e forni</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri e Categorie</CardTitle>
          <CardDescription>Seleziona il tipo di equipaggiamento e la categoria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="equipment">Tipo Equipaggiamento</Label>
              <Select value={selectedEquipment} onValueChange={setSelectedEquipment}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona equipaggiamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abbattitori">Abbattitori</SelectItem>
                  <SelectItem value="forni">Forni</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="media_professionale">Media Professionale</SelectItem>
                  <SelectItem value="creative_advertising">Creative Advertising</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      {selectedEquipment && selectedCategory && (
        <Card>
          <CardHeader>
            <CardTitle>Carica Nuovi File</CardTitle>
            <CardDescription>
              Trascina i file qui o clicca per selezionarli per {selectedEquipment} - {selectedCategory === 'media_professionale' ? 'Media Professionale' : 'Creative Advertising'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  placeholder="Descrizione del materiale"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tag (separati da virgola)</Label>
                <Input
                  id="tags"
                  placeholder="es: brochure, catalogo, video"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>
            
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              {isDragActive ? (
                <p className="text-blue-600">Rilascia i file qui...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">Trascina i file qui o clicca per selezionarli</p>
                  <p className="text-sm text-gray-500">Supportati: immagini, video, documenti PDF</p>
                </div>
              )}
              {uploading && <p className="text-blue-600 mt-2">Caricamento in corso...</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Materials Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {materials.map((material) => (
          <FilePreview
            key={material.id}
            fileName={material.file_name}
            filePath={material.file_path}
            fileType={material.file_type}
            fileSize={material.file_size}
            onDownload={() => downloadMaterial(material)}
            onDelete={() => deleteMaterial(material)}
            description={material.description}
            tags={material.tags}
            createdAt={material.created_at}
            equipmentType={material.equipment_type}
            category={material.category}
          />
        ))}
      </div>

      {materials.length === 0 && (selectedEquipment || selectedCategory) && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">Nessun materiale trovato per i filtri selezionati</p>
          <p className="text-sm text-gray-500 mt-2">
            Carica il primo file utilizzando l'area di upload sopra
          </p>
        </div>
      )}
    </div>
  );
};

export default ArchivePage;