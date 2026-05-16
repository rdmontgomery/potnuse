import { useMemo } from 'react';
import { freshModuleElevenCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module11Prompts() {
  const seeds = useMemo(() => freshModuleElevenCards(), []);
  return (
    <div className="m-prompts m11-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
