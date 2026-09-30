import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BondInputs, CalculationResult } from '@/features/bond-core/types';
import type { SingleBondCalculationEnvelope } from '@/features/bond-core/types/scenarios';

import { buildSingleBondReportPdf } from './pdf-utils';

describe('single bond PDF report', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('embeds a Polish-capable font and paginates long committed notes', async () => {
    const font = readFileSync(join(process.cwd(), 'public/fonts/Geist-Regular.ttf.base64'), 'utf8');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(font, { status: 200 })),
    );
    const inputs = {
      bondType: 'EDO',
      purchaseDate: '2026-09-01',
      withdrawalDate: '2036-09-01',
      expectedInflation: 3,
      expectedNbpRate: 5,
      taxStrategy: 'STANDARD',
      customInflation: Array.from({ length: 10 }, () => 3),
    } as BondInputs;
    const result = {
      initialInvestment: 1000,
      netPayoutValue: 990,
      totalProfit: -10,
      totalTax: 0,
      finalRealValue: 900,
      realAnnualizedReturn: -1,
      calculationNotes: ['Zażółć gęślą jaźń. '.repeat(700)],
    } as unknown as CalculationResult;
    const envelope = {
      calculationVersion: 'historical-model-v7',
      taxRulesRevision: 'tax-2026',
      dataFreshness: {
        status: 'fallback',
        usedFallback: true,
        bondOfferSource: 'gov.pl',
        coverageAsOf: '2026-09-01',
      },
      offerTerms: {
        source: 'series',
        seriesCode: 'EDO0936',
        termsRevision: 'terms-2026-09',
        termsAreVerified: true,
      },
      assumptions: [],
      warnings: [],
      calculationNotes: [],
      dataQualityFlags: [],
      result,
    } as SingleBondCalculationEnvelope;

    const pdf = await buildSingleBondReportPdf(result, inputs, 'pl', envelope);
    expect(pdf.getFontList().Geist).toContain('normal');
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(10_000);
    expect(pdf.output()).toContain('historical-model-v7');

    // Read the binary with an independent PDF parser. Font registration and
    // raw PDF bytes alone cannot prove Unicode text survives export.
    const loadingTask = getDocument({
      data: new Uint8Array(pdf.output('arraybuffer')),
      disableFontFace: true,
      useSystemFonts: true,
    });
    const document = await loadingTask.promise;
    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    const extracted = pageTexts.join(' ');
    expect(extracted).toContain('Zażółć gęślą jaźń');
    expect(extracted).toContain('historical-model-v7');
    expect(extracted).toContain('tax-2026');
    expect(extracted).toContain('EDO0936');
    expect(extracted).toContain('terms-2026-09');
    expect(extracted).toContain('dane zapasowe');
    expect(extracted).toMatch(/[−-]10[,.]00/);
    await loadingTask.destroy();
  });

  it('paginates a legacy rate path longer than a single report page', async () => {
    const font = readFileSync(join(process.cwd(), 'public/fonts/Geist-Regular.ttf.base64'), 'utf8');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(font, { status: 200 })),
    );
    const inputs = {
      bondType: 'EDO',
      purchaseDate: '2026-09-01',
      withdrawalDate: '2036-09-01',
      expectedInflation: 3,
      taxStrategy: 'STANDARD',
      customInflation: Array.from({ length: 1000 }, (_, index) => index / 10),
    } as BondInputs;
    const result = {
      initialInvestment: 1000,
      netPayoutValue: 990,
      totalProfit: -10,
      totalTax: 0,
      finalRealValue: 900,
      realAnnualizedReturn: -1,
      calculationNotes: [],
    } as unknown as CalculationResult;

    const pdf = await buildSingleBondReportPdf(result, inputs, 'pl');
    expect(pdf.getNumberOfPages()).toBeGreaterThan(2);
  });
});
