// packages/canvas-runtime/src/core/lifecycle.ts
import { VALID_TRANSITIONS, type WidgetLifecycleState } from '@rdm/widget-protocol';

export function canTransition(
  from: WidgetLifecycleState,
  to: WidgetLifecycleState,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: WidgetLifecycleState,
  to: WidgetLifecycleState,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`illegal lifecycle transition: ${from} -> ${to}`);
  }
}
