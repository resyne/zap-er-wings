import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Package, CreditCard, Clock, ListChecks, FileText } from "lucide-react";

interface OfferProduct {
  product_id: string;
  product_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

interface OfferLivePreviewProps {
  customerName: string;
  title: string;
  description: string;
  template: 'zapper' | 'vesuviano' | 'zapperpro';
  language: 'it' | 'en' | 'fr';
  companyEntity: 'climatel' | 'unita1';
  validUntil: string;
  products: OfferProduct[];
  timelineProduzione: string;
  timelineConsegna: string;
  timelineInstallazione: string;
  timelineCollaudo: string;
  inclusoFornitura: string;
  esclusoFornitura: string;
  paymentMethod: string;
  paymentAgreement: string;
  vatRegime: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue';
  includeCertificazione: boolean;
  includeGaranzia: boolean;
  inclusoCustom: string;
}

const companyInfo = {
  climatel: {
    name: "CLIMATEL di Elefante Pasquale",
    piva: "IT02053990667",
    address: "Via Michelangelo Buonarroti, 23 - 67051 Avezzano (AQ)"
  },
  unita1: {
    name: "UNITA 1 di Stanislao Elefante",
    piva: "IT02192040661",
    address: "VIA PIAIA 44, 67034 Pettorano sul Gizio (AQ)"
  }
};

const templateColors = {
  zapper: "hsl(var(--primary))",
  vesuviano: "#f97316",
  zapperpro: "hsl(var(--primary))"
};

const vatLabels = {
  standard: "IVA 22%",
  reverse_charge: "Reverse Charge (N.6.7)",
  intra_ue: "Cessione Intra UE (N.3.2)",
  extra_ue: "Cessione Extra UE (N.3.1)"
};

export function OfferLivePreview({
  customerName,
  title,
  description,
  template,
  language,
  companyEntity,
  validUntil,
  products,
  timelineProduzione,
  timelineConsegna,
  timelineInstallazione,
  timelineCollaudo,
  inclusoFornitura,
  esclusoFornitura,
  paymentMethod,
  paymentAgreement,
  vatRegime,
  includeCertificazione,
  includeGaranzia,
  inclusoCustom
}: OfferLivePreviewProps) {
  const calculatedTotal = useMemo(() => {
    return products.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
      return total + (subtotal - discount);
    }, 0);
  }, [products]);

  const vatRate = vatRegime === 'standard' ? 0.22 : 0;
  const vatAmount = calculatedTotal * vatRate;
  const totalWithVat = calculatedTotal + vatAmount;

  const hasTimeline = timelineProduzione || timelineConsegna || timelineInstallazione || timelineCollaudo;
  
  const inclusoItems = useMemo(() => {
    const items: string[] = [];
    if (includeCertificazione) items.push('Certificazione di conformità');
    if (includeGaranzia) items.push('1 anno di garanzia');
    if (inclusoCustom) {
      items.push(...inclusoCustom.split('\n').filter(line => line.trim()));
    }
    return items;
  }, [includeCertificazione, includeGaranzia, inclusoCustom]);

  const accentColor = templateColors[template];
  const company = companyInfo[companyEntity];

  return (
    <div className="h-full flex flex-col bg-muted/30 rounded-lg border overflow-hidden">
      {/* Header */}
      <div 
        className="px-4 py-3 text-white"
        style={{ backgroundColor: accentColor }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Anteprima Offerta</span>
          </div>
          <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
            {template.toUpperCase()}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Company Info */}
          <div className="text-center pb-3 border-b">
            <p className="text-xs font-semibold text-foreground">{company.name}</p>
            <p className="text-[10px] text-muted-foreground">{company.address}</p>
            <p className="text-[10px] text-muted-foreground">P.IVA: {company.piva}</p>
          </div>

          {/* Customer & Title */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Cliente:</span>
              <span className="text-xs font-medium">
                {customerName || <span className="text-muted-foreground italic">Non selezionato</span>}
              </span>
            </div>
            <h3 className="font-semibold text-sm" style={{ color: accentColor }}>
              {title || <span className="text-muted-foreground italic font-normal">Titolo offerta...</span>}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
            )}
          </div>

          {/* Products */}
          {products.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5" style={{ color: accentColor }} />
                <span className="text-xs font-medium">Prodotti e Servizi</span>
              </div>
              <div className="bg-background rounded border">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-1.5 font-medium">Prodotto</th>
                      <th className="text-center p-1.5 font-medium w-12">Qtà</th>
                      <th className="text-right p-1.5 font-medium w-16">Prezzo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((item, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="p-1.5">
                          <div className="font-medium truncate max-w-[120px]">
                            {item.product_name || 'Prodotto'}
                          </div>
                          {item.description && (
                            <div className="text-muted-foreground truncate max-w-[120px]">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="text-center p-1.5">{item.quantity}</td>
                        <td className="text-right p-1.5 font-medium">
                          €{(item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100)).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t p-2 bg-muted/30">
                  <div className="flex justify-between text-[10px]">
                    <span>Imponibile</span>
                    <span className="font-medium">€{calculatedTotal.toFixed(2)}</span>
                  </div>
                  {vatRegime === 'standard' && (
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>IVA 22%</span>
                      <span>€{vatAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-semibold mt-1 pt-1 border-t" style={{ color: accentColor }}>
                    <span>Totale</span>
                    <span>€{totalWithVat.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {products.length === 0 && (
            <div className="text-center py-4 bg-muted/30 rounded border border-dashed">
              <Package className="h-6 w-6 mx-auto text-muted-foreground/50" />
              <p className="text-[10px] text-muted-foreground mt-1">Aggiungi prodotti</p>
            </div>
          )}

          {/* Incluso/Escluso */}
          {(inclusoItems.length > 0 || esclusoFornitura) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5" style={{ color: accentColor }} />
                <span className="text-xs font-medium">Fornitura</span>
              </div>
              <div className="bg-background rounded border p-2 space-y-2">
                {inclusoItems.length > 0 && (
                  <div>
                    <p className="text-[10px] font-medium text-green-600 mb-1">Incluso:</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5">
                      {inclusoItems.map((item, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <span className="text-green-500">✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {esclusoFornitura && (
                  <div>
                    <p className="text-[10px] font-medium text-red-600 mb-1">Escluso:</p>
                    <p className="text-[10px] text-muted-foreground whitespace-pre-line line-clamp-3">
                      {esclusoFornitura}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          {hasTimeline && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" style={{ color: accentColor }} />
                <span className="text-xs font-medium">Tempistiche</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {timelineProduzione && (
                  <div className="bg-background rounded border p-2">
                    <p className="text-[10px] text-muted-foreground">Produzione</p>
                    <p className="text-[10px] font-medium">{timelineProduzione}</p>
                  </div>
                )}
                {timelineConsegna && (
                  <div className="bg-background rounded border p-2">
                    <p className="text-[10px] text-muted-foreground">Consegna</p>
                    <p className="text-[10px] font-medium">{timelineConsegna}</p>
                  </div>
                )}
                {timelineInstallazione && (
                  <div className="bg-background rounded border p-2">
                    <p className="text-[10px] text-muted-foreground">Installazione</p>
                    <p className="text-[10px] font-medium">{timelineInstallazione}</p>
                  </div>
                )}
                {timelineCollaudo && (
                  <div className="bg-background rounded border p-2">
                    <p className="text-[10px] text-muted-foreground">Collaudo</p>
                    <p className="text-[10px] font-medium">{timelineCollaudo}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment */}
          {(paymentMethod || paymentAgreement) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5" style={{ color: accentColor }} />
                <span className="text-xs font-medium">Pagamento</span>
              </div>
              <div className="bg-background rounded border p-2 text-[10px]">
                {paymentMethod && (
                  <p><span className="text-muted-foreground">Metodo:</span> {paymentMethod === 'bonifico' ? 'Bonifico bancario' : 'Contrassegno'}</p>
                )}
                {paymentAgreement && (
                  <p><span className="text-muted-foreground">Accordo:</span> {paymentAgreement}</p>
                )}
                <p><span className="text-muted-foreground">IVA:</span> {vatLabels[vatRegime]}</p>
              </div>
            </div>
          )}

          {/* Validity */}
          {validUntil && (
            <div className="text-center pt-2 border-t">
              <p className="text-[10px] text-muted-foreground">
                Offerta valida fino al <span className="font-medium">{new Date(validUntil).toLocaleDateString('it-IT')}</span>
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
