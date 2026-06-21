import React from 'react';
declare const JoylyDS: any;
const { AnswerGrid } = JoylyDS;

const answers = [
  { id: 'a', text: 'The speed of light' },
  { id: 'b', text: 'The gravitational constant' },
  { id: 'c', text: 'Planck\'s constant' },
  { id: 'd', text: 'Boltzmann constant' },
];

export function PhoneIdle() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 360 }}>
      <AnswerGrid answers={answers} variant="phone" onSelect={() => {}} />
    </div>
  );
}

export function PhoneSelected() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 360 }}>
      <AnswerGrid answers={answers} selectedId="a" variant="phone" onSelect={() => {}} />
    </div>
  );
}

export function PhoneRevealed() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 360 }}>
      <AnswerGrid answers={answers} selectedId="a" correctId="c" disabled variant="phone" />
    </div>
  );
}

export function BigScreen() {
  return (
    <div style={{ padding: 24, background: '#0c0f14' }}>
      <AnswerGrid answers={answers} correctId="c" disabled variant="big-screen" />
    </div>
  );
}
