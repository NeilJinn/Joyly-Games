import React from 'react';
declare const JoylyDS: any;
const { LobbyControls } = JoylyDS;

const game = {
  id: 'cosmic-trivia', title: 'Cosmic Trivia', genre: 'Trivia',
  players: '2–8 players', minPlayers: 2, maxPlayers: 8,
  mood: 'Competitive', status: 'playable', description: '',
};
const av = (p: string) => ({ characterId: null, hatId: null, decorationId: null, paletteId: p });
const roomBase = {
  code: '482901', host: { name: 'Neil', email: 'host@example.com' },
  paymentMode: 'time', entitlement: { type: 'time-pass', minutes: 60 },
  launchCountdown: null, gameSetup: null, gameState: null, createdAt: Date.now(),
  selectedGame: game, status: 'waiting' as const,
};

export function WaitingForPlayers() {
  return (
    <div style={{ padding: 24, background: '#0c0f14' }}>
      <LobbyControls room={{ ...roomBase, players: [] }} onOpenGamePicker={() => {}} />
    </div>
  );
}

export function PlayersOnline() {
  return (
    <div style={{ padding: 24, background: '#0c0f14' }}>
      <LobbyControls
        room={{
          ...roomBase,
          players: [
            { id: '1', nickname: 'Alex', avatar: av('teal'), online: true, ready: true },
            { id: '2', nickname: 'Sam', avatar: av('gold'), online: true, ready: false },
            { id: '3', nickname: 'Jordan', avatar: av('coral'), online: false, ready: false },
          ],
        }}
        onOpenGamePicker={() => {}}
      />
    </div>
  );
}

export function ReadyToStart() {
  return (
    <div style={{ padding: 24, background: '#0c0f14' }}>
      <LobbyControls
        room={{
          ...roomBase,
          players: [
            { id: '1', nickname: 'Alex', avatar: av('teal'), online: true, ready: true },
            { id: '2', nickname: 'Sam', avatar: av('gold'), online: true, ready: true },
          ],
        }}
        onOpenGamePicker={() => {}}
      />
    </div>
  );
}
