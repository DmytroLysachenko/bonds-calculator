import { describe, expect, it } from 'vitest';

import {
  CALCULATION_DIAGNOSTIC_CODES,
  type CalculationDiagnostic,
} from '@/features/bond-core/types/scenarios';
import en from '@/i18n/translations/en.json';
import pl from '@/i18n/translations/pl.json';

import { localizeCalculationDiagnostic } from './calculation-evidence';

describe('typed calculation evidence localization', () => {
  it.each([
    ['en', en],
    ['pl', pl],
  ] as const)('%s covers every known diagnostic code', (_locale, messages) => {
    for (const code of CALCULATION_DIAGNOSTIC_CODES) {
      expect(messages.bonds.engine_messages).toHaveProperty(code);
      expect(messages.bonds.engine_messages[code]).not.toBe('');
    }
  });

  it('uses an explicit fallback for a future or restored unknown diagnostic', () => {
    const diagnostic = {
      code: 'future_code',
      severity: 'warning',
    } as unknown as CalculationDiagnostic;
    const translated = localizeCalculationDiagnostic(diagnostic, (key, params) =>
      key === 'bonds.engine_messages.unknown_diagnostic' ? `Unrecognized ${params?.code}` : key,
    );
    expect(translated).toBe('Unrecognized future_code');
  });
});
