import { useMemo } from 'react';
import { freshModuleOneCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module1Prompts() {
  const seeds = useMemo(() => freshModuleOneCards(), []);
  return (
    <div className="m-prompts m1-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
