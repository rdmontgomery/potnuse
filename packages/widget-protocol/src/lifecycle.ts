import { z } from 'zod';

export const WidgetLifecycleStateSchema = z.enum([
  'loading',
  'ready',
  'active',
  'suspended',
  'unloaded',
]);

export type WidgetLifecycleState = z.infer<typeof WidgetLifecycleStateSchema>;

export const VALID_TRANSITIONS: Record<WidgetLifecycleState, WidgetLifecycleState[]> = {
  loading: ['ready', 'unloaded'],
  ready: ['active', 'unloaded'],
  active: ['suspended', 'unloaded'],
  suspended: ['active', 'unloaded'],
  unloaded: [],
};
