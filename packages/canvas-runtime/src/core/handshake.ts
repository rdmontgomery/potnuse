// packages/canvas-runtime/src/core/handshake.ts
import type { WidgetManifest } from '@rdm/widget-protocol';

export type HandshakeArgs = {
  iframe: HTMLIFrameElement;
  manifest: WidgetManifest;
  instanceId: string;
};

export type HandshakeResult = {
  canvasPort: MessagePort;
};

export async function runHandshake(args: HandshakeArgs): Promise<HandshakeResult> {
  const { iframe, manifest, instanceId } = args;
  const channel = new MessageChannel();
  // targetOrigin is '*' rather than new URL(manifest.entry).origin because
  // sandboxed iframes (without allow-same-origin) run at a null/opaque origin
  // that doesn't match the entry URL's origin — strict targetOrigin causes
  // the message to be silently dropped. This is safe: we hold the iframe
  // contentWindow reference and post synchronously after onLoad, so no other
  // window can intercept the transferred MessagePort.
  iframe.contentWindow!.postMessage(
    {
      rdm: 'init',
      protocolVersion: 1,
      instanceId,
      manifestId: manifest.id,
    },
    '*',
    [channel.port2],
  );
  return { canvasPort: channel.port1 };
}
