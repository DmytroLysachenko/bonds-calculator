'use client';

import { ChevronDown, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { BondInputs } from '@/features/bond-core/types';
import { useAppI18n } from '@/i18n/client';
import { useDateFormatter, useNumberFormatter } from '@/shared/hooks/useLocalizedFormatters';
import { downloadJsonFile } from '@/shared/lib/csv-utils';
import {
  createSingleScenarioPackage,
  isSinglePortableScenario,
  parseScenarioPackage,
  serializeScenarioPackage,
} from '@/shared/lib/scenario-codec';

import {
  createSavedScenario,
  deleteSavedScenario,
  duplicateSavedScenario,
  getSavedScenarioLoadReport,
  MAX_SCENARIOS,
  SavedScenarioRecord,
  saveScenarioRecord,
  ScenarioCapacityError,
  updateSavedScenario,
} from '../lib/scenario-storage';

type SavedScenarioLibraryProps = {
  isDirty: boolean;
  onRestore: (inputs: BondInputs) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};

const previewDateOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'medium',
};

export function SavedScenarioLibrary({ isDirty, onRestore, t }: SavedScenarioLibraryProps) {
  const { locale } = useAppI18n();
  const dateFormatter = useDateFormatter(locale, previewDateOptions);
  const numberFormatter = useNumberFormatter(locale);
  const [records, setRecords] = useState<SavedScenarioRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SavedScenarioRecord | null>(null);
  const [pendingRestore, setPendingRestore] = useState<SavedScenarioRecord | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SavedScenarioRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    const report = getSavedScenarioLoadReport();
    setRecords(report.records);
    setNotice(
      report.unsupportedCount
        ? t('bonds.saved_library.unsupported', { count: report.unsupportedCount })
        : null,
    );
  }, [t]);

  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'obligacje.saved-single-scenarios.v1') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const visibleRecords = records.filter((record) => {
    const needle = query.trim().toLocaleLowerCase();
    return (
      !needle ||
      [record.name, record.description, ...record.tags].join(' ').toLowerCase().includes(needle)
    );
  });
  const scenarioMetadata = (record: SavedScenarioRecord, position: number) =>
    `#${position} · ${record.inputs.bondType} · ${numberFormatter.format(record.inputs.initialInvestment)} PLN · ${record.inputs.investmentHorizonMonths ?? Math.round(record.inputs.duration * 12)} ${t('common.month_compact')} · ${dateFormatter.format(new Date(record.updatedAt))}`;
  const restore = (record: SavedScenarioRecord) => {
    if (isDirty) {
      setIsOpen(true);
      setPendingRestore(record);
      return;
    }
    onRestore(record.inputs);
    setIsOpen(false);
  };
  const mutate = (operation: () => void) => {
    try {
      operation();
      refresh();
    } catch (error) {
      setNotice(
        error instanceof ScenarioCapacityError
          ? t('bonds.saved_library.capacity', { count: MAX_SCENARIOS })
          : t('bonds.saved_library.storage_error'),
      );
    }
  };

  return (
    <section className="border-y border-border py-4" aria-labelledby="saved-scenarios-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="saved-scenarios-title"
            tabIndex={-1}
            className="text-sm font-semibold text-foreground"
          >
            {t('bonds.saved_library.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('bonds.saved_library.description')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-expanded={isOpen}
            aria-controls="saved-scenario-library-content"
            onClick={() => {
              if (!isOpen) refresh();
              setIsOpen((open) => !open);
            }}
          >
            {isOpen ? t('common.show_less') : t('common.show_all', { count: records.length })}
            <ChevronDown
              className={`ml-2 h-4 w-4 ${isOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </Button>
          <span className="text-xs text-muted-foreground">
            {records.length}/{MAX_SCENARIOS}
          </span>
        </div>
      </div>
      {!isOpen && records.length > 0 ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {records.slice(0, 2).map((record, index) => (
            <div
              key={record.id}
              className="flex min-w-0 items-center justify-between gap-3 border-t border-border py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{record.name}</p>
                <p className="text-base leading-6 text-muted-foreground">
                  {scenarioMetadata(record, index + 1)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => restore(record)}>
                {t('bonds.saved_library.restore')}
              </Button>
            </div>
          ))}
        </div>
      ) : null}
      {!isOpen && records.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t('bonds.saved_library.empty')}</p>
      ) : null}
      {notice ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      <div id="saved-scenario-library-content" className="mt-4" hidden={!isOpen}>
        <div className="flex items-center justify-end gap-2">
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file
                .text()
                .then((text) => {
                  const decoded = parseScenarioPackage(text);
                  if (!decoded.ok) {
                    setNotice(t('bonds.saved_library.import_error'));
                    return;
                  }
                  const scenario = decoded.scenario;
                  if (!isSinglePortableScenario(scenario)) {
                    setNotice(t('bonds.saved_library.import_error'));
                    return;
                  }
                  mutate(() => saveScenarioRecord(createSavedScenario(scenario.intent)));
                })
                .catch(() => setNotice(t('bonds.saved_library.import_error')))
                .finally(() => {
                  event.target.value = '';
                });
            }}
          />
          <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            {t('bonds.saved_library.import')}
          </Button>
        </div>
        <label className="mt-4 block text-sm font-medium" htmlFor="saved-scenario-search">
          {t('bonds.saved_library.search')}
        </label>
        <input
          id="saved-scenario-search"
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {pendingRestore ? (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
            <p>{t('bonds.saved_library.restore_dirty', { name: pendingRestore.name })}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onRestore(pendingRestore.inputs);
                  setPendingRestore(null);
                  setIsOpen(false);
                }}
              >
                {t('bonds.saved_library.restore_confirm')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingRestore(null)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-2">
          {visibleRecords.map((record, index) => (
            <article key={record.id} className="rounded-md border border-border p-3">
              {editing?.id === record.id ? (
                <ScenarioEditor
                  record={editing}
                  onCancel={() => setEditing(null)}
                  onSave={(update) =>
                    mutate(() => {
                      updateSavedScenario(record.id, update);
                      setEditing(null);
                    })
                  }
                  t={t}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{record.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{record.description}</p>
                      <p className="mt-1 text-base leading-6 text-muted-foreground">
                        {scenarioMetadata(record, index + 1)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {record.tags.join(' · ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => restore(record)}>
                        {t('bonds.saved_library.restore')}
                      </Button>
                      <details className="relative">
                        <summary className="ui-focus-ring cursor-pointer rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
                          {t('bonds.saved_library.more_actions')}
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-2 rounded-md border border-border bg-card p-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditing(record)}>
                            {t('bonds.saved_library.edit')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => mutate(() => duplicateSavedScenario(record.id))}
                          >
                            {t('bonds.saved_library.duplicate')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              downloadJsonFile(
                                JSON.parse(
                                  serializeScenarioPackage(
                                    createSingleScenarioPackage(record.inputs),
                                  ),
                                ),
                                `${record.name.replace(/\s+/g, '-').toLowerCase()}.scenario.json`,
                              )
                            }
                          >
                            {t('bonds.saved_library.export')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPendingDelete(record)}
                          >
                            {t('bonds.saved_library.delete')}
                          </Button>
                        </div>
                      </details>
                    </div>
                  </div>
                  {pendingDelete?.id === record.id ? (
                    <div
                      className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 p-3"
                      role="group"
                      aria-label={t('bonds.saved_library.delete_confirm_title')}
                    >
                      <p className="text-base">
                        {t('bonds.saved_library.delete_confirm', { name: record.name })}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            mutate(() => deleteSavedScenario(record.id));
                            setPendingDelete(null);
                          }}
                        >
                          {t('bonds.saved_library.delete')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPendingDelete(null)}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          ))}
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('bonds.saved_library.empty')}</p>
          ) : null}
        </div>
        <p className="mt-3 text-base leading-6 text-muted-foreground">
          {t('bonds.saved_library.local_only')}
        </p>
      </div>
    </section>
  );
}

function ScenarioEditor({
  record,
  onCancel,
  onSave,
  t,
}: {
  record: SavedScenarioRecord;
  onCancel: () => void;
  onSave: (update: { name: string; description: string; tags: string[] }) => void;
  t: SavedScenarioLibraryProps['t'];
}) {
  const [name, setName] = useState(record.name);
  const [description, setDescription] = useState(record.description);
  const [tags, setTags] = useState(record.tags.join(', '));
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          name: name.trim(),
          description: description.trim(),
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        });
      }}
      className="space-y-2"
    >
      <label className="block text-xs font-medium">
        {t('bonds.saved_library.name')}
        <input
          className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="block text-xs font-medium">
        {t('bonds.saved_library.notes')}
        <input
          className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-sm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="block text-xs font-medium">
        {t('bonds.saved_library.tags')}
        <input
          className="mt-1 h-8 w-full rounded border border-input bg-background px-2 text-sm"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button size="sm" type="submit">
          {t('common.save')}
        </Button>
        <Button size="sm" type="button" variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
}
