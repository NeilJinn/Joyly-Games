const cosmicTriviaGame = {
  id: "cosmic-trivia",
  title: "Cosmic Trivia",
  genre: "Trivia party",
  price: 7,
  credits: 2,
  players: "2-8",
  minPlayers: 2,
  maxPlayers: 8,
  mood: "Bright sci-fi quiz",
  status: "playable",
  clientModule: "/games/cosmic-trivia/client.js",
  description: "Fast multiple-choice questions, cheerful music cues, and quick score reveals."
};

const fateWerewolfGame = {
  id: "fate-werewolf",
  title: "Fate Werewolf",
  genre: "Social deduction ritual",
  price: 8,
  credits: 3,
  players: "5-8",
  minPlayers: 5,
  maxPlayers: 8,
  mood: "Occult moonlit drama",
  status: "playable",
  clientModule: "/games/fate-werewolf/client.js",
  description: "Moonlit deduction with private roles, ritual staging, and room-for-fate architecture."
};

const comingSoonGames = [
  {
    id: "after-hours",
    title: "After Hours",
    genre: "Social deduction",
    price: 8,
    credits: 3,
    players: "5-12",
    minPlayers: 5,
    maxPlayers: 12,
    mood: "Neon mystery",
    status: "coming-soon",
    description: "A fast bluffing game built for loud rooms and suspicious friends."
  },
  {
    id: "pitch-storm",
    title: "Pitch Storm",
    genre: "Creative chaos",
    price: 6,
    credits: 2,
    players: "3-10",
    minPlayers: 3,
    maxPlayers: 10,
    mood: "Studio party",
    status: "coming-soon",
    description: "Players invent absurd products and vote on the best pitch."
  },
  {
    id: "signal-lost",
    title: "Signal Lost",
    genre: "Team puzzle",
    price: 10,
    credits: 4,
    players: "4-20",
    minPlayers: 4,
    maxPlayers: 20,
    mood: "Sci-fi control room",
    status: "coming-soon",
    description: "A cooperative countdown game where phones become mission terminals."
  },
  {
    id: "hot-seat",
    title: "Hot Seat",
    genre: "Party questions",
    price: 5,
    credits: 1,
    players: "2-30",
    minPlayers: 2,
    maxPlayers: 30,
    mood: "Late-night talk show",
    status: "coming-soon",
    description: "A quick round-based game about knowing your friends too well."
  }
];

export const games = [fateWerewolfGame, cosmicTriviaGame, ...comingSoonGames];

export function findGame(gameId) {
  return games.find(item => item.id === gameId) || cosmicTriviaGame;
}

export function playableGames() {
  return games.filter(item => item.status === "playable");
}
