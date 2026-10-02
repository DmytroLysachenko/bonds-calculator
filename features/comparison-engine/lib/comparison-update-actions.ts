import { BondType } from '@/features/bond-core/types';

import {
  isComparisonMacroConfigKey,
  type ScenarioOverride,
  type SharedComparisonConfig,
  updateScenarioBondType,
  updateSharedComparisonConfig,
} from './comparison-calculator-state';
import {
  setScenarioCustomHorizonMonths,
  toggleScenarioCustomHorizon,
} from './comparison-scenario-state';

export function applySharedComparisonConfigUpdate<K extends keyof SharedComparisonConfig>(
  previous: SharedComparisonConfig,
  key: K,
  value: SharedComparisonConfig[K],
) {
  return updateSharedComparisonConfig(previous, key, value);
}

export function isSharedComparisonMacroUpdate(key: keyof SharedComparisonConfig) {
  return isComparisonMacroConfigKey(key);
}

export function applyScenarioOverrideUpdate<K extends keyof ScenarioOverride>(
  previous: ScenarioOverride,
  key: K,
  value: ScenarioOverride[K],
) {
  return { ...previous, [key]: value };
}

export function applyScenarioBondTypeUpdate(previous: ScenarioOverride, type: BondType) {
  return updateScenarioBondType(previous, type);
}

export function applyScenarioCustomHorizonEnabled(
  sharedConfig: SharedComparisonConfig,
  previous: ScenarioOverride,
  enabled: boolean,
) {
  return toggleScenarioCustomHorizon(sharedConfig, previous, enabled);
}

export function applyScenarioCustomHorizonMonths(
  sharedConfig: SharedComparisonConfig,
  previous: ScenarioOverride,
  value: number | undefined,
) {
  return setScenarioCustomHorizonMonths(sharedConfig, previous, value);
}
