import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatEuro } from "@/lib/accounting-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ExternalLink,
  FileCheck,
  FileText,
  Link as LinkIcon,
  Lock,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";

export type InvoiceRegistry = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: "vendita" | "acquisto" | "nota_credito";
  subject_type: "cliente" | "fornitore";
  subject_name: string;
  imponibile: number;
  iva_amount: number;
  total_amount: number;
  vat_regime: string;
  status: string;
  financial_status: string;
  prima_nota_id: string | null;
  scadenza_id: string | null;
  attachment_url?: string | null;
};

type Group = { label: string; invoices: InvoiceRegistry[] };

type Props = {
  invoices: InvoiceRegistry[];
  isLoading: boolean;
  grouped?: Array<[string, Group]> | null;
  groupBy: string;
  onOpenDetails: (invoice: InvoiceRegistry) => void;
  onEdit: (invoice: InvoiceRegistry) => void;
  onRegister: (invoice: InvoiceRegistry) => void;
  onDelete: (invoice: InvoiceRegistry) => void;
  onRegenerate: (invoice: InvoiceRegistry) => void;
  onPayment?: (invoice: InvoiceRegistry) => void;
  isRegenerating: boolean;
  onGoScadenziario: () => void;
};

export function InvoiceRegistryTable({
  invoices,
  isLoading,
  grouped,
  groupBy,
  onOpenDetails,
  onEdit,
  onRegister,
  onDelete,
  onRegenerate,
  isRegenerating,
  onGoScadenziario,
}: Props) {
  return (
    <Card>
      <CardContent className="p-0 overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Soggetto</TableHead>
              <TableHead className="text-right">Importi</TableHead>
              <TableHead>Stati</TableHead>
              <TableHead className="text-right w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">Caricamento...</TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nessun documento trovato
                </TableCell>
              </TableRow>
            ) : groupBy !== "none" && grouped ? (
              grouped.map(([key, group]) => (
                <React.Fragment key={key}>
                  <GroupHeaderRow group={group} />
                  {group.invoices.map((invoice) => (
                    <InvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      onOpenDetails={onOpenDetails}
                      onEdit={onEdit}
                      onRegister={onRegister}
                      onDelete={onDelete}
                      onRegenerate={onRegenerate}
                      isRegenerating={isRegenerating}
                      onGoScadenziario={onGoScadenziario}
                    />
                  ))}
                </React.Fragment>
              ))
            ) : (
              invoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onOpenDetails={onOpenDetails}
                  onEdit={onEdit}
                  onRegister={onRegister}
                  onDelete={onDelete}
                  onRegenerate={onRegenerate}
                  isRegenerating={isRegenerating}
                  onGoScadenziario={onGoScadenziario}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GroupHeaderRow({ group }: { group: Group }) {
  const totImponibile = group.invoices.reduce((s, i) => s + i.imponibile, 0);
  const totIva = group.invoices.reduce((s, i) => s + i.iva_amount, 0);
  const totSigned = group.invoices.reduce(
    (s, i) => s + (i.invoice_type === "acquisto" ? -i.total_amount : i.total_amount),
    0
  );

  return (
    <TableRow className="bg-muted/30 border-t-2 border-t-border">
      <TableCell colSpan={2} className="py-2.5">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-semibold text-sm capitalize">{group.label}</span>
          <span className="text-xs text-muted-foreground">({group.invoices.length})</span>
        </div>
      </TableCell>
      <TableCell className="text-right py-2.5">
        <div className="text-xs text-muted-foreground">Imponibile: {formatEuro(totImponibile)}</div>
        <div className="text-xs text-muted-foreground">IVA: {formatEuro(totIva)}</div>
        <div className="text-sm font-semibold">
          Totale: {totSigned >= 0 ? "+" : ""}{formatEuro(totSigned, { absolute: false })}
        </div>
      </TableCell>
      <TableCell colSpan={2} />
    </TableRow>
  );
}

function InvoiceRow({
  invoice,
  onOpenDetails,
  onEdit,
  onRegister,
  onDelete,
  onRegenerate,
  isRegenerating,
  onGoScadenziario,
}: {
  invoice: InvoiceRegistry;
  onOpenDetails: (invoice: InvoiceRegistry) => void;
  onEdit: (invoice: InvoiceRegistry) => void;
  onRegister: (invoice: InvoiceRegistry) => void;
  onDelete: (invoice: InvoiceRegistry) => void;
  onRegenerate: (invoice: InvoiceRegistry) => void;
  isRegenerating: boolean;
  onGoScadenziario: () => void;
}) {
  const canOpen = true;

  return (
    <TableRow
      className={canOpen ? "cursor-pointer hover:bg-muted/50" : ""}
      onClick={() => onOpenDetails(invoice)}
    >
      <TableCell>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {invoice.invoice_type === "vendita" ? (
              <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ArrowDownLeft className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-medium">{invoice.invoice_number}</span>
              {typeBadge(invoice.invoice_type)}
              {invoice.attachment_url && (
                <Badge variant="outline" className="text-xs">Allegato</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(invoice.invoice_date), "dd/MM/yyyy", { locale: it })} • {vatRegimeLabel(invoice.vat_regime)}
            </div>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="min-w-0">
          <p className="font-medium truncate">{invoice.subject_name}</p>
          <p className="text-xs text-muted-foreground capitalize">{invoice.subject_type}</p>
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="font-semibold">{formatEuro(invoice.total_amount)}</div>
        <div className="text-xs text-muted-foreground">
          Imp: {formatEuro(invoice.imponibile)} • IVA: {formatEuro(invoice.iva_amount)}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex flex-wrap gap-2">
          {registryStatusBadge(invoice.status)}
          {financialStatusBadge(invoice.financial_status)}
        </div>
      </TableCell>

      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenDetails(invoice)}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Apri dettagli
            </DropdownMenuItem>

            {invoice.scadenza_id && (
              <DropdownMenuItem onClick={onGoScadenziario}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Vai a Scadenziario
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {/* Modifica: disponibile per tutti tranne rettificato e periodo chiuso */}
            {invoice.status !== "rettificato" && (
              <DropdownMenuItem onClick={() => onEdit(invoice)}>
                <Pencil className="h-4 w-4 mr-2" />
                Modifica
              </DropdownMenuItem>
            )}

            {invoice.status === "bozza" && (
              <>
                <DropdownMenuItem onClick={() => onRegister(invoice)}>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Registra
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(invoice)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </DropdownMenuItem>
              </>
            )}

            {invoice.status === "da_riclassificare" && (
              <DropdownMenuItem onClick={() => onRegenerate(invoice)} disabled={isRegenerating}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Rigenera Prima Nota
              </DropdownMenuItem>
            )}

            {invoice.status === "rettificato" && (
              <DropdownMenuItem disabled>
                <Lock className="h-4 w-4 mr-2" />
                Evento bloccato
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function typeBadge(type: InvoiceRegistry["invoice_type"]) {
  if (type === "nota_credito") return <Badge variant="secondary" className="text-xs">Nota credito</Badge>;
  if (type === "nota_debito" as any) return <Badge variant="secondary" className="text-xs">Nota debito</Badge>;
  return <Badge variant="outline" className="text-xs">{type === "vendita" ? "Vendita" : "Acquisto"}</Badge>;
}

function registryStatusBadge(status: string) {
  const effective = status === "registrata" ? "contabilizzato" : status;
  const map: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string; icon: React.ReactNode }> = {
    bozza: { variant: "secondary", label: "Bozza", icon: <FileText className="h-3 w-3" /> },
    da_classificare: { variant: "outline", label: "Da annotare", icon: <FileText className="h-3 w-3" /> },
    da_riclassificare: { variant: "secondary", label: "Da riclass.", icon: <RefreshCw className="h-3 w-3" /> },
    contabilizzato: { variant: "default", label: "Contabilizzato", icon: <FileCheck className="h-3 w-3" /> },
    rettificato: { variant: "destructive", label: "Bloccato", icon: <Lock className="h-3 w-3" /> },
    archiviato: { variant: "outline", label: "Archiviato", icon: <FileText className="h-3 w-3" /> },
  };
  const cfg = map[effective];
  if (!cfg) return <Badge variant="outline" className="text-xs">{status}</Badge>;
  return (
    <Badge variant={cfg.variant} className="gap-1 text-xs">
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function financialStatusBadge(status: string) {
  const map: Record<string, { variant: "default" | "secondary" | "outline"; label: string }> = {
    da_incassare: { variant: "secondary", label: "Da incassare" },
    da_pagare: { variant: "secondary", label: "Da pagare" },
    incassata: { variant: "default", label: "Incassata" },
    pagata: { variant: "default", label: "Pagata" },
  };
  const cfg = map[status];
  if (!cfg) return <Badge variant="outline" className="text-xs">{status}</Badge>;
  return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
}

function vatRegimeLabel(regime: string) {
  switch (regime) {
    case "domestica_imponibile": return "Ordinario (22%)";
    case "ue_non_imponibile": return "Intra UE (0%)";
    case "extra_ue": return "Extra UE";
    case "reverse_charge": return "Reverse Charge (0%)";
    default: return regime;
  }
}
