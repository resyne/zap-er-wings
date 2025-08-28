import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, Trash2, Plus, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Material {
  id: string;
  material_name: string;
  material_type?: string;
  quantity: number;
  notes?: string;
  uploaded_file_url?: string;
}

interface MaterialsManagerProps {
  partnerId: string;
  partnerName: string;
}

export const MaterialsManager = ({ partnerId, partnerName }: MaterialsManagerProps) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({
    material_name: "",
    material_type: "",
    quantity: 1,
    notes: "",
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchMaterials();
  }, [partnerId]);

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_materials')
        .select('*')
        .eq('partner_id', partnerId);

      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadedFile(acceptedFiles[0]);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    multiple: false,
  });

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${partnerId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('company-documents')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento del file",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleAddMaterial = async () => {
    try {
      let fileUrl = null;
      
      if (uploadedFile) {
        fileUrl = await uploadFile(uploadedFile);
        if (!fileUrl) return;
      }

      const { data, error } = await supabase
        .from('partner_materials')
        .insert({
          partner_id: partnerId,
          material_name: newMaterial.material_name,
          material_type: newMaterial.material_type || null,
          quantity: newMaterial.quantity,
          notes: newMaterial.notes || null,
          uploaded_file_url: fileUrl,
        })
        .select()
        .single();

      if (error) throw error;

      setMaterials(prev => [...prev, data]);
      setIsAddDialogOpen(false);
      setNewMaterial({
        material_name: "",
        material_type: "",
        quantity: 1,
        notes: "",
      });
      setUploadedFile(null);

      toast({
        title: "Successo",
        description: "Materiale aggiunto con successo",
      });
    } catch (error) {
      console.error('Error adding material:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'aggiunta del materiale",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      const { error } = await supabase
        .from('partner_materials')
        .delete()
        .eq('id', materialId);

      if (error) throw error;

      setMaterials(prev => prev.filter(m => m.id !== materialId));
      
      toast({
        title: "Successo",
        description: "Materiale eliminato con successo",
      });
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione del materiale",
        variant: "destructive",
      });
    }
  };

  const openFile = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground">Materiali</h4>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Plus className="h-3 w-3" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Aggiungi Materiale per {partnerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome Materiale</label>
                <Input
                  value={newMaterial.material_name}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, material_name: e.target.value }))}
                  placeholder="Es. Catalogo prodotti, Listino prezzi..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Input
                  value={newMaterial.material_type}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, material_type: e.target.value }))}
                  placeholder="Es. Documentazione, Campioni..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Quantità</label>
                <Input
                  type="number"
                  min="1"
                  value={newMaterial.quantity}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Note</label>
                <Textarea
                  value={newMaterial.notes}
                  onChange={(e) => setNewMaterial(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Note aggiuntive..."
                  className="min-h-16"
                />
              </div>
              <div>
                <label className="text-sm font-medium">File (opzionale)</label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                >
                  <input {...getInputProps()} />
                  {uploadedFile ? (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{uploadedFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedFile(null);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        {isDragActive ? 'Rilascia il file qui...' : 'Trascina un file qui o clicca per selezionare'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annulla
                </Button>
                <Button 
                  onClick={handleAddMaterial}
                  disabled={!newMaterial.material_name.trim()}
                >
                  Aggiungi
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {materials.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nessun materiale</p>
      ) : (
        <div className="space-y-1">
          {materials.map((material) => (
            <div
              key={material.id}
              className="flex items-center justify-between bg-muted/30 rounded p-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="font-medium truncate">{material.material_name}</span>
                  {material.quantity > 1 && (
                    <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                      {material.quantity}
                    </Badge>
                  )}
                </div>
                {material.material_type && (
                  <p className="text-muted-foreground text-xs mt-1">{material.material_type}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {material.uploaded_file_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => openFile(material.uploaded_file_url!)}
                  >
                    <FileText className="h-3 w-3" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteMaterial(material.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};