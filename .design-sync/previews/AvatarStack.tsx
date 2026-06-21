import React from 'react';
declare const JoylyDS: any;
const { AvatarStack } = JoylyDS;

const baseAvatar = { characterId: null, hatId: null, decorationId: null };

export function Palettes() {
  const palettes = ['teal', 'gold', 'coral', 'sky', 'violet', 'mint'];
  return (
    <div style={{ display: 'flex', gap: 16, padding: 24, background: '#111821', flexWrap: 'wrap' }}>
      {palettes.map(p => (
        <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <AvatarStack avatar={{ ...baseAvatar, paletteId: p }} size="normal" />
          <span style={{ color: '#8f99a6', fontSize: 11 }}>{p}</span>
        </div>
      ))}
    </div>
  );
}

export function Sizes() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, padding: 24, background: '#111821' }}>
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'teal' }} size="small" />
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'gold' }} size="normal" />
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'coral' }} size="large" />
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'violet' }} size="hero" />
    </div>
  );
}

export function States() {
  return (
    <div style={{ display: 'flex', gap: 20, padding: 24, background: '#111821', flexWrap: 'wrap' }}>
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'teal' }} size="normal" ringColor="#78d45e" glowColor="#78d45e" />
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'gold' }} size="normal" ringColor="#f4b04a" glowColor="#f4b04a" />
      <AvatarStack avatar={{ ...baseAvatar, paletteId: 'coral' }} size="normal" greyscale={true} />
    </div>
  );
}
