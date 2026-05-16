import { useMemo } from 'react';
import { freshModuleFiveCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module5Prompts() {
  const seeds = useMemo(() => freshModuleFiveCards(), []);
  return (
    <div className="m5-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
