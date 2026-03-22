import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Filter, Archive, Copy, Edit2, UserPlus } from "lucide-react";
import { useManagementCosts, useCostCategories, useCreateCost, useUpdateCost, useDeleteCost, ManagementCost } from "@/hooks/useManagementCosts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";

// Metodi di pagamento allineati con Registro Contabile e Prima Nota
const PAYMENT_METHODS = [
  { value: 'bonifico', label: 'Bonifico Bancario' },
  { value: 'banca', label: 'Banca (altro)' },
  { value: 'carta', label: 'Carta' },
  { value: 'american_express', label: 'American Express' },
  { value: 'carta_aziendale', label: 'Carta Aziendale' },
  { value: 'carta_q8', label: 'Carta Q8' },
  { value: 'contanti', label: 'Contanti' },
  { value: 'cassa', label: 'Cassa' },
  { value: 'anticipo_dipendente', label: 'Anticipo Dipendente' },
  { value: 'banca_intesa', label: 'Banca Intesa' },
];

// Regimi IVA standard allineati con Prima Nota e Registro Contabile
const IVA_OPTIONS = [
  { value: 'none', label: '— Nessuna —', rate: 0 },
  { value: 'ORDINARIO_22', label: 'Ordinario (22%)', rate: 22 },
  { value: 'REVERSE_CHARGE', label: 'Reverse Charge (0%)', rate: 0 },
  { value: 'INTRA_UE', label: 'Intra UE (0%)', rate: 0 },
  { value: 'EXTRA_UE', label: 'Extra UE (0%)', rate: 0 },
];

const emptyForm = (): Partial<ManagementCost> => ({
  date: format(new Date(), "yyyy-MM-dd"),
  description: "",
  cost_type: "variable",
  cost_nature: "direct",
  amount: 0,
  frequency: "one_time",
  status: "active",
});

const CostiPage = () => {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCost, setEditingCost] = useState<Partial<ManagementCost> | null>(null);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const queryClient = useQueryClient();

  const { data: costs = [], isLoading } = useManagementCosts({ status: "active" });
  const { data: categories = [] } = useCostCategories();
  const createCost = useCreateCost();
  const updateCost = useUpdateCost();
  const deleteCost = useDeleteCost();

  // Centri di costo — stessa query del Registro Contabile
  const { data: costCenters = [] } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_centers')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Centri di ricavo — stessa query del Registro Contabile
  const { data: profitCenters = [] } = useQuery({
    queryKey: ['profit-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profit_centers')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Business units
  const { data: businessUnits = [] } = useQuery({
    queryKey: ['business-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fornitori dalla tabella suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const filtered = costs.filter(c => {
    if (search && !c.description.toLowerCase().includes(search.toLowerCase()) && !(c.supplier_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && c.cost_type !== filterType) return false;
    if (filterCategory !== "all" && c.category_id !== filterCategory) return false;
    return true;
  });

  const totalFixed = costs.filter(c => c.cost_type === "fixed").reduce((s, c) => s + Number(c.amount), 0);
  const totalVariable = costs.filter(c => c.cost_type === "variable").reduce((s, c) => s + Number(c.amount), 0);

  const handleSave = async () => {
    if (!editingCost) return;
    if (editingCost.id) {
      await updateCost.mutateAsync(editingCost as any);
    } else {
      await createCost.mutateAsync(editingCost);
    }
    setDialogOpen(false);
    setEditingCost(null);
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    try {
      const code = 'SUP-' + Date.now().toString(36).toUpperCase();
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data, error } = await supabase.from('suppliers').insert({
        name: newSupplierName.trim(),
        code,
        access_code: accessCode,
        active: true,
      } as any).select('id, name').single();
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['suppliers-active'] });
      setEditingCost(p => ({ ...p!, supplier_id: data.id, supplier_name: data.name }));
      setNewSupplierName("");
      setNewSupplierOpen(false);
      toast.success("Fornitore aggiunto");
    } catch (e: any) {
      toast.error("Errore: " + e.message);
    }
  };

  const handleArchive = async (cost: ManagementCost) => {
    await updateCost.mutateAsync({ id: cost.id, status: "archived" });
  };

  const handleDuplicate = (cost: ManagementCost) => {
    const { id, created_at, updated_at, ...rest } = cost;
    setEditingCost({ ...rest, date: format(new Date(), "yyyy-MM-dd"), description: rest.description + " (copia)" });
    setDialogOpen(true);
  };

  const fmt = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 2 });
  const freqLabel: Record<string, string> = { one_time: "Una tantum", monthly: "Mensile", quarterly: "Trimestrale", annual: "Annuale" };
  const paymentLabel = (v: string) => PAYMENT_METHODS.find(p => p.value === v)?.label || v || "-";

  const getCostCenterName = (id?: string) => costCenters.find(c => c.id === id)?.name || "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Costi</h1>
          <p className="text-muted-foreground">Inserisci, classifica e monitora tutti i costi aziendali</p>
        </div>
        <Button onClick={() => { setEditingCost(emptyForm()); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nuovo Costo
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Totale Costi</div><div className="text-2xl font-bold">{fmt(totalFixed + totalVariable)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Costi Fissi</div><div className="text-2xl font-bold text-red-600">{fmt(totalFixed)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Costi Variabili</div><div className="text-2xl font-bold text-orange-600">{fmt(totalVariable)}</div></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca per descrizione o fornitore..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="fixed">Fisso</SelectItem>
            <SelectItem value="variable">Variabile</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le categorie</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Data</th>
                  <th className="text-left p-3">Descrizione</th>
                  <th className="text-left p-3">Fornitore</th>
                  <th className="text-left p-3">Categoria</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Natura</th>
                  <th className="text-right p-3">Importo</th>
                  <th className="text-left p-3">Frequenza</th>
                  <th className="text-left p-3">Centro Costo</th>
                  <th className="text-right p-3">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Nessun costo trovato. Crea il primo costo per iniziare.</td></tr>
                ) : filtered.map(cost => (
                  <tr key={cost.id} className="border-b hover:bg-muted/30">
                    <td className="p-3">{cost.date ? format(new Date(cost.date), "dd/MM/yyyy") : "-"}</td>
                    <td className="p-3 font-medium">{cost.description}</td>
                    <td className="p-3">{cost.supplier_name || "-"}</td>
                    <td className="p-3">{cost.category_name || "-"}</td>
                    <td className="p-3">
                      <Badge variant={cost.cost_type === "fixed" ? "destructive" : "secondary"}>
                        {cost.cost_type === "fixed" ? "Fisso" : "Variabile"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline">{cost.cost_nature === "direct" ? "Diretto" : "Indiretto"}</Badge>
                    </td>
                    <td className="p-3 text-right font-medium">{fmt(Number(cost.amount))}</td>
                    <td className="p-3">{freqLabel[cost.frequency] || cost.frequency}</td>
                    <td className="p-3 text-xs">{getCostCenterName(cost.cost_center_id)}</td>
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCost(cost); setDialogOpen(true); }}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(cost)}><Copy className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleArchive(cost)}><Archive className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCost?.id ? "Modifica Costo" : "Nuovo Costo"}</DialogTitle></DialogHeader>
          {editingCost && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data *</Label>
                <Input type="date" value={editingCost.date || ""} onChange={e => setEditingCost(p => ({ ...p!, date: e.target.value }))} />
              </div>
              <div>
                <Label>Importo *</Label>
                <Input type="number" step="0.01" value={editingCost.amount || ""} onChange={e => setEditingCost(p => ({ ...p!, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-2">
                <Label>Descrizione *</Label>
                <Input value={editingCost.description || ""} onChange={e => setEditingCost(p => ({ ...p!, description: e.target.value }))} />
              </div>
              <div>
                <Label>Fornitore</Label>
                <div className="flex gap-2">
                  <Select value={editingCost.supplier_id || "none"} onValueChange={v => {
                    if (v === "none") {
                      setEditingCost(p => ({ ...p!, supplier_id: undefined, supplier_name: undefined }));
                    } else {
                      const sup = suppliers.find(s => s.id === v);
                      setEditingCost(p => ({ ...p!, supplier_id: v, supplier_name: sup?.name }));
                    }
                  }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Seleziona fornitore" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Nessuno —</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setNewSupplierOpen(true)} title="Aggiungi fornitore">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editingCost.category_id || "none"} onValueChange={v => {
                  if (v === "none") {
                    setEditingCost(p => ({ ...p!, category_id: undefined, category_name: undefined }));
                  } else {
                    const cat = categories.find(c => c.id === v);
                    setEditingCost(p => ({ ...p!, category_id: v, category_name: cat?.name, cost_type: cat?.cost_type || p!.cost_type }));
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuna —</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.cost_type === "fixed" ? "F" : "V"})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo Costo *</Label>
                <Select value={editingCost.cost_type} onValueChange={v => setEditingCost(p => ({ ...p!, cost_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fisso</SelectItem>
                    <SelectItem value="variable">Variabile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Natura</Label>
                <Select value={editingCost.cost_nature} onValueChange={v => setEditingCost(p => ({ ...p!, cost_nature: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Diretto</SelectItem>
                    <SelectItem value="indirect">Indiretto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequenza</Label>
                <Select value={editingCost.frequency} onValueChange={v => setEditingCost(p => ({ ...p!, frequency: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">Una tantum</SelectItem>
                    <SelectItem value="monthly">Mensile</SelectItem>
                    <SelectItem value="quarterly">Trimestrale</SelectItem>
                    <SelectItem value="annual">Annuale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Regime IVA</Label>
                <Select value={(editingCost as any).iva_mode || "none"} onValueChange={v => {
                  const opt = IVA_OPTIONS.find(o => o.value === v);
                  const rate = opt?.rate || 0;
                  const vatAmount = (editingCost.amount || 0) * rate / 100;
                  setEditingCost(p => ({
                    ...p!,
                    vat_rate: rate,
                    vat_amount: vatAmount,
                    net_amount: (p!.amount || 0) + vatAmount,
                    ...(v !== "none" ? { iva_mode: v } : { iva_mode: undefined }),
                  } as any));
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleziona regime IVA" /></SelectTrigger>
                  <SelectContent>
                    {IVA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Metodo Pagamento</Label>
                <Select value={editingCost.payment_method || "none"} onValueChange={v => setEditingCost(p => ({ ...p!, payment_method: v === "none" ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuno —</SelectItem>
                    {PAYMENT_METHODS.map(pm => (
                      <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Centro di Costo — allineato con Registro Contabile */}
              <div>
                <Label>Centro di Costo</Label>
                <Select value={editingCost.cost_center_id || "none"} onValueChange={v => setEditingCost(p => ({ ...p!, cost_center_id: v === "none" ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuno —</SelectItem>
                    {costCenters.map((cc: any) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Business Unit */}
              <div>
                <Label>Business Unit</Label>
                <Select value={editingCost.business_unit_id || "none"} onValueChange={v => setEditingCost(p => ({ ...p!, business_unit_id: v === "none" ? undefined : v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuna —</SelectItem>
                    {businessUnits.map((bu: any) => (
                      <SelectItem key={bu.id} value={bu.id}>{bu.code} - {bu.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2">
                <Label>Note</Label>
                <Textarea value={editingCost.notes || ""} onChange={e => setEditingCost(p => ({ ...p!, notes: e.target.value }))} rows={2} />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button onClick={handleSave} disabled={!editingCost.description || !editingCost.amount}>Salva</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Nuovo Fornitore */}
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nuovo Fornitore</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Fornitore *</Label>
              <Input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="Es. Acme S.r.l." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewSupplierOpen(false)}>Annulla</Button>
              <Button onClick={handleAddSupplier} disabled={!newSupplierName.trim()}>Aggiungi</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CostiPage;
