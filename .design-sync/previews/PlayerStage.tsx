import React from 'react';
declare const JoylyDS: any;
const { PlayerStage } = JoylyDS;

const av = (p: string) => ({ characterId: null, hatId: null, decorationId: null, paletteId: p });

export function Empty() {
  return (
    <div style={{ background: '#0c0f14' }}>
      <PlayerStage players={[]} minPlayers={2} maxPlayers={8} />
    </div>
  );
}

export function LobbyFull() {
  return (
    <div style={{ background: '#0c0f14' }}>
      <PlayerStage
        players={[
          { id: '1', nickname: 'Alex', avatar: av('teal'), online: true, ready: true },
          { id: '2', nickname: 'Sam', avatar: av('gold'), online: true, ready: false },
          { id: '3', nickname: 'Jordan', avatar: av('coral'), online: false, ready: false },
          { id: '4', nickname: 'Riley', avatar: av('violet'), online: true, ready: true },
          { id: '5', nickname: 'Casey', avatar: av('mint'), online: true, ready: true },
        ]}
        minPlayers={2}
        maxPlayers={8}
      />
    </div>
  );
}
