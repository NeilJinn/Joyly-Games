import React from 'react';
declare const JoylyDS: any;
const { Joyly01Overlay } = JoylyDS;

export function Transition() {
  return (
    <div style={{ position: 'relative', height: 300, background: '#0c0f14', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13, position: 'relative', zIndex: 1 }}>3D flower + leaf burst overlay — fires on trigger change</span>
      <Joyly01Overlay preset="transition" trigger={1} origin="random" />
    </div>
  );
}

export function Celebration() {
  return (
    <div style={{ position: 'relative', height: 300, background: '#0c0f14', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13, position: 'relative', zIndex: 1 }}>Celebration preset — flowers, leaves, and confetti</span>
      <Joyly01Overlay preset="celebration" trigger={1} origin="bottom" />
    </div>
  );
}
