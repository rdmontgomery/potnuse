// packages/canvas-runtime/src/core/dispatch.ts
import type { Request, WidgetManifest } from '@rdm/widget-protocol';

export type CapabilityCtx = {
  instanceId: string;
  manifestId: string;
  signal: AbortSignal;
  log: (level: 'info' | 'warn' | 'error', msg: string, meta?: unknown) => void;
};

export type CapabilityHandler =
  (params: unknown, ctx: CapabilityCtx) => Promise<unknown>;

export type Provider = Record<string, CapabilityHandler>;

export type DispatchOk = { ok: true; result: unknown };
export type DispatchErr = { ok: false; error: { code: string; message: string; data?: unknown } };
export type DispatchResult = DispatchOk | DispatchErr;

function isDeclared(method: string, declared: readonly string[]): boolean {
  return declared.some(
    (cap) => cap === method || method.startsWith(cap + '.')
  );
}

export async function dispatch(
  req: Request,
  manifest: WidgetManifest,
  providers: ReadonlyMap<string, Provider>,
  defaultTimeoutMs: number,
  ctx: CapabilityCtx,
): Promise<DispatchResult> {
  if (!isDeclared(req.method, manifest.capabilities)) {
    return {
      ok: false,
      error: {
        code: 'capability/denied',
        message: `manifest ${manifest.id} did not declare capability ${req.method}`,
      },
    };
  }

  const dotIdx = req.method.indexOf('.');
  const domain = dotIdx === -1 ? req.method : req.method.slice(0, dotIdx);
  const methodName = dotIdx === -1 ? '' : req.method.slice(dotIdx + 1);

  const provider = providers.get(domain);
  if (!provider) {
    return {
      ok: false,
      error: {
        code: 'capability/unavailable',
        message: `no provider registered for domain ${domain}`,
      },
    };
  }

  const handler = provider[methodName];
  if (typeof handler !== 'function') {
    return {
      ok: false,
      error: {
        code: 'method/unknown',
        message: `provider ${domain} has no method ${methodName}`,
      },
    };
  }

  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('__rdm_timeout__'));
        }
      }, defaultTimeoutMs);

      handler(req.params, ctx).then(
        (r) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(r);
          }
        },
        (e) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(e);
          }
        },
      );
    });
    return { ok: true, result };
  } catch (e: unknown) {
    if (e instanceof Error && e.message === '__rdm_timeout__') {
      return {
        ok: false,
        error: {
          code: 'provider/timeout',
          message: `handler ${req.method} exceeded ${defaultTimeoutMs}ms`,
        },
      };
    }
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: { code: 'provider/error', message },
    };
  }
}
