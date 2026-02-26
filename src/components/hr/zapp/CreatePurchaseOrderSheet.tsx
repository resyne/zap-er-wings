import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Search, Plus, Minus, Trash2,
  Building2, Package, ClipboardList, Send, Check, Calendar,
  Clock, AlertTriangle, Zap, Timer
} from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
}

interface Material {
  id: string;
  name: string;
  code: string;
  unit: string;
  cost: number;
}

interface OrderItem {
  material: Material;
  quantity: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STEPS = [
  { id: 0, label: "Fornitore", icon: Building2 },
  { id: 1, label: "Materiali", icon: Package },
  { id: 2, label: "Dettagli", icon: ClipboardList },
  { id: 3, label: "Riepilogo", icon: Check },
];

const PRIORITY_OPTIONS = [
  { value: "urgente", label: "Urgente", icon: AlertTriangle, color: "bg-red-500 hover:bg-red-600 text-white", desc: "24h" },
  { value: "alta", label: "Alta", icon: Zap, color: "bg-orange-500 hover:bg-orange-600 text-white", desc: "48h" },
  { value: "media", label: "Media", icon: Timer, color: "bg-yellow-500 hover:bg-yellow-600 text-white", desc: "5 gg" },
  { value: "bassa", label: "Bassa", icon: Clock, color: "bg-blue-500 hover:bg-blue-600 text-white", desc: "10 gg" },
];

export function CreatePurchaseOrderSheet({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Step 0: Supplier
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Step 1: Materials
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  // Step 2: Details
  const [priority, setPriority] = useState("media");
  const [notes, setNotes] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");

  useEffect(() => {
    if (open) {
      loadSuppliers();
      loadMaterials();
    } else {
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setStep(0);
    setSelectedSupplier(null);
    setSupplierSearch("");
    setMaterialSearch("");
    setOrderItems([]);
    setPriority("media");
    setNotes("");
    setExpectedDeliveryDate("");
  };

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from("suppliers")
      .select("id, name, contact_email, contact_phone")
      .eq("active", true)
      .order("name");
    setSuppliers((data || []) as Supplier[]);
  };

  const loadMaterials = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("materials")
      .select("id, name, code, unit, cost")
      .eq("active", true)
      .order("name");
    setMaterials((data || []) as Material[]);
    setLoading(false);
  };

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch) return suppliers;
    const term = supplierSearch.toLowerCase();
    return suppliers.filter(s => s.name.toLowerCase().includes(term));
  }, [suppliers, supplierSearch]);

  const filteredMaterials = useMemo(() => {
    if (!materialSearch) return materials.slice(0, 30);
    const term = materialSearch.toLowerCase();
    return materials.filter(m =>
      m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term)
    ).slice(0, 30);
  }, [materials, materialSearch]);

  const addItem = (material: Material) => {
    if (orderItems.find(i => i.material.id === material.id)) {
      setOrderItems(prev => prev.map(i =>
        i.material.id === material.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setOrderItems(prev => [...prev, { material, quantity: 1 }]);
    }
  };

  const updateQuantity = (materialId: string, delta: number) => {
    setOrderItems(prev => prev.map(i => {
      if (i.material.id === materialId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const removeItem = (materialId: string) => {
    setOrderItems(prev => prev.filter(i => i.material.id !== materialId));
  };

  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedSupplier;
      case 1: return orderItems.length > 0;
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!selectedSupplier || orderItems.length === 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-purchase-order", {
        body: {
          supplier_id: selectedSupplier.id,
          order_date: new Date().toISOString().split("T")[0],
          expected_delivery_date: expectedDeliveryDate || undefined,
          notes: notes || undefined,
          priority,
          items: orderItems.map(i => ({
            material_id: i.material.id,
            quantity: i.quantity,
            unit_price: i.material.cost || 0,
          })),
        },
      });
      if (error) throw error;
      toast.success(`Ordine ${data?.purchaseOrder?.number || ""} creato con successo!`);
      onCreated();
      onClose();
    } catch (err: any) {
      console.error("Error creating PO:", err);
      toast.error("Errore nella creazione dell'ordine: " + (err.message || "Errore sconosciuto"));
    } finally {
      setSubmitting(false);
    }
  };

  const computeDeadlineFromPriority = (p: string) => {
    const now = new Date();
    const hoursMap: Record<string, number> = { urgente: 24, alta: 48, media: 120, bassa: 240 };
    const hours = hoursMap[p] || 120;
    now.setHours(now.getHours() + hours);
    return now.toISOString().split("T")[0];
  };

  const handlePrioritySelect = (p: string) => {
    setPriority(p);
    setExpectedDeliveryDate(computeDeadlineFromPriority(p));
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl p-0 flex flex-col">
        {/* Header */}
        <div className="bg-orange-600 text-white px-4 py-3 rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="text-white text-lg">Nuovo Ordine Fornitore</SheetTitle>
          </SheetHeader>
          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => {
              const StepIcon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                    isActive ? "bg-white text-orange-600" : isDone ? "bg-orange-400 text-white" : "bg-orange-500/50 text-orange-200"
                  }`}>
                    {isDone ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? "bg-orange-400" : "bg-orange-500/30"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 pb-28">
              {/* Step 0: Select Supplier */}
              {step === 0 && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca fornitore..."
                      value={supplierSearch}
                      onChange={(e) => setSupplierSearch(e.target.value)}
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    {filteredSuppliers.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSupplier(s)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${
                          selectedSupplier?.id === s.id
                            ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                            : "bg-white hover:border-orange-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            selectedSupplier?.id === s.id ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            {s.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{s.name}</p>
                            {s.contact_email && (
                              <p className="text-xs text-muted-foreground truncate">{s.contact_email}</p>
                            )}
                          </div>
                          {selectedSupplier?.id === s.id && (
                            <Check className="h-5 w-5 text-orange-500 ml-auto shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <p className="text-center text-sm text-muted-foreground py-8">Nessun fornitore trovato</p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 1: Select Materials */}
              {step === 1 && (
                <div className="space-y-4">
                  {/* Selected items */}
                  {orderItems.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        Materiali selezionati ({orderItems.length})
                      </Label>
                      {orderItems.map((item) => (
                        <div key={item.material.id} className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.material.name}</p>
                            <p className="text-xs text-muted-foreground">{item.material.code}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.material.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateQuantity(item.material.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => removeItem(item.material.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search & add */}
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Aggiungi materiale</Label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca per nome o codice..."
                        value={materialSearch}
                        onChange={(e) => setMaterialSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    {filteredMaterials.map((m) => {
                      const isAdded = orderItems.some(i => i.material.id === m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => addItem(m)}
                          className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                            isAdded ? "bg-orange-50 border-orange-200" : "bg-white hover:bg-muted/30"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{m.code} · {m.unit}</p>
                          </div>
                          {isAdded ? (
                            <Badge className="bg-orange-500 text-white shrink-0">
                              x{orderItems.find(i => i.material.id === m.id)?.quantity}
                            </Badge>
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2: Priority & Notes */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Priorità</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {PRIORITY_OPTIONS.map((p) => {
                        const Icon = p.icon;
                        const isSelected = priority === p.value;
                        return (
                          <button
                            key={p.value}
                            onClick={() => handlePrioritySelect(p.value)}
                            className={`p-3 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? `${p.color} border-transparent ring-2 ring-offset-1 ring-current`
                                : "bg-white border-muted hover:border-muted-foreground/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${isSelected ? "" : "text-muted-foreground"}`} />
                              <span className={`font-semibold text-sm ${isSelected ? "" : "text-foreground"}`}>{p.label}</span>
                            </div>
                            <p className={`text-xs mt-1 ${isSelected ? "opacity-80" : "text-muted-foreground"}`}>
                              Consegna entro {p.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Data Consegna Richiesta</Label>
                    <Input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Calcolata automaticamente dalla priorità, modificabile</p>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Note per il fornitore</Label>
                    <Textarea
                      placeholder="Inserisci eventuali note o richieste particolari..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-1 min-h-[100px]"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Review */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border p-4 space-y-2">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Fornitore</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                        {selectedSupplier?.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{selectedSupplier?.name}</p>
                        {selectedSupplier?.contact_email && (
                          <p className="text-xs text-muted-foreground">{selectedSupplier.contact_email}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-3">
                      Materiali ({orderItems.length})
                    </h3>
                    <div className="space-y-2">
                      {orderItems.map((item) => (
                        <div key={item.material.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.material.name}</p>
                            <p className="text-xs text-muted-foreground">{item.material.code}</p>
                          </div>
                          <Badge variant="secondary" className="text-base font-bold px-3">x{item.quantity}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border p-4 space-y-2">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Dettagli</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Priorità</span>
                        <Badge className={`${PRIORITY_OPTIONS.find(p => p.value === priority)?.color || ""} mt-1`}>
                          {PRIORITY_OPTIONS.find(p => p.value === priority)?.label}
                        </Badge>
                      </div>
                      {expectedDeliveryDate && (
                        <div>
                          <span className="text-muted-foreground text-xs">Consegna richiesta</span>
                          <p className="font-medium flex items-center gap-1 mt-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(expectedDeliveryDate).toLocaleDateString("it-IT")}
                          </p>
                        </div>
                      )}
                    </div>
                    {notes && (
                      <div className="pt-2 border-t text-sm">
                        <span className="text-muted-foreground text-xs">Note</span>
                        <p className="mt-1">{notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                    <p className="font-medium">📧 All'invio verranno notificati:</p>
                    <ul className="mt-1 text-xs space-y-0.5">
                      {selectedSupplier?.contact_email && <li>• Email al fornitore ({selectedSupplier.contact_email})</li>}
                      {selectedSupplier?.contact_phone && <li>• WhatsApp al fornitore ({selectedSupplier.contact_phone})</li>}
                      <li>• Notifica interna al team</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 flex gap-3 safe-bottom">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
            </Button>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annulla
            </Button>
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1 bg-orange-600 hover:bg-orange-700"
            >
              Avanti <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {submitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Invia Ordine
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
