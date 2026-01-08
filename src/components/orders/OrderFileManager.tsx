import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, FileText, Image as ImageIcon, Download, Eye, Video, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AttachmentFile {
  path: string;
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface OrderFileManagerProps {
  orderId: string;
  attachments?: AttachmentFile[];
  onUpdate?: () => void;
  readOnly?: boolean;
  label?: string;
}

export function OrderFileManager({
  orderId,
  attachments = [],
  onUpdate,
  readOnly = false,
  label = "File Ordine"
}: OrderFileManagerProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ url: string; name: string } | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (readOnly) return;
      
      setUploading(true);
      try {
        const uploadedAttachments: AttachmentFile[] = [];

        for (const file of acceptedFiles) {
          // Check file size (max 50MB)
          if (file.size > 50 * 1024 * 1024) {
            toast({
              title: "File troppo grande",
              description: `${file.name} supera il limite di 50MB`,
              variant: "destructive",
            });
            continue;
          }

          const fileExt = file.name.split('.').pop();
          const fileName = `${orderId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError, data } = await supabase.storage
            .from('order-files')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            throw uploadError;
          }

          uploadedAttachments.push({
            path: data.path,
            name: file.name,
            size: file.size,
            type: file.type
          });
        }

        // Update sales_orders attachments
        const newAttachments = [...attachments, ...uploadedAttachments];
        
        const { error: updateError } = await supabase
          .from('sales_orders')
          .update({ attachments: JSON.parse(JSON.stringify(newAttachments)) })
          .eq('id', orderId);

        if (updateError) throw updateError;

        toast({
          title: "File caricati",
          description: `${uploadedAttachments.length} file caricati con successo`,
        });

        onUpdate?.();
      } catch (error: any) {
        console.error('Upload error:', error);
        toast({
          title: "Errore",
          description: "Errore durante il caricamento dei file",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [orderId, attachments, onUpdate, readOnly, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: readOnly || uploading,
    // Accept all common file types including videos
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.heic'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'text/plain': ['.txt'],
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar']
    },
    maxSize: 50 * 1024 * 1024 // 50MB max
  });

  const handleDelete = async (attachment: AttachmentFile) => {
    if (readOnly) return;

    try {
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('order-files')
        .remove([attachment.path]);

      if (deleteError) throw deleteError;

      // Update database
      const newAttachments = attachments.filter(a => a.path !== attachment.path);
      
      const { error: updateError } = await supabase
        .from('sales_orders')
        .update({ attachments: JSON.parse(JSON.stringify(newAttachments)) })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast({
        title: "File eliminato",
        description: "Il file è stato eliminato con successo",
      });

      onUpdate?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione del file",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (attachment: AttachmentFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .download(attachment.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Errore durante il download del file",
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (attachment: AttachmentFile) => {
    const isImage = attachment.type.startsWith('image/');
    const isVideo = attachment.type.startsWith('video/');

    if (!isImage && !isVideo) {
      handleDownload(attachment);
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .createSignedUrl(attachment.path, 3600);

      if (error) throw error;

      if (isVideo) {
        setVideoPreview({ url: data.signedUrl, name: attachment.name });
      } else {
        setPreviewFile({ ...attachment, url: data.signedUrl });
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Errore durante il caricamento dell'anteprima",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    if (type.startsWith('video/')) {
      return <Video className="h-4 w-4 text-purple-500" />;
    }
    if (type.includes('pdf')) {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="space-y-4">
        <h4 className="text-sm font-medium">{label}</h4>
        
        {!readOnly && (
          <Card>
            <CardContent className="p-6">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary hover:bg-accent/50",
                  (readOnly || uploading) && "opacity-50 cursor-not-allowed"
                )}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-primary">Rilascia i file qui...</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {uploading ? "Caricamento in corso..." : "Trascina i file qui o clicca per selezionare"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Video, Immagini, PDF, Word, Excel, PowerPoint, ZIP (max 50MB)
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {attachments.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {attachments.length} {attachments.length === 1 ? 'file allegato' : 'file allegati'}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {getFileIcon(attachment.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(attachment)}
                      title="Visualizza"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(attachment)}
                      title="Scarica"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(attachment)}
                        className="text-destructive hover:text-destructive"
                        title="Elimina"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {attachments.length === 0 && readOnly && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nessun file allegato
          </p>
        )}
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
          </DialogHeader>
          {previewFile?.url && (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={!!videoPreview} onOpenChange={() => setVideoPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{videoPreview?.name}</DialogTitle>
          </DialogHeader>
          {videoPreview?.url && (
            <video
              controls
              autoPlay
              className="w-full rounded-lg"
              src={videoPreview.url}
            >
              Il tuo browser non supporta la riproduzione video.
            </video>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
