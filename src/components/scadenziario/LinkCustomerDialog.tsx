import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserPlus, Link2, Building2, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { normalizeCompanyName, stringSimilarity } from "@/lib/fuzzyMatch";

interface LinkCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scadenza: {
    id: string;
    soggetto_nome: string | null;
    soggetto_id: string | null;
    tipo: "credito" | "debito";
  } | null;
}

interface CustomerMatch {
  id: string;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  pec: string | null;
  sdi_code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  similarity: number;
}

export function LinkCustomerDialog({ open, onOpenChange, scadenza }: LinkCustomerDialogProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"search" | "create">("search");
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    tax_id: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    pec: "",
    sdi_code: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

  // Load all customers for matching
  const { data: customers = [] } = useQuery({
    queryKey: ["all-customers-for-link"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, company_name, tax_id, email, phone, address, city, pec, sdi_code, contact_name, contact_email, contact_phone")
        .eq("active", true)
        .order("name");
      return data || [];
    },
    enabled: open,
  });

  // Check if already linked
  const isAlreadyLinked = !!scadenza?.soggetto_id;
  const linkedCustomer = useMemo(() => {
    if (!scadenza?.soggetto_id) return null;
    return customers.find(c => c.id === scadenza.soggetto_id) || null;
  }, [scadenza?.soggetto_id, customers]);

  // Initialize search term and new customer name
  useEffect(() => {
    if (open && scadenza?.soggetto_nome) {
      setSearchTerm(scadenza.soggetto_nome);
      setNewCustomer(prev => ({ ...prev, name: scadenza.soggetto_nome || "" }));
      setMode("search");
    }
  }, [open, scadenza?.soggetto_nome]);

  // Fuzzy match customers
  const matches = useMemo(() => {
    if (!searchTerm.trim() || customers.length === 0) return [];
    const normalizedSearch = normalizeCompanyName(searchTerm);

    return customers
      .map(c => {
        const nameToCompare = c.company_name || c.name;
        const normalizedName = normalizeCompanyName(nameToCompare);
        const sim = stringSimilarity(normalizedSearch, normalizedName);
        // Also check if the original name contains the search
        const nameContains = nameToCompare.toLowerCase().includes(searchTerm.toLowerCase()) ||
          searchTerm.toLowerCase().includes(nameToCompare.toLowerCase());
        const finalSim = nameContains ? Math.max(sim, 0.7) : sim;

        return { ...c, similarity: finalSim } as CustomerMatch;
      })
      .filter(m => m.similarity >= 0.4)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 8);
  }, [searchTerm, customers]);

  const linkToCustomer = async (customerId: string) => {
    if (!scadenza) return;
    setSaving(true);
    try {
      // Update scadenze soggetto_id
      const { error } = await supabase
        .from("scadenze")
        .update({ soggetto_id: customerId } as any)
        .eq("id", scadenza.id);
      if (error) throw error;

      // Also update all scadenze with same soggetto_nome
      if (scadenza.soggetto_nome) {
        await supabase
          .from("scadenze")
          .update({ soggetto_id: customerId } as any)
          .eq("soggetto_nome", scadenza.soggetto_nome)
          .is("soggetto_id", null);
      }

      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["all-customers-for-link"] });
      toast.success("Soggetto collegato all'anagrafica clienti");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const createAndLink = async () => {
    if (!scadenza || !newCustomer.name.trim()) return;
    setSaving(true);
    try {
      // Generate code
      const { data: lastCustomer } = await supabase
        .from("customers")
        .select("code")
        .order("code", { ascending: false })
        .limit(1)
        .single();

      let nextCode = "C0001";
      if (lastCustomer?.code) {
        const num = parseInt(lastCustomer.code.replace(/\D/g, "")) + 1;
        nextCode = `C${String(num).padStart(4, "0")}`;
      }

      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          code: nextCode,
          name: newCustomer.name,
          company_name: newCustomer.name,
          tax_id: newCustomer.tax_id || null,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          address: newCustomer.address || null,
          city: newCustomer.city || null,
          pec: newCustomer.pec || null,
          sdi_code: newCustomer.sdi_code || null,
          contact_name: newCustomer.contact_name || null,
          contact_email: newCustomer.contact_email || null,
          contact_phone: newCustomer.contact_phone || null,
          incomplete_registry: !newCustomer.tax_id || !newCustomer.contact_email,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!created) throw new Error("Creazione fallita");

      await linkToCustomer(created.id);
      toast.success("Cliente creato e collegato con successo");
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
      setSaving(false);
    }
  };

  if (!scadenza) return null;

  const simBadge = (sim: number) => {
    if (sim >= 0.9) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">Corrispondenza alta</Badge>;
    if (sim >= 0.7) return <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Possibile match</Badge>;
    return <Badge variant="outline" className="text-[10px]">Simile</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Collega ad Anagrafica Clienti
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current subject info */}
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-muted-foreground">Soggetto nello Scadenziario</p>
                  <p className="font-semibold">{scadenza.soggetto_nome || "N/D"}</p>
                </div>
                <Badge variant="outline" className={scadenza.tipo === "credito" ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>
                  {scadenza.tipo === "credito" ? "Cliente" : "Fornitore"}
                </Badge>
              </div>
              {isAlreadyLinked && linkedCustomer && (
                <div className="mt-2 pt-2 border-t flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-emerald-700">Già collegato a: <strong>{linkedCustomer.company_name || linkedCustomer.name}</strong></span>
                  {linkedCustomer.tax_id && <span className="text-xs text-muted-foreground">P.IVA: {linkedCustomer.tax_id}</span>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Search / Create toggle */}
          <div className="flex gap-2">
            <Button variant={mode === "search" ? "default" : "outline"} size="sm" onClick={() => setMode("search")} className="gap-1.5">
              <Search className="h-3.5 w-3.5" /> Cerca esistente
            </Button>
            <Button variant={mode === "create" ? "default" : "outline"} size="sm" onClick={() => setMode("create")} className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Crea nuovo
            </Button>
          </div>

          {mode === "search" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Cerca per nome azienda..."
                  className="pl-9"
                />
              </div>

              {matches.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {matches.map(m => (
                    <Card key={m.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => linkToCustomer(m.id)}>
                      <CardContent className="py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{m.company_name || m.name}</span>
                              {simBadge(m.similarity)}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground pl-6">
                              {m.tax_id && <span>P.IVA: {m.tax_id}</span>}
                              {m.email && <span>{m.email}</span>}
                              {m.city && <span>{m.city}</span>}
                              {m.contact_name && <span>Ref: {m.contact_name}</span>}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="shrink-0 gap-1 h-7 text-xs" disabled={saving}>
                            <Link2 className="h-3 w-3" /> Collega
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : searchTerm.trim() ? (
                <div className="text-center py-6 space-y-3">
                  <AlertTriangle className="h-8 w-8 mx-auto text-amber-500" />
                  <p className="text-sm text-muted-foreground">Nessun cliente trovato per "{searchTerm}"</p>
                  <Button variant="outline" onClick={() => setMode("create")} className="gap-1.5">
                    <UserPlus className="h-4 w-4" /> Crea nuovo cliente
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Anagrafica */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Anagrafica Cliente
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Nome Azienda *</Label>
                    <Input value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">P.IVA</Label>
                    <Input value={newCustomer.tax_id} onChange={e => setNewCustomer(p => ({ ...p, tax_id: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Codice SDI</Label>
                    <Input value={newCustomer.sdi_code} onChange={e => setNewCustomer(p => ({ ...p, sdi_code: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PEC</Label>
                    <Input value={newCustomer.pec} onChange={e => setNewCustomer(p => ({ ...p, pec: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email aziendale</Label>
                    <Input value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Indirizzo</Label>
                    <Input value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Città</Label>
                    <Input value={newCustomer.city} onChange={e => setNewCustomer(p => ({ ...p, city: e.target.value }))} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Referente */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5" /> Contatto Referente
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Nome e Cognome</Label>
                    <Input value={newCustomer.contact_name} onChange={e => setNewCustomer(p => ({ ...p, contact_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Email referente</Label>
                    <Input value={newCustomer.contact_email} onChange={e => setNewCustomer(p => ({ ...p, contact_email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefono referente</Label>
                    <Input value={newCustomer.contact_phone} onChange={e => setNewCustomer(p => ({ ...p, contact_phone: e.target.value }))} />
                  </div>
                </div>
              </div>

              <Button onClick={createAndLink} disabled={saving || !newCustomer.name.trim()} className="w-full gap-2">
                <UserPlus className="h-4 w-4" />
                {saving ? "Creazione in corso..." : "Crea Cliente e Collega"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
