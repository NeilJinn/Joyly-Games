import React from 'react';
declare const JoylyDS: any;
const { ConfettiRain } = JoylyDS;

export function Active() {
  return (
    <div style={{ position: 'relative', height: 320, background: '#0c0f14', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>3D confetti overlay — active during celebration</span>
      </div>
      <ConfettiRain active={true} zIndex={10} />
    </div>
  );
}

export function Idle() {
  return (
    <div style={{ position: 'relative', height: 200, background: '#0c0f14', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>Inactive — no confetti spawning</span>
      <ConfettiRain active={false} />
    </div>
  );
}
