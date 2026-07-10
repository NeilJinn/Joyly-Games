import React from 'react';
declare const JoylyDS: any;
const { Input, Button, Icon } = JoylyDS;

// AuthModal wraps in framer-motion AnimatePresence (opacity:0 initial) — render content directly
const backdrop: React.CSSProperties = { background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const panel: React.CSSProperties = { width: '100%', maxWidth: 440, background: 'rgba(17,24,33,.98)', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.6)' };

export function Open() {
  return (
    <div style={backdrop}>
      <div style={panel}>
        <h2 style={{ color: 'var(--ink)', fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Host account</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 0, marginBottom: 4 }}>Sign in to choose a game and buy play time.</p>
        <div style={{ display: 'grid', gap: 8, marginTop: 18, marginBottom: 18 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#c8d4de', fontSize: 13, fontWeight: 700 }}>Display name</span>
            <Input defaultValue="Neil" name="hostName" />
          </label>
        </div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: '#c8d4de', fontSize: 13, fontWeight: 700 }}>Email</span>
            <Input type="email" defaultValue="host@example.com" name="email" />
          </label>
        </div>
        <Button variant="primary" style={{ width: '100%', marginTop: 8 }}>
          <Icon name="login" />
          <span>Continue</span>
        </Button>
      </div>
    </div>
  );
}
