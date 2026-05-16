import { useMemo } from 'react';
import { freshModuleFourCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module4Prompts() {
  const seeds = useMemo(() => freshModuleFourCards(), []);
  return (
    <div className="m4-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
