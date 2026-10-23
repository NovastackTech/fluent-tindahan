const pesoNumberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatPeso(amount: number): string {
  const formattedAmount = pesoNumberFormatter.format(Math.abs(amount));
  const negativeSign = amount < 0 && formattedAmount !== '0.00' ? '-' : '';
  return `${negativeSign}₱${formattedAmount}`;
}

/**
 * Formats a margin percentage to 1 decimal place.
 * If cost > 0 and margin is strictly less than 100% but would round up to 100.0%,
 * displays '~99.9%' so it does not falsely appear as 100.0% zero-cost margin (issue #120).
 */
export function formatMarginPercent(marginPct: number, cost = 0): string {
  if (cost > 0 && marginPct < 100 && marginPct >= 99.95) {
    return '~99.9%';
  }
  return `${marginPct.toFixed(1)}%`;
}

