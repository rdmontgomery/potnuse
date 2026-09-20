import { useMemo } from 'react';
import { freshModuleEightCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module8Prompts() {
  const seeds = useMemo(() => freshModuleEightCards(), []);
  return (
    <div className="m-prompts m8-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
