import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Upload, Loader2, Trash2, Paperclip, Receipt, Wrench, Truck,
  FileText, Camera, ShoppingCart, FileSignature, File, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AttachmentPreview } from "@/components/warehouse/AttachmentPreview";

const ATTACHMENT_TYPES = [
  { value: "scontrino", label: "Scontrino", icon: Receipt },
  { value: "rapporto_intervento", label: "Rapporto Intervento", icon: Wrench },
  { value: "ddt", label: "DDT", icon: Truck },
  { value: "preventivo", label: "Preventivo", icon: FileText },
  { value: "foto_lavori", label: "Foto Lavori", icon: Camera },
  { value: "ordine", label: "Ordine", icon: ShoppingCart },
  { value: "contratto", label: "Contratto", icon: FileSignature },
  { value: "altro", label: "Altro", icon: File },
] as const;

interface DocumentAttachment {
  id: string;
  document_id: string;
  attachment_type: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
}

interface DocumentAttachmentsProps {
  documentId: string;
  documentName: string;
}

function useDocumentAttachments(documentId: string) {
  return useQuery({
    queryKey: ["document-attachments", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_attachments")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DocumentAttachment[];
    },
  });
}

export function DocumentAttachmentsPanel({ documentId, documentName }: DocumentAttachmentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: attachments, isLoading } = useDocumentAttachments(documentId);
  const [selectedType, setSelectedType] = useState<string>("altro");
  const [isUploading, setIsUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<DocumentAttachment | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      toast.error("Devi essere autenticato");
      return;
    }

    for (const file of acceptedFiles) {
      setIsUploading(true);
      try {
        const filePath = `${user.id}/${documentId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("document-attachments")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: signedData } = await supabase.storage
          .from("document-attachments")
          .createSignedUrl(filePath, 31536000); // 1 year

        const fileUrl = signedData?.signedUrl || "";

        const { error: insertError } = await supabase
          .from("document_attachments")
          .insert({
            document_id: documentId,
            attachment_type: selectedType,
            file_url: fileUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user.id,
          });
        if (insertError) throw insertError;

        toast.success(`Allegato "${file.name}" caricato`);
        queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] });
      } catch (err: any) {
        toast.error(`Errore: ${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  }, [user, documentId, selectedType, queryClient]);

  const deleteAttachment = async (attachment: DocumentAttachment) => {
    try {
      const { error } = await supabase
        .from("document_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
      toast.success("Allegato eliminato");
      queryClient.invalidateQueries({ queryKey: ["document-attachments", documentId] });
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "text/xml": [".xml"],
      "application/xml": [".xml"],
    },
    disabled: isUploading,
    maxSize: 20 * 1024 * 1024,
  });

  const getTypeInfo = (type: string) => {
    return ATTACHMENT_TYPES.find(t => t.value === type) || ATTACHMENT_TYPES[ATTACHMENT_TYPES.length - 1];
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          Allegati — {documentName}
        </h3>
        <Badge variant="secondary">{attachments?.length || 0}</Badge>
      </div>

      {/* Type selector + drop zone */}
      <div className="space-y-2">
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Tipo allegato" />
          </SelectTrigger>
          <SelectContent>
            {ATTACHMENT_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex items-center gap-2">
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div
          {...getRootProps()}
          className={`border border-dashed rounded-lg p-4 text-center cursor-pointer transition-all text-sm
            ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
            ${isUploading ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <input {...getInputProps()} />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">Caricamento...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Upload className="h-4 w-4" />
              <span>{isDragActive ? "Rilascia qui" : "Trascina o clicca per allegare"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Attachments list */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments?.length ? (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {attachments.map(att => {
            const typeInfo = getTypeInfo(att.attachment_type);
            const Icon = typeInfo.icon;
            return (
              <div
                key={att.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
              >
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setPreviewAttachment(att)}
                    className="text-sm font-medium truncate block text-left hover:underline w-full"
                  >
                    {att.file_name}
                  </button>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {typeInfo.label}
                    </Badge>
                    {att.file_size && <span>{formatFileSize(att.file_size)}</span>}
                    <span>{format(new Date(att.created_at), "dd/MM/yy", { locale: it })}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => deleteAttachment(att)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-3">Nessun allegato</p>
      )}

      {/* Preview dialog */}
      <Dialog open={!!previewAttachment} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Paperclip className="h-4 w-4" />
              {previewAttachment?.file_name}
            </DialogTitle>
          </DialogHeader>
          {previewAttachment && (
            <div className="h-[60vh]">
              <AttachmentPreview
                url={previewAttachment.file_url}
                alt={previewAttachment.file_name}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
