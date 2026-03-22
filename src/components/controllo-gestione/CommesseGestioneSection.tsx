import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import {
  useManagementCommesse,
  useCreateManagementCommessa,
  useUpdateManagementCommessa,
  useDeleteManagementCommessa,
  useCommesseTotals,
  type ManagementCommessa,
} from "@/hooks/useManagementCommesse";

const emptyForm = {
  codice_commessa: "",
  cliente: "",
  descrizione: "",
  stato: "acquisita" as ManagementCommessa["stato"],
  data: new Date().toISOString().split("T")[0],
  ricavo: 0,
  costo_diretto_stimato: 0,
  note: "",
};

const statoColors: Record<string, string> = {
  acquisita: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_corso: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  chiusa: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  annullata: "bg-muted text-muted-foreground",
};

const statoLabels: Record<string, string> = {
  acquisita: "Acquisita",
  in_corso: "In Corso",
  chiusa: "Chiusa",
  annullata: "Annullata",
};

const fmt = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const CommesseGestioneSection = () => {
  const { data: commesse = [] } = useManagementCommesse();
  const createMut = useCreateManagementCommessa();
  const updateMut = useUpdateManagementCommessa();
  const deleteMut = useDeleteManagementCommessa();
  const totals = useCommesseTotals(commesse);

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openNew = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c: ManagementCommessa) => {
    setEditId(c.id);
    setForm({
      codice_commessa: c.codice_commessa,
      cliente: c.cliente,
      descrizione: c.descrizione || "",
      stato: c.stato,
      data: c.data,
      ricavo: c.ricavo,
      costo_diretto_stimato: c.costo_diretto_stimato,
      note: c.note || "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.codice_commessa || !form.cliente) return;
    if (editId) {
      updateMut.mutate({ id: editId, ...form }, { onSuccess: () => setOpen(false) });
    } else {
      createMut.mutate(form, { onSuccess: () => setOpen(false) });
    }
  };

  const marginePreview = form.ricavo - form.costo_diretto_stimato;
  const marginePctPreview = form.ricavo > 0 ? (marginePreview / form.ricavo) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Totale Ricavi Commesse</div>
            <div className="text-2xl font-bold">{fmt(totals.totaleRicavi)}</div>
            <p className="text-xs text-muted-foreground">{totals.count} commesse attive</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="h-4 w-4" />Costi Variabili da Commesse</div>
            <div className="text-2xl font-bold text-orange-600">{fmt(totals.totaleCostiDiretti)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />Margine Lordo Commesse</div>
            <div className={`text-2xl font-bold ${totals.totaleMargineLordo >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(totals.totaleMargineLordo)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Commesse</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nuova Commessa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editId ? "Modifica Commessa" : "Nuova Commessa"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Codice Commessa *</Label>
                    <Input value={form.codice_commessa} onChange={e => setForm(f => ({ ...f, codice_commessa: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Cliente *</Label>
                    <Input value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Descrizione</Label>
                  <Input value={form.descrizione} onChange={e => setForm(f => ({ ...f, descrizione: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Stato</Label>
                    <Select value={form.stato} onValueChange={v => setForm(f => ({ ...f, stato: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="acquisita">Acquisita</SelectItem>
                        <SelectItem value="in_corso">In Corso</SelectItem>
                        <SelectItem value="chiusa">Chiusa</SelectItem>
                        <SelectItem value="annullata">Annullata</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Ricavo (€)</Label>
                    <Input type="number" min={0} value={form.ricavo} onChange={e => setForm(f => ({ ...f, ricavo: Math.max(0, Number(e.target.value)) }))} />
                  </div>
                  <div>
                    <Label>Costo Diretto Stimato (€)</Label>
                    <Input type="number" min={0} value={form.costo_diretto_stimato} onChange={e => setForm(f => ({ ...f, costo_diretto_stimato: Math.max(0, Number(e.target.value)) }))} />
                  </div>
                </div>
                {/* Live margin preview */}
                <div className="p-3 rounded-lg bg-muted/50 flex justify-between items-center">
                  <span className="text-sm font-medium">Margine calcolato</span>
                  <div className="text-right">
                    <span className={`font-bold ${marginePreview >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(marginePreview)}</span>
                    <Badge variant={marginePreview >= 0 ? "default" : "destructive"} className="ml-2 text-xs">{marginePctPreview.toFixed(1)}%</Badge>
                  </div>
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} />
                </div>
                <Button onClick={save} disabled={!form.codice_commessa || !form.cliente || createMut.isPending || updateMut.isPending} className="w-full">
                  {editId ? "Salva Modifiche" : "Aggiungi Commessa"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {commesse.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>Nessuna commessa inserita. Clicca "Nuova Commessa" per iniziare.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Ricavo</TableHead>
                  <TableHead className="text-right">Costo Diretto</TableHead>
                  <TableHead className="text-right">Margine</TableHead>
                  <TableHead className="text-right">% Margine</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commesse.map(c => {
                  const margine = Number(c.margine_calcolato);
                  const pct = Number(c.ricavo) > 0 ? (margine / Number(c.ricavo)) * 100 : 0;
                  return (
                    <TableRow key={c.id} className={c.stato === "annullata" ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{c.codice_commessa}</TableCell>
                      <TableCell>{c.cliente}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{c.descrizione || "-"}</TableCell>
                      <TableCell><Badge className={statoColors[c.stato]}>{statoLabels[c.stato]}</Badge></TableCell>
                      <TableCell className="text-right">{fmt(Number(c.ricavo))}</TableCell>
                      <TableCell className="text-right text-orange-600">{fmt(Number(c.costo_diretto_stimato))}</TableCell>
                      <TableCell className={`text-right font-medium ${margine >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(margine)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={margine >= 0 ? "default" : "destructive"} className="text-xs">{pct.toFixed(1)}%</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMut.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CommesseGestioneSection;
