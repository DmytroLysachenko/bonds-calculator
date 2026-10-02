import { z } from 'zod';

import { BondType } from '@/features/bond-core/types';
import { IsoCalendarDateSchema } from '@/features/bond-core/types/iso-calendar-date';

const ImportedBondQuantitySchema = z.union([z.string(), z.number()]).refine(
  // Database numerics are exported as strings such as "100.00". Accept
  // that lossless representation, but never fractional bond quantities.
  (value) =>
    /^\d+(?:\.0+)?$/.test(String(value)) && Number(value) > 0 && Number(value) <= 10_000_000,
);

const ImportedLotSchema = z
  .object({
    bondType: z.enum(BondType),
    purchaseDate: IsoCalendarDateSchema,
    bondQuantity: ImportedBondQuantitySchema.optional(),
    amount: ImportedBondQuantitySchema.optional(),
    bondSeriesId: z.uuid().optional().nullable(),
    seriesCode: z.string().trim().min(3).max(32).optional(),
    // Export-only database relation. It is decoded for compatibility and
    // intentionally discarded: imports resolve the public series identity.
    bondTypeId: z.uuid().optional().nullable(),
    isRebought: z.boolean().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict()
  .refine((lot) => lot.bondQuantity !== undefined || lot.amount !== undefined, {
    message: 'bondQuantity is required',
    path: ['bondQuantity'],
  })
  .transform((input) => ({
    bondType: input.bondType,
    purchaseDate: input.purchaseDate,
    bondSeriesId: input.bondSeriesId,
    seriesCode: input.seriesCode,
    isRebought: input.isRebought,
    notes: input.notes ?? undefined,
    bondQuantity: input.bondQuantity ?? input.amount!,
  }));

export const ImportPayloadSchema = z
  .object({
    version: z.literal('2.0').optional(),
    packageType: z.enum(['portfolio-export', 'portfolio-package']).optional(),
    exportedAt: z.string().datetime().optional(),
    appVersion: z.string().min(1).max(120).optional(),
    // Projection metadata is informative only and is never restored as a
    // balance. It remains accepted so an exported package is importable.
    assumptions: z.record(z.string(), z.unknown()).optional(),
    summary: z.unknown().optional(),
    portfolio: z
      .object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(2_000).nullable().optional(),
        id: z.uuid().optional(),
        lots: z.array(ImportedLotSchema).max(500),
      })
      .strict()
      .transform((portfolio) => ({
        name: portfolio.name,
        description: portfolio.description ?? undefined,
        lots: portfolio.lots,
      })),
  })
  .strict()
  .transform((packageData) => ({
    version: packageData.version,
    packageType: packageData.packageType,
    exportedAt: packageData.exportedAt,
    appVersion: packageData.appVersion,
    portfolio: packageData.portfolio,
  }))
  .superRefine(({ portfolio }, context) => {
    const seen = new Set<string>();
    portfolio.lots.forEach((lot, index) => {
      const key = `${lot.bondType}:${lot.purchaseDate}:${lot.bondQuantity}`;
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['portfolio', 'lots', index],
          message: 'Duplicate import lots are not allowed.',
        });
      }
      seen.add(key);
    });
  });
