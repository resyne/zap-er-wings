import { useState, useEffect } from "react";
import { Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SaveEstimateChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  estimateData?: any;
}

type RefType = "lead" | "customer" | "contact" | "deal" | "none";

interface RefOption {
  id: string;
  label: string;
}

export default function SaveEstimateChatDialog({ open, onOpenChange, messages, estimateData }: SaveEstimateChatDialogProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [refType, setRefType] = useState<RefType>("none");
  const [refId, setRefId] = useState("");
  const [options, setOptions] = useState<RefOption[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Auto-generate title from first user message
    const firstUser = messages.find(m => m.role === "user");
    if (firstUser) {
      setTitle(firstUser.content.slice(0, 80));
    }
  }, [open, messages]);

  useEffect(() => {
    if (refType === "none") { setOptions([]); return; }
    loadOptions();
  }, [refType, search]);

  const loadOptions = async () => {
    let data: RefOption[] = [];
    const term = `%${search}%`;

    if (refType === "lead") {
      const { data: leads } = await supabase
        .from("leads")
        .select("id, company_name, contact_name")
        .or(`company_name.ilike.${term},contact_name.ilike.${term}`)
        .order("created_at", { ascending: false })
        .limit(20);
      data = (leads || []).map(l => ({ id: l.id, label: `${l.company_name || ""} - ${l.contact_name || ""}`.trim() }));
    } else if (refType === "customer") {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, company_name")
        .or(`name.ilike.${term},company_name.ilike.${term}`)
        .order("name")
        .limit(20);
      data = (customers || []).map(c => ({ id: c.id, label: `${c.name}${c.company_name ? ` (${c.company_name})` : ""}` }));
    } else if (refType === "contact") {
      const { data: contacts } = await supabase
        .from("crm_contacts")
        .select("id, first_name, last_name, company_name")
        .or(`first_name.ilike.${term},last_name.ilike.${term},company_name.ilike.${term}`)
        .order("first_name")
        .limit(20);
      data = (contacts || []).map(c => ({ id: c.id, label: `${c.first_name || ""} ${c.last_name || ""} ${c.company_name ? `(${c.company_name})` : ""}`.trim() }));
    } else if (refType === "deal") {
      const { data: deals } = await supabase
        .from("crm_deals")
        .select("id, name, amount")
        .ilike("name", term)
        .order("created_at", { ascending: false })
        .limit(20);
      data = (deals || []).map(d => ({ id: d.id, label: `${d.name}${d.amount ? ` (€${d.amount})` : ""}` }));
    }
    setOptions(data);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Inserisci un titolo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const insertData: any = {
        title: title.trim(),
        messages: messages as any,
        estimate_data: estimateData || null,
        notes: notes.trim() || null,
        created_by: user?.id || null,
      };
      if (refType === "lead" && refId) insertData.lead_id = refId;
      if (refType === "customer" && refId) insertData.customer_id = refId;
      if (refType === "contact" && refId) insertData.contact_id = refId;
      if (refType === "deal" && refId) insertData.deal_id = refId;

      const { error } = await supabase.from("ai_cost_estimates").insert(insertData);
      if (error) throw error;

      toast({ title: "Chat salvata con successo!" });
      onOpenChange(false);
      setTitle("");
      setNotes("");
      setRefType("none");
      setRefId("");
    } catch (e: any) {
      toast({ title: "Errore nel salvataggio", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Salva Analisi Costi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Titolo</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo dell'analisi..." />
          </div>

          <div>
            <Label>Collega a</Label>
            <Select value={refType} onValueChange={(v: RefType) => { setRefType(v); setRefId(""); setSearch(""); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun collegamento</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="customer">Cliente</SelectItem>
                <SelectItem value="contact">Contatto CRM</SelectItem>
                <SelectItem value="deal">Trattativa CRM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {refType !== "none" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Cerca..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={refId} onValueChange={setRefId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                  {options.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Nessun risultato</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Note (opzionale)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note aggiuntive..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
