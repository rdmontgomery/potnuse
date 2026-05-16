import { useMemo } from 'react';
import { freshModuleNineCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module9Prompts() {
  const seeds = useMemo(() => freshModuleNineCards(), []);
  return (
    <div className="m-prompts m9-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
