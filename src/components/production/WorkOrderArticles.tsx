import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());

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

        const productName = match[1].trim();
        
        // Find matching product
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .ilike("name", `%${productName}%`)
          .limit(1);

        if (!products || products.length === 0) continue;

        const productId = products[0].id;

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
                  boms!bom_inclusions_included_bom_id_fkey(id, name, version, level)
                `)
                .eq("parent_bom_id", bom.id);

              if (inclusions) {
                for (const inc of inclusions) {
                  const includedBom = inc.boms as any;
                  if (includedBom && includedBom.level === 2) {
                    level2Boms.push({
                      id: includedBom.id,
                      name: includedBom.name,
                      version: includedBom.version,
                      quantity: inc.quantity
                    });
                  }
                }
              }
            }
          }
        }

        bomDataMap[article.id] = { level1: level1Boms, level2: level2Boms };
      }

      setBomData(bomDataMap);
    } catch (error) {
      console.error("Error loading BOM data:", error);
    }
  };

  const handleToggleArticle = async (articleId: string, currentStatus: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const updateData: any = {
        is_completed: !currentStatus,
      };

      if (!currentStatus) {
        // Marking as completed
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      } else {
        // Marking as not completed
        updateData.completed_at = null;
        updateData.completed_by = null;
      }

      const { error } = await supabase
        .from("work_order_article_items")
        .update(updateData)
        .eq("id", articleId);

      if (error) throw error;

      // Update local state
      setArticles(articles.map(article =>
        article.id === articleId
          ? { ...article, is_completed: !currentStatus, completed_at: updateData.completed_at }
          : article
      ));

      toast.success(!currentStatus ? "Articolo completato" : "Articolo ripristinato");
    } catch (error: any) {
      console.error("Error toggling article:", error);
      toast.error("Errore nell'aggiornamento dell'articolo");
    }
  };

  const toggleExpanded = (articleId: string) => {
    setExpandedArticles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nessun articolo disponibile</p>
    );
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => {
        const articleBoms = bomData[article.id];
        const hasBomsToShow = articleBoms && (articleBoms.level1.length > 0 || articleBoms.level2.length > 0);
        const isExpanded = expandedArticles.has(article.id);

        return (
          <div
            key={article.id}
            className="rounded-lg border bg-card"
          >
            <div className="flex items-start gap-3 p-3 hover:bg-accent/50 transition-colors">
              <Checkbox
                id={article.id}
                checked={article.is_completed}
                onCheckedChange={() => handleToggleArticle(article.id, article.is_completed)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <Label
                    htmlFor={article.id}
                    className={`cursor-pointer text-sm whitespace-pre-wrap ${
                      article.is_completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {hideAmounts ? sanitizeAmounts(article.description) : article.description}
                  </Label>
                  {hasBomsToShow && (
                    <button
                      onClick={() => toggleExpanded(article.id)}
                      className="ml-2 p-1 hover:bg-accent rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
                {article.completed_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Completato il {new Date(article.completed_at).toLocaleDateString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* BOM Hierarchy */}
            {hasBomsToShow && isExpanded && (
              <div className="px-3 pb-3 pt-0 ml-8 space-y-2">
                {articleBoms.level1.length > 0 && (
                  <div className="space-y-1">
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
                      <div key={bom.id} className="text-sm pl-2 border-l-2 border-amber-500/30">
                        {bom.quantity}x {bom.name} <span className="text-muted-foreground">(v{bom.version})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
