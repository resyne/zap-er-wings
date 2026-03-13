import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Search, X } from "lucide-react";

type Props = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  groupBy: string;
  onGroupByChange: (value: string) => void;
  onClearFilters: () => void;
};

export function RegistryFiltersBar({
  searchTerm,
  onSearchTermChange,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  groupBy,
  onGroupByChange,
  onClearFilters,
}: Props) {
  const hasActiveFilters =
    !!searchTerm || filterType !== "all" || filterStatus !== "all" || groupBy !== "month";

  return (
    <div className="sticky top-3 z-10 space-y-3 rounded-xl border bg-card/95 backdrop-blur-sm p-4 shadow-sm">
      {/* Quick type filters */}
      <div className="flex flex-wrap gap-1.5">
        <QuickFilterButton active={filterType === "all"} onClick={() => onFilterTypeChange("all")}>Tutti</QuickFilterButton>
        <QuickFilterButton active={filterType === "acquisto"} onClick={() => onFilterTypeChange("acquisto")}>Fatture Acquisto</QuickFilterButton>
        <QuickFilterButton active={filterType === "vendita"} onClick={() => onFilterTypeChange("vendita")}>Fatture Vendita</QuickFilterButton>
        <QuickFilterButton active={filterType === "nota_credito"} onClick={() => onFilterTypeChange("nota_credito")}>Note di Credito</QuickFilterButton>
        <QuickFilterButton active={filterType === "nota_debito"} onClick={() => onFilterTypeChange("nota_debito")}>Note di Debito</QuickFilterButton>
      </div>

      {/* Search + filters row */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Cerca per numero fattura o soggetto…"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            className="pl-10 h-9 bg-background"
          />
        </div>

        <div className="grid grid-cols-2 lg:flex gap-2">
          <Select value={filterType} onValueChange={onFilterTypeChange}>
            <SelectTrigger className="h-9 w-full lg:w-[170px] bg-background">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              <SelectItem value="vendita">Fatture Vendita</SelectItem>
              <SelectItem value="acquisto">Fatture Acquisto</SelectItem>
              <SelectItem value="nota_credito">Note di Credito</SelectItem>
              <SelectItem value="nota_debito">Note di Debito</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="h-9 w-full lg:w-[200px] bg-background">
              <SelectValue placeholder="Stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="bozza">Bozza</SelectItem>
              <SelectItem value="contabilizzato">Contabilizzato</SelectItem>
              <SelectItem value="registrata">Registrata</SelectItem>
              <SelectItem value="stornati">Stornati / Da Riclassificare</SelectItem>
              <SelectItem value="da_riclassificare">Solo Da Riclassificare</SelectItem>
              <SelectItem value="rettificato">Rettificato (Bloccato)</SelectItem>
              <SelectItem value="archiviato">Archiviato</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={onGroupByChange}>
            <SelectTrigger className="h-9 w-full lg:w-[160px] bg-background">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Raggruppa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessun raggruppamento</SelectItem>
              <SelectItem value="day">Per giorno</SelectItem>
              <SelectItem value="week">Per settimana</SelectItem>
              <SelectItem value="month">Per mese</SelectItem>
              <SelectItem value="quarter">Per trimestre</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-foreground col-span-2 lg:col-span-1"
              onClick={onClearFilters}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {searchTerm && (
            <FilterChip label={`Ricerca: ${searchTerm}`} onClear={() => onSearchTermChange("")} />
          )}
          {filterType !== "all" && (
            <FilterChip label={`Tipo: ${labelType(filterType)}`} onClear={() => onFilterTypeChange("all")} />
          )}
          {filterStatus !== "all" && (
            <FilterChip label={`Stato: ${labelStatus(filterStatus)}`} onClear={() => onFilterStatusChange("all")} />
          )}
          {groupBy !== "month" && (
            <FilterChip label={`Raggruppa: ${labelGroupBy(groupBy)}`} onClear={() => onGroupByChange("month")} />
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button onClick={onClear} className="inline-flex" title="Rimuovi filtro">
      <Badge variant="secondary" className="gap-1 text-xs font-normal hover:bg-destructive/10 hover:text-destructive transition-colors">
        {label}
        <X className="h-3 w-3" />
      </Badge>
    </button>
  );
}

function QuickFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "ghost"}
      className={`h-7 text-xs px-3 rounded-full ${!active ? "text-muted-foreground hover:text-foreground" : ""}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function labelType(v: string) {
  const map: Record<string, string> = {
    vendita: "Fatture Vendita",
    acquisto: "Fatture Acquisto",
    nota_credito: "Note di Credito",
    nota_debito: "Note di Debito",
    all: "Tutti",
  };
  return map[v] || v;
}

function labelStatus(v: string) {
  const map: Record<string, string> = {
    bozza: "Bozza",
    registrata: "Registrata",
    contabilizzato: "Contabilizzato",
    stornati: "Stornati",
    da_riclassificare: "Da riclassificare",
    rettificato: "Rettificato",
    archiviato: "Archiviato",
    all: "Tutti",
  };
  return map[v] || v;
}

function labelGroupBy(v: string) {
  const map: Record<string, string> = {
    none: "Nessuno",
    day: "Giorno",
    week: "Settimana",
    month: "Mese",
    quarter: "Trimestre",
  };
  return map[v] || v;
}
