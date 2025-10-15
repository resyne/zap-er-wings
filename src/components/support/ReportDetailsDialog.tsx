import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ReportDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: any;
  onDownloadPDF: () => void;
  onSendEmail: () => void;
}

export function ReportDetailsDialog({
  open,
  onOpenChange,
  report,
  onDownloadPDF,
  onSendEmail
}: ReportDetailsDialogProps) {
  if (!report) return null;

  const contact = report.crm_contacts;
  const technician = report.technicians;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dettagli Rapporto di Intervento</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informazioni Cliente */}
          <div>
            <h3 className="font-semibold text-lg mb-3">Cliente</h3>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Nome:</strong> {contact?.first_name} {contact?.last_name}</p>
              {contact?.company_name && <p><strong>Azienda:</strong> {contact.company_name}</p>}
              {contact?.email && <p><strong>Email:</strong> {contact.email}</p>}
              {contact?.phone && <p><strong>Telefono:</strong> {contact.phone}</p>}
              {contact?.address && <p><strong>Indirizzo:</strong> {contact.address}</p>}
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

          {report.materials_used && (
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
                  {report.amount && <p><strong>Importo:</strong> €{parseFloat(report.amount).toFixed(2)}</p>}
                  {report.vat_rate !== null && <p><strong>IVA:</strong> {parseFloat(report.vat_rate).toFixed(2)}%</p>}
                  {report.total_amount && (
                    <p className="text-lg font-bold text-primary">
                      <strong>Totale:</strong> €{parseFloat(report.total_amount).toFixed(2)}
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
          <div className="flex gap-3 pt-4">
            <Button onClick={onDownloadPDF} className="flex-1 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" />
              Scarica PDF
            </Button>
            <Button 
              onClick={onSendEmail} 
              variant="outline"
              className="flex-1 flex items-center justify-center gap-2"
              disabled={!contact?.email}
            >
              <Mail className="w-4 h-4" />
              Invia Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
