'use client';

import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollHint,
} from '@/components/ui/table';
import { BondDefinition } from '@/features/bond-core/constants/bond-definitions';
import { BondType } from '@/features/bond-core/types';
import { ConfirmActionDialog } from '@/shared/components/feedback/ConfirmActionDialog';
import { FormInlineNotice } from '@/shared/components/forms/FormInlineNotice';
import { SegmentedControl } from '@/shared/components/forms/SegmentedControl';
import { bondSeriesClient, BondSeriesMetadata } from '@/shared/lib/bond-series-client';
import { downloadFile } from '@/shared/lib/csv-utils';
import { formatIsoDate } from '@/shared/lib/financial-formatters';
import { formatBondDuration } from '@/shared/lib/format-bond-duration';
import { buildMaturityIcs, estimateSettlementDate } from '@/shared/lib/maturity-planner';
import { CreatePortfolioLotInput } from '@/shared/lib/portfolio-client';
import { UserInvestmentLot } from '@/shared/types/portfolio';
import { UserPortfolio } from '@/shared/types/portfolio';

export type PortfolioMaturityItem = UserInvestmentLot & {
  maturityDate: Date;
  value: number;
};

type MaturityWindowDays = 30 | 90 | 180;
type LotMutationInput = Omit<CreatePortfolioLotInput, 'portfolioId'> & {
  portfolioId?: string;
  notes?: string;
};

interface PortfolioLotsTableSectionProps {
  isLoading: boolean;
  lots: UserInvestmentLot[];
  definitions: Record<BondType, BondDefinition>;
  language: 'en' | 'pl';
  formatCurrency: (value: number) => string;
  t: (key: string, values?: Record<string, string>) => string;
  onCreateLot: (input: LotMutationInput) => Promise<unknown>;
  onUpdateLot: (lotId: string, input: LotMutationInput) => Promise<unknown>;
  onDeleteLot: (lotId: string) => Promise<unknown>;
  portfolios: UserPortfolio[];
}

interface PortfolioLiquidityPanelProps {
  definitions: Record<BondType, BondDefinition>;
  language: 'en' | 'pl';
  formatCurrency: (value: number) => string;
  maturityWindowDays: MaturityWindowDays;
  onWindowChange: (value: MaturityWindowDays) => void;
  filteredMaturities: PortfolioMaturityItem[];
  upcomingCashflow: number;
  maturityWindowLabel: string;
  t: (key: string, values?: Record<string, string>) => string;
}

const maturityWindowOptions = [30, 90, 180] as const;

export function PortfolioLotsTableSection({
  isLoading,
  lots,
  definitions,
  language,
  formatCurrency,
  t,
  onCreateLot,
  onUpdateLot,
  onDeleteLot,
  portfolios,
}: PortfolioLotsTableSectionProps) {
  const [editing, setEditing] = useState<UserInvestmentLot | 'new' | null>(null);
  const [lotPendingDelete, setLotPendingDelete] = useState<UserInvestmentLot | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const submitLot = async (input: LotMutationInput) => {
    setIsMutating(true);
    try {
      if (editing === 'new') await onCreateLot(input);
      else if (editing) await onUpdateLot(editing.id, input);
      setEditing(null);
    } finally {
      setIsMutating(false);
    }
  };
  return (
    <section className="space-y-5 border-t border-border py-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="ui-section-title">{t('notebook.stored_lots_title')}</h2>
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="mr-1 h-4 w-4" />
            {t('notebook.add_lot')}
          </Button>
        </div>
        <p className="ui-body text-muted-foreground">{t('notebook.stored_lots_desc')}</p>
      </div>
      {editing ? (
        <LotEditorDialog
          lot={editing === 'new' ? null : editing}
          definitions={definitions}
          portfolios={portfolios}
          onCancel={() => setEditing(null)}
          onSubmit={submitLot}
          isMutating={isMutating}
          t={t}
        />
      ) : null}
      <div>
        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('notebook.updating')}
          </div>
        ) : lots.length === 0 ? (
          <div className="border-t border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t('notebook.no_lots')}</p>
          </div>
        ) : (
          <div className="border-y border-border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-border py-3 text-sm text-muted-foreground">
              <p>{t('notebook.stored_lots_hint')}</p>
              <p className="text-sm font-semibold text-muted-foreground">
                {t('notebook.lots_count', { count: String(lots.length) })}
              </p>
            </div>
            <div className="grid gap-px border-b border-border bg-border lg:hidden">
              {lots.map((lot) => (
                <article key={`mobile-${lot.id}`} className="space-y-4 bg-background p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-foreground">{lot.bondType}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatBondDuration(
                          definitions[lot.bondType as BondType]?.duration ?? 1,
                          language,
                        )}
                      </p>
                    </div>
                    <Button variant="outline" size="icon" className="min-h-11 min-w-11" asChild>
                      <a
                        href={`/single-calculator?bondType=${lot.bondType}&purchaseDate=${lot.purchaseDate}`}
                        aria-label={t('notebook.open_lot_calculator', {
                          bondType: lot.bondType,
                        })}
                      >
                        <ExternalLink aria-hidden="true" className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-11 min-w-11"
                      onClick={() => setEditing(lot)}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="min-h-11 min-w-11"
                      onClick={() => setLotPendingDelete(lot)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t('notebook.column_amount')}</dt>
                      <dd className="financial-number mt-1 font-semibold text-foreground">
                        {lot.bondQuantity}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">
                        {t('notebook.column_nominal_value')}
                      </dt>
                      <dd className="financial-number mt-1 font-semibold text-foreground">
                        {formatCurrency(Number(lot.bondQuantity) * 100)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">
                        {t('notebook.column_purchase_date')}
                      </dt>
                      <dd className="mt-1 font-medium text-foreground">
                        {formatIsoDate(lot.purchaseDate, language)}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <TableScrollHint>{t('notebook.stored_lots_hint')}</TableScrollHint>
              <Table
                className="w-full table-fixed text-sm tabular-nums"
                aria-label={t('notebook.stored_lots_hint')}
              >
                <TableCaption>{t('notebook.stored_lots_hint')}</TableCaption>
                <TableHeader>
                  <TableRow className="h-12 hover:bg-transparent">
                    <TableHead
                      scope="col"
                      className="sticky top-0 z-10 h-12 w-[14%] bg-background text-sm font-semibold text-muted-foreground"
                    >
                      {t('notebook.column_type')}
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="sticky top-0 z-10 h-12 w-[22%] bg-background text-sm font-semibold text-muted-foreground"
                    >
                      {t('notebook.column_duration')}
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="sticky top-0 z-10 h-12 w-[14%] bg-background text-right text-sm font-semibold text-muted-foreground"
                    >
                      {t('notebook.column_amount')}
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="sticky top-0 z-10 h-12 w-[18%] bg-background text-sm font-semibold text-muted-foreground"
                    >
                      {t('notebook.column_purchase_date')}
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="sticky top-0 z-10 h-12 w-[20%] bg-background text-right text-sm font-semibold text-muted-foreground"
                    >
                      {t('notebook.column_nominal_value')}
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="sticky top-0 z-10 h-12 w-[12%] bg-background text-right text-sm font-semibold text-muted-foreground"
                    >
                      {t('notebook.column_action')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow
                      key={lot.id}
                      className="h-14 border-b border-border transition-colors hover:bg-muted/25"
                    >
                      <TableCell className="py-4 font-medium">{lot.bondType}</TableCell>
                      <TableCell className="py-4 text-muted-foreground">
                        {formatBondDuration(
                          definitions[lot.bondType as BondType]?.duration ?? 1,
                          language,
                        )}
                      </TableCell>
                      <TableCell className="financial-number py-4 text-right">
                        {lot.bondQuantity}
                      </TableCell>
                      <TableCell className="py-4">
                        {formatIsoDate(lot.purchaseDate, language)}
                      </TableCell>
                      <TableCell className="financial-number py-4 text-right font-semibold">
                        {formatCurrency(Number(lot.bondQuantity) * 100)}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <Button variant="outline" size="icon" className="min-h-11 min-w-11" asChild>
                          <a
                            href={`/single-calculator?bondType=${lot.bondType}&purchaseDate=${lot.purchaseDate}`}
                            aria-label={t('notebook.open_lot_calculator', {
                              bondType: lot.bondType,
                            })}
                          >
                            <ExternalLink aria-hidden="true" className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common.edit')}
                          onClick={() => setEditing(lot)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t('common.delete')}
                          onClick={() => setLotPendingDelete(lot)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
      <ConfirmActionDialog
        open={Boolean(lotPendingDelete)}
        title={t('notebook.delete_lot')}
        description={t('notebook.confirm_delete_lot')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setLotPendingDelete(null)}
        onConfirm={async () => {
          if (lotPendingDelete) await onDeleteLot(lotPendingDelete.id);
          setLotPendingDelete(null);
        }}
      />
    </section>
  );
}

function LotEditorDialog({
  lot,
  definitions,
  portfolios,
  onCancel,
  onSubmit,
  isMutating,
  t,
}: {
  lot: UserInvestmentLot | null;
  definitions: Record<BondType, BondDefinition>;
  portfolios: UserPortfolio[];
  onCancel: () => void;
  onSubmit: (input: LotMutationInput) => Promise<void>;
  isMutating: boolean;
  t: PortfolioLotsTableSectionProps['t'];
}) {
  const [bondType, setBondType] = useState<BondType>(
    (lot?.bondType as BondType) ?? (Object.keys(definitions)[0] as BondType),
  );
  const [purchaseDate, setPurchaseDate] = useState(
    lot?.purchaseDate ?? new Date().toISOString().slice(0, 10),
  );
  const [bondQuantity, setBondQuantity] = useState(lot?.bondQuantity ?? '1');
  const [notes, setNotes] = useState(lot?.notes ?? '');
  const [targetPortfolioId, setTargetPortfolioId] = useState(
    lot?.portfolioId ?? portfolios[0]?.id ?? '',
  );
  const [series, setSeries] = useState<BondSeriesMetadata[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(lot?.bondSeriesId ?? '');
  const [seriesError, setSeriesError] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    setSeries([]);
    setSelectedSeriesId(lot?.bondType === bondType ? (lot.bondSeriesId ?? '') : '');
    setSeriesError(false);
    void bondSeriesClient
      .listBySymbol(bondType)
      .then((nextSeries) => {
        if (active) setSeries(nextSeries);
      })
      .catch(() => {
        if (active) setSeriesError(true);
      });
    return () => {
      active = false;
    };
  }, [bondType, lot?.bondSeriesId, lot?.bondType]);

  return (
    <Dialog.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-border bg-background p-5 shadow-lg"
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit({
                portfolioId: targetPortfolioId,
                bondType,
                purchaseDate,
                bondQuantity: Number(bondQuantity),
                selectedSeriesId: selectedSeriesId || null,
                isRebought: lot?.isRebought ?? false,
                notes,
              });
            }}
          >
            <div>
              <Dialog.Title className="ui-card-title">
                {lot ? t('notebook.edit_lot') : t('notebook.add_lot')}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t('notebook.lot_editor_desc')}
              </Dialog.Description>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">
                {t('notebook.column_type')}
                <select
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2"
                  value={bondType}
                  onChange={(event) => setBondType(event.target.value as BondType)}
                >
                  {Object.keys(definitions).map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t('notebook.column_amount')}
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2"
                  value={bondQuantity}
                  onChange={(event) => setBondQuantity(event.target.value)}
                />
              </label>
              <label className="text-sm">
                {t('notebook.column_purchase_date')}
                <input
                  required
                  type="date"
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
              </label>
              <label className="text-sm">
                {t('notebook.series')}
                <select
                  className="mt-1 h-9 w-full rounded border border-input bg-background px-2"
                  value={selectedSeriesId}
                  onChange={(event) => setSelectedSeriesId(event.target.value)}
                >
                  <option value="">{t('notebook.current_offer')}</option>
                  {series.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.seriesCode}
                    </option>
                  ))}
                </select>
                {seriesError ? (
                  <span className="mt-1 block text-xs text-warning">
                    {t('notebook.series_load_error')}
                  </span>
                ) : null}
              </label>
              {lot ? (
                <label className="text-sm md:col-span-2">
                  {t('notebook.move_to_portfolio')}
                  <select
                    className="mt-1 h-9 w-full rounded border border-input bg-background px-2"
                    value={targetPortfolioId}
                    onChange={(event) => setTargetPortfolioId(event.target.value)}
                  >
                    {portfolios.map((portfolio) => (
                      <option key={portfolio.id} value={portfolio.id}>
                        {portfolio.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-sm md:col-span-2">
                {t('notebook.notes')}
                <textarea
                  className="mt-1 min-h-20 w-full rounded border border-input bg-background px-2 py-1"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={2000}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isMutating}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PortfolioLiquidityPanel({
  definitions,
  language,
  formatCurrency,
  maturityWindowDays,
  onWindowChange,
  filteredMaturities,
  upcomingCashflow,
  maturityWindowLabel,
  t,
}: PortfolioLiquidityPanelProps) {
  const exportCalendar = () =>
    downloadFile(
      buildMaturityIcs(
        filteredMaturities.map((item) => ({
          id: `maturity-${item.id}`,
          date: item.maturityDate.toISOString().slice(0, 10),
          title: `${item.bondType} maturity`,
          description: `Principal scheduled at maturity: ${item.value.toFixed(2)} PLN. This is a planning event, not a redemption instruction.`,
        })),
      ),
      'bond-maturities.ics',
      'text/calendar;charset=utf-8',
    );
  return (
    <div className="space-y-6">
      <section className="space-y-4 border-t border-border py-5">
        <div className="space-y-2">
          <h2 className="ui-section-title">{t('notebook.liquidity_window_title')}</h2>
          <p className="ui-body text-muted-foreground">{t('notebook.liquidity_window_desc')}</p>
        </div>
        <SegmentedControl
          value={String(maturityWindowDays)}
          options={maturityWindowOptions.map((days) => ({
            value: String(days),
            label: `${days}d`,
          }))}
          onValueChange={(days) => onWindowChange(Number(days) as MaturityWindowDays)}
          className="grid-cols-3"
        />

        <div className="border-y border-border py-4">
          <p className="text-sm font-semibold text-muted-foreground">
            {t('notebook.cash_in_window')}
          </p>
          <p className="financial-number mt-2 text-2xl font-semibold text-foreground">
            {formatCurrency(upcomingCashflow)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{maturityWindowLabel}</p>
        </div>

        {filteredMaturities.length === 0 ? (
          <FormInlineNotice description={t('notebook.no_maturities_in_window')} />
        ) : (
          <div className="space-y-3">
            {filteredMaturities.slice(0, 6).map((item) => (
              <div key={item.id} className="border-t border-border py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{item.bondType}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatIsoDate(item.maturityDate.toISOString().slice(0, 10), language)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      {formatBondDuration(
                        definitions[item.bondType as BondType]?.duration ?? 1,
                        language,
                      )}
                    </p>
                  </div>
                  <p className="financial-number font-semibold text-foreground">
                    {formatCurrency(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {filteredMaturities.length ? (
          <Button type="button" variant="outline" onClick={exportCalendar}>
            Export local calendar (.ics)
          </Button>
        ) : null}
      </section>

      {filteredMaturities[0] ? (
        <section
          className="space-y-2 border-t border-border py-5"
          aria-labelledby="exit-planner-title"
        >
          <h2 id="exit-planner-title" className="ui-card-title">
            Early-exit planning
          </h2>
          <p className="text-sm text-muted-foreground">
            Read-only estimate for {filteredMaturities[0].bondType}; it does not submit an
            instruction.
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt>Principal</dt>
            <dd className="text-right">{formatCurrency(filteredMaturities[0].value)}</dd>
            <dt>Estimated settlement</dt>
            <dd className="text-right">
              {estimateSettlementDate(new Date().toISOString().slice(0, 10))}
            </dd>
            <dt>Interest / fee / tax</dt>
            <dd className="text-right">Calculated only in the scenario engine</dd>
          </dl>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-border py-5">
        <h2 className="ui-card-title">{t('notebook.usage_note_title')}</h2>
        <div className="text-sm leading-6 text-muted-foreground">
          {t('notebook.usage_note_desc')}
        </div>
      </section>
    </div>
  );
}
