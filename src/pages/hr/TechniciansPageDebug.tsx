import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function TechniciansPageDebug() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    console.log("TechniciansPageDebug mounted");
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log("Loading technicians data...");
      setLoading(true);
      setError(null);
      
      const { data: techData, error: techError } = await supabase
        .from("technicians")
        .select("*")
        .order("created_at", { ascending: false });

      console.log("Raw data from DB:", techData);
      console.log("Error from DB:", techError);

      if (techError) {
        console.error("Database error:", techError);
        setError(`Database error: ${techError.message}`);
        toast({
          title: "Errore DB",
          description: techError.message,
          variant: "destructive",
        });
      } else {
        setData(techData || []);
        console.log("Data loaded successfully:", techData?.length || 0, "records");
      }
    } catch (err: any) {
      console.error("Catch error:", err);
      setError(`Catch error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Debug - Caricamento...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Debug Pagina Tecnici</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Errore:</strong> {error}
            </div>
          )}
          
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded">
            <strong>Dati caricati:</strong> {data.length} record(s)
          </div>
          
          {data.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold">Primi 3 record:</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(data.slice(0, 3), null, 2)}
              </pre>
            </div>
          )}
          
          <div className="space-y-2">
            <button 
              onClick={loadData}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Ricarica Dati
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}