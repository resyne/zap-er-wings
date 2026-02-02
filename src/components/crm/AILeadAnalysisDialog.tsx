import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Sparkles, Loader2, Phone, MessageCircle, Mail, FileText, 
  Users, AlertTriangle, TrendingUp, CheckCircle2, Lightbulb,
  ArrowRight, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UrgentLead {
  leadId: string;
  leadName: string;
  urgencyScore: number;
  urgencyReason: string;
  suggestedAction: string;
  actionType: "call" | "whatsapp" | "email" | "offer" | "meeting";
}

interface Analysis {
  summary: string;
  urgentLeads: UrgentLead[];
  suggestions: string[];
}

interface AILeadAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline?: string;
  onLeadClick?: (leadId: string) => void;
}

const actionIcons = {
  call: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  offer: FileText,
  meeting: Users,
};

const actionColors = {
  call: "bg-blue-100 text-blue-700",
  whatsapp: "bg-green-100 text-green-700",
  email: "bg-purple-100 text-purple-700",
  offer: "bg-orange-100 text-orange-700",
  meeting: "bg-pink-100 text-pink-700",
};

export default function AILeadAnalysisDialog({ 
  open, 
  onOpenChange, 
  pipeline,
  onLeadClick 
}: AILeadAnalysisDialogProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("analyze-leads-priority", {
        body: { pipeline: pipeline || "all", limit: 100 }
      });

      if (fnError) throw fnError;
      if (!data?.success) throw new Error(data?.error || "Errore nell'analisi");

      setAnalysis(data.analysis);
      toast.success("Analisi completata!");
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError(err.message || "Errore durante l'analisi");
      toast.error("Errore durante l'analisi");
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (score: number) => {
    if (score >= 8) return "bg-red-500";
    if (score >= 6) return "bg-orange-500";
    if (score >= 4) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getUrgencyLabel = (score: number) => {
    if (score >= 8) return "Critico";
    if (score >= 6) return "Alto";
    if (score >= 4) return "Medio";
    return "Basso";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Analisi AI Lead
            {pipeline && pipeline !== "all" && (
              <Badge variant="outline" className="ml-2">{pipeline}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!analysis && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="rounded-full bg-primary/10 p-6">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg">Analisi Intelligente dei Lead</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  L'AI analizzerà i tuoi lead e identificherà quelli più urgenti da lavorare, 
                  suggerendo le azioni specifiche da compiere.
                </p>
              </div>
              <Button onClick={runAnalysis} size="lg" className="gap-2 mt-4">
                <Sparkles className="h-4 w-4" />
                Avvia Analisi
              </Button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">Analisi in corso...</h3>
                <p className="text-muted-foreground text-sm">
                  L'AI sta analizzando {pipeline || "tutti"} i lead per identificare le priorità
                </p>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="m-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {analysis && (
            <ScrollArea className="h-[calc(85vh-10rem)] px-1">
              <div className="space-y-6 pb-4 pr-3">
                {/* Summary */}
                <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/20 p-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Riepilogo</h4>
                        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Urgent Leads */}
                {analysis.urgentLeads && analysis.urgentLeads.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Lead Urgenti ({analysis.urgentLeads.length})
                    </h4>
                    
                    <div className="space-y-2">
                      {analysis.urgentLeads.map((lead, idx) => {
                        const ActionIcon = actionIcons[lead.actionType] || Phone;
                        return (
                          <Card 
                            key={lead.leadId || idx} 
                            className="hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => onLeadClick?.(lead.leadId)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                {/* Urgency Score */}
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`w-10 h-10 rounded-full ${getUrgencyColor(lead.urgencyScore)} flex items-center justify-center text-white font-bold text-sm`}>
                                    {lead.urgencyScore}
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {getUrgencyLabel(lead.urgencyScore)}
                                  </span>
                                </div>

                                {/* Lead Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="font-medium truncate">{lead.leadName}</h5>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {lead.urgencyReason}
                                  </p>
                                  
                                  {/* Suggested Action */}
                                  <div className="mt-2 flex items-center gap-2">
                                    <Badge className={`${actionColors[lead.actionType] || actionColors.call} gap-1`}>
                                      <ActionIcon className="h-3 w-3" />
                                      {lead.suggestedAction}
                                    </Badge>
                                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  </div>
                                </div>

                                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Strategic Suggestions */}
                {analysis.suggestions && analysis.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Suggerimenti Strategici
                    </h4>
                    
                    <div className="space-y-2">
                      {analysis.suggestions.map((suggestion, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <p className="text-sm">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Re-run Analysis */}
                <div className="pt-4 flex justify-center">
                  <Button variant="outline" onClick={runAnalysis} disabled={loading} className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    Riesegui Analisi
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
