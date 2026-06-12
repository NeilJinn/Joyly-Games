const source = "cosmic-trivia";

function reducedGlow(id, slot = "targetElement", color = "#7de2ff") {
  return {
    mode: "simplified",
    timeline: {
      duration: 0.08,
      blocks: [
        {
          id: `${id}.reduced`,
          type: "glow",
          start: 0,
          duration: 0.08,
          slot,
          params: {
            strength: 8,
            color
          }
        }
      ]
    }
  };
}

export const triviaMotionPacks = [
  {
    id: "question.cardReveal",
    name: "Question Card Reveal",
    version: "1.1.0",
    category: "card",
    description: "Bring a question card and its answer choices onto the stage with a premium host-screen entrance.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Question card",
        type: "element",
        required: true,
        description: "The question card container."
      }
    ],
    optionalSlots: [
      {
        id: "choiceElements",
        label: "Choice tiles",
        type: "element",
        required: false,
        description: "Answer tiles that enter after the card."
      }
    ],
    timeline: {
      duration: 3,
      blocks: [
        {
          id: "question-card.opening-flight",
          type: "pathfly",
          start: 0,
          duration: 1.48,
          slot: "targetElement",
          easing: "power3.out",
          params: {
            from: { x: 180, y: 112, scale: 0.9, opacity: 0, rotate: -2 },
            to: { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 },
            arc: 94,
            bendX: -32,
            autoRotate: false
          }
        },
        {
          id: "question-card.aqua-glow",
          type: "glow",
          start: 0.34,
          duration: 0.34,
          slot: "targetElement",
          params: {
            strength: 24,
            color: "#75e8dc"
          }
        },
        {
          id: "question-card.afterglow",
          type: "glow",
          start: 0.9,
          duration: 0.62,
          slot: "targetElement",
          params: {
            strength: 12,
            color: "#75e8dc"
          }
        },
        {
          id: "question-card.choice-pop",
          type: "stagger",
          start: 1.58,
          duration: 0.44,
          slot: "choiceElements",
          params: {
            delay: 0.085,
            scale: 1.045
          }
        },
        {
          id: "question-card.final-polish",
          type: "finalhold",
          start: 2.72,
          duration: 0.2,
          slot: "targetElement",
          params: {
            opacity: 1,
            scale: 1,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
            rotate: 0,
            strength: 0,
            color: "#75e8dc"
          }
        }
      ]
    },
    defaultParams: {
      color: "#75e8dc"
    },
    themeSlots: {
      default: {
        defaultParams: {
          color: "#75e8dc"
        }
      }
    },
    assetSlots: {},
    particleHooks: {},
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("question-card", "targetElement", "#75e8dc"),
    metadata: { source }
  },
  {
    id: "score.bump",
    name: "Score Bump",
    version: "1.1.0",
    category: "feedback",
    description: "Celebrate a score gain with a readable punch, glow, and light particle burst.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Score value",
        type: "element",
        required: true,
        description: "The score element or chip that gets emphasized."
      }
    ],
    optionalSlots: [],
    timeline: {
      duration: 1.18,
      blocks: [
        {
          id: "score-bump.fast-pop",
          type: "pulse",
          start: 0,
          duration: 0.24,
          slot: "targetElement",
          easing: "back.out(2.4)",
          params: {
            scale: 1.24
          }
        },
        {
          id: "score-bump.gold-flash",
          type: "flash",
          start: 0.02,
          duration: 0.18,
          slot: "targetElement",
          params: {
            strength: 30,
            color: "#ffd35a",
            opacity: 1
          }
        },
        {
          id: "score-bump.spark-impact",
          type: "impact",
          start: 0.1,
          duration: 0.46,
          slot: "targetElement",
          params: {
            magnitude: 6,
            cycles: 1,
            scaleX: 1.09,
            scaleY: 0.92,
            strength: 24,
            color: "#ffd35a",
            particles: {
              count: 16,
              size: 3,
              speed: 230,
              life: 560
            }
          }
        },
        {
          id: "score-bump.afterglow",
          type: "glow",
          start: 0.48,
          duration: 0.32,
          slot: "targetElement",
          params: {
            strength: 12,
            color: "#ffd35a"
          }
        },
        {
          id: "score-bump.clear",
          type: "finalhold",
          start: 0.86,
          duration: 0.18,
          slot: "targetElement",
          params: {
            opacity: 1,
            scale: 1,
            strength: 0,
            color: "#ffd35a"
          }
        }
      ]
    },
    defaultParams: {
      color: "#ffd35a"
    },
    themeSlots: {
      default: {
        defaultParams: {
          color: "#ffd35a"
        }
      }
    },
    assetSlots: {
      accentImage: {
        type: "image",
        label: "Accent image",
        description: "Optional score accent art.",
        required: false
      }
    },
    particleHooks: {
      scoreBurst: {
        type: "burst",
        label: "Score burst",
        description: "Particles on score gain."
      }
    },
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("score-bump", "targetElement", "#ffd35a"),
    metadata: { source }
  },
  {
    id: "leaderboard.shift",
    name: "Leaderboard Shift",
    version: "1.1.0",
    category: "feedback",
    description: "Polish a player row during rank movement while layout FLIP handles the actual position change.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Leaderboard row",
        type: "element",
        required: true,
        description: "The leaderboard row that changed place."
      }
    ],
    optionalSlots: [
      {
        id: "arrowElement",
        label: "Rank arrow",
        type: "element",
        required: false,
        description: "Optional rank movement arrow."
      }
    ],
    timeline: {
      duration: 1.9,
      blocks: [
        {
          id: "leaderboard-shift.row-sheen",
          type: "flash",
          start: 0,
          duration: 0.18,
          slot: "targetElement",
          params: {
            strength: 18,
            color: "#85d95f",
            opacity: 1
          }
        },
        {
          id: "leaderboard-shift.row-glow",
          type: "glow",
          start: 0.08,
          duration: 0.7,
          slot: "targetElement",
          params: {
            strength: 20,
            color: "#85d95f"
          }
        },
        {
          id: "leaderboard-shift.arrow-pop",
          type: "fromto",
          start: 0.12,
          duration: 0.5,
          slot: "arrowElement",
          easing: "back.out(2)",
          params: {
            from: { y: 10, scale: 0.68, opacity: 0 },
            to: { y: 0, scale: 1.08, opacity: 1 }
          }
        },
        {
          id: "leaderboard-shift.arrow-float",
          type: "fromto",
          start: 0.82,
          duration: 0.46,
          slot: "arrowElement",
          easing: "power2.in",
          params: {
            from: { y: 0, scale: 1, opacity: 1 },
            to: { y: -8, scale: 0.92, opacity: 0 }
          }
        },
        {
          id: "leaderboard-shift.clear",
          type: "finalhold",
          start: 1.52,
          duration: 0.14,
          slot: "targetElement",
          params: {
            opacity: 1,
            scale: 1,
            strength: 0,
            color: "#85d95f"
          }
        }
      ]
    },
    defaultParams: {
      color: "#85d95f"
    },
    themeSlots: {
      default: {
        defaultParams: {
          color: "#85d95f"
        }
      }
    },
    assetSlots: {},
    particleHooks: {},
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("leaderboard-shift", "targetElement", "#85d95f"),
    metadata: { source }
  },
  {
    id: "player.choiceLocked",
    name: "Player Choice Locked",
    version: "1.0.0",
    category: "feedback",
    description: "Confirm that a player has selected an answer with a sweep, label, and row glow.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Player row",
        type: "element",
        required: true,
        description: "The player score row."
      }
    ],
    optionalSlots: [
      {
        id: "fillElement",
        label: "Selection fill",
        type: "element",
        required: false,
        description: "The full-row green sweep layer."
      },
      {
        id: "stampElement",
        label: "Selected stamp",
        type: "element",
        required: false,
        description: "The selected confirmation text."
      }
    ],
    timeline: {
      duration: 1.42,
      blocks: [
        {
          id: "choice-locked.cover-sweep",
          type: "fromto",
          start: 0,
          duration: 0.98,
          slot: "fillElement",
          easing: "power2.out",
          params: {
            from: { scaleX: 0, opacity: 1, origin: "left center" },
            to: { scaleX: 1, opacity: 1, origin: "left center" }
          }
        },
        {
          id: "choice-locked.label-in",
          type: "fromto",
          start: 0.24,
          duration: 0.32,
          slot: "stampElement",
          easing: "power2.out",
          params: {
            from: { y: 8, scale: 0.92, opacity: 0 },
            to: { y: 0, scale: 1, opacity: 1 }
          }
        },
        {
          id: "choice-locked.row-flash",
          type: "glow",
          start: 0.18,
          duration: 0.54,
          slot: "targetElement",
          params: {
            strength: 18,
            color: "#85d95f"
          }
        },
        {
          id: "choice-locked.label-out",
          type: "fromto",
          start: 1.06,
          duration: 0.2,
          slot: "stampElement",
          easing: "power2.in",
          params: {
            from: { y: 0, scale: 1, opacity: 1 },
            to: { y: -4, scale: 0.98, opacity: 0 }
          }
        },
        {
          id: "choice-locked.cover-out",
          type: "fromto",
          start: 1.1,
          duration: 0.18,
          slot: "fillElement",
          easing: "power2.in",
          params: {
            from: { scaleX: 1, opacity: 1, origin: "left center" },
            to: { scaleX: 1.02, opacity: 0, origin: "left center" }
          }
        },
        {
          id: "choice-locked.clear",
          type: "finalhold",
          start: 1.32,
          duration: 0.08,
          slot: "targetElement",
          params: {
            opacity: 1,
            scale: 1,
            strength: 0,
            color: "#85d95f"
          }
        }
      ]
    },
    defaultParams: {
      color: "#85d95f"
    },
    themeSlots: {
      default: {
        defaultParams: {
          color: "#85d95f"
        }
      }
    },
    assetSlots: {},
    particleHooks: {},
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("choice-locked", "targetElement", "#85d95f"),
    metadata: { source }
  },
  {
    id: "countdown.warningPulse",
    name: "Countdown Warning Pulse",
    version: "1.0.0",
    category: "timer",
    description: "Subtle timer reminder when the countdown reaches the final ten seconds.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Countdown",
        type: "element",
        required: true,
        description: "The countdown number box."
      }
    ],
    optionalSlots: [],
    timeline: {
      duration: 0.72,
      blocks: [
        {
          id: "countdown-warning.line-glow",
          type: "glow",
          start: 0,
          duration: 0.5,
          slot: "targetElement",
          params: {
            strength: 10,
            color: "#ffd35a"
          }
        },
        {
          id: "countdown-warning.clear",
          type: "finalhold",
          start: 0.58,
          duration: 0.08,
          slot: "targetElement",
          params: {
            opacity: 1,
            strength: 0,
            color: "#ffd35a"
          }
        }
      ]
    },
    defaultParams: {
      color: "#ffd35a"
    },
    themeSlots: {},
    assetSlots: {},
    particleHooks: {},
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("countdown-warning", "targetElement", "#ffd35a"),
    metadata: { source }
  },
  {
    id: "countdown.dangerPulse",
    name: "Countdown Danger Pulse",
    version: "1.0.0",
    category: "timer",
    description: "High-urgency timer hit when the countdown reaches the final five seconds.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Countdown",
        type: "element",
        required: true,
        description: "The countdown number box."
      }
    ],
    optionalSlots: [],
    timeline: {
      duration: 0.9,
      blocks: [
        {
          id: "countdown-danger.line-flash",
          type: "flash",
          start: 0,
          duration: 0.38,
          slot: "targetElement",
          params: {
            strength: 22,
            opacity: 1,
            color: "#ff7a59"
          }
        },
        {
          id: "countdown-danger.line-glow",
          type: "glow",
          start: 0.34,
          duration: 0.32,
          slot: "targetElement",
          params: {
            strength: 18,
            color: "#ff7a59"
          }
        },
        {
          id: "countdown-danger.clear",
          type: "finalhold",
          start: 0.78,
          duration: 0.08,
          slot: "targetElement",
          params: {
            opacity: 1,
            strength: 0,
            color: "#ff7a59"
          }
        }
      ]
    },
    defaultParams: {
      color: "#ff7a59"
    },
    themeSlots: {},
    assetSlots: {},
    particleHooks: {},
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("countdown-danger", "targetElement", "#ff7a59"),
    metadata: { source }
  },
  {
    id: "answer.reveal",
    name: "Answer Reveal",
    version: "1.1.0",
    category: "result",
    description: "Reveal the correct answer tile with a bright confirmation hit and clear final state.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Correct answer",
        type: "element",
        required: true,
        description: "The correct answer tile."
      }
    ],
    optionalSlots: [],
    timeline: {
      duration: 1.42,
      blocks: [
        {
          id: "answer-reveal.confirm-pop",
          type: "pulse",
          start: 0,
          duration: 0.32,
          slot: "targetElement",
          easing: "back.out(2)",
          params: {
            scale: 1.18
          }
        },
        {
          id: "answer-reveal.green-flash",
          type: "flash",
          start: 0.02,
          duration: 0.18,
          slot: "targetElement",
          params: {
            strength: 22,
            color: "#85d95f",
            opacity: 1
          }
        },
        {
          id: "answer-reveal.spark-impact",
          type: "impact",
          start: 0.12,
          duration: 0.42,
          slot: "targetElement",
          params: {
            magnitude: 3,
            cycles: 1,
            scaleX: 1.06,
            scaleY: 0.94,
            strength: 24,
            color: "#85d95f",
            particles: {
              count: 20,
              size: 3,
              speed: 210,
              life: 620
            }
          }
        },
        {
          id: "answer-reveal.hold-glow",
          type: "glow",
          start: 0.52,
          duration: 0.42,
          slot: "targetElement",
          params: {
            strength: 16,
            color: "#85d95f"
          }
        },
        {
          id: "answer-reveal.clear",
          type: "finalhold",
          start: 1.1,
          duration: 0.1,
          slot: "targetElement",
          params: {
            opacity: 1,
            scale: 1,
            strength: 0,
            color: "#85d95f"
          }
        }
      ]
    },
    defaultParams: {
      color: "#85d95f"
    },
    themeSlots: {
      default: {
        defaultParams: {
          color: "#85d95f"
        }
      }
    },
    assetSlots: {},
    particleHooks: {
      revealBurst: {
        type: "burst",
        label: "Reveal burst",
        description: "Particles when the answer is revealed."
      }
    },
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("answer-reveal", "targetElement", "#85d95f"),
    metadata: { source }
  },
  {
    id: "trivia.victoryReveal",
    name: "Trivia Victory Reveal",
    version: "1.0.0",
    category: "victory",
    description: "Reveal the final winner row and trophy treatment with a celebratory but readable finish.",
    requiredSlots: [
      {
        id: "targetElement",
        label: "Winner row",
        type: "element",
        required: true,
        description: "The winning row or victory element."
      }
    ],
    optionalSlots: [
      {
        id: "badgeElement",
        label: "Trophy badge",
        type: "element",
        required: false,
        description: "Optional trophy PNG badge."
      }
    ],
    timeline: {
      duration: 2.1,
      blocks: [
        {
          id: "trivia-victory.row-rise",
          type: "pathfly",
          start: 0,
          duration: 0.72,
          slot: "targetElement",
          easing: "power3.out",
          params: {
            from: { x: 0, y: 52, scale: 0.94, opacity: 0 },
            to: { x: 0, y: 0, scale: 1, opacity: 1 },
            arc: 28,
            bendX: 0,
            autoRotate: false
          }
        },
        {
          id: "trivia-victory.winner-impact",
          type: "impact",
          start: 0.48,
          duration: 0.56,
          slot: "targetElement",
          params: {
            magnitude: 4,
            cycles: 1,
            scaleX: 1.07,
            scaleY: 0.94,
            strength: 32,
            color: "#ffd35a",
            particles: {
              count: 28,
              size: 4,
              speed: 260,
              life: 760
            }
          }
        },
        {
          id: "trivia-victory.badge-pop",
          type: "fromto",
          start: 0.62,
          duration: 0.54,
          slot: "badgeElement",
          easing: "back.out(2)",
          params: {
            from: { y: 18, scale: 0.62, opacity: 0, rotate: -8 },
            to: { y: 0, scale: 1, opacity: 1, rotate: 0 }
          }
        },
        {
          id: "trivia-victory.gold-bloom",
          type: "stagepulse",
          start: 1.02,
          duration: 0.62,
          slot: "targetElement",
          params: {
            scale: 1.035,
            strength: 24,
            color: "#ffd35a"
          }
        },
        {
          id: "trivia-victory.clear",
          type: "finalhold",
          start: 1.76,
          duration: 0.12,
          slot: "targetElement",
          params: {
            opacity: 1,
            scale: 1,
            strength: 0,
            color: "#ffd35a"
          }
        }
      ]
    },
    defaultParams: {
      color: "#ffd35a"
    },
    themeSlots: {},
    assetSlots: {
      badgeImage: {
        type: "image",
        label: "Victory badge",
        description: "Winner trophy PNG.",
        required: false
      }
    },
    particleHooks: {
      victoryBurst: {
        type: "burst",
        label: "Victory burst",
        description: "Particles around the winning row."
      }
    },
    lottieHooks: {},
    soundHooks: {},
    reducedMotionFallback: reducedGlow("trivia-victory", "targetElement", "#ffd35a"),
    metadata: { source }
  }
];

export default triviaMotionPacks;
