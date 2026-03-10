import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (searchTerm) chips.push({ key: "q", label: `Ricerca: ${searchTerm}`, onClear: () => onSearchTermChange("") });
  if (filterType !== "all") chips.push({ key: "type", label: `Tipo: ${labelType(filterType)}`, onClear: () => onFilterTypeChange("all") });
  if (filterStatus !== "all") chips.push({ key: "status", label: `Stato: ${labelStatus(filterStatus)}`, onClear: () => onFilterStatusChange("all") });
  if (groupBy !== "month") chips.push({ key: "group", label: `Raggruppa: ${labelGroupBy(groupBy)}`, onClear: () => onGroupByChange("month") });

  return (
    <Card className="sticky top-3 z-10">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Cerca per numero fattura o soggetto…"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          <div className="grid grid-cols-2 lg:flex gap-2">
            <Select value={filterType} onValueChange={onFilterTypeChange}>
              <SelectTrigger className="h-10 w-full lg:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="vendita">Vendita</SelectItem>
                <SelectItem value="acquisto">Acquisto</SelectItem>
                <SelectItem value="da_classificare">Da Annotare</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={onFilterStatusChange}>
              <SelectTrigger className="h-10 w-full lg:w-[220px]">
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
              <SelectTrigger className="h-10 w-full lg:w-[180px]">
                <Calendar className="h-4 w-4 mr-2" />
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

            <Button
              variant={hasActiveFilters ? "outline" : "ghost"}
              className="h-10 col-span-2 lg:col-span-1"
              disabled={!hasActiveFilters}
              onClick={onClearFilters}
            >
              <X className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Active chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={c.onClear}
                className="inline-flex"
                title="Rimuovi filtro"
              >
                <Badge variant="outline" className="gap-1">
                  {c.label}
                  <X className="h-3 w-3" />
                </Badge>
              </button>
            ))}
          </div>
        )}

        {/* Quick status shortcuts */}
        <div className="flex flex-wrap gap-2">
          <QuickFilterButton active={filterStatus === "all"} onClick={() => onFilterStatusChange("all")}>Tutti</QuickFilterButton>
          <QuickFilterButton active={filterStatus === "bozza"} onClick={() => onFilterStatusChange("bozza")}>Bozze</QuickFilterButton>
          <QuickFilterButton active={filterStatus === "contabilizzato"} onClick={() => onFilterStatusChange("contabilizzato")}>Contabilizzati</QuickFilterButton>
          <QuickFilterButton active={filterStatus === "stornati"} onClick={() => onFilterStatusChange("stornati")}>Stornati</QuickFilterButton>
          <QuickFilterButton active={filterStatus === "rettificato"} onClick={() => onFilterStatusChange("rettificato")}>Bloccati</QuickFilterButton>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickFilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} className="h-8" onClick={onClick}>
      {children}
    </Button>
  );
}

function labelType(v: string) {
  const map: Record<string, string> = {
    vendita: "Vendita",
    acquisto: "Acquisto",
    da_classificare: "Da Annotare",
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
