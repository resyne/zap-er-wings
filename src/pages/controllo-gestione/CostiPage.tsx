import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Filter, Archive, Copy, Edit2, Trash2 } from "lucide-react";
import { useManagementCosts, useCostCategories, useCreateCost, useUpdateCost, useDeleteCost, ManagementCost } from "@/hooks/useManagementCosts";
import { format } from "date-fns";

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

  const { data: costs = [], isLoading } = useManagementCosts({ status: "active" });
  const { data: categories = [] } = useCostCategories();
  const createCost = useCreateCost();
  const updateCost = useUpdateCost();
  const deleteCost = useDeleteCost();

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
                  <th className="text-right p-3">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Nessun costo trovato. Crea il primo costo per iniziare.</td></tr>
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
                <Input value={editingCost.supplier_name || ""} onChange={e => setEditingCost(p => ({ ...p!, supplier_name: e.target.value }))} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={editingCost.category_id || ""} onValueChange={v => {
                  const cat = categories.find(c => c.id === v);
                  setEditingCost(p => ({ ...p!, category_id: v, category_name: cat?.name, cost_type: cat?.cost_type || p!.cost_type }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.cost_type === "fixed" ? "F" : "V"})</SelectItem>)}</SelectContent>
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
                <Label>IVA %</Label>
                <Input type="number" value={editingCost.vat_rate || ""} onChange={e => {
                  const rate = parseFloat(e.target.value) || 0;
                  const vatAmount = (editingCost.amount || 0) * rate / 100;
                  setEditingCost(p => ({ ...p!, vat_rate: rate, vat_amount: vatAmount, net_amount: (p!.amount || 0) + vatAmount }));
                }} />
              </div>
              <div>
                <Label>Metodo Pagamento</Label>
                <Select value={editingCost.payment_method || ""} onValueChange={v => setEditingCost(p => ({ ...p!, payment_method: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonifico">Bonifico</SelectItem>
                    <SelectItem value="carta">Carta</SelectItem>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="banca">Banca</SelectItem>
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
    </div>
  );
};

export default CostiPage;
