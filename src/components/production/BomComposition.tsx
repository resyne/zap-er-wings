import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight } from "lucide-react";

interface BomItem {
  id: string;
  name: string;
  version: string;
  level: number;
  quantity?: number;
  material?: {
    id: string;
    name: string;
    code: string;
    cost?: number;
  };
}

interface BomCompositionProps {
  bomId: string;
}

export function BomComposition({ bomId }: BomCompositionProps) {
  const [composition, setComposition] = useState<BomItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBomComposition();
  }, [bomId]);

  const fetchBomComposition = async () => {
    try {
      setLoading(true);
      
      // Fetch livello 1 BOMs
      const { data: level1Inclusions, error: error1 } = await supabase
        .from('bom_inclusions')
        .select('quantity, included_bom_id')
        .eq('parent_bom_id', bomId);

      if (error1) throw error1;

      // Get BOM details for level 1
      const level1Items: BomItem[] = [];
      if (level1Inclusions && level1Inclusions.length > 0) {
        const bomIds = level1Inclusions.map(inc => inc.included_bom_id);
        const { data: level1Boms, error: bomError } = await supabase
          .from('boms')
          .select('id, name, version, level, material:materials(id, name, code, cost)')
          .in('id', bomIds);

        if (!bomError && level1Boms) {
          level1Items.push(
            ...level1Boms.map(bom => {
              const inclusion = level1Inclusions.find(inc => inc.included_bom_id === bom.id);
              return {
                id: bom.id,
                name: bom.name,
                version: bom.version,
                level: bom.level,
                quantity: inclusion?.quantity || 1,
                material: (bom as any).material || undefined
              };
            })
          );
        }
      }

      // For each level 1, fetch level 2
      const level2Items: BomItem[] = [];
      for (const level1Item of level1Items) {
        const { data: level2Inclusions, error: error2 } = await supabase
          .from('bom_inclusions')
          .select('quantity, included_bom_id')
          .eq('parent_bom_id', level1Item.id);

        if (error2 || !level2Inclusions) continue;

        const bomIds = level2Inclusions.map(inc => inc.included_bom_id);
        if (bomIds.length === 0) continue;

        const { data: level2Boms, error: bomError } = await supabase
          .from('boms')
          .select('id, name, version, level, material:materials(id, name, code, cost)')
          .in('id', bomIds);

        if (!bomError && level2Boms) {
          level2Items.push(
            ...level2Boms.map(bom => {
              const inclusion = level2Inclusions.find(inc => inc.included_bom_id === bom.id);
              return {
                id: bom.id,
                name: bom.name,
                version: bom.version,
                level: bom.level,
                quantity: inclusion?.quantity || 1,
                material: (bom as any).material || undefined
              };
            })
          );
        }
      }

      setComposition([...level1Items, ...level2Items]);
    } catch (error) {
      console.error('Error fetching BOM composition:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composizione BOM</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (composition.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composizione BOM</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nessun componente trovato per questa distinta base
          </p>
        </CardContent>
      </Card>
    );
  }

  const level1Items = composition.filter(item => item.level === 1);
  const level2Items = composition.filter(item => item.level === 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Composizione BOM</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Livello 1 */}
        {level1Items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-primary/10">
                Livello 1
              </Badge>
              <span className="text-xs text-muted-foreground">
                Sottoinsiemi principali
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              {level1Items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {item.level === 2 && item.material ? item.material.name : item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      v{item.version} • Qtà: {item.quantity || 1}
                      {item.material?.cost && ` • €${Number(item.material.cost).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Livello 2 */}
        {level2Items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="bg-info/10">
                Livello 2
              </Badge>
              <span className="text-xs text-muted-foreground">
                Componenti e materiali
              </span>
            </div>
            <div className="space-y-2 pl-4 border-l-2 border-info/20">
              {level2Items.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm">
                      {item.level === 2 && item.material ? item.material.name : item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      v{item.version} • Qtà: {item.quantity || 1}
                      {item.material?.cost && ` • €${Number(item.material.cost).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}