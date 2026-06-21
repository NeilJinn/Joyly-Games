import React from 'react';
declare const JoylyDS: any;
const { Tag, Button, Icon } = JoylyDS;

// GamePickerModal uses framer-motion AnimatePresence (opacity:0 initial) — render content directly
const games = [
  { id: 'cosmic-trivia', title: 'Cosmic Trivia', genre: 'Trivia', players: '2–8', mood: 'Competitive', status: 'playable', description: 'Fast-paced trivia battles across the cosmos.' },
  { id: 'word-battle', title: 'Word Battle', genre: 'Word', players: '3–10', mood: 'Creative', status: 'coming-soon', description: 'Outsmart friends with clever wordplay.' },
  { id: 'quick-draw', title: 'Quick Draw', genre: 'Art', players: '2–12', mood: 'Chaotic', status: 'coming-soon', description: 'Draw fast, guess faster.' },
];

const backdrop: React.CSSProperties = { background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 };
const panel: React.CSSProperties = { position: 'relative', width: '100%', maxWidth: 680, background: 'rgba(17,24,33,.98)', borderRadius: 12, border: '1px solid rgba(255,255,255,.1)', padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,.6)' };

function GameGrid({ selectedId }: { selectedId: string | null }) {
  return (
    <div style={backdrop}>
      <div style={panel}>
        <button style={{ position: 'absolute', top: 14, right: 14, width: 36, height: 36, borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: 'rgba(17,24,33,.9)', color: 'var(--muted)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>✕</button>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ color: 'var(--ink)', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Choose Game</h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Pick one for this room.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {games.map((g) => {
            const selected = g.id === selectedId;
            const playable = g.status === 'playable';
            return (
              <article key={g.id} style={{ borderRadius: 8, border: selected ? '1px solid rgba(120,212,94,.7)' : '1px solid rgba(255,255,255,.12)', background: 'rgba(17,24,33,.92)', overflow: 'hidden', boxShadow: selected ? '0 0 0 2px rgba(120,212,94,.18)' : 'none' }}>
                <div className={`game-art game-art-${g.id}`} style={{ padding: 12 }}>
                  <Tag>{g.genre}</Tag>
                </div>
                <div style={{ padding: 14, display: 'grid', gap: 12 }}>
                  <div>
                    <h3 style={{ color: 'var(--ink)', fontSize: 18, fontWeight: 800, margin: '0 0 6px' }}>{g.title}</h3>
                    <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>{g.description}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, color: 'var(--muted)', fontSize: 12 }}>
                    <span>{g.players}</span>
                    <span>{g.mood}</span>
                    <span>{playable ? 'Playable' : 'Coming soon'}</span>
                  </div>
                  <Button variant={selected ? 'primary' : 'secondary'} disabled={!playable} style={{ width: '100%' }}>
                    {selected ? <><Icon name="check" /><span>Selected</span></> : playable ? <><Icon name="check" /><span>Select</span></> : <><Icon name="star" /><span>Coming soon</span></>}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Open() {
  return <GameGrid selectedId="cosmic-trivia" />;
}

export function NoneSelected() {
  return <GameGrid selectedId={null} />;
}
