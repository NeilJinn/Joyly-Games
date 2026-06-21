import React from 'react';
declare const JoylyDS: any;
const { PlayerBubble } = JoylyDS;

const playerBase = { id: '1', lastSeen: Date.now() };
const avatar = { characterId: null, hatId: null, decorationId: null, paletteId: 'teal' };
const avatarGold = { ...avatar, paletteId: 'gold' };
const avatarCoral = { ...avatar, paletteId: 'coral' };

export function Pending() {
  return (
    <div style={{ padding: 24, background: '#111821', display: 'inline-block' }}>
      <PlayerBubble player={{ ...playerBase, nickname: 'Alex', avatar, online: true, ready: false }} />
    </div>
  );
}

export function Ready() {
  return (
    <div style={{ padding: 24, background: '#111821', display: 'inline-block' }}>
      <PlayerBubble player={{ ...playerBase, nickname: 'Sam', avatar: avatarGold, online: true, ready: true }} />
    </div>
  );
}

export function Disconnected() {
  return (
    <div style={{ padding: 24, background: '#111821', display: 'inline-block' }}>
      <PlayerBubble player={{ ...playerBase, nickname: 'Jordan', avatar: avatarCoral, online: false, ready: false }} />
    </div>
  );
}

export function LobbyRow() {
  return (
    <div style={{ padding: 24, background: '#111821', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <PlayerBubble player={{ ...playerBase, id: '1', nickname: 'Alex', avatar, online: true, ready: true }} />
      <PlayerBubble player={{ ...playerBase, id: '2', nickname: 'Sam', avatar: avatarGold, online: true, ready: false }} />
      <PlayerBubble player={{ ...playerBase, id: '3', nickname: 'Jordan', avatar: avatarCoral, online: false, ready: false }} />
    </div>
  );
}
