import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, Edit2, Save, X, FileCheck } from "lucide-react";
import { formatAmount } from "@/lib/formatAmount";

interface OrderFinancialInfoProps {
  orderId: string;
  totalAmount?: number;
  invoiced?: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  onUpdate?: () => void;
}

export function OrderFinancialInfo({
  orderId,
  totalAmount = 0,
  invoiced = false,
  invoiceNumber,
  invoiceDate,
  onUpdate,
}: OrderFinancialInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    total_amount: totalAmount,
    invoiced: invoiced,
    invoice_number: invoiceNumber || "",
    invoice_date: invoiceDate || "",
  });
  const { toast } = useToast();

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from("sales_orders")
        .update({
          total_amount: formData.total_amount,
          invoiced: formData.invoiced,
          invoice_number: formData.invoice_number || null,
          invoice_date: formData.invoice_date || null,
        })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Informazioni aggiornate",
        description: "I dati finanziari sono stati salvati con successo",
      });

      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile salvare le modifiche: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setFormData({
      total_amount: totalAmount,
      invoiced: invoiced,
      invoice_number: invoiceNumber || "",
      invoice_date: invoiceDate || "",
    });
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Informazioni Finanziarie
          </CardTitle>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Modifica
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Annulla
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Salva
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div>
              <Label htmlFor="total_amount">Importo Totale (€)</Label>
              <Input
                id="total_amount"
                type="number"
                step="0.01"
                value={formData.total_amount}
                onChange={(e) =>
                  setFormData({ ...formData, total_amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="invoiced" className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4" />
                  Ordine Fatturato
                </Label>
                <p className="text-sm text-muted-foreground">
                  Indica se l'ordine è stato fatturato al cliente
                </p>
              </div>
              <Switch
                id="invoiced"
                checked={formData.invoiced}
                onCheckedChange={(checked) => setFormData({ ...formData, invoiced: checked })}
              />
            </div>

            {formData.invoiced && (
              <>
                <div>
                  <Label htmlFor="invoice_number">Numero Fattura</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_number: e.target.value })
                    }
                    placeholder="Es: FT-2025-0001"
                  />
                </div>

                <div>
                  <Label htmlFor="invoice_date">Data Fatturazione</Label>
                  <Input
                    id="invoice_date"
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) =>
                      setFormData({ ...formData, invoice_date: e.target.value })
                    }
                  />
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Importo Totale</Label>
                <div className="text-2xl font-bold">{formatAmount(totalAmount)}</div>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Stato Fatturazione</Label>
                <div className="flex items-center gap-2 mt-1">
                  {invoiced ? (
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-600">Fatturato</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-muted-foreground" />
                      <span className="text-muted-foreground">Non fatturato</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {invoiced && (invoiceNumber || invoiceDate) && (
              <div className="border-t pt-4 space-y-2">
                {invoiceNumber && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Numero Fattura</Label>
                    <div className="font-medium">{invoiceNumber}</div>
                  </div>
                )}
                {invoiceDate && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Data Fatturazione</Label>
                    <div className="font-medium">
                      {new Date(invoiceDate).toLocaleDateString("it-IT")}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
