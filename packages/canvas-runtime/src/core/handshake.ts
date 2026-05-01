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
  const targetOrigin = new URL(manifest.entry).origin;
  iframe.contentWindow!.postMessage(
    {
      rdm: 'init',
      protocolVersion: 1,
      instanceId,
      manifestId: manifest.id,
    },
    targetOrigin,
    [channel.port2],
  );
  return { canvasPort: channel.port1 };
}
