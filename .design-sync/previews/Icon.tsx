import React from 'react';
declare const JoylyDS: any;
const { Icon } = JoylyDS;

const ALL_ICONS = ['play','login','logout','left','right','check','star','users','door','desktop','mobile','settings','power','card','coins','music','copy','game'];

export function AllIcons() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, padding: 24, background: '#111821' }}>
      {ALL_ICONS.map(name => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Icon name={name} className="w-[22px] h-[22px]" />
          <span style={{ color: '#8f99a6', fontSize: 10 }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

export function LargeIcons() {
  return (
    <div style={{ display: 'flex', gap: 24, padding: 24, background: '#111821' }}>
      {['play','settings','users','star'].map(name => (
        <Icon key={name} name={name} className="w-[32px] h-[32px] text-[var(--ink)]" />
      ))}
    </div>
  );
}
