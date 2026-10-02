import type { KeyboardEvent } from 'react';

/** Enter is a calculation shortcut only while editing a simple value field. */
export function isCalculatorInputEnter(event: KeyboardEvent): boolean {
  if (
    event.key !== 'Enter' ||
    event.defaultPrevented ||
    event.nativeEvent.isComposing ||
    event.repeat
  ) {
    return false;
  }
  const target = event.target;
  return (
    target instanceof HTMLInputElement &&
    (target.type === 'text' || target.type === 'number') &&
    !target.closest('[role="dialog"]')
  );
}
