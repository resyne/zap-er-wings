import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, BookOpen, Search, Tag, X, Save } from "lucide-react";

interface KnowledgeEntry {
  id: string;
  account_id: string | null;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  is_active: boolean;
  usage_count: number;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
}

const CATEGORIES = [
  { value: "general", label: "Generale" },
  { value: "pricing", label: "Prezzi e Preventivi" },
  { value: "products", label: "Prodotti" },
  { value: "shipping", label: "Spedizioni" },
  { value: "warranty", label: "Garanzia" },
  { value: "technical", label: "Tecnico" },
  { value: "objections", label: "Obiezioni" },
  { value: "closing", label: "Chiusura Vendita" },
];

export function WhatsAppKnowledgeBase({ open, onOpenChange, accountId }: Props) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Form state
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    question: "",
    answer: "",
    category: "general",
    keywords: "",
    is_active: true,
  });

  useEffect(() => {
    if (open) {
      fetchEntries();
    }
  }, [open, accountId]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("whatsapp_ai_knowledge")
        .select("*")
        .order("usage_count", { ascending: false });

      if (accountId) {
        query = query.or(`account_id.eq.${accountId},account_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEntries(data || []);
    } catch (error: any) {
      toast.error("Errore nel caricamento: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const keywordsArray = formData.keywords
        .split(",")
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);

      const entryData = {
        question: formData.question,
        answer: formData.answer,
        category: formData.category,
        keywords: keywordsArray,
        is_active: formData.is_active,
        account_id: accountId || null,
      };

      if (editingEntry) {
        const { error } = await supabase
          .from("whatsapp_ai_knowledge")
          .update(entryData)
          .eq("id", editingEntry.id);

        if (error) throw error;
        toast.success("Voce aggiornata!");
      } else {
        const { error } = await supabase
          .from("whatsapp_ai_knowledge")
          .insert(entryData);

        if (error) throw error;
        toast.success("Nuova voce aggiunta!");
      }

      resetForm();
      fetchEntries();
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa voce?")) return;

    try {
      const { error } = await supabase
        .from("whatsapp_ai_knowledge")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Voce eliminata");
      fetchEntries();
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setFormData({
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      keywords: entry.keywords.join(", "),
      is_active: entry.is_active,
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingEntry(null);
    setShowForm(false);
    setFormData({
      question: "",
      answer: "",
      category: "general",
      keywords: "",
      is_active: true,
    });
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = searchQuery === "" || 
      entry.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.keywords.some(k => k.includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Knowledge Base AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per domanda, risposta o keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card className="p-4 bg-muted/50 border-primary/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {editingEntry ? "Modifica voce" : "Nuova voce"}
                  </h3>
                  <Button variant="ghost" size="icon" onClick={resetForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Domanda / Situazione</Label>
                    <Textarea
                      placeholder="Es: Il cliente chiede il prezzo del modello X"
                      value={formData.question}
                      onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Risposta suggerita</Label>
                    <Textarea
                      placeholder="Es: Il modello X ha un prezzo di listino di €X..."
                      value={formData.answer}
                      onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Keywords (separati da virgola)</Label>
                    <Input
                      placeholder="prezzo, costo, preventivo"
                      value={formData.keywords}
                      onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Attivo</Label>
                    <div className="flex items-center gap-2 pt-2">
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                      />
                      <span className="text-sm text-muted-foreground">
                        {formData.is_active ? "L'AI userà questa voce" : "Disattivato"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={resetForm}>Annulla</Button>
                  <Button onClick={handleSave} disabled={!formData.question || !formData.answer}>
                    <Save className="h-4 w-4 mr-1" />
                    {editingEntry ? "Aggiorna" : "Salva"}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Entries list */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {entries.length === 0 
                  ? "Nessuna voce nella Knowledge Base. Aggiungi domande e risposte per addestrare l'AI."
                  : "Nessun risultato trovato"}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <Card 
                    key={entry.id} 
                    className={`p-4 ${!entry.is_active ? 'opacity-50' : ''}`}
                  >
                    <div className="flex justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-2">
                          <Badge variant="outline" className="shrink-0">
                            {CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                          </Badge>
                          {!entry.is_active && (
                            <Badge variant="secondary">Disattivato</Badge>
                          )}
                          {entry.usage_count > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Usato {entry.usage_count}x
                            </Badge>
                          )}
                        </div>
                        
                        <div>
                          <p className="font-medium text-sm">D: {entry.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">R: {entry.answer}</p>
                        </div>

                        {entry.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {entry.keywords.map((kw, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {kw}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(entry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>

          <p className="text-xs text-muted-foreground">
            💡 L'AI utilizzerà queste informazioni per rispondere in modo più accurato e coerente con il vostro stile di comunicazione.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
