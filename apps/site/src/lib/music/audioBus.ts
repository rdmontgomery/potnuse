// Cross-module audio coordinator. Each module that produces audio
// registers a stopper before playing; starting new audio takes over the
// bus and cancels every other registered stopper. The result: only one
// module's audio runs at a time, with no silent collisions when the
// listener scrolls from Module 1's drone into Module 4's progression.
//
// React state stays in sync via an optional onStopped callback —
// modules pass () => setPlaying(false) and get notified when something
// else preempts them, so their UI reflects reality.
//
// Tab visibility: when the page hides, every active source stops.
// Tone.js wouldn't pause on its own, and a backgrounded curriculum
// page running an eight-oscillator drone is not a feature.

type Stopper = () => void;

interface Handle {
  stop: () => void;
}

const active = new Map<symbol, Handle>();

function runStop(handle: Handle): void {
  try {
    handle.stop();
  } catch (err) {
    console.error('audioBus stop failed', err);
  }
}

// Register a stopper. Returns a deregister fn for the caller to invoke
// on its own clean shutdown (play-complete, component unmount).
export function register(
  stopper: Stopper,
  onStopped?: () => void,
): () => void {
  const token = Symbol();
  const handle: Handle = {
    stop: () => {
      stopper();
      onStopped?.();
    },
  };
  active.set(token, handle);
  return () => {
    active.delete(token);
  };
}

// Stop every active source. Used by the visibility-change listener
// below and exposed for callers who want a global panic button.
export function stopAll(): void {
  const handles = Array.from(active.values());
  active.clear();
  for (const h of handles) runStop(h);
}

// Stop everything else, then register a new source. The right entry
// point for any module's play function — guarantees exclusivity.
export function takeOver(
  stopper: Stopper,
  onStopped?: () => void,
): () => void {
  stopAll();
  return register(stopper, onStopped);
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAll();
  });
}
