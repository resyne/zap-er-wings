import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar, Search, X } from "lucide-react";
import { format, addMonths, subMonths, addDays, subDays } from "date-fns";
import { it } from "date-fns/locale";

type ViewMode = "month" | "day";

type Props = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
  selectedPeriod: Date;
  onSelectedPeriodChange: (value: Date) => void;
  onClearFilters: () => void;
};

export function RegistryFiltersBar({
  searchTerm,
  onSearchTermChange,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  viewMode,
  onViewModeChange,
  selectedPeriod,
  onSelectedPeriodChange,
  onClearFilters,
}: Props) {
  const hasActiveFilters =
    !!searchTerm || filterType !== "all" || filterStatus !== "all";

  const periodLabel = viewMode === "month"
    ? format(selectedPeriod, "MMMM yyyy", { locale: it })
    : format(selectedPeriod, "EEEE d MMMM yyyy", { locale: it });

  const goBack = () => {
    onSelectedPeriodChange(
      viewMode === "month" ? subMonths(selectedPeriod, 1) : subDays(selectedPeriod, 1)
    );
  };

  const goForward = () => {
    onSelectedPeriodChange(
      viewMode === "month" ? addMonths(selectedPeriod, 1) : addDays(selectedPeriod, 1)
    );
  };

  const goToday = () => {
    onSelectedPeriodChange(new Date());
  };

  return (
    <div className="sticky top-3 z-10 space-y-3 rounded-xl border bg-card/95 backdrop-blur-sm p-4 shadow-sm">
      {/* Period navigator */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <QuickFilterButton active={filterType === "all"} onClick={() => onFilterTypeChange("all")}>Tutti</QuickFilterButton>
          <QuickFilterButton active={filterType === "acquisto"} onClick={() => onFilterTypeChange("acquisto")}>Fatture Acquisto</QuickFilterButton>
          <QuickFilterButton active={filterType === "vendita"} onClick={() => onFilterTypeChange("vendita")}>Fatture Vendita</QuickFilterButton>
          <QuickFilterButton active={filterType === "nota_credito"} onClick={() => onFilterTypeChange("nota_credito")}>Note di Credito</QuickFilterButton>
          <QuickFilterButton active={filterType === "nota_debito"} onClick={() => onFilterTypeChange("nota_debito")}>Note di Debito</QuickFilterButton>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg bg-background overflow-hidden">
            <Button variant="ghost" size="sm" className={`h-8 rounded-none text-xs px-3 ${viewMode === "month" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}`} onClick={() => onViewModeChange("month")}>
              Mese
            </Button>
            <Button variant="ghost" size="sm" className={`h-8 rounded-none text-xs px-3 ${viewMode === "day" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : "text-muted-foreground"}`} onClick={() => onViewModeChange("day")}>
              Giorno
            </Button>
          </div>

          <div className="flex items-center gap-1 border rounded-lg bg-background px-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button onClick={goToday} className="px-3 h-8 text-sm font-medium capitalize hover:bg-muted rounded transition-colors min-w-[160px] text-center">
              {periodLabel}
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
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
