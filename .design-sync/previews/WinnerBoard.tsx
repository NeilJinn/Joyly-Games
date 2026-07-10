import React from 'react';
declare const JoylyDS: any;
const { WinnerBoard } = JoylyDS;

const av = (p: string) => ({ characterId: null, hatId: null, decorationId: null, paletteId: p });
const players = [
  { id: '1', nickname: 'Alex', avatar: av('teal'), online: true, ready: true },
  { id: '2', nickname: 'Sam', avatar: av('gold'), online: true, ready: true },
  { id: '3', nickname: 'Jordan', avatar: av('coral'), online: false, ready: false },
  { id: '4', nickname: 'Riley', avatar: av('violet'), online: true, ready: true },
];
const scores = { '1': 5200, '2': 4100, '3': 3750, '4': 2800 };

export function Results() {
  return (
    <div style={{ padding: 24, background: '#0c0f14' }}>
      <WinnerBoard players={players} scores={scores} onPlayAgain={() => {}} />
    </div>
  );
}

export function TwoPlayers() {
  return (
    <div style={{ padding: 24, background: '#0c0f14' }}>
      <WinnerBoard players={players.slice(0, 2)} scores={{ '1': 3100, '2': 2400 }} />
    </div>
  );
}
