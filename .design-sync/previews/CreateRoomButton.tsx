import React from 'react';
declare const JoylyDS: any;
const { CreateRoomButton } = JoylyDS;

export function Default() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 380 }}>
      <CreateRoomButton onClick={() => {}} />
    </div>
  );
}
