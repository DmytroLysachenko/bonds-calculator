const colorClasses: Record<string, { background: string; border: string }> = {
  '#2563eb': { background: 'bg-blue-600', border: 'border-blue-600' },
  '#db2777': { background: 'bg-pink-600', border: 'border-pink-600' },
  '#d97706': { background: 'bg-amber-600', border: 'border-amber-600' },
  '#64748b': { background: 'bg-slate-500', border: 'border-slate-500' },
  '#0f766e': { background: 'bg-teal-700', border: 'border-teal-700' },
  '#94a3b8': { background: 'bg-slate-400', border: 'border-slate-400' },
  '#c89d4f': { background: 'bg-[#c89d4f]', border: 'border-[#c89d4f]' },
  '#6f7782': { background: 'bg-[#6f7782]', border: 'border-[#6f7782]' },
  'var(--chart-series-primary)': { background: 'bg-primary', border: 'border-primary' },
  'var(--chart-series-real)': { background: 'bg-chart-2', border: 'border-chart-2' },
};

/** CSP-safe palette class for the finite chart palettes used by the product. */
export function chartColorClass(
  color: string | undefined,
  target: 'background' | 'border' = 'background',
) {
  return (
    colorClasses[color?.toLowerCase() ?? '']?.[target] ??
    (target === 'border' ? 'border-muted-foreground' : 'bg-muted-foreground')
  );
}
