import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Calendar, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PurchaseOrderData {
  id: string;
  number: string;
  order_date: string;
  expected_delivery_date: string;
  priority: string;
  notes: string;
  suppliers: {
    name: string;
  };
  purchase_order_items: Array<{
    quantity: number;
    unit_price: number;
    total_price: number;
    materials: {
      code: string;
      name: string;
      description: string;
      unit: string;
    };
  }>;
}

interface ConfirmationData {
  id: string;
  confirmed: boolean;
  confirmed_at: string | null;
  supplier_delivery_date: string | null;
  supplier_notes: string | null;
  purchase_orders: PurchaseOrderData;
}

export default function PurchaseOrderConfirmPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token di conferma mancante');
      setLoading(false);
      return;
    }

    fetchConfirmationData();
  }, [token]);

  const fetchConfirmationData = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_order_confirmations')
        .select(`
          *,
          purchase_orders!inner(
            *,
            suppliers!inner(name),
            purchase_order_items!inner(
              *,
              materials!inner(code, name, description, unit)
            )
          )
        `)
        .eq('confirmation_token', token)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError('Token di conferma non valido o scaduto');
        return;
      }

      setConfirmation(data);
    } catch (err: any) {
      console.error('Error fetching confirmation:', err);
      setError('Errore nel caricamento dei dati di conferma');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!deliveryDate) {
      toast.error('Inserire la data di consegna confermata');
      return;
    }

    setConfirming(true);
    try {
      const { error } = await supabase.functions.invoke('confirm-purchase-order', {
        body: {
          token,
          deliveryDate,
          supplierNotes
        }
      });

      if (error) throw error;

      toast.success('Conferma ricevuta con successo!');
      // Refresh the data to show updated status
      await fetchConfirmationData();
    } catch (err: any) {
      console.error('Error confirming order:', err);
      toast.error('Errore nella conferma dell\'ordine');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Alert className="max-w-md">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!confirmation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Alert className="max-w-md">
          <XCircle className="h-4 w-4" />
          <AlertDescription>Dati di conferma non trovati</AlertDescription>
        </Alert>
      </div>
    );
  }

  const purchaseOrder = confirmation.purchase_orders;
  const items = purchaseOrder.purchase_order_items || [];

  if (confirmation.confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-2xl w-full mx-4">
          <CardHeader className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-green-700">Ordine già confermato</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Questo ordine è stato confermato il{' '}
              <strong>{new Date(confirmation.confirmed_at!).toLocaleDateString('it-IT')}</strong>
            </p>
            <p className="text-lg font-semibold">Ordine N° {purchaseOrder.number}</p>
            {confirmation.supplier_delivery_date && (
              <p>
                <strong>Data di consegna confermata:</strong>{' '}
                {new Date(confirmation.supplier_delivery_date).toLocaleDateString('it-IT')}
              </p>
            )}
            {confirmation.supplier_notes && (
              <div className="bg-gray-50 p-4 rounded-lg text-left">
                <p className="font-semibold">Note del fornitore:</p>
                <p className="text-gray-700">{confirmation.supplier_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader className="text-center border-b">
            <CardTitle className="text-3xl">Conferma Ricezione Ordine di Acquisto</CardTitle>
            <p className="text-xl text-gray-600">N° {purchaseOrder.number}</p>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {/* Order Details */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Package className="mr-2" />
                Dettagli Ordine
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p><strong>Fornitore:</strong> {purchaseOrder.suppliers.name}</p>
                <p><strong>Data Ordine:</strong> {new Date(purchaseOrder.order_date).toLocaleDateString('it-IT')}</p>
                <p><strong>Data Consegna Richiesta:</strong> {new Date(purchaseOrder.expected_delivery_date).toLocaleDateString('it-IT')}</p>
                <p><strong>Priorità:</strong> {purchaseOrder.priority?.toUpperCase() || 'MEDIA'}</p>
              </div>
              {purchaseOrder.notes && (
                <p className="mt-4"><strong>Note:</strong> {purchaseOrder.notes}</p>
              )}
            </div>

            {/* Items Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Articoli Ordinati</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-left border-b">Codice</th>
                      <th className="p-3 text-left border-b">Descrizione</th>
                      <th className="p-3 text-center border-b">Quantità</th>
                      <th className="p-3 text-right border-b">Prezzo Unit. Est.</th>
                      <th className="p-3 text-right border-b">Totale Est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3">{item.materials.code}</td>
                        <td className="p-3">
                          <div>
                            <strong>{item.materials.name}</strong>
                            {item.materials.description && (
                              <div className="text-sm text-gray-600">{item.materials.description}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">{item.quantity} {item.materials.unit}</td>
                        <td className="p-3 text-right">€{item.unit_price.toFixed(2)}</td>
                        <td className="p-3 text-right font-semibold">€{item.total_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Confirmation Request */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <h4 className="font-semibold mb-2">Richiesta di Conferma</h4>
                <p className="mb-2">Vi chiediamo di confermare la ricezione di questo ordine e di fornire le seguenti informazioni:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Disponibilità dei materiali richiesti</li>
                  <li>Tempi di produzione/consegna effettivi</li>
                  <li>Prezzi aggiornati se diversi da quelli indicati</li>
                  <li>Eventuali note o comunicazioni</li>
                </ul>
              </AlertDescription>
            </Alert>

            {/* Confirmation Form */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Calendar className="mr-2" />
                Conferma Ordine
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="deliveryDate">Data di Consegna Confermata *</Label>
                  <Input
                    id="deliveryDate"
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="supplierNotes">Note e Comunicazioni</Label>
                  <Textarea
                    id="supplierNotes"
                    value={supplierNotes}
                    onChange={(e) => setSupplierNotes(e.target.value)}
                    placeholder="Inserire eventuali note sui prezzi, disponibilità, tempi di consegna o altre comunicazioni..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={handleConfirm}
                    disabled={confirming || !deliveryDate}
                    className="flex-1"
                  >
                    {confirming ? 'Confermando...' : 'Conferma Ricezione Ordine'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.close()}
                    className="flex-1"
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}