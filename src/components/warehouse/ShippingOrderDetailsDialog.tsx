import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, Trash2, Archive } from "lucide-react";
import { ShippingOrderComments } from "./ShippingOrderComments";

interface ShippingOrder {
  id: string;
  number: string;
  status: string;
  order_date: string;
  shipping_address?: string;
  payment_on_delivery: boolean;
  payment_amount?: number;
  notes?: string;
  article?: string;
  customers?: { 
    name: string; 
    code: string;
    address?: string;
    email?: string;
    phone?: string;
    tax_id?: string;
    company_name?: string;
    shipping_address?: string;
    pec?: string;
    sdi_code?: string;
    city?: string;
    country?: string;
  };
  work_orders?: { number: string; title: string };
  sales_orders?: { 
    number: string;
    offer_id?: string;
    offers?: {
      payment_method?: string;
      payment_agreement?: string;
      offer_items?: Array<{
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        notes?: string;
        products?: { name: string };
      }>;
    };
    sales_order_items?: Array<{
      id: string;
      product_name: string;
      description: string;
      quantity: number;
      unit_price: number;
      discount_percent: number;
      notes?: string;
    }>;
  };
  shipping_order_items?: any[];
}

interface ShippingOrderDetailsDialogProps {
  order: ShippingOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: ShippingOrder) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
}

const statusOptions = [
  { value: "da_preparare", label: "Da preparare", color: "bg-gray-100 text-gray-800" },
  { value: "in_preparazione", label: "In preparazione", color: "bg-yellow-100 text-yellow-800" },
  { value: "pronto", label: "Pronto", color: "bg-blue-100 text-blue-800" },
  { value: "spedito", label: "Spedito", color: "bg-orange-100 text-orange-800" },
  { value: "consegnato", label: "Consegnato", color: "bg-green-100 text-green-800" },
];

export function ShippingOrderDetailsDialog({
  order,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onArchive,
}: ShippingOrderDetailsDialogProps) {
  if (!order) return null;

  const statusOption = statusOptions.find(s => s.value === order.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Dettagli Ordine: {order.number}</span>
            <Badge className={statusOption?.color}>{statusOption?.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onEdit(order)}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifica
            </Button>
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm("Sei sicuro di voler eliminare questo ordine?")) {
                onDelete(order.id);
              }
            }}>
              <Trash2 className="w-4 h-4 mr-2" />
              Elimina
            </Button>
            <Button size="sm" variant="outline" onClick={() => onArchive(order.id)}>
              <Archive className="w-4 h-4 mr-2" />
              Archivia
            </Button>
          </div>

          <Separator />

          {/* Order Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Cliente</h4>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                <p className="font-medium text-lg">{order.customers?.company_name || order.customers?.name || "N/A"}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Codice: </span>
                    <span className="font-medium">{order.customers?.code || "N/A"}</span>
                  </div>
                  {order.customers?.tax_id && (
                    <div>
                      <span className="text-muted-foreground">P.IVA: </span>
                      <span className="font-medium">{order.customers.tax_id}</span>
                    </div>
                  )}
                </div>
                {order.customers?.address && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Indirizzo: </span>
                    {order.customers.address}
                    {order.customers.city && `, ${order.customers.city}`}
                    {order.customers.country && ` - ${order.customers.country}`}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {order.customers?.email && (
                    <div>
                      <span className="text-muted-foreground">Email: </span>
                      <span className="font-medium">{order.customers.email}</span>
                    </div>
                  )}
                  {order.customers?.phone && (
                    <div>
                      <span className="text-muted-foreground">Telefono: </span>
                      <span className="font-medium">{order.customers.phone}</span>
                    </div>
                  )}
                </div>
                {order.customers?.pec && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">PEC: </span>
                    <span className="font-medium">{order.customers.pec}</span>
                  </p>
                )}
                {order.customers?.sdi_code && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Codice SDI: </span>
                    <span className="font-medium">{order.customers.sdi_code}</span>
                  </p>
                )}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Data Ordine</h4>
              <p>{new Date(order.order_date).toLocaleDateString('it-IT', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
              })}</p>
            </div>
          </div>

          {/* Payment Agreement */}
          {order.sales_orders?.offers && (order.sales_orders.offers.payment_method || order.sales_orders.offers.payment_agreement) && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Accordi di Pagamento</h4>
              <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                {order.sales_orders.offers.payment_method && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Metodo: </span>
                    <span className="font-medium capitalize">{order.sales_orders.offers.payment_method}</span>
                  </p>
                )}
                {order.sales_orders.offers.payment_agreement && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Accordo: </span>
                    <span className="font-medium">{order.sales_orders.offers.payment_agreement}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {order.shipping_address && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Indirizzo di Spedizione</h4>
              <p className="whitespace-pre-wrap">{order.shipping_address}</p>
            </div>
          )}

          {order.payment_on_delivery && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Pagamento alla Consegna</h4>
              <p className="text-lg font-semibold text-primary">
                €{typeof order.payment_amount === 'number' ? order.payment_amount.toFixed(2) : '0.00'}
              </p>
            </div>
          )}

          {/* Linked Orders */}
          {(order.work_orders || order.sales_orders) && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Ordini Collegati</h4>
              <div className="space-y-1">
                {order.work_orders && (
                  <p className="text-sm">
                    <strong>CdP:</strong> {order.work_orders.number} - {order.work_orders.title}
                  </p>
                )}
                {order.sales_orders && (
                  <p className="text-sm">
                    <strong>OdV:</strong> Ordine {order.sales_orders.number}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Order Items from Sales Order */}
          {(order.sales_orders?.sales_order_items && order.sales_orders.sales_order_items.length > 0) || 
           (order.sales_orders?.offers?.offer_items && order.sales_orders.offers.offer_items.length > 0) ? (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Articoli dall'Ordine di Vendita</h4>
              <div className="border rounded-lg divide-y">
                {/* First show sales_order_items if present */}
                {order.sales_orders.sales_order_items?.map((item: any, index: number) => (
                  <div key={`order-${index}`} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-base">{item.product_name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                        {item.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">Note: {item.notes}</p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-muted-foreground">
                          Quantità: <span className="font-semibold text-foreground">{item.quantity}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          €{item.unit_price.toFixed(2)} x {item.quantity}
                        </p>
                        {item.discount_percent > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Sconto: {item.discount_percent}%
                          </p>
                        )}
                        <p className="text-lg font-semibold text-primary mt-1">
                          €{(() => {
                            const subtotal = item.quantity * item.unit_price;
                            const afterDiscount = subtotal * (1 - item.discount_percent / 100);
                            return afterDiscount.toFixed(2);
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Then show offer_items if no sales_order_items */}
                {(!order.sales_orders.sales_order_items || order.sales_orders.sales_order_items.length === 0) &&
                 order.sales_orders.offers?.offer_items?.map((item: any, index: number) => (
                  <div key={`offer-${index}`} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-base">{item.products?.name || item.description}</p>
                        {item.description && item.products?.name && (
                          <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                        )}
                        {item.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">Note: {item.notes}</p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-muted-foreground">
                          Quantità: <span className="font-semibold text-foreground">{item.quantity}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          €{item.unit_price.toFixed(2)} x {item.quantity}
                        </p>
                        {item.discount_percent > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Sconto: {item.discount_percent}%
                          </p>
                        )}
                        <p className="text-lg font-semibold text-primary mt-1">
                          €{(() => {
                            const subtotal = item.quantity * item.unit_price;
                            const afterDiscount = subtotal * (1 - item.discount_percent / 100);
                            return afterDiscount.toFixed(2);
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="p-4 bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">Totale Ordine:</span>
                    <span className="font-bold text-xl text-primary">
                      €{(() => {
                        const items = order.sales_orders.sales_order_items && order.sales_orders.sales_order_items.length > 0
                          ? order.sales_orders.sales_order_items
                          : order.sales_orders.offers?.offer_items || [];
                        return items.reduce((sum: number, item: any) => {
                          const subtotal = item.quantity * item.unit_price;
                          const afterDiscount = subtotal * (1 - (item.discount_percent || 0) / 100);
                          return sum + afterDiscount;
                        }, 0).toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Shipping Order Items */}
          {order.shipping_order_items && order.shipping_order_items.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Articoli dell'Ordine di Spedizione</h4>
              <div className="border rounded-lg divide-y">
                {order.shipping_order_items.map((item: any, index: number) => (
                  <div key={index} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-base">{item.materials?.name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">
                          Codice: <span className="font-mono">{item.materials?.code || "N/A"}</span>
                        </p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            Note: {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Quantità: <span className="font-semibold text-foreground">{item.quantity}</span></p>
                        <p className="text-sm text-muted-foreground">
                          €{typeof item.unit_price === 'number' ? item.unit_price.toFixed(2) : '0.00'} x {item.quantity}
                        </p>
                        <p className="text-lg font-semibold text-primary mt-1">
                          €{typeof item.total_price === 'number' ? item.total_price.toFixed(2) : '0.00'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="p-4 bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-lg">Totale:</span>
                    <span className="font-bold text-xl text-primary">
                      €{order.shipping_order_items.reduce((sum: number, item: any) => 
                        sum + (typeof item.total_price === 'number' ? item.total_price : 0), 0
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {(!order.shipping_order_items || order.shipping_order_items.length === 0) && 
           (!order.sales_orders?.offers?.offer_items || order.sales_orders.offers.offer_items.length === 0) && (
            <div className="border rounded-lg p-4 text-center text-muted-foreground">
              Nessun articolo presente in questo ordine
            </div>
          )}

          {order.notes && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground">Note</h4>
              <p className="whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
          
          {/* Articles */}
          {order.article && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Articoli</h4>
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{order.article}</p>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div className="border-t pt-4">
            <ShippingOrderComments shippingOrderId={order.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
