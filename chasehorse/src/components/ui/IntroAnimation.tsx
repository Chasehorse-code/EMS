import { useEffect, useState, useCallback } from 'react';
import { ChaseHorseLogo } from './ChaseHorseLogo';

interface IntroAnimationProps {
  onComplete?: () => void;
}

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const [phase, setPhase] = useState<'assembling' | 'pulsing' | 'gliding' | 'done'>('assembling');
  const [visible, setVisible] = useState(false);

  const skipIntro = useCallback(() => {
    sessionStorage.setItem('chasehorse_intro_seen', 'true');
    setPhase('done');
    setVisible(false);
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    // 1. Guard: Check session storage or reduced motion
    const alreadySeen = sessionStorage.getItem('chasehorse_intro_seen');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (alreadySeen === 'true' || prefersReducedMotion) {
      setPhase('done');
      onComplete?.();
      return;
    }

    setVisible(true);

    // Sequence Choreography (~1.6s total):
    // 0-800ms: assembling letters
    // 800-1200ms: O inner square pulse + tagline fade
    // 1200-1650ms: gliding to header + background fade
    const timerPulse = setTimeout(() => {
      setPhase('pulsing');
    }, 800);

    const timerGlide = setTimeout(() => {
      setPhase('gliding');
    }, 1200);

    const timerDone = setTimeout(() => {
      skipIntro();
    }, 1650);

    // ESC or any key to skip
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        skipIntro();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timerPulse);
      clearTimeout(timerGlide);
      clearTimeout(timerDone);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [skipIntro, onComplete]);

  if (!visible || phase === 'done') {
    return null;
  }

  return (
    <div
      className={`intro-overlay ${phase === 'gliding' ? 'intro-overlay--gliding' : ''}`}
      onClick={skipIntro}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: '#F3F1EB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'opacity 450ms cubic-bezier(0.22, 1, 0.36, 1), background-color 450ms ease',
        opacity: phase === 'gliding' ? 0 : 1,
        pointerEvents: phase === 'gliding' ? 'none' : 'auto',
      }}
      aria-label="ChaseHorse Intro Animation (Click or press ESC to skip)"
      role="banner"
    >
      <div
        className={`intro-logo-container ${phase === 'gliding' ? 'intro-logo-container--gliding' : ''}`}
        style={{
          transformOrigin: 'center center',
          transition: 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1), opacity 400ms ease',
          transform:
            phase === 'gliding'
              ? 'translate(-38vw, -42vh) scale(0.48)'
              : 'translate(0, 0) scale(1)',
        }}
      >
        <ChaseHorseLogo
          size="hero"
          theme="light"
          withSubtitle={true}
          animated={true}
          pulseInnerSquare={phase === 'pulsing'}
        />
      </div>

      {/* Skip indicator micro-pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '24px',
          fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#5E5B53',
          background: 'rgba(21, 21, 21, 0.05)',
          border: '1px solid #DDD8CC',
          borderRadius: '9999px',
          padding: '4px 10px',
        }}
      >
        Click or [ESC] to skip
      </div>
    </div>
  );
}
