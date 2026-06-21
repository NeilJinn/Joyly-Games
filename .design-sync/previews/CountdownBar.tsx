import React from 'react';
declare const JoylyDS: any;
const { CountdownBar } = JoylyDS;

export function Plenty() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 420 }}>
      <CountdownBar endsAt={Date.now() + 22_000} totalSecs={30} />
    </div>
  );
}

export function Warning() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 420 }}>
      <CountdownBar endsAt={Date.now() + 8_000} totalSecs={30} />
    </div>
  );
}

export function Danger() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 420 }}>
      <CountdownBar endsAt={Date.now() + 3_000} totalSecs={30} />
    </div>
  );
}
