import { z } from 'zod';

const EnvelopeIdSchema = z.string().min(1);
const NamespacedNameSchema = z.string().regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/);

export const RequestSchema = z.object({
  type: z.literal('req'),
  id: EnvelopeIdSchema,
  method: NamespacedNameSchema,
  params: z.unknown().optional(),
});

export const ResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    type: z.literal('res'),
    id: EnvelopeIdSchema,
    outcome: z.literal('ok'),
    result: z.unknown().optional(),
  }),
  z.object({
    type: z.literal('res'),
    id: EnvelopeIdSchema,
    outcome: z.literal('err'),
    error: z.object({
      code: z.string(),
      message: z.string(),
      data: z.unknown().optional(),
    }),
  }),
]);

export const EventSchema = z.object({
  type: z.literal('event'),
  name: NamespacedNameSchema,
  payload: z.unknown().optional(),
});

export const ProtocolMessageSchema = z.discriminatedUnion('type', [
  RequestSchema,
  ResponseSchema,
  EventSchema,
]);

export type Request = z.infer<typeof RequestSchema>;
export type Response = z.infer<typeof ResponseSchema>;
export type Event = z.infer<typeof EventSchema>;
export type ProtocolMessage = z.infer<typeof ProtocolMessageSchema>;
