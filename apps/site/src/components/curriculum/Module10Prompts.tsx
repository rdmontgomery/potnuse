import { useMemo } from 'react';
import { freshModuleTenCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module10Prompts() {
  const seeds = useMemo(() => freshModuleTenCards(), []);
  return (
    <div className="m-prompts m10-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
