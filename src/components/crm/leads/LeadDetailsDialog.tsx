import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, Users, Phone, Mail, MapPin, FileText, Zap, ChevronDown, 
  Edit, Archive, ArchiveRestore, Trash2, CheckCircle2, XCircle, Calendar,
  Activity, Upload, MessageCircle, User, Link, ExternalLink, CalendarPlus
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Lead } from "@/hooks/useLeads";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LeadActivities from "@/components/crm/LeadActivities";
import LeadFileUpload from "@/components/crm/LeadFileUpload";
import LeadComments from "@/components/crm/LeadComments";
import LeadCallHistory from "@/components/crm/LeadCallHistory";
import LeadWhatsAppChat from "@/components/crm/LeadWhatsAppChat";
import { GenerateConfiguratorLink } from "@/components/crm/GenerateConfiguratorLink";
import { ConfiguratorStatus } from "@/components/crm/ConfiguratorStatus";

interface LeadDetailsDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lead: Lead) => void;
  onArchive: (leadId: string, archive: boolean) => void;
  onDelete: (leadId: string) => void;
  onStatusChange: (leadId: string, status: string) => void;
  formatAmount: (value: number) => string;
  hideAmounts?: boolean;
  isMobile?: boolean;
  onRefresh?: () => void;
}

const kanbanStatuses = [
  { id: "new", title: "Nuovo", color: "bg-blue-100 text-blue-800" },
  { id: "pre_qualified", title: "Pre-Qualificato", color: "bg-purple-100 text-purple-800" },
  { id: "qualified", title: "Qualificato", color: "bg-green-100 text-green-800" },
  { id: "negotiation", title: "Trattativa", color: "bg-orange-100 text-orange-800" },
  { id: "won", title: "Vinto", color: "bg-emerald-100 text-emerald-800" },
  { id: "lost", title: "Perso", color: "bg-red-100 text-red-800" }
];

const leadPriorities = [
  { id: "low", title: "LOW", color: "bg-blue-100 text-blue-800" },
  { id: "mid", title: "MID", color: "bg-orange-100 text-orange-800" },
  { id: "hot", title: "HOT", color: "bg-red-100 text-red-800" },
];

export function LeadDetailsDialog({
  lead,
  open,
  onOpenChange,
  onEdit,
  onArchive,
  onDelete,
  onStatusChange,
  formatAmount,
  hideAmounts = false,
  isMobile = false,
  onRefresh,
}: LeadDetailsDialogProps) {
  const handleUpdateCustomField = useCallback(async (fieldName: string, value: string) => {
    if (!lead) return;
    
    try {
      const updatedCustomFields = {
        ...lead.custom_fields,
        [fieldName]: value
      };

      const { error } = await supabase
        .from("leads")
        .update({ custom_fields: updatedCustomFields })
        .eq("id", lead.id);

      if (error) throw error;
      
      toast.success("Campo aggiornato");
      onRefresh?.();
    } catch (error: any) {
      toast.error("Errore aggiornamento: " + error.message);
    }
  }, [lead, onRefresh]);

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-h-[90vh] overflow-y-auto",
        isMobile ? "max-w-[95vw] p-4" : "max-w-4xl"
      )}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="truncate">{lead.company_name}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {/* Quick Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={kanbanStatuses.find(s => s.id === lead.status)?.color || ''}>
              {kanbanStatuses.find(s => s.id === lead.status)?.title || lead.status}
            </Badge>
            <Badge variant="outline">{lead.pipeline || 'N/A'}</Badge>
            {lead.priority && (
              <Badge className={leadPriorities.find(p => p.id === lead.priority)?.color || ''}>
                {leadPriorities.find(p => p.id === lead.priority)?.title || lead.priority}
              </Badge>
            )}
            {lead.value && !hideAmounts && (
              <Badge variant="secondary" className="text-green-600">
                € {formatAmount(lead.value)}
              </Badge>
            )}
            {/* Created date */}
            <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <CalendarPlus className="h-3.5 w-3.5" />
              {format(new Date(lead.created_at), "dd MMM yyyy", { locale: it })}
            </span>
          </div>

          {/* Customer Details */}
          <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Dettagli Cliente</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={cn("grid gap-3 px-3 pb-3 border-t pt-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{lead.contact_name || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="text-sm hover:underline">{lead.phone}</a>
                  ) : <span className="text-sm text-muted-foreground">-</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="text-sm hover:underline truncate">{lead.email}</a>
                  ) : <span className="text-sm text-muted-foreground">-</span>}
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">
                    {lead.city ? `${lead.city}, ` : ''}{lead.country || '-'}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Description */}
          {lead.notes && (
            <div className="border rounded-lg bg-card px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Descrizione</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}

          {/* Custom Fields - ZAPPER */}
          {(lead.pipeline === "Zapper" || lead.pipeline === "Zapper Pro") && (
            <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Configurazione ZAPPER</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={cn("grid gap-2 px-3 pb-3 border-t pt-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Tipologia Cliente</label>
                    <Select
                      value={lead.custom_fields?.tipologia_cliente || ""}
                      onValueChange={(value) => handleUpdateCustomField('tipologia_cliente', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleziona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pizzeria">🍕 Pizzeria</SelectItem>
                        <SelectItem value="cucina_professionale">👨‍🍳 Cucina professionale</SelectItem>
                        <SelectItem value="panificio">🥖 Panificio</SelectItem>
                        <SelectItem value="braceria">🥩 Braceria</SelectItem>
                        <SelectItem value="girarrosto">🍗 Girarrosto</SelectItem>
                        <SelectItem value="industriale">🏭 Industriale</SelectItem>
                        <SelectItem value="domestico">🏠 Domestico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Diametro Canna Fumaria</label>
                    <Select
                      value={lead.custom_fields?.diametro_canna_fumaria || ""}
                      onValueChange={(value) => handleUpdateCustomField('diametro_canna_fumaria', value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Seleziona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">⌀ 100 mm</SelectItem>
                        <SelectItem value="150">⌀ 150 mm</SelectItem>
                        <SelectItem value="200">⌀ 200 mm</SelectItem>
                        <SelectItem value="250">⌀ 250 mm</SelectItem>
                        <SelectItem value="300">⌀ 300 mm</SelectItem>
                        <SelectItem value="350">⌀ 350 mm</SelectItem>
                        <SelectItem value="400">⌀ 400 mm</SelectItem>
                        <SelectItem value="450">⌀ 450 mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Configurator Link - for Vesuviano pipeline */}
          {lead.pipeline === "Vesuviano" && (
            <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
              <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Configuratore</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-3 border-t pt-3 space-y-2">
                  {lead.external_configurator_link ? (
                    <div className="space-y-2">
                      <ConfiguratorStatus lead={lead} />
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            navigator.clipboard.writeText(lead.external_configurator_link!);
                            toast.success("Link copiato!");
                          }}
                        >
                          Copia Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(lead.external_configurator_link!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <GenerateConfiguratorLink 
                      leadId={lead.id}
                      leadName={lead.company_name}
                      pipeline={lead.pipeline?.toLowerCase() || ''}
                      existingLink={lead.external_configurator_link}
                    />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Activities */}
          <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Attività</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t pt-3">
                <LeadActivities leadId={lead.id} onActivityCompleted={onRefresh} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Call History */}
          <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Storico Chiamate</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t pt-3">
                <LeadCallHistory leadId={lead.id} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* WhatsApp */}
          <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium">WhatsApp</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t pt-3">
                {lead.phone ? (
                  <LeadWhatsAppChat 
                    leadId={lead.id} 
                    leadPhone={lead.phone}
                    leadName={lead.contact_name || lead.company_name}
                    leadCountry={lead.country}
                  />
                ) : (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    <MessageCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    Nessun numero di telefono associato
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Files */}
          <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
            <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">File & Documenti</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-3 border-t pt-3">
                <LeadFileUpload leadId={lead.id} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Comments - Always Open */}
          <LeadComments leadId={lead.id} />

          {/* Actions */}
          <div className={cn("flex gap-2 pt-2", isMobile && "flex-col")}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                onEdit(lead);
              }}
            >
              <Edit className="h-4 w-4 mr-1" />
              Modifica
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onArchive(lead.id, !lead.archived);
                onOpenChange(false);
              }}
            >
              {lead.archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-1" />
                  Ripristina
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-1" />
                  Archivia
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1"
              onClick={() => {
                if (confirm("Sei sicuro di voler eliminare questo lead?")) {
                  onDelete(lead.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Elimina
            </Button>
            {lead.status === "negotiation" && (
              <>
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    onStatusChange(lead.id, "won");
                    onOpenChange(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Vinto
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    onStatusChange(lead.id, "lost");
                    onOpenChange(false);
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Perso
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
