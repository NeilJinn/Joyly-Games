import React from 'react';
declare const JoylyDS: any;
const { JoinRoomForm, __Router } = JoylyDS;

export function Empty() {
  return (
    <__Router>
      <div style={{ padding: 24, background: '#0c0f14', maxWidth: 380 }}>
        <JoinRoomForm />
      </div>
    </__Router>
  );
}
