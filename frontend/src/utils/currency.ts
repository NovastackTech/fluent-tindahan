const pesoNumberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatPeso(amount: number): string {
  const formattedAmount = pesoNumberFormatter.format(Math.abs(amount));
  return `${amount < 0 ? '-' : ''}₱${formattedAmount}`;
}
