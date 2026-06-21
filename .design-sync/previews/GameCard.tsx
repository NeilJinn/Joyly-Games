import React from 'react';
declare const JoylyDS: any;
const { GameCard } = JoylyDS;

const cosmicTrivia = {
  id: 'cosmic-trivia',
  title: 'Cosmic Trivia',
  genre: 'Trivia',
  players: '2–8 players',
  minPlayers: 2,
  maxPlayers: 8,
  mood: 'Competitive',
  status: 'playable' as const,
  description: 'Fast-paced trivia battles across the cosmos. Answer quickly to earn bonus stars.',
};

const comingSoon = {
  id: 'word-battle',
  title: 'Word Battle',
  genre: 'Word',
  players: '3–10 players',
  minPlayers: 3,
  maxPlayers: 10,
  mood: 'Creative',
  status: 'coming-soon' as const,
  description: 'Outsmart your friends with clever wordplay. A party favourite for word lovers.',
};

export function Playable() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 360 }}>
      <GameCard game={cosmicTrivia} onPlay={() => {}} />
    </div>
  );
}

export function Selected() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 360 }}>
      <GameCard game={cosmicTrivia} selected={true} onPlay={() => {}} />
    </div>
  );
}

export function ComingSoon() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 360 }}>
      <GameCard game={comingSoon} onPlay={() => {}} />
    </div>
  );
}

export function Grid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 24, background: '#0c0f14' }}>
      <GameCard game={cosmicTrivia} selected={true} onPlay={() => {}} />
      <GameCard game={comingSoon} onPlay={() => {}} />
    </div>
  );
}
