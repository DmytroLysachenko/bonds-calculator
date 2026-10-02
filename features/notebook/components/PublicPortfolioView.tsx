/** Public metadata only. Lot disclosure requires a separate product decision. */
export function PublicPortfolioView({
  portfolio,
}: {
  portfolio: { name: string; description: string | null };
}) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{portfolio.name}</h1>
      {portfolio.description && <p className="text-muted-foreground">{portfolio.description}</p>}
    </section>
  );
}
