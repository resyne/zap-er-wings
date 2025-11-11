import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EditPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListId: string;
  onSuccess?: () => void;
}

export function EditPriceListDialog({
  open,
  onOpenChange,
  priceListId,
  onSuccess,
}: EditPriceListDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const { data: priceList, isLoading } = useQuery({
    queryKey: ["price-list", priceListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("*")
        .eq("id", priceListId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!priceListId,
  });

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    list_type: "generic",
    target_type: "",
    tier: "",
    default_multiplier: "",
    country: "",
    valid_from: "",
    valid_to: "",
  });

  // Update form data when priceList is loaded
  useEffect(() => {
    if (priceList) {
      setFormData({
        name: priceList.name || "",
        code: priceList.code || "",
        description: priceList.description || "",
        list_type: priceList.list_type || "generic",
        target_type: priceList.target_type || "",
        tier: priceList.tier || "",
        default_multiplier: priceList.default_multiplier?.toString() || "",
        country: priceList.country || "",
        valid_from: priceList.valid_from || "",
        valid_to: priceList.valid_to || "",
      });
    }
  }, [priceList]);

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.error("Nome e codice sono obbligatori");
      return;
    }

    setIsSaving(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        code: formData.code,
        description: formData.description || null,
        list_type: formData.list_type,
        target_type: formData.target_type || null,
        tier: formData.tier || null,
        default_multiplier: formData.default_multiplier
          ? parseFloat(formData.default_multiplier)
          : null,
        country: formData.country || null,
        valid_from: formData.valid_from || null,
        valid_to: formData.valid_to || null,
      };

      // Update price list
      const { error: updateError } = await supabase
        .from("price_lists")
        .update(updateData)
        .eq("id", priceListId);

      if (updateError) throw updateError;

      // Create audit log
      const changedFields: string[] = [];
      const oldValues: any = {};
      const newValues: any = {};

      Object.keys(updateData).forEach((key) => {
        if (priceList && priceList[key] !== updateData[key]) {
          changedFields.push(key);
          oldValues[key] = priceList[key];
          newValues[key] = updateData[key];
        }
      });

      if (changedFields.length > 0) {
        await supabase.from("price_list_audit_logs").insert({
          price_list_id: priceListId,
          user_id: user?.id,
          action: "updated",
          old_values: oldValues,
          new_values: newValues,
          changed_fields: changedFields,
        });
      }

      toast.success("Listino aggiornato con successo");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating price list:", error);
      toast.error(error.message || "Errore nell'aggiornamento del listino");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !priceList) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Listino</DialogTitle>
          <DialogDescription>
            Modifica i dettagli del listino prezzi
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Es: Listino Italia 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="Es: IT2024"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descrizione del listino"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="list_type">Tipo Listino</Label>
              <Select
                value={formData.list_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, list_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Generico</SelectItem>
                  <SelectItem value="country">Paese</SelectItem>
                  <SelectItem value="region">Regione</SelectItem>
                  <SelectItem value="customer_category">
                    Categoria Cliente
                  </SelectItem>
                  <SelectItem value="reseller">Rivenditore</SelectItem>
                  <SelectItem value="custom">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_multiplier">Moltiplicatore Default</Label>
              <Input
                id="default_multiplier"
                type="number"
                step="0.01"
                min="0"
                value={formData.default_multiplier}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_multiplier: e.target.value,
                  })
                }
                placeholder="Es: 2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="target_type">Target</Label>
              <Select
                value={formData.target_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, target_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.target_type && (
              <div className="space-y-2">
                <Label htmlFor="tier">Tier</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tier: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T">Top</SelectItem>
                    <SelectItem value="M">Medium</SelectItem>
                    <SelectItem value="L">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {formData.list_type === "country" && (
            <div className="space-y-2">
              <Label htmlFor="country">Paese</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
                placeholder="Es: Italia"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid_from">Valido dal</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) =>
                  setFormData({ ...formData, valid_from: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_to">Valido fino al</Label>
              <Input
                id="valid_to"
                type="date"
                value={formData.valid_to}
                onChange={(e) =>
                  setFormData({ ...formData, valid_to: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
