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
  }, [workOrderId]); // Removed articleText from dependencies to avoid recreating articles

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

      // ALWAYS use existing articles if they exist - never recreate
      if (existingArticles && existingArticles.length > 0) {
        setArticles(existingArticles);
        return; // Exit early to prevent any recreation
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

      // Group lines intelligently: short lines (titles) with following longer lines (descriptions)
      const groupedArticles: string[] = [];
      let i = 0;
      
      while (i < allLines.length) {
        const currentLine = allLines[i];
        
        // Check if this is a short line (likely a title) followed by a longer line (description)
        if (i + 1 < allLines.length) {
          const nextLine = allLines[i + 1];
          
          // If current line is short (<= 60 chars) and next line is longer, group them
          if (currentLine.length <= 60 && nextLine.length > currentLine.length) {
            groupedArticles.push(`${currentLine}\n${nextLine}`);
            i += 2;
            continue;
          }
        }
        
        // Otherwise, add the line as-is
        groupedArticles.push(currentLine);
        i++;
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
