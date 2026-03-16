import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { MessageCircle, Bot, ArrowRight, FileText, ListTodo, ShoppingCart, UserPlus, XCircle, AlertCircle, Calendar } from "lucide-react";

const actionIcons: Record<string, any> = {
  prima_nota: FileText, task: ListTodo, sales_order: ShoppingCart,
  lead: UserPlus, error: XCircle, unknown: AlertCircle,
  query: MessageCircle, conversation: MessageCircle,
  schedule_commessa: Calendar, update_lead: UserPlus, update_task: ListTodo,
};

const actionLabels: Record<string, string> = {
  prima_nota: "Prima Nota", task: "Task", sales_order: "Ordine",
  lead: "Lead", error: "Errore", unknown: "Non classificato",
  query: "Consulta dati", conversation: "Conversazione",
  schedule_commessa: "Calendarizza Commessa", update_lead: "Aggiorna Lead", update_task: "Aggiorna Task",
};

const statusConfig: Record<string, { label: string; className: string }> = {
  completed: { label: "Completato", className: "bg-green-500/10 text-green-700 border-green-200" },
  failed: { label: "Errore", className: "bg-red-500/10 text-red-700 border-red-200" },
  awaiting_confirmation: { label: "In attesa", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  pending: { label: "In corso", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
};

interface Props {
  log: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BeccaActivityDetailDialog({ log, open, onOpenChange }: Props) {
  if (!log) return null;

  const Icon = actionIcons[log.action_type] || AlertCircle;
  const aiData = log.ai_interpretation as any;
  const status = statusConfig[log.status] || statusConfig.pending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-violet-600" />
            {actionLabels[log.action_type] || log.action_type}
            <Badge variant="outline" className={status.className}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          <div className="space-y-4">
            {/* Timestamp */}
            <p className="text-xs text-muted-foreground">
              {format(new Date(log.created_at), "dd MMMM yyyy, HH:mm:ss", { locale: it })}
            </p>

            {/* Request */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MessageCircle className="h-4 w-4 text-blue-500" />
                Messaggio ricevuto
              </div>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                {log.raw_message || "N/D"}
              </p>
            </div>

            {/* AI Interpretation */}
            {aiData && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bot className="h-4 w-4 text-violet-500" />
                  Interpretazione AI
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-md p-2">
                    <span className="text-muted-foreground text-xs">Azione</span>
                    <p className="font-medium">{actionLabels[aiData.action] || aiData.action || "N/D"}</p>
                  </div>
                  <div className="bg-muted/50 rounded-md p-2">
                    <span className="text-muted-foreground text-xs">Confidenza</span>
                    <p className="font-medium">{log.confidence_score != null ? `${log.confidence_score}%` : "N/D"}</p>
                  </div>
                </div>

                {/* Extracted data */}
                {aiData.data && Object.keys(aiData.data).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Dati estratti</p>
                    <div className="bg-muted/50 rounded-md p-3 space-y-1">
                      {Object.entries(aiData.data).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-right max-w-[60%] truncate">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value || 'N/D')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Response sent */}
            {log.confirmation_question && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  Risposta inviata
                </div>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3">
                  {log.confirmation_question}
                </p>
              </div>
            )}

            {/* Error */}
            {log.error_message && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-red-700">
                  <XCircle className="h-4 w-4" />
                  Errore
                </div>
                <p className="text-sm text-red-600">{log.error_message}</p>
              </div>
            )}

            {/* Entity created */}
            {log.entity_type && log.entity_id && (
              <div className="rounded-lg border p-3 flex items-center gap-2 text-sm">
                <Badge variant="secondary">{log.entity_type}</Badge>
                <span className="text-muted-foreground text-xs font-mono">{log.entity_id}</span>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
