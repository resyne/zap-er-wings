import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Loader2, Package, X, Pencil, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface ArticleItem {
  id: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  product_id?: string;
}

interface BomLevel1 {
  id: string;
  name: string;
  version: string;
}

interface BomLevel2 {
  id: string;
  name: string;
  version: string;
  quantity: number;
  material_id?: string;
  current_stock?: number;
}

interface WorkOrderArticlesProps {
  workOrderId: string;
  articleText: string;
  hideAmounts?: boolean;
}

// Function to hide € amounts from text
const sanitizeAmounts = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.replace(/€\s*[\d.,]+|\d+[\d.,]*\s*€/g, '€ ***');
};

export function WorkOrderArticles({ workOrderId, articleText, hideAmounts = false }: WorkOrderArticlesProps) {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [bomData, setBomData] = useState<Record<string, { level1: BomLevel1[]; level2: BomLevel2[] }>>({});
  const [editingArticle, setEditingArticle] = useState<ArticleItem | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newArticleDescription, setNewArticleDescription] = useState("");

  useEffect(() => {
    loadArticles();
  }, [workOrderId]);

  const loadArticles = async () => {
    try {
      setLoading(true);

      // Fetch existing articles from database
      const { data: existingArticles, error: fetchError } = await supabase
        .from("work_order_article_items")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("position", { ascending: true });

      if (fetchError) throw fetchError;

      // Check for duplicates in existing articles
      const uniqueArticles: ArticleItem[] = [];
      const seenDescriptions = new Set<string>();
      
      if (existingArticles && existingArticles.length > 0) {
        // Remove exact duplicates based on description
        for (const article of existingArticles) {
          const normalizedDesc = article.description.trim().toLowerCase();
          if (!seenDescriptions.has(normalizedDesc)) {
            seenDescriptions.add(normalizedDesc);
            uniqueArticles.push(article);
          } else {
            // Delete duplicate from database
            console.log('Removing duplicate article:', article.description.substring(0, 50));
            await supabase
              .from("work_order_article_items")
              .delete()
              .eq("id", article.id);
          }
        }
        
        setArticles(uniqueArticles);
        
        // If we removed duplicates, show a toast
        if (uniqueArticles.length < existingArticles.length) {
          toast.success(`Rimossi ${existingArticles.length - uniqueArticles.length} articoli duplicati`);
        }

        // Load BOM data for articles
        await loadBomDataForArticles(uniqueArticles);
        return;
      }

      // Only create articles if NONE exist for this work order
      // Split article text into lines
      const allLines = articleText
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (allLines.length === 0) {
        setArticles([]);
        return;
      }

      // Group lines by products (lines starting with quantity like "1x", "2x", etc.)
      const groupedArticles: string[] = [];
      let currentProduct: string[] = [];
      
      for (let i = 0; i < allLines.length; i++) {
        const line = allLines[i];
        
        // Check if line starts with a quantity pattern (e.g., "1x", "2x", "10x")
        const isProductLine = /^\d+x\s/i.test(line);
        
        if (isProductLine) {
          // If we have a current product being built, save it
          if (currentProduct.length > 0) {
            groupedArticles.push(currentProduct.join('\n'));
          }
          // Start a new product group
          currentProduct = [line];
        } else {
          // Add line to current product description (if we have one)
          if (currentProduct.length > 0) {
            currentProduct.push(line);
          }
          // If no current product, skip this line (it's a standalone description like "Diam 300 mm")
        }
      }
      
      // Don't forget the last product
      if (currentProduct.length > 0) {
        groupedArticles.push(currentProduct.join('\n'));
      }

      // If no products were found, don't create any articles
      if (groupedArticles.length === 0) {
        setArticles([]);
        return;
      }

      // Create new articles from grouped text - only if none exist
      const newArticles = groupedArticles.map((description, index) => ({
        work_order_id: workOrderId,
        description: description,
        is_completed: false,
        position: index,
      }));

      const { data: createdArticles, error: insertError } = await supabase
        .from("work_order_article_items")
        .insert(newArticles)
        .select();

      if (insertError) throw insertError;

      setArticles(createdArticles || []);
      
      // Load BOM data for newly created articles
      if (createdArticles) {
        await loadBomDataForArticles(createdArticles);
      }
    } catch (error: any) {
      console.error("Error loading articles:", error);
      toast.error("Errore nel caricamento degli articoli");
    } finally {
      setLoading(false);
    }
  };

  const loadBomDataForArticles = async (articleList: ArticleItem[]) => {
    try {
      // Extract product names from article descriptions to find matching products
      const bomDataMap: Record<string, { level1: BomLevel1[]; level2: BomLevel2[] }> = {};

      for (const article of articleList) {
        // Extract the product name from description (after "1x " prefix)
        const match = article.description.match(/^\d+x\s+(.+?)(?:\n|$)/i);
        if (!match) continue;

        const fullLine = match[1].trim();
        // Use text before the first " - " as base product name (e.g. "ZPZ NUVOLA L")
        const baseName = fullLine.split(" - ")[0].trim();

        // Try to find matching product using the base name first, then fall back to full line
        const searchTerms = [baseName, fullLine].filter(Boolean);
        let productId: string | null = null;

        for (const term of searchTerms) {
          const { data: products, error } = await supabase
            .from("products")
            .select("id, name")
            .ilike("name", `%${term}%`)
            .limit(1);

          if (error) {
            console.error("Error searching product for article", article.id, error);
            continue;
          }

          if (products && products.length > 0) {
            productId = products[0].id;
            break;
          }
        }

        if (!productId) continue;

        // Find BOM Level 1 linked to this product
        const { data: bomProducts } = await supabase
          .from("bom_products")
          .select(`
            bom_id,
            boms!inner(id, name, version, level)
          `)
          .eq("product_id", productId);

        const level1Boms: BomLevel1[] = [];
        const level2Boms: BomLevel2[] = [];

        if (bomProducts) {
          for (const bp of bomProducts) {
            const bom = bp.boms as any;
            if (bom && bom.level === 1) {
              level1Boms.push({
                id: bom.id,
                name: bom.name,
                version: bom.version
              });

              // Find BOM Level 2 inclusions for this Level 1 BOM
              const { data: inclusions } = await supabase
                .from("bom_inclusions")
                .select(`
                  quantity,
                  included_bom_id,
                  boms!bom_inclusions_included_bom_id_fkey(id, name, version, level, material_id)
                `)
                .eq("parent_bom_id", bom.id);

              if (inclusions) {
                for (const inc of inclusions) {
                  const includedBom = inc.boms as any;
                  if (includedBom && includedBom.level === 2) {
                    let stockInfo: number | undefined = undefined;

                    // Fetch material stock if material_id exists
                    if (includedBom.material_id) {
                      const { data: material } = await supabase
                        .from("materials")
                        .select("current_stock")
                        .eq("id", includedBom.material_id)
                        .single();
                      
                      if (material) {
                        stockInfo = material.current_stock;
                      }
                    }

                    level2Boms.push({
                      id: includedBom.id,
                      name: includedBom.name,
                      version: includedBom.version,
                      quantity: inc.quantity,
                      material_id: includedBom.material_id,
                      current_stock: stockInfo
                    });
                  }
                }
              }
            }
          }
        }

        bomDataMap[article.id] = { level1: level1Boms, level2: level2Boms };
      }

      console.log("Loaded BOM data for articles", bomDataMap);
      setBomData(bomDataMap);
    } catch (error) {
      console.error("Error loading BOM data:", error);
    }
  };

  const handleToggleComplete = async (article: ArticleItem) => {
    try {
      const newCompleted = !article.is_completed;
      
      const { error } = await supabase
        .from("work_order_article_items")
        .update({ 
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null
        })
        .eq("id", article.id);

      if (error) throw error;

      // Log activity
      await (supabase as any).from("work_order_activities").insert({
        work_order_id: workOrderId,
        activity_type: newCompleted ? "article_completed" : "article_uncompleted",
        description: newCompleted 
          ? `Articolo completato: ${article.description.substring(0, 100)}` 
          : `Articolo riaperto: ${article.description.substring(0, 100)}`
      });

      setArticles(prev => prev.map(a => 
        a.id === article.id 
          ? { ...a, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null }
          : a
      ));

      toast.success(newCompleted ? "Articolo completato" : "Articolo riaperto");
    } catch (error) {
      console.error("Error toggling article:", error);
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleDeleteArticle = async (article: ArticleItem) => {
    try {
      const { error } = await supabase
        .from("work_order_article_items")
        .delete()
        .eq("id", article.id);

      if (error) throw error;

      // Log activity
      await (supabase as any).from("work_order_activities").insert({
        work_order_id: workOrderId,
        activity_type: "article_deleted",
        description: `Articolo eliminato: ${article.description.substring(0, 100)}`
      });

      setArticles(prev => prev.filter(a => a.id !== article.id));
      toast.success("Articolo eliminato");
    } catch (error) {
      console.error("Error deleting article:", error);
      toast.error("Errore nell'eliminazione");
    }
  };

  const handleEditArticle = async () => {
    if (!editingArticle || !editDescription.trim()) return;
    
    try {
      const { error } = await supabase
        .from("work_order_article_items")
        .update({ description: editDescription.trim() })
        .eq("id", editingArticle.id);

      if (error) throw error;

      // Log activity
      await (supabase as any).from("work_order_activities").insert({
        work_order_id: workOrderId,
        activity_type: "article_updated",
        description: `Articolo modificato: ${editDescription.substring(0, 100)}`
      });

      setArticles(prev => prev.map(a => 
        a.id === editingArticle.id 
          ? { ...a, description: editDescription.trim() }
          : a
      ));

      setEditingArticle(null);
      setEditDescription("");
      toast.success("Articolo aggiornato");
    } catch (error) {
      console.error("Error updating article:", error);
      toast.error("Errore nell'aggiornamento");
    }
  };

  const handleAddArticle = async () => {
    if (!newArticleDescription.trim()) return;
    
    try {
      const newPosition = articles.length > 0 
        ? Math.max(...articles.map(a => a.position)) + 1 
        : 0;

      const { data: createdArticle, error } = await supabase
        .from("work_order_article_items")
        .insert({
          work_order_id: workOrderId,
          description: newArticleDescription.trim(),
          is_completed: false,
          position: newPosition
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await (supabase as any).from("work_order_activities").insert({
        work_order_id: workOrderId,
        activity_type: "article_added",
        description: `Articolo aggiunto: ${newArticleDescription.substring(0, 100)}`
      });

      if (createdArticle) {
        setArticles(prev => [...prev, createdArticle]);
        await loadBomDataForArticles([createdArticle]);
      }

      setIsAddDialogOpen(false);
      setNewArticleDescription("");
      toast.success("Articolo aggiunto");
    } catch (error) {
      console.error("Error adding article:", error);
      toast.error("Errore nell'aggiunta");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsAddDialogOpen(true)}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Aggiungi Articolo
        </Button>
      </div>

      {articles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun articolo disponibile</p>
      ) : (
        articles.map((article) => {
          const articleBoms = bomData[article.id];
          const hasBomsToShow = articleBoms && (articleBoms.level1.length > 0 || articleBoms.level2.length > 0);

          return (
            <div
              key={article.id}
              className={`rounded-lg border bg-card ${article.is_completed ? 'opacity-60' : ''}`}
            >
              <div className="p-3 flex items-start gap-3">
                <Checkbox
                  checked={article.is_completed}
                  onCheckedChange={() => handleToggleComplete(article)}
                  className="mt-1"
                />
                <Label className={`text-sm font-medium whitespace-pre-wrap flex-1 ${article.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                  {hideAmounts ? sanitizeAmounts(article.description) : article.description}
                </Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setEditingArticle(article);
                    setEditDescription(article.description);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteArticle(article)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* BOM Hierarchy - Always visible */}
              {hasBomsToShow && (
                <div className="px-3 pb-3 pt-0 ml-10 space-y-2 border-t">
                  {articleBoms.level1.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <p className="text-xs font-medium text-muted-foreground">BOM Livello 1:</p>
                      {articleBoms.level1.map(bom => (
                        <div key={bom.id} className="text-sm pl-2 border-l-2 border-primary/30">
                          {bom.name} <span className="text-muted-foreground">(v{bom.version})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {articleBoms.level2.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">BOM Livello 2:</p>
                      {articleBoms.level2.map(bom => (
                        <div key={bom.id} className="text-sm pl-2 border-l-2 border-amber-500/30 flex items-center justify-between">
                          <span>
                            {bom.quantity}x {bom.name} <span className="text-muted-foreground">(v{bom.version})</span>
                          </span>
                          {bom.current_stock !== undefined && (
                            <Badge 
                              variant="outline" 
                              className={`ml-2 gap-1 ${
                                bom.current_stock >= bom.quantity 
                                  ? 'border-green-500 text-green-600' 
                                  : 'border-red-500 text-red-600'
                              }`}
                            >
                              <Package className="h-3 w-3" />
                              {bom.current_stock}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingArticle} onOpenChange={(open) => !open && setEditingArticle(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifica Articolo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Descrizione articolo"
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingArticle(null)}>
              Annulla
            </Button>
            <Button onClick={handleEditArticle}>
              <Check className="h-4 w-4 mr-1" />
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Aggiungi Articolo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={newArticleDescription}
              onChange={(e) => setNewArticleDescription(e.target.value)}
              placeholder="Es: 1x Nome Prodotto - Descrizione"
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleAddArticle}>
              <Plus className="h-4 w-4 mr-1" />
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
