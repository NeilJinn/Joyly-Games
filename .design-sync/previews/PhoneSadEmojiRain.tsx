import React from 'react';
declare const JoylyDS: any;
const { PhoneSadEmojiRain } = JoylyDS;

export function Rain() {
  return (
    <div style={{ position: 'relative', height: 280, background: '#0c0f14', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: 'var(--muted)', fontSize: 13 }}>Sad emoji rain animation — plays on wrong answer</span>
      <PhoneSadEmojiRain trigger={1} />
    </div>
  );
}
