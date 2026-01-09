import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, PhoneIncoming, PhoneOutgoing, Clock, User, Loader2, ChevronDown, MessageSquare, FileText } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface CallRecord {
  id: string;
  caller_number: string;
  called_number: string;
  direction: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  operator_name?: string;
  operator_id?: string;
  extension_number?: string;
  ai_summary?: string;
  ai_sentiment?: string;
  transcription?: string;
  service?: string;
}

interface LeadCallHistoryProps {
  leadId: string;
}

export default function LeadCallHistory({ leadId }: LeadCallHistoryProps) {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  useEffect(() => {
    loadCalls();
  }, [leadId]);

  const loadCalls = async () => {
    try {
      const { data, error } = await supabase
        .from('call_records')
        .select('*')
        .eq('lead_id', leadId)
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false });

      if (error) throw error;
      setCalls(data || []);
    } catch (error) {
      console.error('Error loading call records:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positivo': return 'bg-green-100 text-green-800';
      case 'negativo': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
        Nessuna chiamata registrata
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {calls.map((call) => {
        const isExpanded = expandedCall === call.id;
        const hasDetails = call.ai_summary || call.transcription;

        return (
          <Collapsible 
            key={call.id} 
            open={isExpanded} 
            onOpenChange={() => setExpandedCall(isExpanded ? null : call.id)}
          >
            <div className="rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
              <CollapsibleTrigger asChild>
                <div className="flex items-start gap-3 p-3 cursor-pointer w-full">
                  {/* Direction Icon */}
                  <div className={`p-2 rounded-full ${call.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                    {call.direction === 'inbound' ? (
                      <PhoneIncoming className="h-4 w-4 text-blue-600" />
                    ) : (
                      <PhoneOutgoing className="h-4 w-4 text-green-600" />
                    )}
                  </div>

                  {/* Call Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {call.direction === 'inbound' ? 'Chiamata ricevuta' : 'Chiamata effettuata'}
                      </span>
                      {call.ai_sentiment && (
                        <Badge className={`text-xs ${getSentimentColor(call.ai_sentiment)}`}>
                          {call.ai_sentiment}
                        </Badge>
                      )}
                      {hasDetails && (
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>

                    {/* Date, Time & Duration */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>
                        {call.call_date && format(new Date(call.call_date), 'dd MMM yyyy', { locale: it })}
                      </span>
                      <span>{call.call_time}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.duration_seconds)}
                      </span>
                    </div>

                    {/* Phone Numbers */}
                    <div className="text-xs text-muted-foreground mt-1">
                      {call.direction === 'inbound' ? (
                        <span>Da: {call.caller_number}</span>
                      ) : (
                        <span>A: {call.called_number}</span>
                      )}
                    </div>

                    {/* Operator & Extension */}
                    {(call.operator_name || call.extension_number) && (
                      <div className="flex items-center gap-1 text-xs mt-1">
                        <User className="h-3 w-3 text-primary" />
                        <span className="font-medium text-primary">
                          {call.operator_name || 'Operatore'}
                          {call.extension_number && <span className="text-muted-foreground ml-1">(Int. {call.extension_number})</span>}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-3 pb-3 space-y-3 border-t pt-3">
                  {/* AI Summary */}
                  {call.ai_summary && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        Riassunto AI
                      </div>
                      <p className="text-sm bg-background p-2 rounded border">
                        {call.ai_summary}
                      </p>
                    </div>
                  )}

                  {/* Transcription */}
                  {call.transcription && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        Trascrizione
                      </div>
                      <p className="text-sm bg-background p-2 rounded border whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {call.transcription}
                      </p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
