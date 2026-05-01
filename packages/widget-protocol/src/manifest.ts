import { z } from 'zod';
import { CapabilitySchema } from './capabilities.js';

const WidgetIdSchema = z.string().regex(
  /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/,
  'widget id must be reverse-DNS-style: domain.namespace.name'
);

const SemverSchema = z.string().regex(
  /^\d+\.\d+\.\d+(-[\w.-]+)?$/,
  'must be semver'
);

const SandboxFlagSchema = z.string().regex(
  /^allow-[a-z][a-z-]*$/,
  'sandbox flag must be a "allow-*" token'
);

export const WidgetManifestSchema = z.object({
  id: WidgetIdSchema,
  version: SemverSchema,
  kind: z.enum(['iframe', 'native']),
  entry: z.string(),
  capabilities: z.array(CapabilitySchema).default([]),
  sandbox: z.array(SandboxFlagSchema).optional(),
  defaultSize: z.object({
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  protocolVersion: z.literal(1).default(1),
}).refine(
  (m) => m.kind !== 'iframe' || /^https?:\/\//.test(m.entry),
  { message: 'iframe entry must be an http(s) URL', path: ['entry'] }
);

export type WidgetManifest = z.infer<typeof WidgetManifestSchema>;
