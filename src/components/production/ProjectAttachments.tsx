import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Loader2, Link as LinkIcon, Image, Video, FileText,
  Upload, Trash2, ExternalLink, Paperclip, Plus, X, Eye
} from "lucide-react";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface Attachment {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

function getFileType(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

function getFileIcon(type: string) {
  switch (type) {
    case "image": return <Image className="h-4 w-4 text-green-500" />;
    case "video": return <Video className="h-4 w-4 text-purple-500" />;
    case "link": return <LinkIcon className="h-4 w-4 text-blue-500" />;
    default: return <FileText className="h-4 w-4 text-orange-500" />;
  }
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectAttachments({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [previewItem, setPreviewItem] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = useCallback(async () => {
    const { data, error } = await supabase
      .from("production_project_attachments")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) { console.error(error); return; }
    setAttachments((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadAttachments(); }, [loadAttachments]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${projectId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("production-project-files")
          .upload(path, file);
        if (upErr) throw upErr;

        const { data: urlData } = supabase.storage
          .from("production-project-files")
          .getPublicUrl(path);

        await supabase.from("production_project_attachments").insert({
          project_id: projectId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: getFileType(file),
          file_size: file.size,
          mime_type: file.type,
          created_by: user?.id,
        });
      }
      toast.success("File caricati");
      loadAttachments();
    } catch (err: any) {
      toast.error(err.message || "Errore upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddLink = async () => {
    if (!linkUrl.trim()) { toast.error("Inserisci un URL"); return; }
    try {
      await supabase.from("production_project_attachments").insert({
        project_id: projectId,
        file_name: linkName.trim() || linkUrl.trim(),
        file_url: linkUrl.trim(),
        file_type: "link",
        created_by: user?.id,
      });
      toast.success("Link aggiunto");
      setLinkUrl("");
      setLinkName("");
      setShowLinkForm(false);
      loadAttachments();
    } catch (err: any) {
      toast.error(err.message || "Errore");
    }
  };

  const handleDelete = async (att: Attachment) => {
    if (!confirm("Eliminare questo allegato?")) return;
    if (att.file_type !== "link") {
      const path = att.file_url.split("/production-project-files/")[1];
      if (path) {
        await supabase.storage.from("production-project-files").remove([decodeURIComponent(path)]);
      }
    }
    await supabase.from("production_project_attachments").delete().eq("id", att.id);
    toast.success("Eliminato");
    loadAttachments();
  };

  const isPreviewable = (att: Attachment) =>
    att.file_type === "image" || att.file_type === "video";

  if (loading) return <Loader2 className="h-4 w-4 animate-spin mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <Paperclip className="h-4 w-4" /> Allegati ({attachments.length})
        </Label>
        <div className="flex gap-1">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1 text-xs"
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            File
          </Button>
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => setShowLinkForm(!showLinkForm)}
            className="gap-1 text-xs"
          >
            <LinkIcon className="h-3 w-3" /> Link
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.step,.stp,.igs,.iges"
        className="hidden"
        onChange={e => handleFileUpload(e.target.files)}
      />

      {showLinkForm && (
        <div className="border rounded-lg p-2 space-y-2 bg-muted/30">
          <Input
            placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            className="text-xs h-8"
          />
          <div className="flex gap-2">
            <Input
              placeholder="Nome (opzionale)"
              value={linkName}
              onChange={e => setLinkName(e.target.value)}
              className="text-xs h-8"
            />
            <Button size="sm" onClick={handleAddLink} className="h-8 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Aggiungi
            </Button>
          </div>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 p-1.5 rounded border bg-background hover:bg-muted/50 group">
              {getFileIcon(att.file_type)}
              <span className="text-xs truncate flex-1" title={att.file_name}>{att.file_name}</span>
              {att.file_size && (
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatSize(att.file_size)}</span>
              )}
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {isPreviewable(att) && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPreviewItem(att)}>
                    <Eye className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" asChild>
                  <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDelete(att)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <MediaPreviewModal
          open={!!previewItem}
          onOpenChange={() => setPreviewItem(null)}
          url={previewItem.file_url}
          name={previewItem.file_name}
          isVideo={previewItem.file_type === "video"}
        />
      )}
    </div>
  );
}

/** Compact badge for showing attachment count on cards */
export function AttachmentCountBadge({ projectId }: { projectId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    supabase
      .from("production_project_attachments")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .then(({ count: c }) => { if (c) setCount(c); });
  }, [projectId]);

  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-muted-foreground">
      <Paperclip className="h-3 w-3" />
      <span>{count}</span>
    </span>
  );
}
