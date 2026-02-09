import { useState, useRef, useCallback } from "react";
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
  FolderPlus,
  ChevronLeft,
  Folder,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

interface BusinessFile {
  id: string;
  account_id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string;
  file_size: number | null;
  mime_type: string | null;
  folder_id: string | null;
  created_at: string;
}

interface BusinessFolder {
  id: string;
  account_id: string;
  name: string;
  parent_id: string | null;
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
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // Fetch folders for this account
  const { data: folders, isLoading: foldersLoading } = useQuery({
    queryKey: ["whatsapp-business-folders", accountId, currentFolderId],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_business_folders")
        .select("*")
        .eq("account_id", accountId);

      if (currentFolderId) {
        query = query.eq("parent_id", currentFolderId);
      } else {
        query = query.is("parent_id", null);
      }

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      return data as BusinessFolder[];
    },
    enabled: !!accountId,
  });

  // Fetch parent folder for breadcrumb
  const { data: parentFolder } = useQuery({
    queryKey: ["whatsapp-business-folder", currentFolderId],
    queryFn: async () => {
      if (!currentFolderId) return null;
      const { data, error } = await supabase
        .from("whatsapp_business_folders")
        .select("*")
        .eq("id", currentFolderId)
        .single();

      if (error) throw error;
      return data as BusinessFolder;
    },
    enabled: !!currentFolderId,
  });

  // Fetch business files for this account/folder
  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ["whatsapp-business-files", accountId, currentFolderId],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_business_files")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (currentFolderId) {
        query = query.eq("folder_id", currentFolderId);
      } else {
        query = query.is("folder_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BusinessFile[];
    },
    enabled: !!accountId,
  });

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("whatsapp_business_folders")
        .insert({
          account_id: accountId,
          name,
          parent_id: currentFolderId,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-folders", accountId] });
      setNewFolderName("");
      setShowNewFolderInput(false);
      toast.success("Cartella creata");
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  // Update folder mutation
  const updateFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase
        .from("whatsapp_business_folders")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-folders", accountId] });
      setEditingFolderId(null);
      setEditingFolderName("");
      toast.success("Cartella rinominata");
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  // Delete folder mutation
  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_business_folders")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-folders", accountId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-files", accountId] });
      toast.success("Cartella eliminata");
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, folderId }: { file: File; folderId: string | null }) => {
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
      const fileName = `${accountId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("whatsapp-business-files")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("whatsapp-business-files")
        .getPublicUrl(fileName);

      const { data: { user } } = await supabase.auth.getUser();

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
          folder_id: folderId,
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

  // Move file to folder mutation
  const moveFileMutation = useMutation({
    mutationFn: async ({ fileId, folderId }: { fileId: string; folderId: string | null }) => {
      const { error } = await supabase
        .from("whatsapp_business_files")
        .update({ folder_id: folderId })
        .eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-business-files", accountId] });
      toast.success("File spostato");
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (file: BusinessFile) => {
      const storagePath = file.file_url.split("/whatsapp-business-files/")[1];
      if (storagePath) {
        await supabase.storage.from("whatsapp-business-files").remove([storagePath]);
      }
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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setIsUploading(true);
      try {
        for (const file of acceptedFiles) {
          await uploadMutation.mutateAsync({ file, folderId: currentFolderId });
        }
      } finally {
        setIsUploading(false);
      }
    },
    [uploadMutation, currentFolderId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "video/*": [],
      "audio/*": [],
      "application/pdf": [],
      "application/msword": [],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [],
      "application/vnd.ms-excel": [],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [],
      "application/vnd.ms-powerpoint": [],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [],
    },
    noClick: true,
    noKeyboard: true,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    if (uploadedFiles.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of uploadedFiles) {
        await uploadMutation.mutateAsync({ file, folderId: currentFolderId });
      }
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

  const handleFileDragStart = (e: React.DragEvent, fileId: string) => {
    e.dataTransfer.setData("fileId", fileId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    const fileId = e.dataTransfer.getData("fileId");
    if (fileId) {
      moveFileMutation.mutate({ fileId, folderId });
    }
  };

  const filteredFiles = files?.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFolders = folders?.filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = foldersLoading || filesLoading;

  return (
    <div className="space-y-3" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Header with breadcrumb, search and upload */}
      <div className="space-y-2">
        {/* Breadcrumb */}
        {currentFolderId && (
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolderId(parentFolder?.parent_id || null)}
              className="h-7 px-2"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{parentFolder?.name}</span>
          </div>
        )}

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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewFolderInput(true)}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                multiple
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

        {/* New folder input */}
        {showNewFolderInput && (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nome cartella..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="h-8"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName.trim());
                } else if (e.key === "Escape") {
                  setShowNewFolderInput(false);
                  setNewFolderName("");
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (newFolderName.trim()) {
                  createFolderMutation.mutate(newFolderName.trim());
                }
              }}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              {createFolderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Crea"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowNewFolderInput(false);
                setNewFolderName("");
              }}
            >
              Annulla
            </Button>
          </div>
        )}
      </div>

      {/* Drag & drop overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-primary font-medium">Rilascia i file qui</p>
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="h-[300px] relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (!filteredFolders || filteredFolders.length === 0) && (!filteredFiles || filteredFiles.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FolderOpen className="h-8 w-8 mb-2" />
            <p className="text-sm">Nessun file o cartella</p>
            {mode === "manage" && (
              <p className="text-xs mt-1">Trascina i file qui o clicca Carica</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Folders */}
            {filteredFolders?.map((folder) => (
              <div
                key={folder.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                  dragOverFolderId === folder.id
                    ? "bg-primary/20 border-primary"
                    : "hover:bg-muted/50"
                )}
                onClick={() => {
                  if (editingFolderId !== folder.id) {
                    setCurrentFolderId(folder.id);
                  }
                }}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
              >
                <div className="flex-shrink-0 p-2 bg-accent rounded">
                  <Folder className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  {editingFolderId === folder.id ? (
                    <Input
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingFolderName.trim()) {
                          updateFolderMutation.mutate({
                            id: folder.id,
                            name: editingFolderName.trim(),
                          });
                        } else if (e.key === "Escape") {
                          setEditingFolderId(null);
                          setEditingFolderName("");
                        }
                      }}
                    />
                  ) : (
                    <p className="text-sm font-medium truncate">{folder.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(folder.created_at), "dd/MM/yy")}
                  </p>
                </div>

                {mode === "manage" && editingFolderId !== folder.id && (
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
                          setEditingFolderId(folder.id);
                          setEditingFolderName(folder.name);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Rinomina
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFolderMutation.mutate(folder.id);
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

            {/* Files */}
            {filteredFiles?.map((file) => (
              <div
                key={file.id}
                draggable={mode === "manage"}
                onDragStart={(e) => handleFileDragStart(e, file.id)}
                className={cn(
                  "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors",
                  selectedFileId === file.id
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted/50"
                )}
                onClick={() => handleSelectFile(file)}
              >
                <div className="flex-shrink-0 p-2 bg-muted rounded">
                  {getFileIcon(file.file_type)}
                </div>

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
                      {currentFolderId && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            moveFileMutation.mutate({ fileId: file.id, folderId: null });
                          }}
                        >
                          <FolderOpen className="h-4 w-4 mr-2" />
                          Sposta alla radice
                        </DropdownMenuItem>
                      )}
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
