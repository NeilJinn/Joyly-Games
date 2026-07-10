import React from 'react';
declare const JoylyDS: any;
const { Input } = JoylyDS;

export function Empty() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 400 }}>
      <Input placeholder="Enter room code" />
    </div>
  );
}

export function WithValue() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24, background: '#0c0f14', maxWidth: 400 }}>
      <Input defaultValue="Neil" placeholder="Display name" />
      <Input defaultValue="host@example.com" type="email" placeholder="Email" />
    </div>
  );
}
