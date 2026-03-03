/**
 * Currency utilities for multi-currency support
 */

export const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'Dollaro USA ($)' },
  { code: 'GBP', symbol: '£', label: 'Sterlina (£)' },
  { code: 'CHF', symbol: 'CHF', label: 'Franco Svizzero (CHF)' },
  { code: 'SEK', symbol: 'kr', label: 'Corona Svedese (kr)' },
  { code: 'NOK', symbol: 'kr', label: 'Corona Norvegese (kr)' },
  { code: 'DKK', symbol: 'kr', label: 'Corona Danese (kr)' },
  { code: 'PLN', symbol: 'zł', label: 'Zloty Polacco (zł)' },
  { code: 'CZK', symbol: 'Kč', label: 'Corona Ceca (Kč)' },
  { code: 'TRY', symbol: '₺', label: 'Lira Turca (₺)' },
  { code: 'AED', symbol: 'د.إ', label: 'Dirham (د.إ)' },
  { code: 'SAR', symbol: '﷼', label: 'Riyal Saudita (﷼)' },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

export function getCurrencySymbol(code: string): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === code);
  return currency?.symbol || '€';
}

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string = 'EUR',
  locale: string = 'it-IT'
): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol} ${amount.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}
