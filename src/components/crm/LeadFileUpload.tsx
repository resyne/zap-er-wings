import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, File, Image as ImageIcon, Video, Trash2, Download, FileText, Eye } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ImageSlideshow from "./ImageSlideshow";

interface LeadFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface LeadFileUploadProps {
  leadId: string;
}

export default function LeadFileUpload({ leadId }: LeadFileUploadProps) {
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);
  const { toast } = useToast();

  const loadFiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("lead_files")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error("Error loading files:", error);
    }
  }, [leadId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (fileList: File[]) => {
    setUploading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      for (const file of fileList) {
        // Check file size (max 20MB)
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File troppo grande",
            description: `${file.name} supera il limite di 20MB`,
            variant: "destructive",
          });
          continue;
        }

        // Upload to storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${leadId}/${Date.now()}_${file.name}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("lead-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save metadata to database
        const { error: dbError } = await supabase
          .from("lead_files")
          .insert([{
            lead_id: leadId,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id
          }]);

        if (dbError) throw dbError;
      }

      toast({
        title: "Upload completato",
        description: `${fileList.length} file caricati con successo`,
      });

      loadFiles();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i file: " + error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: LeadFile) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("lead-files")
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("lead_files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast({
        title: "File eliminato",
        description: "Il file è stato eliminato con successo",
      });

      loadFiles();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il file: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (file: LeadFile) => {
    try {
      const { data, error } = await supabase.storage
        .from("lead-files")
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile scaricare il file: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (fileType.startsWith("video/")) return <Video className="w-5 h-5 text-purple-500" />;
    if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const isImageFile = (fileType: string) => fileType.startsWith("image/");

  const getImageFiles = () => {
    return files
      .filter(file => isImageFile(file.file_type))
      .map(file => ({
        url: `${supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl}`,
        name: file.file_name
      }));
  };

  const openSlideshow = (fileIndex: number) => {
    const imageFiles = files.filter(file => isImageFile(file.file_type));
    const imageIndex = imageFiles.findIndex(imgFile => imgFile.id === files[fileIndex].id);
    if (imageIndex !== -1) {
      setSlideshowStartIndex(imageIndex);
      setSlideshowOpen(true);
    }
  };

  const handleSlideshowDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile scaricare l'immagine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">File e Documenti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-primary/50"
          }`}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Trascina i file qui o clicca per selezionare
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Foto, video, documenti (max 20MB per file)
          </p>
          <input
            type="file"
            multiple
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          />
          <label htmlFor="file-upload">
            <Button variant="outline" asChild disabled={uploading}>
              <span>{uploading ? "Caricamento..." : "Seleziona File"}</span>
            </Button>
          </label>
        </div>

        {/* Files List */}
        {files.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">File caricati ({files.length})</h4>
            
            {/* Image Gallery Preview */}
            {getImageFiles().length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    {getImageFiles().length} {getImageFiles().length === 1 ? 'immagine' : 'immagini'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSlideshowStartIndex(0);
                      setSlideshowOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Visualizza Slideshow
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {files
                    .filter(file => isImageFile(file.file_type))
                    .slice(0, 8)
                    .map((file, index) => {
                      const imageUrl = supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl;
                      return (
                        <div
                          key={file.id}
                          className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                          onClick={() => openSlideshow(files.indexOf(file))}
                        >
                          <img
                            src={imageUrl}
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {getFileIcon(file.file_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isImageFile(file.file_type) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openSlideshow(index)}
                        title="Visualizza"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDownload(file)}
                      title="Scarica"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Elimina">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Elimina file</AlertDialogTitle>
                          <AlertDialogDescription>
                            Sei sicuro di voler eliminare questo file? Questa azione non può essere annullata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(file)}>
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Image Slideshow */}
        <ImageSlideshow
          images={getImageFiles()}
          initialIndex={slideshowStartIndex}
          open={slideshowOpen}
          onOpenChange={setSlideshowOpen}
          onDownload={handleSlideshowDownload}
        />
      </CardContent>
    </Card>
  );
}
