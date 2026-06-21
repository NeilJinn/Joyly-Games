import React from 'react';
declare const JoylyDS: any;
const { PreferencesPicker } = JoylyDS;

const options = {
  categories: ['space', 'science', 'history', 'geography', 'nature', 'movies', 'sports', 'general'],
  tags: ['planets', 'ai', 'inventions', 'animals', 'food', 'music', 'art', 'tech'],
};

export function Default() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 520 }}>
      <PreferencesPicker options={options} onSubmit={() => {}} submitting={false} />
    </div>
  );
}

export function Submitting() {
  return (
    <div style={{ padding: 24, background: '#0c0f14', maxWidth: 520 }}>
      <PreferencesPicker options={options} onSubmit={() => {}} submitting={true} />
    </div>
  );
}
