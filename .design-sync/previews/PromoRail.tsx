import React from 'react';
declare const JoylyDS: any;
const { Button, Tag, Icon } = JoylyDS;

// PromoRail's slide content is in a framer-motion AnimatePresence (opacity:0 initial).
// Render a static version showing the hero layout with real components.
export function Featured() {
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      minHeight: 340,
      padding: '32px 20px 72px',
      background: 'linear-gradient(180deg, rgba(9,18,28,0.04), #0c0f14)',
    }}>
      <Tag>2–8 players · Trivia</Tag>
      <h1 style={{ fontSize: 'clamp(32px, 7vw, 72px)', lineHeight: 0.98, margin: '18px 0 28px', color: 'var(--ink)', fontWeight: 800, maxWidth: 700 }}>
        Cosmic Trivia
      </h1>
      <p style={{ color: '#e5f4f6', fontSize: 20, lineHeight: 1.42, margin: '-12px 0 24px', maxWidth: 540 }}>
        Fast-paced trivia battles across the cosmos. Answer quickly for bonus stars.
      </p>
      <Button variant="primary" style={{ minWidth: 180 }}>
        <Icon name="play" />
        <span>Play now</span>
      </Button>

      {/* Pagination controls */}
      <div style={{ position: 'absolute', left: 20, right: 20, bottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Button variant="icon" style={{ background: 'rgba(17,24,33,.82)' }}>
          <Icon name="left" />
        </Button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 999, background: 'rgba(17,24,33,.72)', border: '1px solid rgba(255,255,255,.1)' }}>
          <div style={{ width: 34, height: 8, borderRadius: 4, background: 'var(--green)' }} />
          <div style={{ width: 10, height: 8, borderRadius: 4, background: 'rgba(255,248,232,.46)' }} />
          <div style={{ width: 10, height: 8, borderRadius: 4, background: 'rgba(255,248,232,.46)' }} />
        </div>
        <Button variant="icon" style={{ background: 'rgba(17,24,33,.82)' }}>
          <Icon name="right" />
        </Button>
      </div>
    </section>
  );
}
