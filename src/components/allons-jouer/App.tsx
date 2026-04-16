import { useAppStore } from '@/lib/allons-jouer/useAppStore';
import { HomeScreen } from '@/components/allons-jouer/HomeScreen';
import { FreePlayScreen } from '@/components/allons-jouer/FreePlayScreen';
import { LessonScreen } from '@/components/allons-jouer/LessonScreen';
import { ReferenceScreen } from '@/components/allons-jouer/ReferenceScreen';
import { TunerScreen } from '@/components/allons-jouer/TunerScreen';
import { K, FONTS } from '@/lib/allons-jouer/tokens';

export default function App() {
  const screen = useAppStore(s => s.screen);

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(170deg, ${K.bg} 0%, #0f0b04 100%)`,
      color: K.text, fontFamily: FONTS.serif,
      margin: 0, padding: 0, overflowX: 'hidden', userSelect: 'none',
    }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        @keyframes targetPulse { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes noteHit { 0%{transform:scale(1.08);opacity:.6} 100%{transform:scale(1);opacity:0} }
        @keyframes timingPop { 0%{transform:scale(0.8);opacity:0} 50%{transform:scale(1.1);opacity:1} 100%{transform:scale(1);opacity:0} }
      `}</style>

      {screen === 'home'       && <HomeScreen />}
      {screen === 'freeplay'   && <FreePlayScreen />}
      {screen === 'lesson'    && <LessonScreen />}
      {screen === 'reference' && <ReferenceScreen />}
      {screen === 'tuner'     && <TunerScreen />}
    </div>
  );
}
