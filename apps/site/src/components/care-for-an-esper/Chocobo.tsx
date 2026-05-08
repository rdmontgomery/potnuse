import { DialogueBox } from './DialogueBox';

// Ambient chocobo. She's just there — no feed gate, no skip button.
// Prototype for the wandering-sprite layer that will replace the
// removed click-through mechanics: presence, not interaction.
export function Chocobo() {
  return (
    <div className="cfe-chocobo">
      <DialogueBox body="⌒(•ㅅ•)⌒    *kweh.*" maxCols={48} />
    </div>
  );
}
