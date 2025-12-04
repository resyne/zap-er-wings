import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";

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
  current_stock?: number;
}

interface ArticleBomDisplayProps {
  articleDescription: string;
  compact?: boolean;
  showStock?: boolean;
}

export function ArticleBomDisplay({ articleDescription, compact = false, showStock = false }: ArticleBomDisplayProps) {
  const [bomData, setBomData] = useState<{ level1: BomLevel1[]; level2: BomLevel2[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBomData();
  }, [articleDescription]);

  const loadBomData = async () => {
    try {
      // Extract the product name from description (after "1x " prefix)
      const match = articleDescription.match(/^\d+x\s+(.+?)(?:\n|$)/i);
      if (!match) {
        setLoading(false);
        return;
      }

      const productName = match[1].trim();
      
      // Find matching product
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", `%${productName}%`)
        .limit(1);

      if (!products || products.length === 0) {
        setLoading(false);
        return;
      }

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
                boms!bom_inclusions_included_bom_id_fkey(id, name, version, level, material_id)
              `)
              .eq("parent_bom_id", bom.id);

            if (inclusions) {
              for (const inc of inclusions) {
                const includedBom = inc.boms as any;
                if (includedBom && includedBom.level === 2) {
                  let stockInfo: number | undefined = undefined;

                  // Fetch material stock if needed
                  if (showStock && includedBom.material_id) {
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
                    current_stock: stockInfo
                  });
                }
              }
            }
          }
        }
      }

      setBomData({ level1: level1Boms, level2: level2Boms });
    } catch (error) {
      console.error("Error loading BOM data:", error);
    } finally {
      setLoading(false);
    }
  };

  const articleLine = articleDescription.split('\n')[0];

  if (compact) {
    return (
      <div className="space-y-0.5">
        <div className="font-medium text-xs">{articleLine}</div>
        {!loading && bomData && bomData.level2.length > 0 && (
          <>
            {bomData.level2.map(bom => (
              <div key={bom.id} className="text-[10px] text-muted-foreground pl-2 border-l border-amber-500/30 flex items-center gap-1">
                <span>{bom.quantity}x {bom.name}</span>
                {showStock && bom.current_stock !== undefined && (
                  <Badge 
                    variant="outline" 
                    className={`text-[8px] px-1 py-0 h-4 ${
                      bom.current_stock >= bom.quantity 
                        ? 'border-green-500 text-green-600' 
                        : 'border-red-500 text-red-600'
                    }`}
                  >
                    <Package className="h-2 w-2 mr-0.5" />
                    {bom.current_stock}
                  </Badge>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="font-medium text-xs">{articleLine}</div>
      {!loading && bomData && bomData.level2.length > 0 && (
        <>
          {bomData.level2.map(bom => (
            <div key={bom.id} className="text-xs text-muted-foreground pl-2 border-l-2 border-amber-500/30 flex items-center justify-between">
              <span>{bom.quantity}x {bom.name} <span className="opacity-70">(v{bom.version})</span></span>
              {showStock && bom.current_stock !== undefined && (
                <Badge 
                  variant="outline" 
                  className={`ml-2 gap-1 text-[10px] ${
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
        </>
      )}
    </div>
  );
}
