import React from 'react';
declare const JoylyDS: any;
const { Button, Input } = JoylyDS;

// Framer-motion AnimatePresence starts at opacity:0 — bypass with static panel styles
const backdrop: React.CSSProperties = { background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const panel: React.CSSProperties = { width: '100%', maxWidth: 440, background: 'rgba(17,24,33,.98)', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.6)' };

export function SignInModal() {
  return (
    <div style={backdrop}>
      <div style={panel}>
        <h2 style={{ color: 'var(--ink)', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Host account</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0, marginBottom: 18 }}>Sign in to choose a game and buy play time.</p>
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          <Input placeholder="Display name" defaultValue="Neil" />
          <Input placeholder="Email" type="email" defaultValue="host@example.com" />
        </div>
        <Button variant="primary" style={{ width: '100%' }}>Continue</Button>
      </div>
    </div>
  );
}

export function ConfirmModal() {
  return (
    <div style={backdrop}>
      <div style={panel}>
        <h2 style={{ color: 'var(--ink)', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Close room?</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0, marginBottom: 24 }}>All players will be disconnected.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="secondary" style={{ flex: 1 }}>Cancel</Button>
          <button style={{ flex: 1, height: 44, borderRadius: 6, border: '1px solid rgba(246,114,114,.4)', background: 'rgba(246,114,114,.08)', color: '#f67272', fontWeight: 700, cursor: 'pointer' }}>Close room</button>
        </div>
      </div>
    </div>
  );
}
