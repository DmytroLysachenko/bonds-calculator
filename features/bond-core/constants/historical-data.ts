export interface MonthlyReturn {
  date: string; // YYYY-MM
  sp500: number; // % change
  gold: number; // % change
  savings: number; // % change
  inflation: number; // % change
  /** Explicit unit; GUS YoY CPI cannot be replayed as a monthly price change. */
  inflationKind?: 'month_on_month' | 'year_over_year';
  nbpRate: number; // % annual
}

// Simulated representative historical data (averages based on 2010-2024 trends)
// This will be replaced by API/DB data later.
export const HISTORICAL_RETURNS: MonthlyReturn[] = [
  // 2020: Volatile year
  { date: '2020-01', sp500: -0.16, gold: 3.9, savings: 0.1, inflation: 0.9, nbpRate: 1.5 },
  { date: '2020-02', sp500: -8.41, gold: -0.2, savings: 0.1, inflation: 0.7, nbpRate: 1.5 },
  { date: '2020-03', sp500: -12.51, gold: 1.6, savings: 0.1, inflation: 0.2, nbpRate: 1.0 },
  { date: '2020-04', sp500: 12.68, gold: 6.9, savings: 0.05, inflation: 0.0, nbpRate: 0.5 },
  { date: '2020-05', sp500: 4.53, gold: 2.6, savings: 0.05, inflation: 0.3, nbpRate: 0.1 },
  { date: '2020-06', sp500: 1.84, gold: 2.9, savings: 0.05, inflation: 0.6, nbpRate: 0.1 },
  { date: '2020-07', sp500: 5.51, gold: 10.9, savings: 0.05, inflation: -0.2, nbpRate: 0.1 },
  { date: '2020-08', sp500: 7.01, gold: -0.4, savings: 0.05, inflation: -0.1, nbpRate: 0.1 },
  { date: '2020-09', sp500: -3.92, gold: -4.2, savings: 0.05, inflation: 0.2, nbpRate: 0.1 },
  { date: '2020-10', sp500: -2.77, gold: -0.4, savings: 0.05, inflation: 0.1, nbpRate: 0.1 },
  { date: '2020-11', sp500: 10.75, gold: -5.4, savings: 0.05, inflation: 0.1, nbpRate: 0.1 },
  { date: '2020-12', sp500: 3.71, gold: 6.8, savings: 0.05, inflation: 0.1, nbpRate: 0.1 },
  // 2021: Bull year
  { date: '2021-01', sp500: -1.11, gold: -2.7, savings: 0.05, inflation: 1.3, nbpRate: 0.1 },
  { date: '2021-02', sp500: 2.61, gold: -6.1, savings: 0.05, inflation: 0.5, nbpRate: 0.1 },
  { date: '2021-03', sp500: 4.24, gold: -0.8, savings: 0.05, inflation: 1.0, nbpRate: 0.1 },
  { date: '2021-04', sp500: 5.24, gold: 3.6, savings: 0.05, inflation: 0.8, nbpRate: 0.1 },
  { date: '2021-05', sp500: 0.55, gold: 7.7, savings: 0.05, inflation: 0.3, nbpRate: 0.1 },
  { date: '2021-06', sp500: 2.22, gold: -7.2, savings: 0.05, inflation: 0.1, nbpRate: 0.1 },
  { date: '2021-07', sp500: 2.27, gold: 3.3, savings: 0.05, inflation: 0.4, nbpRate: 0.1 },
  { date: '2021-08', sp500: 2.9, gold: -0.6, savings: 0.05, inflation: 0.3, nbpRate: 0.1 },
  { date: '2021-09', sp500: -4.76, gold: -3.4, savings: 0.05, inflation: 0.7, nbpRate: 0.1 },
  { date: '2021-10', sp500: 6.91, gold: 1.5, savings: 0.1, inflation: 1.1, nbpRate: 0.5 },
  { date: '2021-11', sp500: -0.83, gold: -0.5, savings: 0.1, inflation: 1.0, nbpRate: 1.25 },
  { date: '2021-12', sp500: 4.36, gold: 3.1, savings: 0.1, inflation: 0.9, nbpRate: 1.75 },
  // 2022: Inflation and Bear year
  { date: '2022-01', sp500: -5.26, gold: -1.8, savings: 0.1, inflation: 1.9, nbpRate: 2.25 },
  { date: '2022-02', sp500: -3.14, gold: 6.2, savings: 0.1, inflation: -0.3, nbpRate: 2.75 },
  { date: '2022-03', sp500: 3.58, gold: 1.5, savings: 0.15, inflation: 3.3, nbpRate: 3.5 },
  { date: '2022-04', sp500: -8.8, gold: -2.1, savings: 0.2, inflation: 2.0, nbpRate: 4.5 },
  { date: '2022-05', sp500: 0.01, gold: -3.1, savings: 0.25, inflation: 1.7, nbpRate: 5.25 },
  { date: '2022-06', sp500: -8.39, gold: -2.2, savings: 0.3, inflation: 1.5, nbpRate: 6.0 },
  { date: '2022-07', sp500: 9.11, gold: -3.5, savings: 0.3, inflation: 0.5, nbpRate: 6.5 },
  { date: '2022-08', sp500: -4.24, gold: -3.1, savings: 0.3, inflation: 0.8, nbpRate: 6.5 },
  { date: '2022-09', sp500: -9.34, gold: -3.0, savings: 0.3, inflation: 1.6, nbpRate: 6.75 },
  { date: '2022-10', sp500: 7.99, gold: -1.6, savings: 0.3, inflation: 1.8, nbpRate: 6.75 },
  { date: '2022-11', sp500: 5.38, gold: 8.3, savings: 0.3, inflation: 0.7, nbpRate: 6.75 },
  { date: '2022-12', sp500: -5.9, gold: 3.1, savings: 0.3, inflation: 0.1, nbpRate: 6.75 },
  // 2023: Recovery Year
  { date: '2023-01', sp500: 6.18, gold: 5.7, savings: 0.35, inflation: 2.5, nbpRate: 6.75 },
  { date: '2023-02', sp500: -2.61, gold: -5.2, savings: 0.35, inflation: 1.2, nbpRate: 6.75 },
  { date: '2023-03', sp500: 3.51, gold: 7.7, savings: 0.35, inflation: 1.1, nbpRate: 6.75 },
  { date: '2023-04', sp500: 1.46, gold: 1.1, savings: 0.35, inflation: 0.7, nbpRate: 6.75 },
  { date: '2023-05', sp500: 0.25, gold: -1.3, savings: 0.35, inflation: 0.0, nbpRate: 6.75 },
  { date: '2023-06', sp500: 6.47, gold: -2.2, savings: 0.35, inflation: 0.0, nbpRate: 6.75 },
  { date: '2023-07', sp500: 3.11, gold: 2.4, savings: 0.3, inflation: -0.2, nbpRate: 6.75 },
  { date: '2023-08', sp500: -1.77, gold: 1.3, savings: 0.3, inflation: 0.0, nbpRate: 6.75 },
  { date: '2023-09', sp500: -4.87, gold: -4.7, savings: 0.3, inflation: -0.4, nbpRate: 6.0 },
  { date: '2023-10', sp500: -2.2, gold: 7.3, savings: 0.25, inflation: 0.3, nbpRate: 5.75 },
  { date: '2023-11', sp500: 8.92, gold: 2.1, savings: 0.25, inflation: 0.7, nbpRate: 5.75 },
  { date: '2023-12', sp500: 4.42, gold: 1.3, savings: 0.25, inflation: 0.1, nbpRate: 5.75 },
  // 2024: New Highs
  { date: '2024-01', sp500: 1.59, gold: -1.1, savings: 0.25, inflation: 0.4, nbpRate: 5.75 },
  { date: '2024-02', sp500: 5.17, gold: 0.2, savings: 0.25, inflation: 0.3, nbpRate: 5.75 },
  { date: '2024-03', sp500: 3.1, gold: 9.1, savings: 0.25, inflation: 0.2, nbpRate: 5.75 },
  { date: '2024-04', sp500: -4.16, gold: 2.5, savings: 0.25, inflation: 1.1, nbpRate: 5.75 },
  { date: '2024-05', sp500: 4.8, gold: 1.8, savings: 0.25, inflation: 0.1, nbpRate: 5.75 },
  { date: '2024-06', sp500: 3.47, gold: -0.1, savings: 0.25, inflation: 0.1, nbpRate: 5.75 },
].map((row) => ({ ...row, inflationKind: 'month_on_month' as const }));
