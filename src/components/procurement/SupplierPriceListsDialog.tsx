import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Trash2, Upload, FileText } from "lucide-react";
import { useDropzone } from "react-dropzone";

interface StorageFile {
  id: string;
  name: string;
  size: number;
  created_at: string;
  storage_path: string;
}

interface SupplierPriceListsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
}

export function SupplierPriceListsDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
}: SupplierPriceListsDialogProps) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const folderPath = `supplier-pricelists/${supplierId}`;

  useEffect(() => {
    if (open) loadFiles();
  }, [open]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("company-documents")
        .list(folderPath, { limit: 100 });

      if (error) throw error;

      const validFiles = (data || [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          id: f.id || f.name,
          name: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at || "",
          storage_path: `${folderPath}/${f.name}`,
        }));

      setFiles(validFiles);
    } catch (error) {
      console.error("Error loading files:", error);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    setUploading(true);
    for (const file of acceptedFiles) {
      try {
        const sanitized = file.name
          .replace(/[^\w\s.-]/g, "")
          .replace(/\s+/g, "_");
        const filename = `${Date.now()}_${sanitized}`;
        const filePath = `${folderPath}/${filename}`;

        const { error } = await supabase.storage
          .from("company-documents")
          .upload(filePath, file);

        if (error) throw error;

        toast({ title: "Successo", description: `${file.name} caricato` });
      } catch (error: any) {
        toast({
          title: "Errore",
          description: `Errore caricamento ${file.name}`,
          variant: "destructive",
        });
      }
    }
    setUploading(false);
    loadFiles();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
    },
  });

  const downloadFile = async (file: StorageFile) => {
    try {
      const { data, error } = await supabase.storage
        .from("company-documents")
        .download(file.storage_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Errore", description: "Errore nel download", variant: "destructive" });
    }
  };

  const deleteFile = async (file: StorageFile) => {
    if (!confirm(`Eliminare ${file.name}?`)) return;
    try {
      const { error } = await supabase.storage
        .from("company-documents")
        .remove([file.storage_path]);
      if (error) throw error;
      toast({ title: "Successo", description: "File eliminato" });
      loadFiles();
    } catch {
      toast({ title: "Errore", description: "Errore eliminazione", variant: "destructive" });
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Listini - {supplierName}
          </DialogTitle>
        </DialogHeader>

        {/* Upload */}
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          {uploading ? (
            <p className="text-sm text-primary">Caricamento...</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Trascina file o clicca per caricare (PDF, XLS, XLSX, JPG, PNG)
            </p>
          )}
        </div>

        {/* File list */}
        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-4">Caricamento...</p>
        ) : files.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            Nessun listino caricato
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              File caricati <Badge variant="secondary">{files.length}</Badge>
            </p>
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.size)} •{" "}
                    {file.created_at
                      ? new Date(file.created_at).toLocaleDateString("it-IT")
                      : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => downloadFile(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteFile(file)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
