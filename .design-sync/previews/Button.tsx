import React from 'react';
declare const JoylyDS: any;
const { Button, Icon } = JoylyDS;

export function Primary() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      <Button variant="primary">Start a Jam</Button>
      <Button variant="primary">Join Room</Button>
    </div>
  );
}

export function Secondary() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      <Button variant="secondary">Cancel</Button>
      <Button variant="secondary">Back</Button>
    </div>
  );
}

export function IconVariant() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: 24 }}>
      <Button variant="icon"><Icon name="settings" /></Button>
      <Button variant="icon"><Icon name="logout" /></Button>
      <Button variant="icon"><Icon name="users" /></Button>
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      <Button variant="primary" disabled>Not Available</Button>
      <Button variant="secondary" disabled>Disabled</Button>
    </div>
  );
}

export function WithIcon() {
  return (
    <div style={{ padding: 24 }}>
      <Button variant="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="play" />
        Start Game
      </Button>
    </div>
  );
}
