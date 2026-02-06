import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Image,
  FileText,
  Video,
  Mic,
  Upload,
  Trash2,
  MoreVertical,
  Loader2,
  FolderOpen,
  Search,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface BusinessFile {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface WhatsAppBusinessFilesLibraryProps {
  accountId: string;
  accountName?: string;
  onSelectFile?: (file: BusinessFile) => void;
  mode?: "manage" | "select";
}

const getFileTypeFromMime = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
};

const getFileIcon = (fileType: string) => {
  switch (fileType) {
    case "image":
      return <Image className="h-4 w-4" />;
    case "video":
      return <Video className="h-4 w-4" />;
    case "audio":
      return <Mic className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function WhatsAppBusinessFilesLibrary({
  accountId,
  accountName,
  onSelectFile,
  mode = "manage",
}: WhatsAppBusinessFilesLibraryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // Fetch business files for this account
  const { data: files, isLoading } = useQuery({
    queryKey: ["whatsapp-business-files", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_business_files")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as BusinessFile[];
    },
    enabled: !!accountId,
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
      const fileName = `${accountId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("whatsapp-business-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("whatsapp-business-files").getPublicUrl(fileName);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Insert record
      const fileType = getFileTypeFromMime(file.type);
      const { error: insertError } = await supabase
        .from("whatsapp_business_files")
        .insert({
          account_id: accountId,
          name: file.name,
          file_url: publicUrl,
          file_type: fileType,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user?.id,
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-files", accountId] });
      toast.success("File caricato");
    },
    onError: (error: Error) => {
      toast.error(`Errore upload: ${error.message}`);
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (file: BusinessFile) => {
      // Delete from storage
      const storagePath = file.file_url.split("/whatsapp-business-files/")[1];
      if (storagePath) {
        await supabase.storage.from("whatsapp-business-files").remove([storagePath]);
      }

      // Delete record
      const { error } = await supabase
        .from("whatsapp_business_files")
        .delete()
        .eq("id", file.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-files", accountId] });
      toast.success("File eliminato");
    },
    onError: (error: Error) => {
      toast.error(`Errore eliminazione: ${error.message}`);
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSelectFile = (file: BusinessFile) => {
    if (mode === "select" && onSelectFile) {
      setSelectedFileId(file.id);
      onSelectFile(file);
    }
  };

  const filteredFiles = files?.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Header with search and upload */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca file..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        {mode === "manage" && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={handleFileUpload}
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Carica
            </Button>
          </>
        )}
      </div>

      {/* Files list */}
      <ScrollArea className="h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredFiles || filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="h-8 w-8 mb-2" />
            <p className="text-sm">Nessun file business</p>
            {mode === "manage" && (
              <p className="text-xs mt-1">Carica file da inviare ai clienti</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                  selectedFileId === file.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted/50"
                }`}
                onClick={() => handleSelectFile(file)}
              >
                {/* File type icon */}
                <div className="flex-shrink-0 p-2 bg-muted rounded">
                  {getFileIcon(file.file_type)}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {file.file_type}
                    </Badge>
                    {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                    <span>{format(new Date(file.created_at), "dd/MM/yy")}</span>
                  </div>
                </div>

                {/* Select indicator or actions */}
                {mode === "select" ? (
                  selectedFileId === file.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(file.file_url, "_blank");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Apri
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(file);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// Dialog wrapper for selecting files in chat
interface BusinessFilesDialogProps {
  accountId: string;
  accountName?: string;
  onSelectFile: (file: BusinessFile) => void;
  trigger: React.ReactNode;
}

export function BusinessFilesDialog({
  accountId,
  accountName,
  onSelectFile,
  trigger,
}: BusinessFilesDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (file: BusinessFile) => {
    onSelectFile(file);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            File Business {accountName && `- ${accountName}`}
          </DialogTitle>
          <DialogDescription>
            Seleziona un file da inviare al cliente
          </DialogDescription>
        </DialogHeader>
        <WhatsAppBusinessFilesLibrary
          accountId={accountId}
          accountName={accountName}
          onSelectFile={handleSelect}
          mode="select"
        />
      </DialogContent>
    </Dialog>
  );
}
