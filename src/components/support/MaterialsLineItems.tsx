import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Package } from "lucide-react";

export interface MaterialItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

interface MaterialsLineItemsProps {
  items: MaterialItem[];
  onChange: (items: MaterialItem[]) => void;
  readOnly?: boolean;
}

export function MaterialsLineItems({ items, onChange, readOnly = false }: MaterialsLineItemsProps) {
  const addItem = () => {
    onChange([...items, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unit_price: 0,
      vat_rate: 22
    }]);
  };

  const updateItem = (id: string, field: keyof MaterialItem, value: string | number) => {
    onChange(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const totalNetto = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const totalIva = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.vat_rate / 100), 0);
  const totalLordo = totalNetto + totalIva;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Package className="w-4 h-4" />
          Materiali Utilizzati
        </Label>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={addItem} className="flex items-center gap-1">
            <Plus className="w-3 h-3" />
            Aggiungi Materiale
          </Button>
        )}
      </div>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nessun materiale aggiunto</p>
      )}

      {items.map((item, index) => (
        <div key={item.id} className="p-3 border rounded-lg bg-muted/30 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="h-6 w-6 p-0 text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
          
          <div className="space-y-2">
            <Input
              placeholder="Descrizione materiale..."
              value={item.description}
              onChange={(e) => updateItem(item.id, 'description', e.target.value)}
              readOnly={readOnly}
              className="text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Qtà</Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  readOnly={readOnly}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prezzo Unit. (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || ''}
                  onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                  readOnly={readOnly}
                  placeholder="0.00"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">IVA (%)</Label>
                {readOnly ? (
                  <Input type="text" value={`${item.vat_rate}%`} readOnly className="text-sm bg-muted" />
                ) : (
                  <Select value={String(item.vat_rate)} onValueChange={(v) => updateItem(item.id, 'vat_rate', parseFloat(v))}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="4">4%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="22">22%</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            {item.unit_price > 0 && (
              <div className="flex justify-end text-xs text-muted-foreground gap-3">
                <span>Netto: €{(item.quantity * item.unit_price).toFixed(2)}</span>
                <span>IVA: €{(item.quantity * item.unit_price * item.vat_rate / 100).toFixed(2)}</span>
                <span className="font-medium text-foreground">
                  Totale: €{(item.quantity * item.unit_price * (1 + item.vat_rate / 100)).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      {items.length > 0 && items.some(i => i.unit_price > 0) && (
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>Netto Materiali: <span className="font-medium">€{totalNetto.toFixed(2)}</span></div>
            <div>IVA Materiali: <span className="font-medium">€{totalIva.toFixed(2)}</span></div>
            <div className="font-semibold">Totale: €{totalLordo.toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
