import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Search, Plus, User, Building2, X, Loader2, Check, MapPin, Mail, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  code: string;
  city: string | null;
  incomplete_registry: boolean | null;
}

interface CustomerSearchSelectProps {
  selectedCustomerId: string;
  onSelect: (customerId: string, customerName: string) => void;
  label?: string;
}

export function CustomerSearchSelect({ selectedCustomerId, onSelect, label = "Soggetto Economico" }: CustomerSearchSelectProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [newCustomer, setNewCustomer] = useState({ name: "", company_name: "", email: "", phone: "", tax_id: "" });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-for-select"],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, name, company_name, email, phone, tax_id, code, city, incomplete_registry")
        .eq("active", true)
        .order("name");
      return (data || []) as Customer[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
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

  // Reset highlight when results change
  useEffect(() => { setHighlightedIndex(-1); }, [filtered.length]);

  const handleSelect = useCallback((c: Customer) => {
    onSelect(c.id, c.company_name || c.name);
    setSearch("");
    setIsFocused(false);
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = filtered.slice(0, 20);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0 && items[highlightedIndex]) {
      e.preventDefault();
      handleSelect(items[highlightedIndex]);
    } else if (e.key === "Escape") {
      setSearch("");
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleCreate = async () => {
    if (!newCustomer.name.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert([{
          name: newCustomer.name,
          company_name: newCustomer.company_name || null,
          email: newCustomer.email || null,
          phone: newCustomer.phone || null,
          tax_id: newCustomer.tax_id || null,
          active: true,
          incomplete_registry: true,
          code: "",
        }])
        .select("id, name, company_name")
        .single();

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["customers-for-select"] });
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

  const showResults = isFocused && search.trim().length > 0;

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!search.trim()) return text;
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + search.length)}</mark>
        {text.slice(idx + search.length)}
      </>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-3 w-3" /> Nuovo
        </Button>
      </div>

      {/* Selected customer card */}
      {selectedCustomer && (() => {
        const isIncomplete = selectedCustomer.incomplete_registry || !selectedCustomer.tax_id || !selectedCustomer.email;
        return (
          <div className={cn(
            "group flex items-center gap-3 p-3 rounded-lg border transition-all",
            isIncomplete
              ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20"
              : "border-primary/20 bg-primary/5 hover:border-primary/30"
          )}>
            <div className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
              isIncomplete ? "bg-amber-100 dark:bg-amber-900/30" : "bg-primary/10"
            )}>
              {isIncomplete
                ? <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                : <Building2 className="h-4 w-4 text-primary" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedCustomer.company_name || selectedCustomer.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedCustomer.company_name && <span className="truncate">{selectedCustomer.name}</span>}
                {selectedCustomer.tax_id && (
                  <>
                    {selectedCustomer.company_name && <span>·</span>}
                    <span className="font-mono">{selectedCustomer.tax_id}</span>
                  </>
                )}
                {selectedCustomer.city && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{selectedCustomer.city}</span>
                  </>
                )}
              </div>
              {isIncomplete && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    ⚠ Anagrafica incompleta
                  </span>
                  <span className="text-[10px] text-muted-foreground">—</span>
                  <a
                    href="/clienti"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Completa in Clienti →
                  </a>
                </div>
              )}
            </div>
            {isIncomplete ? (
              <Badge variant="outline" className="text-[10px] shrink-0 border-amber-300 bg-amber-100/50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Incompleto
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{selectedCustomer.code}</Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onSelect("", "")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })()}

      {/* Search input */}
      <div className="relative">
        <Search className={cn(
          "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
          isFocused ? "text-primary" : "text-muted-foreground"
        )} />
        <Input
          ref={inputRef}
          placeholder={selectedCustomer ? "Cambia soggetto..." : "Cerca per nome, P.IVA, email, città..."}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          className={cn(
            "pl-9 h-10 text-sm transition-all",
            isFocused && "ring-2 ring-primary/20 border-primary/40"
          )}
        />
        {search && (
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-sm hover:bg-muted transition-colors"
            onClick={() => { setSearch(""); inputRef.current?.focus(); }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div ref={listRef} className="border rounded-lg shadow-lg bg-popover overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {isLoading ? (
            <div className="p-6 text-center">
              <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Ricerca in corso...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-5 text-center space-y-3">
              <div className="h-10 w-10 mx-auto rounded-full bg-muted flex items-center justify-center">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Nessun risultato per "{search}"</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prova con un altro termine o crea un nuovo cliente</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setNewCustomer(prev => ({ ...prev, name: search }));
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Crea "{search}"
              </Button>
            </div>
          ) : (
            <>
              <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b bg-muted/30 flex items-center justify-between">
                <span>{filtered.length} risultat{filtered.length === 1 ? "o" : "i"}</span>
                <span className="hidden sm:inline">↑↓ naviga · ⏎ seleziona</span>
              </div>
              <ScrollArea className="max-h-[200px]">
                <div>
                  {filtered.slice(0, 20).map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-2.5 transition-colors text-sm border-b border-border/50 last:border-0",
                        i === highlightedIndex && "bg-accent",
                        c.id === selectedCustomerId && "bg-primary/5",
                        i !== highlightedIndex && "hover:bg-accent/50"
                      )}
                      onClick={() => handleSelect(c)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                          c.id === selectedCustomerId
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {c.id === selectedCustomerId 
                            ? <Check className="h-3.5 w-3.5" />
                            : (c.company_name || c.name).charAt(0).toUpperCase()
                          }
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-sm">
                            {highlightMatch(c.company_name || c.name)}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            {c.company_name && <span className="truncate">{highlightMatch(c.name)}</span>}
                            {c.tax_id && (
                              <>
                                {c.company_name && <span>·</span>}
                                <span className="font-mono">{highlightMatch(c.tax_id)}</span>
                              </>
                            )}
                            {c.city && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" />{c.city}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {(c.incomplete_registry || !c.tax_id) ? (
                          <Badge variant="outline" className="text-[9px] shrink-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Incompleto
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{c.code}</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
              {filtered.length > 20 && (
                <div className="px-3 py-1.5 text-[11px] text-center text-muted-foreground border-t bg-muted/30">
                  +{filtered.length - 20} risultati — affina la ricerca
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Create Customer Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="h-4 w-4 text-primary" />
              </div>
              Nuovo Cliente
            </DialogTitle>
            <DialogDescription>
              Crea un nuovo soggetto economico. Potrai completare l'anagrafica in seguito.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nome / Referente <span className="text-destructive">*</span></Label>
              <Input
                value={newCustomer.name}
                onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                placeholder="Mario Rossi"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Ragione Sociale</Label>
              <Input
                value={newCustomer.company_name}
                onChange={e => setNewCustomer(p => ({ ...p, company_name: e.target.value }))}
                placeholder="Rossi S.r.l."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                <Input
                  type="email"
                  value={newCustomer.email}
                  onChange={e => setNewCustomer(p => ({ ...p, email: e.target.value }))}
                  placeholder="email@esempio.it"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Telefono</Label>
                <Input
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+39..."
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">P.IVA / Codice Fiscale</Label>
              <Input
                value={newCustomer.tax_id}
                onChange={e => setNewCustomer(p => ({ ...p, tax_id: e.target.value }))}
                placeholder="IT01234567890"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              Annulla
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newCustomer.name.trim()}>
              {creating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
              Crea Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
