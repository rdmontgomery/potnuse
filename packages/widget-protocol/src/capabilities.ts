import { z } from 'zod';

export const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const CapabilitySchema = z.string().regex(
  CAPABILITY_PATTERN,
  'capability must be domain.verb (lowercase, dot-separated)'
);

export type KnownCapability =
  | 'fs.read'
  | 'fs.write'
  | 'fs.watch'
  | 'pty.spawn'
  | 'pty.attach'
  | 'llm.complete'
  | 'clipboard.read'
  | 'clipboard.write'
  | 'notifications.notify'
  | 'os.globalHotkey'
  | 'os.openWith'
  | 'os.dragIn';

export type Capability = KnownCapability | (string & {});
