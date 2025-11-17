import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Image, Video, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ProductMediaUploadProps {
  productId: string;
  existingMedia?: any[];
}

export function ProductMediaUpload({ productId, existingMedia = [] }: ProductMediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!productId) {
      toast.error("Seleziona prima un prodotto");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const totalFiles = acceptedFiles.length;
      let completedFiles = 0;

      for (const file of acceptedFiles) {
        // Genera un nome file unico
        const fileExt = file.name.split('.').pop();
        const fileName = `${productId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload a Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('product-media')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Ottieni URL pubblico
        const { data: { publicUrl } } = supabase.storage
          .from('product-media')
          .getPublicUrl(fileName);

        // Determina tipo media
        const mediaType = file.type.startsWith('video/') ? 'video' : 'image';
        
        // Determina se è un video 360
        const is360 = file.name.toLowerCase().includes('360');

        // Salva metadata nel database
        const { error: dbError } = await supabase
          .from('product_configurator_media')
          .insert({
            product_id: productId,
            media_type: mediaType,
            media_url: publicUrl,
            title: file.name,
            description: is360 ? 'Video 360°' : null,
            display_order: existingMedia.length + completedFiles,
          });

        if (dbError) throw dbError;

        completedFiles++;
        setUploadProgress((completedFiles / totalFiles) * 100);
      }

      toast.success(`${completedFiles} file caricati con successo`);
      queryClient.invalidateQueries({ queryKey: ["product-media"] });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || "Errore durante l'upload");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [productId, existingMedia.length, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov']
    },
    disabled: uploading || !productId
  });

  const handleDelete = async (mediaId: string, mediaUrl: string) => {
    try {
      // Estrai il path dal URL pubblico
      const urlParts = mediaUrl.split('/product-media/');
      const filePath = urlParts[1];

      // Elimina da Storage
      const { error: storageError } = await supabase.storage
        .from('product-media')
        .remove([filePath]);

      if (storageError) throw storageError;

      // Elimina dal database
      const { error: dbError } = await supabase
        .from('product_configurator_media')
        .delete()
        .eq('id', mediaId);

      if (dbError) throw dbError;

      toast.success("Media eliminato");
      queryClient.invalidateQueries({ queryKey: ["product-media"] });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || "Errore durante l'eliminazione");
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={`p-8 border-2 border-dashed cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        } ${!productId ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <Upload className="h-12 w-12 text-muted-foreground" />
          <div>
            <p className="font-medium">
              {isDragActive ? 'Rilascia i file qui' : 'Trascina foto/video o clicca per selezionare'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Formati supportati: JPEG, PNG, GIF, WebP, MP4, WebM, MOV
            </p>
            <p className="text-xs text-muted-foreground">
              Dimensione massima: 50MB per file
            </p>
          </div>
        </div>
      </Card>

      {/* Upload Progress */}
      {uploading && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Caricamento in corso...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        </Card>
      )}

      {/* Existing Media */}
      {existingMedia && existingMedia.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Media caricati ({existingMedia.length})</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {existingMedia.map((media: any) => (
              <Card key={media.id} className="overflow-hidden">
                <div className="aspect-video bg-muted relative group">
                  {media.media_type === 'image' ? (
                    <img
                      src={media.media_url}
                      alt={media.title || 'Product media'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.open(media.media_url, '_blank')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(media.id, media.media_url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{media.title}</p>
                    <Badge variant="outline" className="flex-shrink-0">
                      {media.media_type === 'video' ? (
                        <Video className="h-3 w-3 mr-1" />
                      ) : (
                        <Image className="h-3 w-3 mr-1" />
                      )}
                      {media.media_type}
                    </Badge>
                  </div>
                  {media.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {media.description}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
