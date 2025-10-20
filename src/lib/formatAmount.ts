/**
 * Format and optionally hide monetary amounts
 */
export function formatAmount(
  amount: number | string | null | undefined,
  hideAmount: boolean = false,
  currency: string = '€'
): string {
  if (amount === null || amount === undefined) {
    return hideAmount ? '•••' : `${currency} 0,00`;
  }

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    return hideAmount ? '•••' : `${currency} 0,00`;
  }

  if (hideAmount) {
    return '•••';
  }

  return `${currency} ${numAmount.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/**
 * Mask any monetary amount in a text string
 */
export function maskAmountsInText(text: string, hideAmounts: boolean = false): string {
  if (!hideAmounts) {
    return text;
  }

  // Regex per trovare € seguito da numeri (con possibili punti e virgole)
  const amountRegex = /€\s*[\d.,]+/g;
  
  return text.replace(amountRegex, '€ •••');
}
