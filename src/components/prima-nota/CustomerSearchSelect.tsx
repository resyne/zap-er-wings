import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Plus, User, Building2, X, Loader2 } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  code: string;
  city: string | null;
}

interface CustomerSearchSelectProps {
  selectedCustomerId: string;
  onSelect: (customerId: string, customerName: string) => void;
}

export function CustomerSearchSelect({ selectedCustomerId, onSelect }: CustomerSearchSelectProps) {
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", company_name: "", email: "", phone: "", tax_id: "" });

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-for-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, company_name, email, phone, tax_id, code, city")
        .eq("active", true)
        .order("name");
      return (data || []) as Customer[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company_name?.toLowerCase().includes(q)) ||
      (c.email?.toLowerCase().includes(q)) ||
      (c.tax_id?.toLowerCase().includes(q)) ||
      (c.code?.toLowerCase().includes(q)) ||
      (c.city?.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const handleCreate = async () => {
    if (!newCustomer.name.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: newCustomer.name,
          company_name: newCustomer.company_name || null,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          tax_id: newCustomer.tax_id || null,
          active: true,
          incomplete_registry: true,
        })
        .select("id, name, company_name")
        .single();

      if (error) throw error;
      onSelect(data.id, data.company_name || data.name);
      setShowCreateDialog(false);
      setNewCustomer({ name: "", company_name: "", email: "", phone: "", tax_id: "" });
      toast.success("Cliente creato con successo");
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "Impossibile creare il cliente"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Soggetto Economico</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-primary"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-3 w-3" /> Nuovo Cliente
        </Button>
      </div>

      {/* Selected customer badge */}
      {selectedCustomer && (
        <div className="flex items-center gap-2 p-2 rounded-md border bg-primary/5">
          <Building2 className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedCustomer.company_name || selectedCustomer.name}</p>
            {selectedCustomer.company_name && (
              <p className="text-xs text-muted-foreground truncate">{selectedCustomer.name}</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => onSelect("", "")}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Cerca cliente per nome, P.IVA, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Results list */}
      {search.trim() && (
        <ScrollArea className="max-h-[160px] border rounded-md">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Caricamento...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Nessun cliente trovato</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setNewCustomer(prev => ({ ...prev, name: search }));
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="h-3 w-3" /> Crea "{search}"
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.slice(0, 20).map(c => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors text-sm ${
                    c.id === selectedCustomerId ? "bg-primary/10" : ""
                  }`}
                  onClick={() => {
                    onSelect(c.id, c.company_name || c.name);
                    setSearch("");
                  }}
                >
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.company_name || c.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {c.company_name && <span>{c.name}</span>}
                        {c.tax_id && <span>· P.IVA: {c.tax_id}</span>}
                        {c.city && <span>· {c.city}</span>}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{c.code}</Badge>
                  </div>
                </button>
              ))}
              {filtered.length > 20 && (
                <p className="text-xs text-center py-2 text-muted-foreground">
                  +{filtered.length - 20} risultati. Affina la ricerca.
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      )}

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Cliente Rapido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome / Referente *</Label>
              <Input value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))} placeholder="Mario Rossi" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ragione Sociale</Label>
              <Input value={newCustomer.company_name} onChange={e => setNewCustomer(p => ({ ...p, company_name: e.target.value }))} placeholder="Rossi S.r.l." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={newCustomer.email} onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))} placeholder="email@esempio.it" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefono</Label>
                <Input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))} placeholder="+39..." />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">P.IVA / Codice Fiscale</Label>
              <Input value={newCustomer.tax_id} onChange={e => setNewCustomer(p => ({ ...p, tax_id: e.target.value }))} placeholder="IT01234567890" />
            </div>
            <p className="text-xs text-muted-foreground">
              Il cliente verrà creato con anagrafica incompleta. Potrai completarla in seguito dalla sezione Clienti.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>Annulla</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Crea Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
