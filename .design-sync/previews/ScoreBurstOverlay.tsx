import React from 'react';
declare const JoylyDS: any;
const { ScoreBurstOverlay } = JoylyDS;

export function Burst() {
  return (
    <div style={{ position: 'relative', height: 300, background: '#0c0f14', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13, position: 'relative', zIndex: 49 }}>3D flower burst — fires on trigger; flowers fly to score rows</span>
      <ScoreBurstOverlay correctPlayerIds={['p1', 'p2']} trigger={1} />
    </div>
  );
}
