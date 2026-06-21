import React from 'react';
declare const JoylyDS: any;
const { Tag } = JoylyDS;

export function StatusTags() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 24 }}>
      <Tag>New</Tag>
      <Tag>Beta</Tag>
      <Tag>Free</Tag>
      <Tag>Hot</Tag>
      <Tag>Popular</Tag>
    </div>
  );
}

export function GameBadges() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 24 }}>
      <Tag>2–8 players</Tag>
      <Tag>10 min</Tag>
      <Tag>Party</Tag>
    </div>
  );
}
