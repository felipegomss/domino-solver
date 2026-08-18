import { describe, expect, it } from "vitest";
import { createDeck } from "./deck";
import {
  applySuitPlayed,
  filterByPlayableEnds,
  getCandidatePieces,
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
    roundNumber: 1,
    error: null,
    roundEndReason: null,
    passStreak: 0,
    lastWinnerId: null,
    batidaType: null,
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

describe("filterByPlayableEnds", () => {
  it("returns the whole pool on an empty board", () => {
    const pool = [{ id: "0-0", a: 0, b: 0 } as const, { id: "1-2", a: 1, b: 2 } as const];
    expect(filterByPlayableEnds(pool, null, null, [])).toEqual(pool);
  });

  it("keeps only pieces matching an open, non-void end", () => {
    const pool = createDeck();
    const result = filterByPlayableEnds(pool, 3, 5, []);
    expect(result.every((p) => p.a === 3 || p.b === 3 || p.a === 5 || p.b === 5)).toBe(true);
    expect(result.some((p) => p.id === "1-2")).toBe(false);
  });

  it("excludes ends whose value is in voidSuits", () => {
    const pool = createDeck();
    const result = filterByPlayableEnds(pool, 3, 5, [3]);
    expect(result.every((p) => p.a === 5 || p.b === 5)).toBe(true);
    // "3-1" only matches the voided end (3), so it must be excluded.
    expect(result.some((p) => p.id === "1-3")).toBe(false);
    // "3-5" still qualifies via the non-void end (5).
    expect(result.some((p) => p.id === "3-5")).toBe(true);
  });

  it("returns an empty array when both open ends are void", () => {
    const pool = createDeck();
    expect(filterByPlayableEnds(pool, 3, 5, [3, 5])).toEqual([]);
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
