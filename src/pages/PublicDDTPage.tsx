import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

export default function PublicDDTPage() {
  const { code } = useParams<{ code: string }>();
  const [ddtHtml, setDdtHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchDDT = async () => {
      if (!code) {
        setError("Codice DDT non valido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("ddts")
          .select("html_content, ddt_number")
          .eq("unique_code", code)
          .single();

        if (fetchError) throw fetchError;

        if (!data || !data.html_content) {
          setError("DDT non trovato");
          return;
        }

        setDdtHtml(data.html_content);
      } catch (err) {
        console.error("Error fetching DDT:", err);
        setError("Errore nel caricamento del DDT");
      } finally {
        setLoading(false);
      }
    };

    fetchDDT();
  }, [code]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento DDT...</p>
        </div>
      </div>
    );
  }

  if (error || !ddtHtml) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Errore</h1>
          <p className="text-muted-foreground">{error || "DDT non trovato"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print/Download toolbar - hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-semibold">Documento di Trasporto</h1>
          <div className="flex gap-2">
            <Button onClick={handlePrint} variant="outline">
              <Printer className="w-4 h-4 mr-2" />
              Stampa / Salva PDF
            </Button>
          </div>
        </div>
      </div>

      {/* DDT Content */}
      <div className="container mx-auto p-4 print:p-0">
        <div 
          className="bg-white shadow-lg print:shadow-none"
          dangerouslySetInnerHTML={{ __html: ddtHtml }}
        />
      </div>

      {/* Print instructions - hidden when printing */}
      <div className="print:hidden container mx-auto px-4 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Come salvare come PDF</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Clicca su "Stampa / Salva PDF"</li>
            <li>Nella finestra di stampa, seleziona "Salva come PDF" come destinazione</li>
            <li>Clicca su "Salva" e scegli dove salvare il file</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
