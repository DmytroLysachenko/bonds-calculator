import { z } from 'zod';

import { BondType } from './index';
import { IsoCalendarDateSchema } from './iso-calendar-date';

export const PORTFOLIO_LIMITS = {
  descriptionLength: 2_000,
  lotAmount: 10_000_000,
  lotNotesLength: 2_000,
  nameLength: 120,
} as const;

/**
 * Money arrives as a JavaScript number on portfolio mutation routes. Keep the
 * business ceiling and minor-unit precision at the HTTP boundary so database
 * and offer-resolution work never process impossible values.
 */
const PortfolioAmountSchema = z
  .number()
  .finite()
  .positive()
  .max(PORTFOLIO_LIMITS.lotAmount)
  .refine(
    (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < Number.EPSILON * 100,
    'Amount must use at most two decimal places.',
  );

const PortfolioNameSchema = z.string().trim().min(1).max(PORTFOLIO_LIMITS.nameLength);
const PortfolioDescriptionSchema = z.string().trim().max(PORTFOLIO_LIMITS.descriptionLength);
const PortfolioNotesSchema = z.string().trim().max(PORTFOLIO_LIMITS.lotNotesLength);

export const PortfolioSchema = z
  .object({
    name: PortfolioNameSchema,
    description: PortfolioDescriptionSchema.optional(),
  })
  .strict();

export const PortfolioUpdateSchema = z
  .object({
    name: PortfolioNameSchema.optional(),
    description: PortfolioDescriptionSchema.optional(),
  })
  .strict()
  .refine((command) => Object.keys(command).length > 0, 'Update must contain at least one field.');

const PortfolioBondQuantitySchema = PortfolioAmountSchema;

const InvestmentLotFields = {
  portfolioId: z.string().uuid(),
  bondType: z.enum(BondType),
  purchaseDate: IsoCalendarDateSchema,
  bondQuantity: PortfolioBondQuantitySchema.optional(),
  /** Deprecated transport key accepted only while existing clients migrate. */
  amount: PortfolioBondQuantitySchema.optional(),
  selectedSeriesId: z.string().uuid().nullable().optional(),
  isRebought: z.boolean().default(false),
  notes: PortfolioNotesSchema.optional(),
};

/** Canonical create command for every portfolio-lot entry point. */
export const InvestmentLotSchema = z
  .object(InvestmentLotFields)
  .strict()
  .refine((command) => command.bondQuantity !== undefined || command.amount !== undefined, {
    message: 'bondQuantity is required',
    path: ['bondQuantity'],
  })
  .transform(({ amount, bondQuantity, ...command }) => ({
    ...command,
    bondQuantity: bondQuantity ?? amount!,
  }));

/** Legacy buy-transaction route cannot record a selected issued series. */
export const PortfolioLotTransactionSchema = InvestmentLotSchema.refine(
  (command) => command.selectedSeriesId === undefined,
  {
    message: 'selectedSeriesId is not supported by the buy transaction command',
    path: ['selectedSeriesId'],
  },
);

/**
 * PATCH commands intentionally omit create defaults. Supplying `{}` is not an
 * update, and an omitted `isRebought` must not overwrite an existing value.
 */
export const InvestmentLotUpdateSchema = z
  .object({
    portfolioId: InvestmentLotFields.portfolioId.optional(),
    bondType: InvestmentLotFields.bondType.optional(),
    purchaseDate: InvestmentLotFields.purchaseDate.optional(),
    bondQuantity: PortfolioBondQuantitySchema.optional(),
    amount: PortfolioBondQuantitySchema.optional(),
    selectedSeriesId: InvestmentLotFields.selectedSeriesId,
    isRebought: z.boolean().optional(),
    notes: PortfolioNotesSchema.optional(),
  })
  .strict()
  .refine((command) => Object.keys(command).length > 0, 'Update must contain at least one field.')
  .transform(({ amount, bondQuantity, ...command }) => ({
    ...command,
    ...(bondQuantity !== undefined || amount !== undefined
      ? { bondQuantity: bondQuantity ?? amount }
      : {}),
  }));
