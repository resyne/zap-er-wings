import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountSplitLine {
  id: string;
  account_id: string;
  amount: number;
  percentage: number;
  cost_center_id?: string;
  profit_center_id?: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface Center {
  id: string;
  code: string;
  name: string;
}

interface AccountSplitManagerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  totalAmount: number;
  invoiceType: 'vendita' | 'acquisto' | 'nota_credito';
  accounts: Account[];
  costCenters: Center[];
  profitCenters: Center[];
  lines: AccountSplitLine[];
  onLinesChange: (lines: AccountSplitLine[]) => void;
  className?: string;
}

export function AccountSplitManager({
  enabled,
  onEnabledChange,
  totalAmount,
  invoiceType,
  accounts,
  costCenters,
  profitCenters,
  lines,
  onLinesChange,
  className
}: AccountSplitManagerProps) {
  const isCost = invoiceType === 'acquisto';
  // Filtro conti: per costi include cogs, opex, depreciation, extraordinary; per ricavi solo revenue
  const filteredAccounts = accounts.filter(a => 
    isCost 
      ? ['cogs', 'opex', 'depreciation', 'extraordinary', 'cost', 'expense'].includes(a.account_type)
      : a.account_type === 'revenue'
  );
  const centers = isCost ? costCenters : profitCenters;
  const centerLabel = isCost ? 'Centro di Costo' : 'Centro di Ricavo';
  const accountLabel = isCost ? 'Conto di Costo' : 'Conto di Ricavo';

  const allocatedAmount = lines.reduce((sum, line) => sum + line.amount, 0);
  const remainingAmount = totalAmount - allocatedAmount;
  const isBalanced = Math.abs(remainingAmount) < 0.01;

  const addLine = () => {
    const newLine: AccountSplitLine = {
      id: crypto.randomUUID(),
      account_id: '',
      amount: remainingAmount > 0 ? remainingAmount : 0,
      percentage: remainingAmount > 0 && totalAmount > 0 ? (remainingAmount / totalAmount) * 100 : 0
    };
    onLinesChange([...lines, newLine]);
  };

  const removeLine = (id: string) => {
    onLinesChange(lines.filter(line => line.id !== id));
  };

  const updateLine = (id: string, field: keyof AccountSplitLine, value: string | number) => {
    onLinesChange(lines.map(line => {
      if (line.id !== id) return line;
      
      const updated = { ...line, [field]: value };
      
      // Sync amount and percentage
      if (field === 'amount' && totalAmount > 0) {
        updated.percentage = ((value as number) / totalAmount) * 100;
      } else if (field === 'percentage' && totalAmount > 0) {
        updated.amount = (totalAmount * (value as number)) / 100;
      }
      
      return updated;
    }));
  };

  // Auto-balance: distribute remaining to last line
  const autoBalance = () => {
    if (lines.length === 0 || isBalanced) return;
    
    const updatedLines = [...lines];
    const lastLine = updatedLines[updatedLines.length - 1];
    lastLine.amount = lastLine.amount + remainingAmount;
    lastLine.percentage = totalAmount > 0 ? (lastLine.amount / totalAmount) * 100 : 0;
    onLinesChange(updatedLines);
  };

  // When total amount changes, recalculate amounts based on percentages
  useEffect(() => {
    if (lines.length > 0 && totalAmount > 0) {
      const updatedLines = lines.map(line => ({
        ...line,
        amount: (totalAmount * line.percentage) / 100
      }));
      const hasChanges = updatedLines.some((line, i) => Math.abs(line.amount - lines[i].amount) > 0.01);
      if (hasChanges) {
        onLinesChange(updatedLines);
      }
    }
  }, [totalAmount]);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
            id="split-toggle"
          />
          <Label htmlFor="split-toggle" className="text-sm font-medium cursor-pointer">
            Scomponi imponibile su più conti
          </Label>
        </div>
        {enabled && !isBalanced && (
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>Differenza: €{remainingAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
        )}
        {enabled && isBalanced && lines.length > 0 && (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Bilanciato</span>
          </div>
        )}
      </div>

      {enabled && (
        <Card className="border-dashed">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Imponibile totale: <span className="font-semibold text-foreground">€{totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" />
                Aggiungi riga
              </Button>
            </div>

            {lines.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nessuna ripartizione. Clicca "Aggiungi riga" per iniziare.
              </div>
            )}

            {lines.map((line, index) => (
              <div key={line.id} className="grid grid-cols-12 gap-2 items-end p-3 bg-muted/30 rounded-lg">
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">{accountLabel}</Label>
                  <Select 
                    value={line.account_id} 
                    onValueChange={(v) => updateLine(line.id, 'account_id', v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Seleziona conto" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">{centerLabel}</Label>
                  <Select 
                    value={isCost ? (line.cost_center_id || '') : (line.profit_center_id || '')}
                    onValueChange={(v) => updateLine(line.id, isCost ? 'cost_center_id' : 'profit_center_id', v === "__none__" ? '' : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Centro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {centers.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Importo €</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.amount}
                    onChange={(e) => updateLine(line.id, 'amount', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">%</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.percentage.toFixed(2)}
                    onChange={(e) => updateLine(line.id, 'percentage', parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
                
                <div className="col-span-1 flex justify-end">
                  <Button 
                    type="button"
                    variant="ghost" 
                    size="icon"
                    className="h-9 w-9 text-destructive hover:text-destructive"
                    onClick={() => removeLine(line.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {lines.length > 0 && !isBalanced && (
              <div className="flex justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={autoBalance}>
                  Auto-bilancia
                </Button>
              </div>
            )}
            
            {lines.length > 0 && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">Totale allocato:</span>
                <span className={cn(
                  "font-semibold",
                  isBalanced ? "text-green-500" : "text-amber-500"
                )}>
                  €{allocatedAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
