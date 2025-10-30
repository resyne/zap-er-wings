import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface GenerateDDTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
}

export function GenerateDDTDialog({ open, onOpenChange, order }: GenerateDDTDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    destinatario: "",
    telefono: "",
    indirizzo_destinazione: "",
    causale: "vendita" as "vendita" | "garanzia" | "altra",
    causale_altra_text: "",
    incaricato_trasporto: "",
    numero_colli: "",
    peso_totale: "",
    aspetto_beni: "Buono",
    note_trasporto: "",
    pagamento_consegna: "no" as "si" | "no",
    importo_pagamento_consegna: "0.00",
    note_pagamento: "",
  });

  // Update form data when order changes or dialog opens
  useEffect(() => {
    if (open && order) {
      setFormData({
        destinatario: order.customers?.company_name || order.customers?.name || "",
        telefono: order.customers?.phone || "",
        indirizzo_destinazione: order.shipping_address || order.customers?.shipping_address || order.customers?.address || "",
        causale: "vendita" as "vendita" | "garanzia" | "altra",
        causale_altra_text: "",
        incaricato_trasporto: "",
        numero_colli: "",
        peso_totale: "",
        aspetto_beni: "Buono",
        note_trasporto: order.notes || "",
        pagamento_consegna: order.payment_on_delivery ? "si" : "no",
        importo_pagamento_consegna: order.payment_amount?.toString() || "0.00",
        note_pagamento: "",
      });
    }
  }, [open, order]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateDDTNumber = async () => {
    const year = new Date().getFullYear();
    const { data, error } = await (supabase as any)
      .from('ddts')
      .select('ddt_number')
      .like('ddt_number', `${year}/%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error fetching last DDT number:', error);
      return `${year}/1`;
    }

    if (!data || data.length === 0) {
      return `${year}/1`;
    }

    const lastNumber = parseInt(data[0].ddt_number.split('/')[1]);
    return `${year}/${lastNumber + 1}`;
  };

  const compileDDTTemplate = async (ddtNumber: string) => {
    if (!order) return '';
    
    const currentUser = await supabase.auth.getUser();
    const userName = currentUser.data.user?.user_metadata?.full_name || 
                     currentUser.data.user?.email || "Utente";

    // Get logo as base64
    const logoResponse = await fetch('/images/logo-zapper.png');
    const logoBlob = await logoResponse.blob();
    const logoBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(logoBlob);
    });

    // Generate product rows
    const productRows = order.shipping_order_items
      ?.map((item: any) => {
        const description = item.product_name || 
                          item.materials?.name || 
                          'Prodotto';
        return `<tr>
          <td>${description}</td>
          <td style="text-align: center;">${item.quantity}</td>
        </tr>`;
      })
      .join('') || '';

    // Load template
    const templateResponse = await fetch('/templates/ddt-template.html');
    let template = await templateResponse.text();

    // Replace placeholders
    const replacements: Record<string, string> = {
      '{{numero_ddt}}': ddtNumber,
      '{{logo}}': logoBase64,
      '{{data_ddt}}': format(new Date(), 'dd/MM/yyyy'),
      '{{utente}}': userName,
      '{{cliente_nome}}': order.customers?.company_name || order.customers?.name || '',
      '{{cliente_indirizzo}}': order.customers?.address || '',
      '{{cliente_piva}}': order.customers?.tax_id || '',
      '{{destinatario}}': formData.destinatario,
      '{{indirizzo_destinazione}}': formData.indirizzo_destinazione,
      '{{righe_prodotti}}': productRows,
      '{{pagamento_si}}': formData.pagamento_consegna === 'si' ? '☑' : '☐',
      '{{pagamento_no}}': formData.pagamento_consegna === 'no' ? '☑' : '☐',
      '{{importo_pagamento_consegna}}': formData.importo_pagamento_consegna,
      '{{note_pagamento}}': formData.note_pagamento,
      '{{causale_vendita}}': formData.causale === 'vendita' ? '☑' : '☐',
      '{{causale_garanzia}}': formData.causale === 'garanzia' ? '☑' : '☐',
      '{{causale_altra}}': formData.causale === 'altra' ? '☑' : '☐',
      '{{causale_altra_text}}': formData.causale_altra_text,
      '{{incaricato_trasporto}}': formData.incaricato_trasporto,
      '{{numero_colli}}': formData.numero_colli,
      '{{peso_totale}}': formData.peso_totale,
      '{{aspetto_beni}}': formData.aspetto_beni,
      '{{note_trasporto}}': formData.note_trasporto,
      '{{data_creazione_documento}}': format(new Date(), 'dd/MM/yyyy'),
    };

    Object.entries(replacements).forEach(([key, value]) => {
      template = template.replace(new RegExp(key, 'g'), value);
    });

    return template;
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);

      // Generate DDT number
      const ddtNumber = await generateDDTNumber();

      // Compile template
      const compiledHTML = await compileDDTTemplate(ddtNumber);

      // Call edge function to generate PDF
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke(
        'generate-pdf-from-html',
        {
          body: { html: compiledHTML }
        }
      );

      if (pdfError) throw pdfError;

      // Save DDT to database
      const { error: insertError } = await (supabase as any)
        .from('ddts')
        .insert({
          ddt_number: ddtNumber,
          shipping_order_id: order.id,
          customer_id: order.customer_id,
          pdf_data: pdfData.pdf,
          ddt_data: {
            ...formData,
            products: order.shipping_order_items
          }
        });

      if (insertError) throw insertError;

      // Download PDF
      const blob = new Blob(
        [Uint8Array.from(atob(pdfData.pdf), c => c.charCodeAt(0))],
        { type: 'application/pdf' }
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DDT_${ddtNumber.replace('/', '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "DDT generato con successo",
        description: `DDT numero ${ddtNumber} creato e scaricato`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error generating DDT:', error);
      toast({
        title: "Errore",
        description: "Impossibile generare il DDT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Genera DDT - Documento di Trasporto</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Articoli */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">Articoli da Spedire</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              {order.shipping_order_items && order.shipping_order_items.length > 0 ? (
                <div className="space-y-2">
                  {order.shipping_order_items.map((item: any, index: number) => {
                    const description = item.product_name || 
                                      item.materials?.name || 
                                      'Prodotto';
                    return (
                      <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                        <span className="text-sm">{description}</span>
                        <span className="text-sm font-medium">Qtà: {item.quantity}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nessun articolo trovato</p>
              )}
            </div>
          </div>

          {/* Destinatario */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">Destinatario e Destinazione</h3>
            <div className="space-y-2">
              <Label htmlFor="destinatario">Destinatario</Label>
              <Input
                id="destinatario"
                value={formData.destinatario}
                onChange={(e) => handleInputChange('destinatario', e.target.value)}
                placeholder="Nome destinatario"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Telefono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) => handleInputChange('telefono', e.target.value)}
                placeholder="Numero di telefono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="indirizzo_destinazione">Indirizzo di Destinazione</Label>
              <Textarea
                id="indirizzo_destinazione"
                value={formData.indirizzo_destinazione}
                onChange={(e) => handleInputChange('indirizzo_destinazione', e.target.value)}
                placeholder="Indirizzo completo"
                rows={2}
              />
            </div>
          </div>

          {/* Causale Trasporto */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">Causale del Trasporto</h3>
            <RadioGroup
              value={formData.causale}
              onValueChange={(value) => handleInputChange('causale', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="vendita" id="vendita" />
                <Label htmlFor="vendita">Vendita</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="garanzia" id="garanzia" />
                <Label htmlFor="garanzia">Sostituzione in garanzia</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="altra" id="altra" />
                <Label htmlFor="altra">Altra</Label>
              </div>
            </RadioGroup>
            {formData.causale === 'altra' && (
              <Input
                placeholder="Specifica altra causale"
                value={formData.causale_altra_text}
                onChange={(e) => handleInputChange('causale_altra_text', e.target.value)}
              />
            )}
          </div>

          {/* Informazioni Trasporto */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">Informazioni Trasporto</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="incaricato">Incaricato del Trasporto</Label>
                <Input
                  id="incaricato"
                  value={formData.incaricato_trasporto}
                  onChange={(e) => handleInputChange('incaricato_trasporto', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="colli">Numero Colli</Label>
                <Input
                  id="colli"
                  type="number"
                  value={formData.numero_colli}
                  onChange={(e) => handleInputChange('numero_colli', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peso">Peso Totale (kg)</Label>
                <Input
                  id="peso"
                  type="number"
                  step="0.01"
                  value={formData.peso_totale}
                  onChange={(e) => handleInputChange('peso_totale', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aspetto">Aspetto Esteriore Beni</Label>
                <Input
                  id="aspetto"
                  value={formData.aspetto_beni}
                  onChange={(e) => handleInputChange('aspetto_beni', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note_trasporto">Note sul Trasporto</Label>
              <Textarea
                id="note_trasporto"
                value={formData.note_trasporto}
                onChange={(e) => handleInputChange('note_trasporto', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Pagamento alla Consegna */}
          <div className="space-y-4">
            <h3 className="font-semibold">Pagamento alla Consegna</h3>
            <RadioGroup
              value={formData.pagamento_consegna}
              onValueChange={(value) => handleInputChange('pagamento_consegna', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="si" id="pag_si" />
                <Label htmlFor="pag_si">Sì</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="pag_no" />
                <Label htmlFor="pag_no">No</Label>
              </div>
            </RadioGroup>
            {formData.pagamento_consegna === 'si' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="importo">Importo da Pagare (€)</Label>
                  <Input
                    id="importo"
                    type="number"
                    step="0.01"
                    value={formData.importo_pagamento_consegna}
                    onChange={(e) => handleInputChange('importo_pagamento_consegna', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note_pagamento">Note sul Pagamento</Label>
                  <Textarea
                    id="note_pagamento"
                    value={formData.note_pagamento}
                    onChange={(e) => handleInputChange('note_pagamento', e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generazione in corso...
                </>
              ) : (
                'Genera DDT'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
