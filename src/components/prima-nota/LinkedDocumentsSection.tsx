import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Link2, Unlink, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/accounting-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  entryId: string;
  editing: boolean;
}

export function LinkedDocumentsSection({ entryId, editing }: Props) {
  const queryClient = useQueryClient();
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>("");

  // Fetch linked documents
  const { data: linkedDocs = [] } = useQuery({
    queryKey: ["linked-documents", entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_documents")
        .select("*")
        .eq("accounting_entry_id", entryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId,
  });

  // Fetch unlinked documents for selector
  const { data: availableDocs = [] } = useQuery({
    queryKey: ["unlinked-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_documents")
        .select("*")
        .is("accounting_entry_id", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: showLinkSelector,
  });

  // Also check invoice_registry for linkable invoices
  const { data: availableInvoices = [] } = useQuery({
    queryKey: ["unlinked-invoices-for-prima-nota", entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_registry")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: showLinkSelector,
  });

  const linkMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("accounting_documents")
        .update({ accounting_entry_id: entryId })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento collegato");
      setSelectedDocId("");
      setShowLinkSelector(false);
      queryClient.invalidateQueries({ queryKey: ["linked-documents", entryId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-documents"] });
    },
    onError: () => toast.error("Errore nel collegamento"),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("accounting_documents")
        .update({ accounting_entry_id: null })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento scollegato");
      queryClient.invalidateQueries({ queryKey: ["linked-documents", entryId] });
    },
    onError: () => toast.error("Errore nello scollegamento"),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          Documenti Collegati
        </h3>
        {editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkSelector(!showLinkSelector)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Collega
          </Button>
        )}
      </div>

      {/* Link selector */}
      {showLinkSelector && (
        <div className="flex gap-2 items-end p-3 bg-muted/30 rounded-lg">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">Seleziona documento</label>
            <Select value={selectedDocId} onValueChange={setSelectedDocId}>
              <SelectTrigger>
                <SelectValue placeholder="Scegli un documento..." />
              </SelectTrigger>
              <SelectContent>
                {availableDocs.map((doc) => (
                  <SelectItem key={doc.id} value={doc.id}>
                    {doc.document_type} - {doc.file_name}
                    {doc.total_amount ? ` (${formatEuro(doc.total_amount)})` : ""}
                  </SelectItem>
                ))}
                {availableDocs.length === 0 && (
                  <SelectItem value="_none" disabled>
                    Nessun documento disponibile
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            disabled={!selectedDocId || selectedDocId === "_none" || linkMutation.isPending}
            onClick={() => linkMutation.mutate(selectedDocId)}
          >
            <Link2 className="h-3.5 w-3.5 mr-1" />
            Collega
          </Button>
        </div>
      )}

      {/* Linked documents list */}
      {linkedDocs.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nessun documento collegato</p>
      ) : (
        <div className="space-y-2">
          {linkedDocs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {doc.document_type}
                    </Badge>
                    {doc.counterpart_name && <span>{doc.counterpart_name}</span>}
                    {doc.total_amount && (
                      <span className="font-medium">{formatEuro(doc.total_amount)}</span>
                    )}
                    {doc.invoice_date && (
                      <span>{format(new Date(doc.invoice_date), "dd/MM/yyyy", { locale: it })}</span>
                    )}
                  </div>
                </div>
              </div>
              {editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkMutation.mutate(doc.id)}
                  disabled={unlinkMutation.isPending}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
