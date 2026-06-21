import React from 'react';
declare const JoylyDS: any;
const { ScoreRow } = JoylyDS;

const av = (paletteId: string) => ({ characterId: null, hatId: null, decorationId: null, paletteId });

const players = [
  { id: '1', nickname: 'Alex', avatar: av('teal'), online: true, ready: true },
  { id: '2', nickname: 'Sam', avatar: av('gold'), online: true, ready: true },
  { id: '3', nickname: 'Jordan', avatar: av('coral'), online: false, ready: false },
];

export function Waiting() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 24, background: '#0c0f14', maxWidth: 420 }}>
      {players.map((p, i) => (
        <ScoreRow key={p.id} player={p} score={undefined} rank={i + 1} hasAnswered={false} showScore={false} isRevealPhase={false} />
      ))}
    </div>
  );
}

export function AllAnswered() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 24, background: '#0c0f14', maxWidth: 420 }}>
      {players.map((p, i) => (
        <ScoreRow key={p.id} player={p} score={undefined} rank={i + 1} hasAnswered={i < 2} showScore={false} isRevealPhase={false} />
      ))}
    </div>
  );
}

export function Reveal() {
  const scores = [4200, 2800, 1100];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 24, background: '#0c0f14', maxWidth: 420 }}>
      {players.map((p, i) => (
        <ScoreRow key={p.id} player={p} score={scores[i]} rank={i + 1} hasAnswered={i < 2} showScore={true} isRevealPhase={true} />
      ))}
    </div>
  );
}
