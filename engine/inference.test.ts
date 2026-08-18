import { describe, expect, it } from "vitest";
import { createDeck } from "./deck";
import {
  applySuitPlayed,
  computeRoundScore,
  estimateSuitLikelihood,
  getCandidatePieces,
  getScoreKey,
  getUnknownPieces,
  registerPass,
  willSurelyPass,
} from "./inference";
import { GameState, PlayerState } from "./types";

function emptySuitCount(): Record<0 | 1 | 2 | 3 | 4 | 5 | 6, number> {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}

function makePlayer(overrides: Partial<PlayerState>): PlayerState {
  return {
    id: 0,
    role: "user",
    team: null,
    hand: null,
    handSize: 7,
    voidSuits: [],
    suitPlayCount: emptySuitCount(),
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState>): GameState {
  return {
    phase: "playing",
    config: {
      numPlayers: 4,
      mode: "individual",
      direction: "cw",
      handSize: 7,
      boneyardEnabled: false,
      startingPlayer: 0,
    },
    players: [],
    board: { sequence: [], leftEnd: 3, rightEnd: 5 },
    boneyardRemaining: 0,
    currentPlayerIndex: 0,
    history: [],
    scores: {},
    roundNumber: 1,
    error: null,
    roundEndReason: null,
    passStreak: 0,
    lastWinnerId: null,
    roundEndBonus: null,
    ...overrides,
  };
}

describe("registerPass", () => {
  it("adds both open ends to the passing player's voidSuits", () => {
    const state = makeState({
      players: [makePlayer({ id: 1, role: "opponent", voidSuits: [] })],
    });
    const next = registerPass(state, 1);
    expect(next.players[0].voidSuits.sort()).toEqual([3, 5]);
  });

  it("does not duplicate suits already known void", () => {
    const state = makeState({
      players: [makePlayer({ id: 1, role: "opponent", voidSuits: [3] })],
    });
    const next = registerPass(state, 1);
    expect(next.players[0].voidSuits.sort()).toEqual([3, 5]);
  });

  it("ignores null ends (empty board)", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: null, rightEnd: null },
      players: [makePlayer({ id: 1, role: "opponent" })],
    });
    const next = registerPass(state, 1);
    expect(next.players[0].voidSuits).toEqual([]);
  });
});

describe("applySuitPlayed", () => {
  it("counts both suits for a non-double", () => {
    const player = makePlayer({});
    const next = applySuitPlayed(player, { id: "2-5", a: 2, b: 5 });
    expect(next.suitPlayCount[2]).toBe(1);
    expect(next.suitPlayCount[5]).toBe(1);
  });

  it("counts a double only under its own suit", () => {
    const player = makePlayer({});
    const next = applySuitPlayed(player, { id: "3-3", a: 3, b: 3 });
    expect(next.suitPlayCount[3]).toBe(1);
    expect(next.suitPlayCount[0]).toBe(0);
  });
});

describe("getUnknownPieces", () => {
  it("excludes the user's hand and the pieces on the board", () => {
    const state = makeState({
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "0-0", a: 0, b: 0 }] }),
        makePlayer({ id: 1, role: "opponent", hand: null }),
      ],
      board: {
        sequence: [{ piece: { id: "1-1", a: 1, b: 1 }, leftValue: 1, rightValue: 1 }],
        leftEnd: 1,
        rightEnd: 1,
      },
    });
    const unknown = getUnknownPieces(state, createDeck());
    expect(unknown.some((p) => p.id === "0-0")).toBe(false);
    expect(unknown.some((p) => p.id === "1-1")).toBe(false);
    expect(unknown).toHaveLength(26);
  });
});

describe("estimateSuitLikelihood", () => {
  it("returns 0 for a player known void in that suit", () => {
    const state = makeState({
      players: [makePlayer({ id: 1, role: "opponent", voidSuits: [4], handSize: 5 })],
    });
    const likelihood = estimateSuitLikelihood(state, 1, 4, createDeck());
    expect(likelihood).toBe(0);
  });

  it("returns a proportional share among eligible players", () => {
    const state = makeState({
      players: [
        makePlayer({ id: 1, role: "opponent", handSize: 5, voidSuits: [] }),
        makePlayer({ id: 2, role: "opponent", handSize: 5, voidSuits: [] }),
      ],
    });
    const unknown = createDeck().filter((p) => p.a === 4 || p.b === 4);
    const likelihood = estimateSuitLikelihood(state, 1, 4, unknown);
    expect(likelihood).toBeCloseTo(0.5);
  });
});

describe("getScoreKey", () => {
  it("uses the team letter in duplas mode", () => {
    const state = makeState({ config: { ...makeState({}).config, mode: "duplas" } });
    const key = getScoreKey(state, makePlayer({ id: 2, team: "A" }));
    expect(key).toBe("A");
  });

  it("uses the player id in individual mode", () => {
    const state = makeState({});
    const key = getScoreKey(state, makePlayer({ id: 2, team: null }));
    expect(key).toBe("2");
  });
});

describe("computeRoundScore", () => {
  it("sums known and revealed opponent hands for an individual-mode win", () => {
    const state = makeState({
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", hand: [{ id: "6-6", a: 6, b: 6 }], handSize: 1 }),
        makePlayer({ id: 2, role: "opponent", hand: [{ id: "0-1", a: 0, b: 1 }], handSize: 1 }),
      ],
    });
    const result = computeRoundScore(state, 0, createDeck());
    expect(result.winnerKey).toBe("0");
    expect(result.points).toBe(13);
    expect(result.estimated).toBe(false);
  });

  it("estimates points for players whose hand was never revealed", () => {
    const state = makeState({
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", hand: null, handSize: 2 }),
      ],
    });
    const result = computeRoundScore(state, 0, createDeck());
    expect(result.estimated).toBe(true);
    expect(result.points).toBeGreaterThan(0);
  });

  it("excludes the winner's teammate from the point count in duplas mode", () => {
    const state = makeState({
      config: { ...makeState({}).config, mode: "duplas" },
      players: [
        makePlayer({ id: 0, role: "user", team: "A", hand: [] }),
        makePlayer({ id: 1, role: "opponent", team: "B", hand: [{ id: "6-6", a: 6, b: 6 }], handSize: 1 }),
        makePlayer({ id: 2, role: "partner", team: "A", hand: [{ id: "5-5", a: 5, b: 5 }], handSize: 1 }),
        makePlayer({ id: 3, role: "opponent", team: "B", hand: [{ id: "0-1", a: 0, b: 1 }], handSize: 1 }),
      ],
    });
    const result = computeRoundScore(state, 0, createDeck());
    expect(result.winnerKey).toBe("A");
    expect(result.points).toBe(13); // 6-6 + 0-1, partner's 5-5 excluded
  });
});

describe("getCandidatePieces", () => {
  it("returns only unaccounted-for pieces matching an open end", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "0-0", a: 0, b: 0 }] }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const candidates = getCandidatePieces(state, 1, createDeck());
    expect(candidates.every((p) => p.a === 3 || p.b === 3 || p.a === 5 || p.b === 5)).toBe(true);
    expect(candidates.some((p) => p.id === "3-6")).toBe(true);
    expect(candidates.some((p) => p.id === "5-6")).toBe(true);
    expect(candidates.some((p) => p.id === "1-2")).toBe(false);
  });

  it("returns every unaccounted-for piece on an empty board", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: null, rightEnd: null },
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "0-0", a: 0, b: 0 }] }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const candidates = getCandidatePieces(state, 1, createDeck());
    const unknown = getUnknownPieces(state, createDeck());
    expect(candidates).toHaveLength(unknown.length);
  });

  it("excludes pieces already in the user's known hand and already on the board", () => {
    const state = makeState({
      board: {
        sequence: [{ piece: { id: "3-1", a: 1, b: 3 }, leftValue: 3, rightValue: 1 }],
        leftEnd: 3,
        rightEnd: 1,
      },
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "3-3", a: 3, b: 3 }] }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const candidates = getCandidatePieces(state, 1, createDeck());
    expect(candidates.some((p) => p.id === "3-3")).toBe(false);
    expect(candidates.some((p) => p.id === "3-1")).toBe(false);
  });

  it("respects voidSuits: a player void in one open end only gets candidates for the other end", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [3] }),
      ],
    });
    const candidates = getCandidatePieces(state, 1, createDeck());
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((p) => p.a === 5 || p.b === 5)).toBe(true);
  });

  it("returns zero candidates for a player void in both open-end values", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [3, 5] }),
      ],
    });
    const candidates = getCandidatePieces(state, 1, createDeck());
    expect(candidates).toHaveLength(0);
  });

  it("returns an empty array when the playerId does not resolve to a player", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [makePlayer({ id: 0, role: "user", hand: [] })],
    });
    expect(getCandidatePieces(state, 99, createDeck())).toEqual([]);
  });
});

describe("getCandidatePieces with a known hand", () => {
  it("draws from the player's own hand instead of the unaccounted-for pool", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "0-1", a: 0, b: 1 },
          ],
        }),
      ],
    });
    const candidates = getCandidatePieces(state, 0, createDeck()).map((p) => p.id);
    // 3-4 fits the open 3; 0-1 fits neither end. Neither may come from the
    // unknown pool, which excludes everything the user is holding.
    expect(candidates).toEqual(["3-4"]);
  });
});

describe("willSurelyPass", () => {
  it("is true when the player is void in both open ends and the boneyard is empty", () => {
    const state = makeState({
      config: { ...makeState({}).config, boneyardEnabled: true },
      boneyardRemaining: 0,
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [3, 5] }),
      ],
    });
    expect(willSurelyPass(state, 1, createDeck())).toBe(true);
  });

  it("is false while the boneyard still has pieces, even with zero candidates", () => {
    const state = makeState({
      config: { ...makeState({}).config, boneyardEnabled: true },
      boneyardRemaining: 3,
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [3, 5] }),
      ],
    });
    expect(willSurelyPass(state, 1, createDeck())).toBe(false);
  });

  it("is false on an empty board", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: null, rightEnd: null },
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [0, 1, 2, 3, 4, 5, 6] }),
      ],
    });
    expect(willSurelyPass(state, 1, createDeck())).toBe(false);
  });

  it("is false when the player still has candidate pieces", () => {
    const state = makeState({
      board: { sequence: [], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({ id: 0, role: "user", hand: [] }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    expect(willSurelyPass(state, 1, createDeck())).toBe(false);
  });
});
