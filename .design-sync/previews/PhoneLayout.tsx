import React from 'react';
declare const JoylyDS: any;
const { PhoneLayout, __Router } = JoylyDS;

export function WithContent() {
  return (
    <__Router>
      <div style={{ background: '#0c0f14', maxWidth: 430 }}>
        <PhoneLayout>
          <section style={{ background: 'rgba(17,24,33,.9)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 20, margin: '0 16px' }}>
            <h2 style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 800, margin: '0 0 8px' }}>Waiting for host</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>The game will start soon. Get ready!</p>
          </section>
        </PhoneLayout>
      </div>
    </__Router>
  );
}
