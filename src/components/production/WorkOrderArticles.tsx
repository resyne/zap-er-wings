import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ArticleItem {
  id: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
}

interface WorkOrderArticlesProps {
  workOrderId: string;
  articleText: string;
}

export function WorkOrderArticles({ workOrderId, articleText }: WorkOrderArticlesProps) {
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);

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
    } catch (error: any) {
      console.error("Error loading articles:", error);
      toast.error("Errore nel caricamento degli articoli");
    } finally {
      setLoading(false);
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
      {articles.map((article) => (
        <div
          key={article.id}
          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
        >
          <Checkbox
            id={article.id}
            checked={article.is_completed}
            onCheckedChange={() => handleToggleArticle(article.id, article.is_completed)}
            className="mt-1"
          />
          <div className="flex-1">
            <Label
              htmlFor={article.id}
              className={`cursor-pointer text-sm whitespace-pre-wrap ${
                article.is_completed ? "line-through text-muted-foreground" : ""
              }`}
            >
              {article.description}
            </Label>
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
      ))}
    </div>
  );
}
