import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const SAD_EMOJIS = ['😢', '😭', '😔', '💔', '😿', '🥺'];
const COUNT = 14;

interface Props {
  trigger: number;
}

export default function PhoneSadEmojiRain({ trigger }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!trigger) return;
    const container = containerRef.current;
    if (!container) return;

    for (let i = 0; i < COUNT; i++) {
      const span = document.createElement('span');
      span.textContent = SAD_EMOJIS[Math.floor(Math.random() * SAD_EMOJIS.length)];
      const size = 22 + Math.random() * 18;
      span.style.cssText = `
        position: absolute;
        top: -60px;
        left: ${5 + Math.random() * 85}%;
        font-size: ${size}px;
        opacity: 0;
        pointer-events: none;
        user-select: none;
      `;
      container.appendChild(span);

      const delay  = i * 0.12 + Math.random() * 0.4;
      const dur    = 3.0 + Math.random() * 1.8;
      const endRot = (Math.random() - 0.5) * 40;

      gsap.fromTo(
        span,
        { top: '-60px', opacity: 0, rotation: endRot * -0.5 },
        {
          top: '110%',
          opacity: 1,
          rotation: endRot,
          duration: dur,
          delay,
          ease: 'power1.in',
          onComplete: () => span.remove(),
        },
      );
    }
  }, [trigger]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 49,
      }}
    />
  );
}
