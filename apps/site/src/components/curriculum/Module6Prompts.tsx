import { useMemo } from 'react';
import { freshModuleSixCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module6Prompts() {
  const seeds = useMemo(() => freshModuleSixCards(), []);
  return (
    <div className="m-prompts m6-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
