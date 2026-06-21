import React from 'react';
declare const JoylyDS: any;
const { Button, Icon } = JoylyDS;

// PaymentModal uses framer-motion AnimatePresence (opacity:0 initial) — render content directly
const backdrop: React.CSSProperties = { background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const panel: React.CSSProperties = { position: 'relative', width: '100%', maxWidth: 680, background: 'rgba(17,24,33,.98)', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.6)' };
const tabActive: React.CSSProperties = { flex: 1, minHeight: 52, borderRadius: 8, border: '1px solid rgba(120,212,94,.7)', background: 'rgba(23,29,37,.74)', color: 'var(--ink)', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };
const tabInactive: React.CSSProperties = { ...tabActive, border: '1px solid rgba(255,255,255,.12)', color: 'var(--muted)' };
const priceCard = (active: boolean): React.CSSProperties => ({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minHeight: 90, padding: 14, borderRadius: 8, border: active ? '1px solid rgba(120,212,94,.7)' : '1px solid rgba(255,255,255,.12)', background: 'rgba(23,29,37,.74)', color: active ? 'var(--ink)' : 'var(--muted)', cursor: 'pointer' });

export function TimePass() {
  return (
    <div style={backdrop}>
      <div style={panel}>
        <button style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(17,24,33,.9)', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>✕</button>
        <h2 style={{ color: 'var(--ink)', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Payment</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 2px' }}>Cosmic Trivia · 2–8 players</p>

        {/* Summary strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '12px 14px', borderRadius: 8, background: 'rgba(23,29,37,.74)', border: '1px solid rgba(255,255,255,.08)', margin: '14px 0' }}>
          {[['GAME', 'Cosmic Trivia'], ['POINTS', '120'], ['TIME LEFT', '--']].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
              <strong style={{ color: 'var(--ink)', fontSize: 16, fontWeight: 800 }}>{val}</strong>
            </div>
          ))}
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <button style={tabActive}><Icon name="card" /><span>Time pass</span></button>
          <button style={tabInactive}><Icon name="coins" /><span>Use points</span></button>
          <button style={tabInactive}><Icon name="coins" /><span>Buy points</span></button>
        </div>

        {/* Price cards for time pass */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[['1 hr', '29 kr', true], ['2 hrs', '39 kr', false], ['4 hrs', '59 kr', false]].map(([label, price, active]) => (
            <div key={label as string} style={priceCard(active as boolean)}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{label as string}</span>
              <strong style={{ fontSize: 20, fontWeight: 800 }}>{price as string}</strong>
              <span style={{ fontSize: 12 }}>one-time</span>
            </div>
          ))}
        </div>

        <Button variant="primary" style={{ width: '100%' }}>
          <Icon name="play" />
          <span>Pay 29 kr · Create room</span>
        </Button>
      </div>
    </div>
  );
}
