export function TimelineStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border px-1 py-2.5 md:border-b-0 md:px-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function MobileValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-border px-1 py-2 first:border-t-0">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
