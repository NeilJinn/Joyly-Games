import React, { useEffect, useState } from 'react';
declare const JoylyDS: any;
const { HostPhoneLobbyView, __Router, __authStore } = JoylyDS;

const game = {
  id: 'cosmic-trivia', title: 'Cosmic Trivia', genre: 'Trivia',
  players: '2–8 players', minPlayers: 2, maxPlayers: 8,
  mood: 'Competitive', status: 'playable' as const, description: '',
};
const av = (p: string) => ({ characterId: null, hatId: null, decorationId: null, paletteId: p });
const room = {
  code: '482901', host: { name: 'Neil', email: 'host@example.com' },
  players: [
    { id: '1', nickname: 'Alex', avatar: av('teal'), online: true, ready: true },
    { id: '2', nickname: 'Sam', avatar: av('gold'), online: true, ready: false },
  ],
  status: 'waiting' as const, selectedGame: game,
  paymentMode: 'time', entitlement: { type: 'time-pass', minutes: 60 },
  launchCountdown: null, gameSetup: null, gameState: null, createdAt: Date.now(),
};

function WithAuth({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    __authStore.setState({
      account: { displayName: 'Neil Jinn', email: 'host@example.com' },
      entitlement: { points: 0, timePassExpiresAt: Date.now() + 3_600_000 },
      isSignedIn: true,
    });
    setReady(true);
  }, []);
  return ready ? <>{children}</> : null;
}

export function RoomTab() {
  return (
    <__Router>
      <WithAuth>
        <div style={{ maxWidth: 430, background: '#0c0f14' }}>
          <HostPhoneLobbyView room={room} code="482901" onRoomUpdate={() => {}} />
        </div>
      </WithAuth>
    </__Router>
  );
}
