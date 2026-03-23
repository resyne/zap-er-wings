import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, User, Clock, Calendar, Package, FileText, Euro, Loader2, LinkIcon, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ReportDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string | null;
  customerName: string;
  onLinkInvoice?: () => void;
  onLinkOrder?: () => void;
}

export function ReportDetailSheet({ open, onOpenChange, reportId, customerName, onLinkInvoice, onLinkOrder }: ReportDetailSheetProps) {
  const [report, setReport] = useState<any>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<any>(null);

  useEffect(() => {
    if (!open || !reportId) return;
    setLoading(true);
    setLinkedOrder(null);
    Promise.all([
      supabase.from("service_reports").select("*").eq("id", reportId).single(),
      supabase.from("service_report_materials").select("*").eq("report_id", reportId),
    ]).then(async ([reportRes, matRes]) => {
      setReport(reportRes.data);
      setMaterials(matRes.data || []);
      // Check linked order
      const reportData = reportRes.data as any;
      if (reportData?.sales_order_id) {
        const { data: order } = await supabase.from("sales_orders").select("id, number").eq("id", reportData.sales_order_id).single();
        setLinkedOrder(order);
      }
      setLoading(false);
    });
  }, [open, reportId]);

  if (!open) return null;

  const matNetto = materials.reduce((s, m) => s + m.quantity * m.unit_price, 0);
  const matIva = materials.reduce((s, m) => s + m.quantity * m.unit_price * m.vat_rate / 100, 0);

  const statusColors: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg">
                {report?.report_number || "Rapporto"}
              </SheetTitle>
              <p className="text-sm text-muted-foreground truncate">{customerName}</p>
            </div>
            {report && (
              <Badge variant="outline" className={statusColors[report.status] || ""}>
                {report.status === "completed" ? "Completato" : report.status === "draft" ? "Bozza" : report.status}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : report ? (
            <div className="p-6 space-y-5">
              {/* Info intervento */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={Calendar} label="Data intervento" value={report.intervention_date ? format(new Date(report.intervention_date), "dd MMMM yyyy", { locale: it }) : "—"} />
                <InfoCard icon={Clock} label="Orario" value={report.start_time && report.end_time ? `${report.start_time} - ${report.end_time}` : "—"} />
                <InfoCard icon={Wrench} label="Tipo intervento" value={report.intervention_type || "—"} />
                <InfoCard icon={User} label="Tecnico" value={report.technician_name || "—"} />
              </div>

              {/* Linked order */}
              {linkedOrder && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm">
                  <ShoppingCart className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">Ordine collegato:</span>
                  <span className="font-medium">{linkedOrder.number}</span>
                </div>
              )}

              {report.description && (
                <>
                  <Separator />
                  <Section title="Descrizione problema" icon={FileText}>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{report.description}</p>
                  </Section>
                </>
              )}

              {report.work_performed && (
                <>
                  <Separator />
                  <Section title="Lavori eseguiti" icon={Wrench}>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">{report.work_performed}</p>
                  </Section>
                </>
              )}

              {materials.length > 0 && (
                <>
                  <Separator />
                  <Section title="Materiali utilizzati" icon={Package}>
                    <div className="space-y-2">
                      {materials.map((mat) => (
                        <div key={mat.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 text-sm">
                          <div>
                            <p className="font-medium">{mat.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Qtà: {mat.quantity}
                              {mat.unit_price > 0 && ` • €${Number(mat.unit_price).toFixed(2)}/un • IVA ${mat.vat_rate}%`}
                            </p>
                          </div>
                          {mat.unit_price > 0 && (
                            <span className="font-semibold text-sm">
                              €{(mat.quantity * mat.unit_price * (1 + mat.vat_rate / 100)).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ))}
                      {matNetto > 0 && (
                        <div className="p-2.5 bg-primary/5 rounded-lg border border-primary/20 text-xs flex justify-between">
                          <span>Netto: €{matNetto.toFixed(2)}</span>
                          <span>IVA: €{matIva.toFixed(2)}</span>
                          <span className="font-bold">Tot: €{(matNetto + matIva).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              {report.materials_used && materials.length === 0 && (
                <>
                  <Separator />
                  <Section title="Materiali utilizzati" icon={Package}>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{report.materials_used}</p>
                  </Section>
                </>
              )}

              {report.notes && (
                <>
                  <Separator />
                  <Section title="Note" icon={FileText}>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{report.notes}</p>
                  </Section>
                </>
              )}

              {(report.amount || report.total_amount) && (
                <>
                  <Separator />
                  <Section title="Dettagli economici" icon={Euro}>
                    <div className="space-y-2 text-sm">
                      {report.amount != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Importo netto</span>
                          <span className="font-medium">€{Number(report.amount).toFixed(2)}</span>
                        </div>
                      )}
                      {report.vat_rate != null && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IVA</span>
                          <span>{Number(report.vat_rate).toFixed(0)}%</span>
                        </div>
                      )}
                      {report.total_amount != null && (
                        <div className="flex justify-between pt-2 border-t font-semibold text-primary">
                          <span>Totale</span>
                          <span>€{Number(report.total_amount).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </Section>
                </>
              )}

              {(report.customer_signature || report.technician_signature) && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-3">Firme</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {report.customer_signature && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Cliente</p>
                          <div className="border rounded-lg p-2 bg-background">
                            <img src={report.customer_signature} alt="Firma cliente" className="w-full h-20 object-contain" />
                          </div>
                        </div>
                      )}
                      {report.technician_signature && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1.5">Tecnico</p>
                          <div className="border rounded-lg p-2 bg-background">
                            <img src={report.technician_signature} alt="Firma tecnico" className="w-full h-20 object-contain" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </ScrollArea>

        {/* Fixed CTA footer */}
        {report && (
          <div className="border-t p-4 flex gap-2 bg-background">
            <Button className="flex-1 gap-2" onClick={onLinkInvoice}>
              <LinkIcon className="h-4 w-4" />
              Collega a fattura
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={onLinkOrder}>
              <ShoppingCart className="h-4 w-4" />
              {linkedOrder ? "Cambia ordine" : "Collega a ordine"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}
