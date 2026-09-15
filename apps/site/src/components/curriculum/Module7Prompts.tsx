import { useMemo } from 'react';
import { freshModuleSevenCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module7Prompts() {
  const seeds = useMemo(() => freshModuleSevenCards(), []);
  return (
    <div className="m-prompts m7-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
