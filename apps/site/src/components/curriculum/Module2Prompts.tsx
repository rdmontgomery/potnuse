import { useMemo } from 'react';
import { freshModuleTwoCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module2Prompts() {
  const seeds = useMemo(() => freshModuleTwoCards(), []);
  return (
    <div className="m-prompts m2-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
