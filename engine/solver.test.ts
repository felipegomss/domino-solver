import { describe, expect, it } from "vitest";
import { rankMoves } from "./solver";
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
    board: { sequence: [], leftEnd: null, rightEnd: null },
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

describe("rankMoves", () => {
  it("returns one move per valid end for a piece that fits both ends", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "3-5", a: 3, b: 5 }] })],
    });
    const moves = rankMoves(state);
    expect(moves).toHaveLength(2);
    expect(moves.map((m) => m.end).sort()).toEqual(["left", "right"]);
  });

  it("excludes pieces that do not fit either open end", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "1-2", a: 1, b: 2 }] })],
    });
    expect(rankMoves(state)).toHaveLength(0);
  });

  it("allows any piece, with a single move each, on an empty board", () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "1-2", a: 1, b: 2 },
            { id: "4-4", a: 4, b: 4 },
          ],
        }),
      ],
    });
    const moves = rankMoves(state);
    expect(moves).toHaveLength(2);
  });

  it("scores a punish-pass move higher than a neutral one", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      currentPlayerIndex: 0,
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "3-4", a: 3, b: 4 }, { id: "3-1", a: 1, b: 3 }] }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [4] }),
      ],
    });
    const moves = rankMoves(state);
    const punishMove = moves.find((m) => m.piece.id === "3-4")!;
    const neutralMove = moves.find((m) => m.piece.id === "3-1")!;
    expect(punishMove.score).toBeGreaterThan(neutralMove.score);
    expect(punishMove.reasoning.some((r) => r.includes("Castiga"))).toBe(true);
  });

  it("penalizes closing a suit the partner has played often, in duplas mode", () => {
    const state = makeState({
      config: { ...makeState({}).config, mode: "duplas" },
      board: { sequence: [{ piece: { id: "2-2", a: 2, b: 2 }, leftValue: 2, rightValue: 2 }], leftEnd: 2, rightEnd: 2 },
      players: [
        makePlayer({ id: 0, role: "user", team: "A", hand: [{ id: "2-6", a: 2, b: 6 }] }),
        makePlayer({ id: 1, role: "opponent", team: "B" }),
        makePlayer({ id: 2, role: "partner", team: "A", suitPlayCount: { ...emptySuitCount(), 2: 3 } }),
        makePlayer({ id: 3, role: "opponent", team: "B" }),
      ],
    });
    const [move] = rankMoves(state);
    expect(move.reasoning.some((r) => r.includes("parceiro"))).toBe(true);
  });

  it("sorts moves by score descending", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "3-1", a: 1, b: 3 },
          ],
        }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [4] }),
      ],
    });
    const moves = rankMoves(state);
    for (let i = 1; i < moves.length; i++) {
      expect(moves[i - 1].score).toBeGreaterThanOrEqual(moves[i].score);
    }
  });

  it("returns an empty list when the user has no hand", () => {
    const state = makeState({ players: [makePlayer({ id: 0, role: "user", hand: null })] });
    expect(rankMoves(state)).toEqual([]);
  });

  it("rewards a finishing move that qualifies as lá-e-lô (both ends already equal)", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "3-4", a: 3, b: 4 }] })],
    });
    const [move] = rankMoves(state);
    expect(move.reasoning.some((r) => r.includes("lá-e-lô"))).toBe(true);
  });

  it("does not reward lá-e-lô when the ends differ", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-5", a: 3, b: 5 }, leftValue: 3, rightValue: 5 }], leftEnd: 3, rightEnd: 5 },
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "3-4", a: 3, b: 4 }] })],
    });
    const [move] = rankMoves(state);
    expect(move.reasoning.some((r) => r.includes("lá-e-lô"))).toBe(false);
  });

  it("rewards a finishing move that qualifies as bucha (no opponent has played yet)", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      history: [],
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "3-4", a: 3, b: 4 }] }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const [move] = rankMoves(state);
    expect(move.reasoning.some((r) => r.includes("bucha"))).toBe(true);
  });

  it("does not reward bucha once an opponent has a play in the history", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      history: [{ type: "play", playerId: 1, pieceId: "1-1", end: "left" }],
      players: [
        makePlayer({ id: 0, role: "user", hand: [{ id: "3-4", a: 3, b: 4 }] }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const [move] = rankMoves(state);
    expect(move.reasoning.some((r) => r.includes("bucha"))).toBe(false);
  });

  it("gives a smaller setup bonus for a non-finishing move that equalizes the ends", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-5", a: 3, b: 5 }, leftValue: 3, rightValue: 5 }], leftEnd: 3, rightEnd: 5 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-5", a: 3, b: 5 },
            { id: "3-3", a: 3, b: 3 },
            { id: "3-6", a: 3, b: 6 },
          ],
        }),
      ],
    });
    // Playing 3-5 on the right end (5) leaves rightEnd=3, matching leftEnd=3,
    // and the user still holds 3-3 and 3-6 (both contain suit 3).
    const moves = rankMoves(state);
    const setupMove = moves.find((m) => m.piece.id === "3-5" && m.end === "right")!;
    expect(setupMove.reasoning.some((r) => r.includes("Lá-e-Lô"))).toBe(true);
  });

  it("rewards flexibility when a spare piece can extend the resulting suit", () => {
    const withSpare = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "4-5", a: 4, b: 5 },
          ],
        }),
      ],
    });
    const withoutSpare = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
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
    const spareMove = rankMoves(withSpare).find((m) => m.piece.id === "3-4" && m.end === "left")!;
    const noSpareMove = rankMoves(withoutSpare).find((m) => m.piece.id === "3-4" && m.end === "left")!;
    expect(spareMove.reasoning.some((r) => r.includes("sobressalente"))).toBe(true);
    expect(spareMove.score).toBeGreaterThan(noSpareMove.score);
  });

  it("rewards moves that help lock an opponent out while the user's team is light on pips", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "0-1", a: 0, b: 1 },
          ],
        }),
        makePlayer({ id: 1, role: "opponent", voidSuits: [] }),
        makePlayer({ id: 2, role: "opponent", voidSuits: [4] }),
        makePlayer({ id: 3, role: "opponent", voidSuits: [] }),
      ],
    });
    const move = rankMoves(state).find((m) => m.piece.id === "3-4" && m.end === "left")!;
    expect(move.reasoning.some((r) => r.includes("trancamento"))).toBe(true);
    expect(move.score).toBeGreaterThan(0);
  });

  it("penalizes isolating the partner when a move voids them without also voiding the next opponent, in duplas mode", () => {
    const isolating = makeState({
      config: { ...makeState({}).config, mode: "duplas" },
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          team: "A",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "0-1", a: 0, b: 1 },
          ],
        }),
        makePlayer({ id: 1, role: "opponent", team: "B", voidSuits: [] }),
        makePlayer({ id: 2, role: "partner", team: "A", voidSuits: [4] }),
        makePlayer({ id: 3, role: "opponent", team: "B", voidSuits: [] }),
      ],
    });
    const neutral = makeState({
      config: { ...makeState({}).config, mode: "duplas" },
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          team: "A",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "0-1", a: 0, b: 1 },
          ],
        }),
        makePlayer({ id: 1, role: "opponent", team: "B", voidSuits: [] }),
        makePlayer({ id: 2, role: "partner", team: "A", voidSuits: [] }),
        makePlayer({ id: 3, role: "opponent", team: "B", voidSuits: [] }),
      ],
    });
    const isolateMove = rankMoves(isolating).find((m) => m.piece.id === "3-4" && m.end === "left")!;
    const neutralMove = rankMoves(neutral).find((m) => m.piece.id === "3-4" && m.end === "left")!;
    expect(isolateMove.reasoning.some((r) => r.includes("isolando"))).toBe(true);
    expect(isolateMove.score).toBeLessThan(neutralMove.score);
  });

  it("rewards discarding a double regardless of other factors", () => {
    const doubleState = makeState({
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "2-2", a: 2, b: 2 }] })],
    });
    const nonDoubleState = makeState({
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "2-5", a: 2, b: 5 }] })],
    });
    const [doubleMove] = rankMoves(doubleState);
    const [nonDoubleMove] = rankMoves(nonDoubleState);
    expect(doubleMove.reasoning.some((r) => r.includes("dobra pesada"))).toBe(true);
    expect(doubleMove.score).toBeGreaterThan(nonDoubleMove.score);
  });

  it("rewards pip relief for a heavy piece when another heavy piece remains in hand", () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "5-6", a: 5, b: 6 },
            { id: "4-6", a: 4, b: 6 },
          ],
        }),
      ],
    });
    const move = rankMoves(state).find((m) => m.piece.id === "5-6")!;
    expect(move.reasoning.some((r) => r.includes("Descarta peça pesada"))).toBe(true);
  });

  it("does not reward pip relief when the heavy piece is the only heavy piece left", () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "5-6", a: 5, b: 6 },
            { id: "1-2", a: 1, b: 2 },
          ],
        }),
      ],
    });
    const move = rankMoves(state).find((m) => m.piece.id === "5-6")!;
    expect(move.reasoning.some((r) => r.includes("Descarta peça pesada"))).toBe(false);
  });

  it("breaks score ties by preferring the higher pip-sum piece", () => {
    const state = makeState({
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "1-2", a: 1, b: 2 },
            { id: "4-5", a: 4, b: 5 },
          ],
        }),
      ],
    });
    const moves = rankMoves(state);
    expect(moves).toHaveLength(2);
    expect(moves[0].score).toBe(moves[1].score);
    expect(moves[0].piece.id).toBe("4-5");
  });
});
