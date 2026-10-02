import { describe, expect, it } from 'vitest';

import { parseGusCpiCsvContent, parseGusCpiMonthlyCsvContent } from './gus-cpi';

describe('parseGusCpiCsvContent', () => {
  it('keeps only year-over-year CPI rows and converts 100-based indexes to percentages', () => {
    const csv = [
      'Nazwa zmiennej;Jednostka terytorialna;Sposob prezentacji;Rok;Miesiac;Wartosc;Flaga;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Grudzien poprzedniego roku = 100;2026;4;102,7;;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Analogiczny miesiac poprzedniego roku = 100;2026;3;103,0;;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Analogiczny miesiac poprzedniego roku = 100;2026;4;103,2;;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Poprzedni miesiac = 100;2026;4;100,6;;;;',
    ].join('\n');

    expect(parseGusCpiCsvContent(csv)).toEqual([
      { date: '2026-03-01', value: 3 },
      { date: '2026-04-01', value: 3.2 },
    ]);
  });

  it('filters to the requested range', () => {
    const csv = [
      'Nazwa zmiennej;Jednostka terytorialna;Sposob prezentacji;Rok;Miesiac;Wartosc;Flaga;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Analogiczny miesiac poprzedniego roku = 100;2026;1;102,1;;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Analogiczny miesiac poprzedniego roku = 100;2026;2;102,1;;;;',
      'Wskaznik cen towarow i uslug konsumpcyjnych;Polska;Analogiczny miesiac poprzedniego roku = 100;2026;3;103,0;;;;',
    ].join('\n');

    expect(parseGusCpiCsvContent(csv, '2026-02-01', '2026-02-28')).toEqual([
      { date: '2026-02-01', value: 2.1 },
    ]);
  });

  it('keeps month-on-month CPI separate from year-over-year observations', () => {
    const csv = [
      'Nazwa zmiennej;Jednostka terytorialna;Sposob prezentacji;Rok;Miesiac;Wartosc;Flaga;;;',
      'CPI;Polska;Analogiczny miesiac poprzedniego roku = 100;2026;4;103,2;;;;',
      'CPI;Polska;Poprzedni miesiąc = 100;2026;3;99,8;;;;',
      'CPI;Polska;Poprzedni miesiąc = 100;2026;4;100,6;;;;',
    ].join('\n');

    expect(parseGusCpiCsvContent(csv)).toEqual([{ date: '2026-04-01', value: 3.2 }]);
    expect(parseGusCpiMonthlyCsvContent(csv)).toEqual([
      { date: '2026-03-01', value: -0.2 },
      { date: '2026-04-01', value: 0.6 },
    ]);
  });

  it('pins independently checked GUS previous-month indexes for early 2026', () => {
    // Official archive: https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/wskazniki-cen-towarow-i-uslug-konsumpcyjnych-pot-inflacja-/miesieczne-wskazniki-cen-towarow-i-uslug-konsumpcyjnych-od-1982-roku/
    const csv = [
      'Nazwa zmiennej;Jednostka terytorialna;Sposob prezentacji;Rok;Miesiac;Wartosc;Flaga;;;',
      'Wskaźnik cen towarów i usług konsumpcyjnych;Polska;Poprzedni miesiąc = 100;2026;1;100,7;;;',
      'Wskaźnik cen towarów i usług konsumpcyjnych;Polska;Poprzedni miesiąc = 100;2026;2;100,3;;;',
      'Wskaźnik cen towarów i usług konsumpcyjnych;Polska;Poprzedni miesiąc = 100;2026;3;101,1;;;',
      'Wskaźnik cen towarów i usług konsumpcyjnych;Polska;Poprzedni miesiąc = 100;2026;4;100,6;;;',
    ].join('\n');
    expect(parseGusCpiMonthlyCsvContent(csv).map((point) => point.value)).toEqual([
      0.7, 0.3, 1.1, 0.6,
    ]);
  });
});
