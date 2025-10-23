import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  title: string;
  url: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: "Direzione",
    items: [
      { title: "Dashboard Direzionale", url: "/direzione/dashboard" },
      { title: "Calendario Aziendale", url: "/direzione/calendario" },
      { title: "Task Management", url: "/tasks" },
      { title: "Task KPI", url: "/direzione/task-kpi" },
      { title: "Ordini", url: "/direzione/orders" },
    ]
  },
  {
    title: "Area Personale",
    items: [
      { title: "Dashboard", url: "/personal-area" },
      { title: "Calendario Personale", url: "/personal-area/calendario" },
    ]
  },
  {
    title: "CRM", 
    items: [
      { title: "Lead", url: "/crm/leads" },
      { title: "Lead KPI", url: "/crm/leads/kpi" },
      { title: "Clienti", url: "/crm/customers" },
      { title: "Offerte", url: "/crm/offers" },
    ]
  },
  {
    title: "Produzione",
    items: [
      { title: "Distinte Base", url: "/mfg/bom" },
      { title: "Commesse di Produzione", url: "/mfg/work-orders" },
      { title: "Esecuzioni", url: "/mfg/executions" },
    ]
  },
  {
    title: "Assistenza Tecnica",
    items: [
      { title: "Dashboard", url: "/support" },
      { title: "Commesse di Lavoro (CdL)", url: "/support/work-orders" },
      { title: "Rapporti di Intervento", url: "/support/service-reports" },
      { title: "Ticket", url: "/support/tickets" },
    ]
  },
  {
    title: "Magazzino",
    items: [
      { title: "Anagrafica Materiali", url: "/warehouse/materials" },
      { title: "Commesse di Spedizione", url: "/warehouse/shipping-orders" },
      { title: "Scorte", url: "/wms/stock" },
      { title: "Movimenti", url: "/wms/movements" },
      { title: "Inventario", url: "/wms/inventory" },
      { title: "Prelievi", url: "/wms/picking" },
      { title: "DDT", url: "/wms/ddt" },
    ]
  },
  {
    title: "Acquisti",
    items: [
      { title: "Fornitori", url: "/procurement/suppliers" },
      { title: "Richieste Offerta", url: "/procurement/rfq" },
      { title: "Ordini Acquisto", url: "/procurement/po" },
      { title: "Ricevimenti", url: "/procurement/receipts" },
      { title: "Controllo Qualità", url: "/procurement/qc" },
      { title: "Rifornimenti", url: "/procurement/replenishment" },
    ]
  },
  {
    title: "Qualità",
    items: [
      { title: "Non Conformità", url: "/quality/nc" },
      { title: "CAPA", url: "/quality/capa" },
      { title: "Audit", url: "/quality/audits" },
      { title: "HSE", url: "/quality/hse" },
    ]
  },
  {
    title: "Finanza",
    items: [
      { title: "Prima Nota", url: "/finance/prima-nota" },
      { title: "Fatture", url: "/finance/invoices" },
      { title: "Flusso di Cassa", url: "/finance/cash" },
      { title: "Report", url: "/finance/reports" },
      { title: "Esportazioni", url: "/finance/exports" },
    ]
  },
  {
    title: "Controllo di Gestione",
    items: [
      { title: "Dashboard CEO", url: "/management-control" },
      { title: "Setup", url: "/management-control/setup" },
      { title: "Movimenti", url: "/management-control/movements" },
      { title: "Commesse", url: "/management-control/projects" },
      { title: "Budget & Forecast", url: "/management-control/budget" },
    ]
  },
  {
    title: "Risorse Umane",
    items: [
      { title: "Personale", url: "/hr/people" },
      { title: "Tecnici", url: "/hr/technicians" },
      { title: "Timesheet", url: "/hr/timesheets" },
      { title: "Rimborsi", url: "/hr/expenses" },
      { title: "Turni", url: "/hr/roster" },
      { title: "Fluida", url: "/hr/fluida" },
      { title: "Ticket Restaurant", url: "/hr/ticket-restaurant" },
    ]
  },
  {
    title: "Analisi",
    items: [
      { title: "Report", url: "/bi/reports" },
      { title: "Analisi", url: "/bi/analysis" },
      { title: "KPI", url: "/bi/kpi" },
    ]
  },
  {
    title: "Partnership",
    items: [
      { title: "Importers", url: "/partnerships/importers" },
      { title: "Installers", url: "/partnerships/installers" },
      { title: "Resellers", url: "/partnerships/resellers" },
    ]
  },
  {
    title: "Documentazione",
    items: [
      { title: "Dashboard", url: "/docs" },
      { title: "Schede Tecniche", url: "/docs/technical-sheets" },
      { title: "Conformità", url: "/docs/compliance" },
      { title: "Manuali", url: "/docs/manuals" },
      { title: "Listini", url: "/docs/price-lists" },
    ]
  },
  {
    title: "Marketing",
    items: [
      { title: "Cruscotto KPI", url: "/marketing/dashboard" },
      { title: "Campagne", url: "/marketing/campaigns" },
      { title: "Email Marketing", url: "/marketing/email-marketing" },
      { title: "Content Creation", url: "/marketing/content-creation" },
      { title: "Canali", url: "/marketing/channels" },
      { title: "Budget & Costi", url: "/marketing/budget" },
      { title: "Reportistica", url: "/marketing/reports" },
      { title: "Archivio documenti/media", url: "/marketing/archive" },
      { title: "Brandkit", url: "/marketing/brandkit" },
    ]
  },
  {
    title: "Sistema",
    items: [
      { title: "Integrazioni", url: "/integrations" },
      { title: "Impostazioni", url: "/settings" },
    ]
  }
];

interface UserPageVisibilityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function UserPageVisibilityDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName 
}: UserPageVisibilityDialogProps) {
  const { toast } = useToast();
  const { pageVisibility, isPageVisible, updatePageVisibility, refreshPageVisibility } = usePageVisibility(userId);
  const [localVisibility, setLocalVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      refreshPageVisibility();
    }
  }, [open]);

  useEffect(() => {
    setLocalVisibility(pageVisibility);
  }, [pageVisibility]);

  const handleToggle = async (pageUrl: string, newValue: boolean) => {
    try {
      setLocalVisibility(prev => ({ ...prev, [pageUrl]: newValue }));
      await updatePageVisibility(pageUrl, newValue);
      
      toast({
        title: "Successo",
        description: "Visibilità pagina aggiornata",
      });
    } catch (error) {
      console.error("Error updating visibility:", error);
      setLocalVisibility(prev => ({ ...prev, [pageUrl]: !newValue }));
      
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la visibilità",
        variant: "destructive",
      });
    }
  };

  const getPageVisibility = (url: string) => {
    return localVisibility[url] !== false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Gestione Visibilità Pagine</DialogTitle>
          <DialogDescription>
            Configura quali pagine della sidebar sono visibili per <strong>{userName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {navigationGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  {group.title}
                </h4>
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <div
                      key={item.url}
                      className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50"
                    >
                      <Label
                        htmlFor={`toggle-${item.url}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {item.title}
                      </Label>
                      <Switch
                        id={`toggle-${item.url}`}
                        checked={getPageVisibility(item.url)}
                        onCheckedChange={(checked) => handleToggle(item.url, checked)}
                      />
                    </div>
                  ))}
                </div>
                {group !== navigationGroups[navigationGroups.length - 1] && (
                  <Separator className="mt-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
