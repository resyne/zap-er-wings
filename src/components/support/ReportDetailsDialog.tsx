import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Mail, Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";

interface ReportDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any;
  onDownloadPDF: () => void;
  onSendEmail: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReportDetailsDialog({
  open,
  onOpenChange,
  report,
  onDownloadPDF,
  onSendEmail,
  onEdit,
  onDelete
}: ReportDetailsDialogProps) {
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    if (open && report?.id) {
      supabase
        .from('service_report_materials')
        .select('*')
        .eq('report_id', report.id)
        .then(({ data }) => setMaterials(data || []));
    }
  }, [open, report?.id]);

  if (!report) return null;

  const customer = report.customers;
  const technician = report.technicians;

  const matNetto = materials.reduce((s, m) => s + m.quantity * m.unit_price, 0);
  const matIva = materials.reduce((s, m) => s + m.quantity * m.unit_price * m.vat_rate / 100, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dettagli Rapporto di Intervento</DialogTitle>
          <DialogDescription>
            Visualizza tutti i dettagli del rapporto, incluse le firme digitali
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informazioni Cliente */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Cliente</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Nome:</strong> {customer?.name || 'N/A'}</p>
              {customer?.company_name && <p><strong>Azienda:</strong> {customer.company_name}</p>}
              {customer?.email && <p><strong>Email:</strong> {customer.email}</p>}
              {customer?.phone && <p><strong>Telefono:</strong> {customer.phone}</p>}
              {customer?.address && <p><strong>Indirizzo:</strong> {[customer.address, customer.city].filter(Boolean).join(', ')}</p>}
            </div>
          </div>

          <Separator />

          {/* Dettagli Intervento */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Dettagli Intervento</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Data:</strong> {new Date(report.intervention_date).toLocaleDateString('it-IT')}</p>
              {report.start_time && report.end_time && (
                <p><strong>Orario:</strong> {report.start_time} - {report.end_time}</p>
              )}
              <p><strong>Tipo:</strong> <span className="capitalize">{report.intervention_type}</span></p>
              <p><strong>Tecnico:</strong> {technician?.first_name} {technician?.last_name}</p>
              <p><strong>N. Tecnici presenti:</strong> {report.technicians_count || 1}</p>
              <p><strong>Stato:</strong> <span className="capitalize">{report.status}</span></p>
            </div>
          </div>

          {report.description && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Descrizione Problema</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{report.description}</p>
                </div>
              </div>
            </>
          )}

          {report.work_performed && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Lavori Eseguiti</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{report.work_performed}</p>
                </div>
              </div>
            </>
          )}

          {/* Materiali strutturati */}
          {materials.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Materiali Utilizzati</h3>
                <div className="space-y-2">
                  {materials.map((mat: any) => (
                    <div key={mat.id} className="bg-muted p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{mat.description}</p>
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
                    <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm">
                      <div className="flex justify-between">
                        <span>Netto: €{matNetto.toFixed(2)}</span>
                        <span>IVA: €{matIva.toFixed(2)}</span>
                        <span className="font-bold">Totale: €{(matNetto + matIva).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Materiali legacy (testo) */}
          {report.materials_used && materials.length === 0 && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Materiali Utilizzati</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{report.materials_used}</p>
                </div>
              </div>
            </>
          )}

          {report.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Note</h3>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{report.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Dettagli Economici */}
          {(report.amount || report.total_amount) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold text-lg mb-3">Dettagli Economici</h3>
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  {report.amount && <p><strong>Importo:</strong> €{report.amount.toFixed(2)}</p>}
                  {report.vat_rate !== null && <p><strong>IVA:</strong> {report.vat_rate.toFixed(2)}%</p>}
                  {report.total_amount && (
                    <p className="text-lg font-bold text-primary">
                      <strong>Totale:</strong> €{report.total_amount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Firme */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Firme</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-medium mb-2">Firma Cliente</p>
                <div className="border rounded-lg p-2 bg-white">
                  <img src={report.customer_signature} alt="Firma Cliente" className="w-full h-32 object-contain" />
                </div>
              </div>
              <div>
                <p className="font-medium mb-2">Firma Tecnico</p>
                <div className="border rounded-lg p-2 bg-white">
                  <img src={report.technician_signature} alt="Firma Tecnico" className="w-full h-32 object-contain" />
                </div>
              </div>
            </div>
          </div>

          {/* Azioni */}
          <div className="flex flex-wrap gap-3 pt-4">
            {onEdit && (
              <Button onClick={onEdit} variant="secondary" className="flex-1 flex items-center justify-center gap-2">
                <Pencil className="w-4 h-4" />
                Modifica
              </Button>
            )}
            <Button onClick={onDownloadPDF} className="flex-1 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Scarica PDF
            </Button>
            <Button 
              onClick={onSendEmail} 
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
              disabled={!customer?.email}
            >
              <Mail className="w-4 h-4" />
              Invia Email
            </Button>
            {onDelete && (
              <Button onClick={onDelete} variant="destructive" className="flex-1 flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" />
                Elimina
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
