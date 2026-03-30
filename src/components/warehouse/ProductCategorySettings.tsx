import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings, Plus, Trash2, Pencil, ChevronDown, ChevronRight, Layers, Check, X, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  subcategories: Subcategory[];
}

export function ProductCategorySettings({ open, onOpenChange, categories, subcategories }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingSub, setEditingSub] = useState<string | null>(null);
  const [editingSubName, setEditingSubName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    queryClient.invalidateQueries({ queryKey: ["product-subcategories"] });
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order));
    const { error } = await supabase.from("product_categories").insert({ name: newCatName.trim(), sort_order: maxOrder + 1 });
    if (error) { toast({ title: "Errore", variant: "destructive" }); return; }
    setNewCatName("");
    invalidate();
    toast({ title: "Categoria aggiunta" });
  };

  const updateCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    await supabase.from("product_categories").update({ name: editingCatName.trim() }).eq("id", id);
    setEditingCat(null);
    invalidate();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("product_categories").delete().eq("id", id);
    invalidate();
    toast({ title: "Categoria eliminata" });
  };

  const addSubcategory = async (categoryId: string) => {
    if (!newSubName.trim()) return;
    const catSubs = subcategories.filter(s => s.category_id === categoryId);
    const maxOrder = Math.max(0, ...catSubs.map(s => s.sort_order));
    const { error } = await supabase.from("product_subcategories").insert({
      category_id: categoryId,
      name: newSubName.trim(),
      sort_order: maxOrder + 1,
    });
    if (error) { toast({ title: "Errore", variant: "destructive" }); return; }
    setAddingSubTo(null);
    setNewSubName("");
    invalidate();
    toast({ title: "Sottocategoria aggiunta" });
  };

  const updateSubcategory = async (id: string) => {
    if (!editingSubName.trim()) return;
    await supabase.from("product_subcategories").update({ name: editingSubName.trim() }).eq("id", id);
    setEditingSub(null);
    invalidate();
  };

  const deleteSubcategory = async (id: string) => {
    await supabase.from("product_subcategories").delete().eq("id", id);
    invalidate();
    toast({ title: "Sottocategoria eliminata" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            Categorie Prodotti
          </DialogTitle>
          <DialogDescription>
            Gestisci categorie e sottocategorie per organizzare i prodotti finiti
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 max-h-[500px] pr-1">
          {categories.map((cat) => {
            const catSubs = subcategories.filter(s => s.category_id === cat.id);
            const isOpen = expandedCats.has(cat.id);

            return (
              <div key={cat.id} className="border border-border rounded-lg overflow-hidden">
                <Collapsible open={isOpen} onOpenChange={() => {
                  setExpandedCats(prev => {
                    const n = new Set(prev);
                    n.has(cat.id) ? n.delete(cat.id) : n.add(cat.id);
                    return n;
                  });
                }}>
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-2.5">
                    {editingCat === cat.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={editingCatName}
                          onChange={(e) => setEditingCatName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && updateCategory(cat.id)}
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateCategory(cat.id)}>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingCat(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 flex-1 text-left">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <span className="font-semibold text-sm">{cat.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{catSubs.length} sotto</Badge>
                          </button>
                        </CollapsibleTrigger>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingCat(cat.id); setEditingCatName(cat.name); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                  <CollapsibleContent>
                    <div className="p-2 space-y-1.5">
                      {catSubs.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 rounded-md border border-border p-2 bg-card">
                          {editingSub === sub.id ? (
                            <div className="flex items-center gap-1 flex-1">
                              <Input
                                value={editingSubName}
                                onChange={(e) => setEditingSubName(e.target.value)}
                                className="h-7 text-sm"
                                autoFocus
                                onKeyDown={(e) => e.key === "Enter" && updateSubcategory(sub.id)}
                              />
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateSubcategory(sub.id)}>
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingSub(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Layers className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium flex-1">{sub.name}</span>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingSub(sub.id); setEditingSubName(sub.name); }}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteSubcategory(sub.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))}

                      {addingSubTo === cat.id ? (
                        <div className="space-y-2 border border-dashed border-border rounded-md p-2">
                          <Input
                            placeholder="Nome sottocategoria"
                            value={newSubName}
                            onChange={(e) => setNewSubName(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && addSubcategory(cat.id)}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs flex-1" onClick={() => addSubcategory(cat.id)}>Aggiungi</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAddingSubTo(null); setNewSubName(""); }}>Annulla</Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-7 text-xs text-muted-foreground"
                          onClick={() => setAddingSubTo(cat.id)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Aggiungi sottocategoria
                        </Button>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            );
          })}

          {/* Add new category */}
          <div className="flex gap-2">
            <Input
              placeholder="Nuova categoria prodotti..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addCategory()}
            />
            <Button size="sm" className="h-9" onClick={addCategory} disabled={!newCatName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
