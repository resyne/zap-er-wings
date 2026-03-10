import { Badge } from "@/components/ui/badge";

// =====================================================
// IVA MODE LABELS & HELPERS
// =====================================================

export const IVA_MODE_LABELS: Record<string, string> = {
  ORDINARIO_22: "Ordinario (22%)",
  REVERSE_CHARGE: "Reverse Charge (0%)",
  INTRA_UE: "Intra UE (0%)",
  EXTRA_UE: "Extra UE",
  // Legacy mappings
  DOMESTICA_IMPONIBILE: "Ordinario (22%)",
  CESSIONE_UE_NON_IMPONIBILE: "Intra UE (0%)",
  CESSIONE_EXTRA_UE_NON_IMPONIBILE: "Extra UE",
  VENDITA_RC_EDILE: "Reverse Charge (0%)",
  ACQUISTO_RC_EDILE: "Reverse Charge (0%)",
};

export const isZeroIvaMode = (mode: string) =>
  ["REVERSE_CHARGE", "INTRA_UE", "EXTRA_UE", "CESSIONE_UE_NON_IMPONIBILE", "CESSIONE_EXTRA_UE_NON_IMPONIBILE", "VENDITA_RC_EDILE", "ACQUISTO_RC_EDILE"].includes(mode);

export const normalizeIvaMode = (mode: string | null): string => {
  if (!mode) return "ORDINARIO_22";
  const legacyMap: Record<string, string> = {
    DOMESTICA_IMPONIBILE: "ORDINARIO_22",
    CESSIONE_UE_NON_IMPONIBILE: "INTRA_UE",
    CESSIONE_EXTRA_UE_NON_IMPONIBILE: "EXTRA_UE",
    VENDITA_RC_EDILE: "REVERSE_CHARGE",
    ACQUISTO_RC_EDILE: "REVERSE_CHARGE",
  };
  return legacyMap[mode] || (IVA_MODE_LABELS[mode] ? mode : "ORDINARIO_22");
};

// =====================================================
// PAYMENT METHOD
// =====================================================

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bonifico: "Bonifico",
  banca: "Banca",
  carta: "Carta",
  american_express: "American Express",
  contanti: "Contanti",
  cassa: "Cassa",
};

export const formatPaymentMethod = (method: string | null): string => {
  if (!method) return "-";
  return PAYMENT_METHOD_LABELS[method] || method;
};

// =====================================================
// CURRENCY FORMATTING
// =====================================================

export const formatEuro = (value: number, opts?: { absolute?: boolean }) => {
  const v = opts?.absolute ? Math.abs(value) : value;
  return `€ ${v.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;
};

// =====================================================
// DOUBLE-ENTRY LINES GENERATION
// =====================================================

export function generateDoubleEntryLines(
  movementId: string,
  isRevenue: boolean,
  isPaid: boolean,
  ivaMode: string,
  ivaAliquota: number,
  imponibile: number,
  ivaAmount: number,
  totale: number,
  paymentMethod: string | null,
  chartAccountId: string | null
): any[] {
  const lines: any[] = [];
  let lineOrder = 1;

  const isOrdinary = ivaMode === "ORDINARIO_22" || ivaMode === "DOMESTICA_IMPONIBILE";

  if (isOrdinary) {
    lines.push({
      prima_nota_id: movementId, line_order: lineOrder++,
      account_type: "dynamic",
      dynamic_account_key: isPaid ? (paymentMethod?.toUpperCase() || "BANCA") : (isRevenue ? "CREDITI_CLIENTI" : "DEBITI_FORNITORI"),
      chart_account_id: null,
      dare: isRevenue ? totale : 0, avere: isRevenue ? 0 : totale,
      description: isPaid ? "Incasso/Pagamento" : (isRevenue ? "Crediti vs clienti" : "Debiti vs fornitori"),
    });
    lines.push({
      prima_nota_id: movementId, line_order: lineOrder++,
      account_type: "chart", chart_account_id: chartAccountId, dynamic_account_key: null,
      dare: isRevenue ? 0 : imponibile, avere: isRevenue ? imponibile : 0,
      description: isRevenue ? "Ricavi" : "Costi",
    });
    if (ivaAmount > 0) {
      lines.push({
        prima_nota_id: movementId, line_order: lineOrder++,
        account_type: "dynamic", dynamic_account_key: isRevenue ? "IVA_DEBITO" : "IVA_CREDITO",
        chart_account_id: null,
        dare: isRevenue ? 0 : ivaAmount, avere: isRevenue ? ivaAmount : 0,
        description: `IVA ${ivaAliquota}%`,
      });
    }
  } else if (isZeroIvaMode(ivaMode)) {
    lines.push({
      prima_nota_id: movementId, line_order: lineOrder++,
      account_type: "dynamic",
      dynamic_account_key: isPaid ? (paymentMethod?.toUpperCase() || "BANCA") : (isRevenue ? "CREDITI_CLIENTI" : "DEBITI_FORNITORI"),
      chart_account_id: null,
      dare: isRevenue ? totale : 0, avere: isRevenue ? 0 : totale,
      description: isPaid ? "Incasso/Pagamento" : (isRevenue ? "Crediti vs clienti" : "Debiti vs fornitori"),
    });
    lines.push({
      prima_nota_id: movementId, line_order: lineOrder++,
      account_type: "chart", chart_account_id: chartAccountId, dynamic_account_key: null,
      dare: isRevenue ? 0 : totale, avere: isRevenue ? totale : 0,
      description: `${isRevenue ? "Ricavi" : "Costi"} (${IVA_MODE_LABELS[ivaMode] || "Non imponibile"})`,
    });
  }

  return lines;
}
