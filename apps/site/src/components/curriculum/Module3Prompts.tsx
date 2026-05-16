import { useMemo } from 'react';
import { freshModuleThreeCards } from '@/lib/srs/seed';
import { InlinePrompt } from './InlinePrompt';

export default function Module3Prompts() {
  const seeds = useMemo(() => freshModuleThreeCards(), []);
  return (
    <div className="m3-prompts">
      {seeds.map((seed) => (
        <InlinePrompt key={seed.id} seed={seed} />
      ))}
    </div>
  );
}
