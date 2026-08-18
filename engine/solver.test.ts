import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rankMoves } from "./solver";
import { GameState, PlayerState } from "./types";

const solverSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "solver.ts"),
  "utf-8"
);

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
    roundNumber: 1,
    error: null,
    roundEndReason: null,
    passStreak: 0,
    lastWinnerId: null,
    batidaType: null,
    ...overrides,
  };
}

describe("rankMoves", () => {
  it("returns one move per valid end for a piece that fits both ends", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "3-5", a: 3, b: 5 }, { id: "0-0", a: 0, b: 0 }] })],
    });
    const moves = rankMoves(state);
    const threeFive = moves.filter((m) => m.piece.id === "3-5");
    expect(threeFive).toHaveLength(2);
    expect(threeFive.map((m) => m.end).sort()).toEqual(["left", "right"]);
  });

  it("excludes pieces that do not fit either open end", () => {
    const state = makeState({
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "1-2", a: 1, b: 2 }, { id: "0-0", a: 0, b: 0 }] })],
    });
    expect(rankMoves(state).some((m) => m.piece.id === "1-2")).toBe(false);
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
            { id: "0-0", a: 0, b: 0 },
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

  it("breaks score ties by preferring the higher pip-sum piece", () => {
    const state = makeState({
      players: [makePlayer({ id: 0, role: "user", hand: [{ id: "1-2", a: 1, b: 2 }] })],
    });
    // Single-player state (no opponents/partner): with an empty board and hand.length===1
    // this is a finishing move, so tie-break doesn't apply to a single move. Use two
    // pieces instead, neither finishing, to compare pip-sum tiebreak with equal scores.
    void state;

    const twoPieceState = makeState({
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
    const moves = rankMoves(twoPieceState);
    expect(moves).toHaveLength(2);
    expect(moves[0].score).toBe(moves[1].score);
    expect(moves[0].piece.id).toBe("4-5");
  });

  it("penalizes closing a suit the partner has played often, in duplas mode", () => {
    const state = makeState({
      config: { ...makeState({}).config, mode: "duplas" },
      board: { sequence: [{ piece: { id: "2-2", a: 2, b: 2 }, leftValue: 2, rightValue: 2 }], leftEnd: 2, rightEnd: 2 },
      players: [
        makePlayer({ id: 0, role: "user", team: "A", hand: [{ id: "2-6", a: 2, b: 6 }, { id: "0-0", a: 0, b: 0 }] }),
        makePlayer({ id: 1, role: "opponent", team: "B" }),
        makePlayer({ id: 2, role: "partner", team: "A", suitPlayCount: { ...emptySuitCount(), 2: 3 } }),
        makePlayer({ id: 3, role: "opponent", team: "B" }),
      ],
    });
    const move = rankMoves(state).find((m) => m.piece.id === "2-6")!;
    expect(move.reasoning.some((r) => r.includes("parceiro"))).toBe(true);
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

  describe("opponent mobility (case-1 regression)", () => {
    it("scores every left-end (0) move above every right-end (6) move when the user holds nearly all 6-pieces", () => {
      const state = makeState({
        config: { ...makeState({}).config, numPlayers: 2 },
        board: {
          sequence: [{ piece: { id: "0-6", a: 0, b: 6 }, leftValue: 0, rightValue: 6 }],
          leftEnd: 0,
          rightEnd: 6,
        },
        players: [
          makePlayer({
            id: 0,
            role: "user",
            hand: [
              { id: "1-6", a: 1, b: 6 },
              { id: "2-6", a: 2, b: 6 },
              { id: "3-6", a: 3, b: 6 },
              { id: "4-6", a: 4, b: 6 },
              { id: "5-6", a: 5, b: 6 },
              { id: "0-2", a: 0, b: 2 },
            ],
          }),
          makePlayer({ id: 1, role: "opponent" }),
        ],
      });
      const moves = rankMoves(state);
      const leftMoves = moves.filter((m) => m.end === "left");
      const rightMoves = moves.filter((m) => m.end === "right");
      expect(leftMoves.length).toBeGreaterThan(0);
      expect(rightMoves.length).toBeGreaterThan(0);
      const minLeftScore = Math.min(...leftMoves.map((m) => m.score));
      const maxRightScore = Math.max(...rightMoves.map((m) => m.score));
      expect(minLeftScore).toBeGreaterThan(maxRightScore);

      const [topMove] = moves;
      expect(
        topMove.reasoning.some((r) => r.includes("possível") || r.includes("Trava"))
      ).toBe(true);
    });
  });

  it("rewards a move that locks the next opponent out entirely (forced pass)", () => {
    const state = makeState({
      config: { ...makeState({}).config, numPlayers: 3 },
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "1-3", a: 1, b: 3 },
          ],
        }),
        // The next opponent (id 1) is void in suit 4 only.
        makePlayer({ id: 1, role: "opponent", voidSuits: [4] }),
        // A second, fully-known opponent holds every other unaccounted-for piece touching
        // suit 3, so once the board's other 3-containing pieces are placed/held, suit 3 has
        // zero remaining unknown candidates for player 1.
        makePlayer({
          id: 2,
          role: "opponent",
          hand: [
            { id: "0-3", a: 0, b: 3 },
            { id: "2-3", a: 2, b: 3 },
            { id: "3-5", a: 3, b: 5 },
            { id: "3-6", a: 3, b: 6 },
          ],
        }),
      ],
    });
    const moves = rankMoves(state);
    // Playing 3-4 turns the changed end to 4 (void for player 1) and leaves the other end
    // at 3, which now has zero unknown candidates either — total lockout.
    const lockMove = moves.find((m) => m.piece.id === "3-4")!;
    // Playing 1-3 turns the changed end to 1, which still has unknown candidates for player 1.
    const nonLockMove = moves.find((m) => m.piece.id === "1-3")!;
    expect(lockMove.reasoning.some((r) => r.includes("Trava o adversário"))).toBe(true);
    expect(nonLockMove.reasoning.some((r) => r.includes("Trava o adversário"))).toBe(false);
    for (const other of moves) {
      if (other === lockMove) continue;
      expect(lockMove.score).toBeGreaterThanOrEqual(other.score);
    }
  });

  it("ranks a finishing move above any non-finishing move regardless of other terms", () => {
    const state = makeState({
      config: { ...makeState({}).config, numPlayers: 2 },
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [{ id: "3-4", a: 3, b: 4 }],
        }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const nonFinishingState = makeState({
      config: { ...makeState({}).config, numPlayers: 2 },
      board: { sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }], leftEnd: 3, rightEnd: 3 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "3-4", a: 3, b: 4 },
            { id: "0-0", a: 0, b: 0 },
          ],
        }),
        makePlayer({ id: 1, role: "opponent" }),
      ],
    });
    const [finishMove] = rankMoves(state);
    const bestNonFinishing = Math.max(...rankMoves(nonFinishingState).map((m) => m.score));
    expect(finishMove.score).toBeGreaterThan(bestNonFinishing);
  });

  describe("finish tiers", () => {
    it("classifies la-e-lo when ends (2,5) are batted with the bridging piece 2-5", () => {
      const state = makeState({
        board: { sequence: [{ piece: { id: "2-5", a: 2, b: 5 }, leftValue: 2, rightValue: 5 }], leftEnd: 2, rightEnd: 5 },
        players: [makePlayer({ id: 0, role: "user", hand: [{ id: "2-5", a: 2, b: 5 }] })],
      });
      const [move] = rankMoves(state);
      expect(move.reasoning.some((r) => r.includes("lá-e-lô"))).toBe(true);
    });

    it("regression: ends (5,5) batted with 2-5 is NOT la-e-lo", () => {
      const state = makeState({
        board: { sequence: [{ piece: { id: "5-5", a: 5, b: 5 }, leftValue: 5, rightValue: 5 }], leftEnd: 5, rightEnd: 5 },
        players: [makePlayer({ id: 0, role: "user", hand: [{ id: "2-5", a: 2, b: 5 }] })],
      });
      const [move] = rankMoves(state);
      expect(move.reasoning.some((r) => r.includes("lá-e-lô"))).toBe(false);
    });

    it("classifies carroca when batting with a double on a non-matching end", () => {
      const state = makeState({
        board: { sequence: [{ piece: { id: "3-4", a: 3, b: 4 }, leftValue: 3, rightValue: 4 }], leftEnd: 3, rightEnd: 4 },
        players: [makePlayer({ id: 0, role: "user", hand: [{ id: "4-4", a: 4, b: 4 }] })],
      });
      const [move] = rankMoves(state);
      expect(move.reasoning.some((r) => r.includes("carroça"))).toBe(true);
    });

    it("classifies cruzada when ends (4,4) are batted with the double 4-4", () => {
      const state = makeState({
        board: { sequence: [{ piece: { id: "4-4", a: 4, b: 4 }, leftValue: 4, rightValue: 4 }], leftEnd: 4, rightEnd: 4 },
        players: [makePlayer({ id: 0, role: "user", hand: [{ id: "4-4", a: 4, b: 4 }] })],
      });
      const [move] = rankMoves(state);
      expect(move.reasoning.some((r) => r.includes("cruzada"))).toBe(true);
    });

    it("regression: a lá-e-lô finish outscores a carroça finish (no double-discard leak into finishing moves)", () => {
      // Same board (ends 4 and 5); the hand holds both the bridging 4-5
      // (lá-e-lô, tier 2) and the double 5-5 (carroça, tier 1). Either bats.
      const state = makeState({
        board: { sequence: [{ piece: { id: "4-5", a: 4, b: 5 }, leftValue: 4, rightValue: 5 }], leftEnd: 4, rightEnd: 5 },
        players: [
          makePlayer({
            id: 0,
            role: "user",
            hand: [
              { id: "4-5", a: 4, b: 5 },
              { id: "5-5", a: 5, b: 5 },
            ],
          }),
        ],
      });
      // Neither is truly "finishing" with 2 pieces in hand — shrink to 1 piece
      // per scenario so each move IS the batida, then compare scores.
      const laELoState = { ...state, players: [{ ...state.players[0], hand: [{ id: "4-5", a: 4 as const, b: 5 as const }] }] };
      const carrocaState = { ...state, players: [{ ...state.players[0], hand: [{ id: "5-5", a: 5 as const, b: 5 as const }] }] };
      const bestLaELo = rankMoves(laELoState)[0];
      const bestCarroca = rankMoves(carrocaState)[0];
      expect(bestLaELo.reasoning.some((r) => r.includes("lá-e-lô"))).toBe(true);
      expect(bestCarroca.reasoning.some((r) => r.includes("carroça"))).toBe(true);
      expect(bestLaELo.score).toBeGreaterThan(bestCarroca.score);
      // And the finishing carroça must not carry the hand-management bonus.
      expect(bestCarroca.reasoning.some((r) => r.includes("Alivia"))).toBe(false);
    });
  });

  describe("la-e-lo setup", () => {
    it("rewards holding the bridging piece when the post-move ends are distinct", () => {
      const state = makeState({
        board: { sequence: [{ piece: { id: "3-5", a: 3, b: 5 }, leftValue: 3, rightValue: 5 }], leftEnd: 3, rightEnd: 5 },
        players: [
          makePlayer({
            id: 0,
            role: "user",
            hand: [
              { id: "3-6", a: 3, b: 6 },
              { id: "5-6", a: 5, b: 6 },
            ],
          }),
        ],
      });
      // Playing 3-6 on the left end (3) leaves postLeft=6, postRight=5 (distinct), and the
      // user still holds the bridging piece 5-6.
      const move = rankMoves(state).find((m) => m.piece.id === "3-6" && m.end === "left")!;
      expect(move.reasoning.some((r) => r.includes("Mantém o"))).toBe(true);
    });

    it("gives no setup bonus when the post-move ends end up equal", () => {
      const state = makeState({
        board: { sequence: [{ piece: { id: "3-5", a: 3, b: 5 }, leftValue: 3, rightValue: 5 }], leftEnd: 3, rightEnd: 5 },
        players: [
          makePlayer({
            id: 0,
            role: "user",
            hand: [
              { id: "3-5", a: 3, b: 5 },
              { id: "0-0", a: 0, b: 0 },
            ],
          }),
        ],
      });
      // Playing 3-5 on the right end (5) leaves postLeft=3, postRight=3 (equal) — no
      // lá-e-lô setup is possible once the ends match.
      const move = rankMoves(state).find((m) => m.piece.id === "3-5" && m.end === "right")!;
      expect(move.reasoning.some((r) => r.includes("Mantém o"))).toBe(false);
    });
  });

  it("rewards discarding a double over an equivalent non-double, non-finishing move", () => {
    const doubleState = makeState({
      board: { sequence: [{ piece: { id: "1-2", a: 1, b: 2 }, leftValue: 1, rightValue: 2 }], leftEnd: 1, rightEnd: 2 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "2-2", a: 2, b: 2 },
            { id: "0-0", a: 0, b: 0 },
          ],
        }),
      ],
    });
    const nonDoubleState = makeState({
      board: { sequence: [{ piece: { id: "1-2", a: 1, b: 2 }, leftValue: 1, rightValue: 2 }], leftEnd: 1, rightEnd: 2 },
      players: [
        makePlayer({
          id: 0,
          role: "user",
          hand: [
            { id: "2-5", a: 2, b: 5 },
            { id: "0-0", a: 0, b: 0 },
          ],
        }),
      ],
    });
    const doubleMove = rankMoves(doubleState).find((m) => m.piece.id === "2-2")!;
    const nonDoubleMove = rankMoves(nonDoubleState).find((m) => m.piece.id === "2-5")!;
    expect(doubleMove.reasoning.some((r) => r.includes("dobra pesada"))).toBe(true);
    expect(doubleMove.score).toBeGreaterThan(nonDoubleMove.score);
  });

  it("does not use any removed reasoning strings (Castiga / Descarta peça pesada)", () => {
    expect(solverSource.includes("Castiga")).toBe(false);
    expect(solverSource.includes("Descarta peça pesada")).toBe(false);
  });
});
