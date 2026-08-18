# Solver de Dominó (Duplo-6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js app that tracks a live classic double-6 domino match and recommends ranked moves with strategic reasoning.

**Architecture:** Pure, fully-tested TypeScript engine (`engine/`: deck, inference, solver) drives a pure reducer (`hooks/gameReducer.ts`); a thin `useDominoGame` hook adds React state + an undo stack on top. UI components in `components/` are presentational and are verified manually via the dev server in a browser (no component test framework is added — see "Testing Strategy" below). No `src/` directory; everything lives at the repo root next to the existing `app/`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, `lucide-react` for icons, `vitest` for engine/reducer unit tests.

**Design doc:** `docs/superpowers/specs/2026-08-18-domino-solver-design.md`

**Testing Strategy:** The engine (`engine/deck.ts`, `engine/inference.ts`, `engine/solver.ts`) and the pure reducer (`hooks/gameReducer.ts`) contain all the business logic and are fully unit-tested with `vitest` (TDD: test-first for every task that touches these files). `hooks/useDominoGame.ts` is a 15-line wrapper (React state + undo stack) with no branching logic of its own — it is verified by using the app. UI components are presentational Tailwind/React — they are verified by running `pnpm dev` and exercising the flows described in Task 16, per this project's convention of browser-verifying UI changes rather than adding a component-test framework that doesn't otherwise exist in this repo.

---

### Task 1: Project dependencies and test tooling

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run:
```bash
pnpm add lucide-react
pnpm add -D vitest
```

- [ ] **Step 2: Add the `test` script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify vitest runs with no test files**

Run: `pnpm test`
Expected: `No test files found` (non-zero exit is fine at this point — there are no tests yet). If it errors on config parsing, fix `vitest.config.ts` before continuing.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add lucide-react and vitest"
```

---

### Task 2: Core types (`engine/types.ts`)

**Files:**
- Create: `engine/types.ts`

No unit tests for this file — it has no runtime behavior, only type declarations. Every later task imports from it, so getting the shapes right now avoids churn later.

- [ ] **Step 1: Write the file**

```ts
export type Suit = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Piece {
  id: string; // canonical `${a}-${b}` with a <= b
  a: Suit;
  b: Suit;
}

export type End = "left" | "right";

export interface PlacedPiece {
  piece: Piece;
  leftValue: Suit;
  rightValue: Suit;
}

export interface Board {
  sequence: PlacedPiece[];
  leftEnd: Suit | null;
  rightEnd: Suit | null;
}

export type PlayerRole = "user" | "partner" | "opponent";
export type Team = "A" | "B";

export interface PlayerState {
  id: number;
  role: PlayerRole;
  team: Team | null;
  hand: Piece[] | null; // known only for the user, or a player whose hand was revealed
  handSize: number;
  voidSuits: Suit[];
  suitPlayCount: Record<Suit, number>;
}

export type GameMode = "individual" | "duplas";
export type Direction = "cw" | "ccw";

export interface GameConfig {
  numPlayers: 2 | 3 | 4;
  mode: GameMode;
  direction: Direction;
  handSize: number;
  boneyardEnabled: boolean;
  startingPlayer: number;
}

export interface PlayMove {
  type: "play";
  playerId: number;
  pieceId: string;
  end: End;
}
export interface PassMove {
  type: "pass";
  playerId: number;
  drewFirst: boolean;
}
export interface DrawMove {
  type: "draw";
  playerId: number;
  count: number;
  pieceId?: string;
}
export type Move = PlayMove | PassMove | DrawMove;

export type GamePhase = "setup" | "playing" | "round-end" | "finished";
export type RoundEndReason = "batida" | "lock" | null;

export interface GameState {
  phase: GamePhase;
  config: GameConfig;
  players: PlayerState[];
  board: Board;
  boneyardRemaining: number;
  currentPlayerIndex: number;
  history: Move[];
  scores: Record<string, number>;
  roundNumber: number;
  error: string | null;
  roundEndReason: RoundEndReason;
  passStreak: number;
  lastWinnerId: number | null;
  roundEndBonus: { laELo: boolean; bucha: boolean } | null;
}
```

`roundEndBonus` records whether the batida that just ended the round qualified
for the "lá-e-lô" bonus (both ends were equal right before the winning play)
and/or the "bucha" bonus (no opponent had played a single piece yet). Both
double the round's points; if both are true they compound (×4 total). See
Task 6 for detection logic and Task 15 for how it's surfaced in the UI.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (the file has no dependents yet, so this just checks syntax).

- [ ] **Step 3: Commit**

```bash
git add engine/types.ts
git commit -m "feat: add domino engine core types"
```

---

### Task 3: Deck (`engine/deck.ts`)

**Files:**
- Create: `engine/deck.ts`
- Test: `engine/deck.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { createDeck, handPipSum, isDouble, pipSum } from "./deck";

describe("createDeck", () => {
  it("creates all 28 double-6 pieces exactly once", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(28);
    const ids = new Set(deck.map((p) => p.id));
    expect(ids.size).toBe(28);
    expect(ids.has("0-0")).toBe(true);
    expect(ids.has("6-6")).toBe(true);
    expect(ids.has("2-5")).toBe(true);
  });

  it("always returns canonical pieces with a <= b", () => {
    const deck = createDeck();
    for (const piece of deck) {
      expect(piece.a).toBeLessThanOrEqual(piece.b);
    }
  });
});

describe("isDouble", () => {
  it("returns true only when both sides match", () => {
    expect(isDouble({ id: "3-3", a: 3, b: 3 })).toBe(true);
    expect(isDouble({ id: "2-5", a: 2, b: 5 })).toBe(false);
  });
});

describe("pipSum and handPipSum", () => {
  it("sums the pips of a single piece", () => {
    expect(pipSum({ id: "2-5", a: 2, b: 5 })).toBe(7);
  });

  it("sums pips across a hand", () => {
    const hand = [
      { id: "2-5", a: 2 as const, b: 5 as const },
      { id: "0-0", a: 0 as const, b: 0 as const },
      { id: "6-6", a: 6 as const, b: 6 as const },
    ];
    expect(handPipSum(hand)).toBe(19);
  });

  it("returns 0 for an empty hand", () => {
    expect(handPipSum([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test engine/deck.test.ts`
Expected: FAIL with `Cannot find module './deck'`.

- [ ] **Step 3: Write the implementation**

```ts
import { Piece, Suit } from "./types";

export function createDeck(): Piece[] {
  const deck: Piece[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push({ id: `${a}-${b}`, a: a as Suit, b: b as Suit });
    }
  }
  return deck;
}

export function isDouble(piece: Piece): boolean {
  return piece.a === piece.b;
}

export function pipSum(piece: Piece): number {
  return piece.a + piece.b;
}

export function handPipSum(pieces: Piece[]): number {
  return pieces.reduce((sum, p) => sum + pipSum(p), 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test engine/deck.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/deck.ts engine/deck.test.ts
git commit -m "feat: add domino deck generation and pip helpers"
```

---

### Task 4: Inference engine (`engine/inference.ts`)

**Files:**
- Create: `engine/inference.ts`
- Test: `engine/inference.test.ts`

Depends on Tasks 2 and 3.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { createDeck } from "./deck";
import {
  applySuitPlayed,
  computeRoundScore,
  estimateSuitLikelihood,
  getScoreKey,
  getUnknownPieces,
  registerPass,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test engine/inference.test.ts`
Expected: FAIL with `Cannot find module './inference'`.

- [ ] **Step 3: Write the implementation**

```ts
import { handPipSum } from "./deck";
import { GameState, Piece, PlayerState, Suit } from "./types";

export function registerPass(state: GameState, playerId: number): GameState {
  const { leftEnd, rightEnd } = state.board;
  const values = [leftEnd, rightEnd].filter((v): v is Suit => v !== null);
  return {
    ...state,
    players: state.players.map((p) => {
      if (p.id !== playerId) return p;
      const voidSuits = Array.from(new Set([...p.voidSuits, ...values]));
      return { ...p, voidSuits };
    }),
  };
}

export function applySuitPlayed(player: PlayerState, piece: Piece): PlayerState {
  const suits = piece.a === piece.b ? [piece.a] : [piece.a, piece.b];
  const suitPlayCount = { ...player.suitPlayCount };
  for (const s of suits) suitPlayCount[s] = (suitPlayCount[s] ?? 0) + 1;
  return { ...player, suitPlayCount };
}

export function getUnknownPieces(state: GameState, deck: Piece[]): Piece[] {
  const knownIds = new Set<string>();
  for (const p of state.players) {
    if (p.hand) for (const piece of p.hand) knownIds.add(piece.id);
  }
  for (const placed of state.board.sequence) knownIds.add(placed.piece.id);
  return deck.filter((p) => !knownIds.has(p.id));
}

export function estimateSuitLikelihood(
  state: GameState,
  playerId: number,
  suit: Suit,
  unknownPieces: Piece[]
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || player.hand) return 0;
  if (player.voidSuits.includes(suit)) return 0;

  const candidateCount = unknownPieces.filter((p) => p.a === suit || p.b === suit).length;
  if (candidateCount === 0) return 0;

  const eligible = state.players.filter((p) => !p.hand && !p.voidSuits.includes(suit));
  const totalEligibleHandSize = eligible.reduce((sum, p) => sum + p.handSize, 0);
  if (totalEligibleHandSize === 0) return 0;

  return Math.min(1, player.handSize / totalEligibleHandSize);
}

export function getScoreKey(state: GameState, player: PlayerState): string {
  return state.config.mode === "duplas" && player.team ? player.team : String(player.id);
}

export function computeRoundScore(
  state: GameState,
  winnerPlayerId: number,
  deck: Piece[]
): { winnerKey: string; points: number; estimated: boolean } {
  const winner = state.players.find((p) => p.id === winnerPlayerId)!;
  const winnerKey = getScoreKey(state, winner);
  const unknown = getUnknownPieces(state, deck);
  const avgUnknownPip = unknown.length > 0 ? handPipSum(unknown) / unknown.length : 0;

  let points = 0;
  let estimated = false;

  for (const player of state.players) {
    if (player.id === winnerPlayerId) continue;
    const onWinnerSide = state.config.mode === "duplas" && player.team !== null && player.team === winner.team;
    if (onWinnerSide) continue;

    if (player.hand) {
      points += handPipSum(player.hand);
    } else {
      estimated = true;
      points += Math.round(avgUnknownPip * player.handSize);
    }
  }

  return { winnerKey, points, estimated };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test engine/inference.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/inference.ts engine/inference.test.ts
git commit -m "feat: add void-suit inference and round scoring"
```

---

### Task 5: Solver (`engine/solver.ts`)

**Files:**
- Create: `engine/solver.ts`
- Test: `engine/solver.test.ts`

Depends on Tasks 2, 3, 4.

- [ ] **Step 1: Write the failing tests**

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test engine/solver.test.ts`
Expected: FAIL with `Cannot find module './solver'`.

- [ ] **Step 3: Write the implementation**

```ts
import { createDeck, handPipSum, isDouble, pipSum } from "./deck";
import { getUnknownPieces } from "./inference";
import { End, GameState, Piece, PlayerState, Suit, Team } from "./types";

export interface RankedMove {
  piece: Piece;
  end: End;
  score: number;
  reasoning: string[];
}

const WEIGHTS = {
  PUNISH_PASS: 20,
  PARTNER_STRONG_SUIT_PENALTY: 15,
  PARTNER_ISOLATE_PENALTY: 10,
  FLEXIBILITY: 4,
  DOUBLE_DISCARD: 8,
  PIP_RELIEF: 1,
  LOCK_INCENTIVE: 6,
  LA_E_LO_FINISH: 25,
  BUCHA_FINISH: 25,
  LA_E_LO_SETUP: 10,
};
const STRONG_SUIT_THRESHOLD = 2;
const HEAVY_PIP_THRESHOLD = 8;

function opponentsOf(state: GameState, playerId: number, team: Team | null): PlayerState[] {
  return state.players.filter((p) => p.id !== playerId && (state.config.mode !== "duplas" || p.team !== team));
}

function hasPlayedYet(state: GameState, playerId: number): boolean {
  return state.history.some((m) => m.type === "play" && m.playerId === playerId);
}

function otherValue(piece: Piece, target: Suit): Suit {
  if (piece.a === piece.b) return piece.a;
  return piece.a === target ? piece.b : piece.a;
}

function getPlayerByRole(state: GameState, role: "user" | "partner"): PlayerState | undefined {
  return state.players.find((p) => p.role === role);
}

function getNextPlayer(state: GameState, afterId: number): PlayerState {
  const { numPlayers, direction } = state.config;
  const delta = direction === "cw" ? 1 : -1;
  const nextIndex = (afterId + delta + numPlayers) % numPlayers;
  return state.players[nextIndex];
}

export function rankMoves(state: GameState): RankedMove[] {
  const user = getPlayerByRole(state, "user");
  if (!user || !user.hand) return [];

  const { leftEnd, rightEnd } = state.board;
  const boardEmpty = leftEnd === null && rightEnd === null;
  const partner = getPlayerByRole(state, "partner");
  const deck = createDeck();
  const unknown = getUnknownPieces(state, deck);

  const heavyPiecesRemaining = user.hand.filter((p) => pipSum(p) >= HEAVY_PIP_THRESHOLD || isDouble(p)).length;
  const userPipTotal = handPipSum(user.hand);
  const avgUnknownPip = unknown.length > 0 ? handPipSum(unknown) / unknown.length : 3.5;
  const opponents = state.players.filter((p) => p.role === "opponent");
  const estimatedOpponentAvg =
    opponents.length > 0
      ? (opponents.reduce((sum, o) => sum + o.handSize, 0) / opponents.length) * avgUnknownPip
      : 0;
  const teamIsLight = userPipTotal < estimatedOpponentAvg;

  const moves: RankedMove[] = [];
  const ends: End[] = boardEmpty ? ["left"] : ["left", "right"];

  for (const piece of user.hand) {
    for (const end of ends) {
      const targetValue = boardEmpty ? null : end === "left" ? leftEnd : rightEnd;
      if (!boardEmpty && piece.a !== targetValue && piece.b !== targetValue) continue;

      const resultingValue: Suit | null = boardEmpty ? null : otherValue(piece, targetValue as Suit);
      const reasoning: string[] = [];
      let score = 0;

      if (resultingValue !== null) {
        const next = getNextPlayer(state, user.id);
        if (next.role === "opponent" && next.voidSuits.includes(resultingValue)) {
          score += WEIGHTS.PUNISH_PASS;
          reasoning.push(
            `Castiga o adversário seguinte, que já passou no naipe ${resultingValue} (+${WEIGHTS.PUNISH_PASS})`
          );
        }

        if (partner) {
          if (targetValue !== null && partner.suitPlayCount[targetValue] >= STRONG_SUIT_THRESHOLD) {
            score -= WEIGHTS.PARTNER_STRONG_SUIT_PENALTY;
            reasoning.push(
              `Fecha um naipe forte do parceiro (${targetValue}) (-${WEIGHTS.PARTNER_STRONG_SUIT_PENALTY})`
            );
          }
          if (partner.voidSuits.includes(resultingValue) && !next.voidSuits.includes(resultingValue)) {
            score -= WEIGHTS.PARTNER_ISOLATE_PENALTY;
            reasoning.push(
              `Deixa uma ponta que só o adversário aproveita, isolando o parceiro (-${WEIGHTS.PARTNER_ISOLATE_PENALTY})`
            );
          }
        }

        const remainingWithValue = user.hand.filter(
          (p) => p.id !== piece.id && (p.a === resultingValue || p.b === resultingValue)
        ).length;
        if (remainingWithValue > 0) {
          const bonus = remainingWithValue * WEIGHTS.FLEXIBILITY;
          score += bonus;
          reasoning.push(`Mantém ${remainingWithValue} peça(s) sobressalente(s) no naipe ${resultingValue} (+${bonus})`);
        }

        if (teamIsLight) {
          const voidCount = opponents.filter((o) => o.voidSuits.includes(resultingValue)).length;
          if (voidCount > 0) {
            const bonus = voidCount * WEIGHTS.LOCK_INCENTIVE;
            score += bonus;
            reasoning.push(`Aproxima o trancamento com sua dupla em vantagem de pontos (+${bonus})`);
          }
        }

        const isFinishingMove = user.hand.length === 1;
        if (isFinishingMove) {
          const boardEndsWereEqual = leftEnd === rightEnd;
          if (boardEndsWereEqual) {
            score += WEIGHTS.LA_E_LO_FINISH;
            reasoning.push(`Bate jogando de lá-e-lô — pontuação da rodada dobra (+${WEIGHTS.LA_E_LO_FINISH})`);
          }
          const rivals = opponentsOf(state, user.id, user.team);
          if (rivals.length > 0 && rivals.every((r) => !hasPlayedYet(state, r.id))) {
            score += WEIGHTS.BUCHA_FINISH;
            reasoning.push(`Bate de bucha — adversários ainda não jogaram nenhuma peça, pontuação dobra (+${WEIGHTS.BUCHA_FINISH})`);
          }
        } else {
          const untouchedEnd = end === "left" ? rightEnd : leftEnd;
          if (untouchedEnd !== null && resultingValue === untouchedEnd) {
            const remainingWithThatValue = user.hand.filter(
              (p) => p.id !== piece.id && (p.a === resultingValue || p.b === resultingValue)
            ).length;
            if (remainingWithThatValue > 0) {
              score += WEIGHTS.LA_E_LO_SETUP;
              reasoning.push(
                `Iguala as pontas e mantém peça(s) no naipe ${resultingValue} — abre caminho para bater de Lá-e-Lô (+${WEIGHTS.LA_E_LO_SETUP})`
              );
            }
          }
        }
      }

      if (isDouble(piece)) {
        score += WEIGHTS.DOUBLE_DISCARD;
        reasoning.push(`Alivia uma dobra pesada da mão (+${WEIGHTS.DOUBLE_DISCARD})`);
      }
      if (pipSum(piece) >= HEAVY_PIP_THRESHOLD && heavyPiecesRemaining > 1) {
        const bonus = pipSum(piece) * WEIGHTS.PIP_RELIEF;
        score += bonus;
        reasoning.push(`Descarta peça pesada (${pipSum(piece)} pontos) enquanto ainda há outras pesadas na mão (+${bonus})`);
      }

      if (reasoning.length === 0) {
        reasoning.push("Jogada válida sem vantagem estratégica adicional identificada.");
      }

      moves.push({ piece, end, score, reasoning });
    }
  }

  return moves.sort((a, b) => b.score - a.score || pipSum(b.piece) - pipSum(a.piece));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test engine/solver.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/solver.ts engine/solver.test.ts
git commit -m "feat: add move-ranking solver with strategic heuristics"
```

---

### Task 6: Game reducer (`hooks/gameReducer.ts`)

**Files:**
- Create: `hooks/gameReducer.ts`
- Test: `hooks/gameReducer.test.ts`

Depends on Tasks 2, 3, 4.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { createInitialState, gameReducer } from "./gameReducer";
import { GameConfig, Piece } from "@/engine/types";

const duplasConfig: GameConfig = {
  numPlayers: 4,
  mode: "duplas",
  direction: "cw",
  handSize: 7,
  boneyardEnabled: false,
  startingPlayer: 0,
};

const twoPlayerConfig: GameConfig = {
  numPlayers: 2,
  mode: "individual",
  direction: "cw",
  handSize: 7,
  boneyardEnabled: true,
  startingPlayer: 0,
};

const userHand: Piece[] = [
  { id: "3-3", a: 3, b: 3 },
  { id: "3-5", a: 3, b: 5 },
];

describe("createInitialState", () => {
  it("starts in the setup phase", () => {
    expect(createInitialState().phase).toBe("setup");
  });
});

describe("SETUP_COMPLETE", () => {
  it("assigns roles and teams for 4-player duplas mode", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand,
    });
    expect(state.phase).toBe("playing");
    expect(state.players[0]).toMatchObject({ role: "user", team: "A" });
    expect(state.players[1]).toMatchObject({ role: "opponent", team: "B" });
    expect(state.players[2]).toMatchObject({ role: "partner", team: "A" });
    expect(state.players[3]).toMatchObject({ role: "opponent", team: "B" });
    expect(state.players[0].hand).toEqual(userHand);
  });

  it("computes the boneyard from dealt total vs 28", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: twoPlayerConfig,
      userHand,
    });
    expect(state.boneyardRemaining).toBe(28 - 2 * 7);
    expect(state.config.boneyardEnabled).toBe(true);
  });
});

describe("PLAY_PIECE", () => {
  function playingState() {
    return gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand,
    });
  }

  it("sets both ends and removes the piece from hand on an empty board", () => {
    const state = playingState();
    const next = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    expect(next.board).toEqual({
      sequence: [{ piece: { id: "3-3", a: 3, b: 3 }, leftValue: 3, rightValue: 3 }],
      leftEnd: 3,
      rightEnd: 3,
    });
    expect(next.players[0].hand).toEqual([{ id: "3-5", a: 3, b: 5 }]);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.error).toBeNull();
  });

  it("rejects a piece that does not fit the chosen end", () => {
    const first = gameReducer(playingState(), { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    const next = gameReducer(
      { ...first, currentPlayerIndex: 0 },
      { type: "PLAY_PIECE", playerId: 0, pieceId: "3-5", end: "left" }
    );
    // 3-5 fits (shares the 3), so force a mismatch with a fabricated hand instead:
    const mismatched = {
      ...first,
      currentPlayerIndex: 0,
      players: first.players.map((p) => (p.id === 0 ? { ...p, hand: [{ id: "1-2", a: 1, b: 2 }] } : p)),
    };
    const rejected = gameReducer(mismatched, { type: "PLAY_PIECE", playerId: 0, pieceId: "1-2", end: "left" });
    expect(rejected.error).toBe("Essa peça não encaixa na ponta escolhida.");
    expect(rejected.board).toEqual(first.board);
  });

  it("rejects a play out of turn", () => {
    const state = playingState();
    const next = gameReducer(state, { type: "PLAY_PIECE", playerId: 1, pieceId: "3-3", end: "left" });
    expect(next.error).toBe("Não é a vez deste jogador.");
  });

  it("marks a batida when the mover's hand reaches zero", () => {
    const oneHand = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [{ id: "3-3", a: 3, b: 3 }],
    });
    const next = gameReducer(oneHand, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    expect(next.phase).toBe("round-end");
    expect(next.roundEndReason).toBe("batida");
  });

  it("flags lá-e-lô false and bucha false once the ends differ and a rival already played", () => {
    const started = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [
        { id: "3-3", a: 3, b: 3 },
        { id: "0-0", a: 0, b: 0 },
      ],
    });
    const afterUserPlay = gameReducer(started, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    // Board is now leftEnd=3, rightEnd=3.
    const afterOpponentPlay = gameReducer(afterUserPlay, { type: "PLAY_PIECE", playerId: 1, pieceId: "3-4", end: "left" });
    // Board is now leftEnd=4, rightEnd=3 — no longer equal — and rival (player 1) has played.
    const partnerDownToOne = {
      ...afterOpponentPlay,
      players: afterOpponentPlay.players.map((p) => (p.id === 2 ? { ...p, handSize: 1 } : p)),
    };
    const battingPlay = gameReducer(partnerDownToOne, { type: "PLAY_PIECE", playerId: 2, pieceId: "1-3", end: "right" });
    expect(battingPlay.phase).toBe("round-end");
    expect(battingPlay.roundEndBonus).toEqual({ laELo: false, bucha: false });
  });

  it("flags bucha true (but laELo false) when batting on the very first move of the round", () => {
    const started = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [{ id: "3-3", a: 3, b: 3 }],
    });
    const batted = gameReducer(started, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    // Board was empty before this play, so laELo (which requires two pre-existing equal
    // ends) does not apply — but no rival has played yet, so bucha does.
    expect(batted.roundEndBonus).toEqual({ laELo: false, bucha: true });
  });

  it("applies a double multiplier to FINISH_ROUND points when roundEndBonus.bucha is true", () => {
    const started = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [{ id: "3-3", a: 3, b: 3 }],
    });
    const batted = gameReducer(started, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    const revealed = gameReducer(batted, {
      type: "REVEAL_HANDS",
      hands: { 1: [{ id: "6-6", a: 6, b: 6 }], 3: [{ id: "0-0", a: 0, b: 0 }] },
    });
    const finished = gameReducer(revealed, { type: "FINISH_ROUND", winnerPlayerId: 0 });
    // Base points = 12 (6-6) + 0 (0-0) = 12. Only bucha applies (x2) since laELo is false here -> 24.
    expect(finished.scores["A"]).toBe(24);
  });
});

describe("PASS", () => {
  it("registers void suits and advances the turn", () => {
    const state = { ...playingStateWithBoard() };
    const next = gameReducer(state, { type: "PASS", playerId: 1 });
    expect(next.players[1].voidSuits.sort()).toEqual([3]);
    expect(next.currentPlayerIndex).toBe(2);
    expect(next.passStreak).toBe(1);
  });

  it("is rejected while the boneyard still has pieces", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: twoPlayerConfig,
      userHand,
    });
    const next = gameReducer(state, { type: "PASS", playerId: 0 });
    expect(next.error).toBe("Ainda há peças no monte — é preciso comprar antes de passar.");
  });

  it("locks the round once every player has passed in a row", () => {
    let state = playingStateWithBoard();
    for (const playerId of [1, 2, 3, 0]) {
      state = gameReducer(state, { type: "PASS", playerId });
    }
    expect(state.phase).toBe("round-end");
    expect(state.roundEndReason).toBe("lock");
  });

  function playingStateWithBoard() {
    const started = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [{ id: "3-3", a: 3, b: 3 }, { id: "3-5", a: 3, b: 5 }],
    });
    return gameReducer(started, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
  }
});

describe("DRAW", () => {
  it("requires a pieceId for the user and adds it to their hand", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: twoPlayerConfig,
      userHand,
    });
    const rejected = gameReducer(state, { type: "DRAW", playerId: 0 });
    expect(rejected.error).toBe("Selecione a peça comprada.");

    const next = gameReducer(state, { type: "DRAW", playerId: 0, pieceId: "6-6" });
    expect(next.players[0].hand).toContainEqual({ id: "6-6", a: 6, b: 6 });
    expect(next.boneyardRemaining).toBe(state.boneyardRemaining - 1);
  });
});

describe("REVEAL_HANDS and FINISH_ROUND", () => {
  it("rejects a reveal that assigns the same piece twice", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand,
    });
    const next = gameReducer(state, {
      type: "REVEAL_HANDS",
      hands: { 1: [{ id: "0-0", a: 0, b: 0 }], 3: [{ id: "0-0", a: 0, b: 0 }] },
    });
    expect(next.error).toBe("Uma mesma peça foi atribuída a mais de um jogador.");
  });

  it("computes and stores the round score, then NEW_ROUND resets the board", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [],
    });
    const revealed = gameReducer(state, {
      type: "REVEAL_HANDS",
      hands: { 1: [{ id: "6-6", a: 6, b: 6 }] },
    });
    const finished = gameReducer(revealed, { type: "FINISH_ROUND", winnerPlayerId: 0 });
    expect(finished.phase).toBe("finished");
    expect(finished.scores["A"]).toBe(12);
    expect(finished.lastWinnerId).toBe(0);

    const newRound = gameReducer(finished, { type: "NEW_ROUND", userHand: [{ id: "1-1", a: 1, b: 1 }] });
    expect(newRound.phase).toBe("playing");
    expect(newRound.board.sequence).toEqual([]);
    expect(newRound.currentPlayerIndex).toBe(0);
    expect(newRound.scores["A"]).toBe(12);
    expect(newRound.roundNumber).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test hooks/gameReducer.test.ts`
Expected: FAIL with `Cannot find module './gameReducer'`.

- [ ] **Step 3: Write the implementation**

```ts
import { createDeck } from "@/engine/deck";
import { applySuitPlayed, computeRoundScore, registerPass } from "@/engine/inference";
import { End, GameConfig, GameState, Move, Piece, PlayerRole, Suit, Team } from "@/engine/types";

export type GameAction =
  | { type: "SETUP_COMPLETE"; config: GameConfig; userHand: Piece[] }
  | { type: "PLAY_PIECE"; playerId: number; pieceId: string; end: End }
  | { type: "PASS"; playerId: number }
  | { type: "DRAW"; playerId: number; pieceId?: string }
  | { type: "REVEAL_HANDS"; hands: Record<number, Piece[]> }
  | { type: "FINISH_ROUND"; winnerPlayerId: number }
  | { type: "NEW_ROUND"; userHand: Piece[] };

const EMPTY_SUIT_COUNT: Record<Suit, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

export function createInitialState(): GameState {
  return {
    phase: "setup",
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
  };
}

function buildPlayers(config: GameConfig, userHand: Piece[]) {
  const players = [];
  for (let id = 0; id < config.numPlayers; id++) {
    let role: PlayerRole = id === 0 ? "user" : "opponent";
    let team: Team | null = null;
    if (config.mode === "duplas" && config.numPlayers === 4) {
      team = id % 2 === 0 ? "A" : "B";
      if (id === 2) role = "partner";
    }
    players.push({
      id,
      role,
      team,
      hand: id === 0 ? [...userHand] : null,
      handSize: id === 0 ? userHand.length : config.handSize,
      voidSuits: [] as Suit[],
      suitPlayCount: { ...EMPTY_SUIT_COUNT },
    });
  }
  return players;
}

function withError(state: GameState, error: string): GameState {
  return { ...state, error };
}

function clearError(state: GameState): GameState {
  return state.error ? { ...state, error: null } : state;
}

function nextPlayerIndex(state: GameState): number {
  const { numPlayers, direction } = state.config;
  const delta = direction === "cw" ? 1 : -1;
  return (state.currentPlayerIndex + delta + numPlayers) % numPlayers;
}

function handleSetupComplete(state: GameState, action: Extract<GameAction, { type: "SETUP_COMPLETE" }>): GameState {
  const { config, userHand } = action;
  const dealtTotal = config.numPlayers * config.handSize;
  const boneyardRemaining = Math.max(0, 28 - dealtTotal);
  return {
    ...createInitialState(),
    phase: "playing",
    config: { ...config, boneyardEnabled: boneyardRemaining > 0 && config.boneyardEnabled },
    players: buildPlayers(config, userHand),
    boneyardRemaining,
    currentPlayerIndex: config.startingPlayer,
  };
}

function handlePlayPiece(state: GameState, action: Extract<GameAction, { type: "PLAY_PIECE" }>): GameState {
  if (state.phase !== "playing") return withError(state, "A partida não está em andamento.");
  if (action.playerId !== state.currentPlayerIndex) return withError(state, "Não é a vez deste jogador.");

  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return withError(state, "Jogador inválido.");

  const piece =
    player.role === "user"
      ? player.hand?.find((p) => p.id === action.pieceId)
      : createDeck().find((p) => p.id === action.pieceId);
  if (!piece) return withError(state, "Peça inválida.");

  const { board } = state;
  const boardEmpty = board.leftEnd === null && board.rightEnd === null;

  let leftEnd: Suit;
  let rightEnd: Suit;
  let placed: { piece: Piece; leftValue: Suit; rightValue: Suit };

  if (boardEmpty) {
    leftEnd = piece.a;
    rightEnd = piece.b;
    placed = { piece, leftValue: piece.a, rightValue: piece.b };
  } else {
    const targetValue = action.end === "left" ? board.leftEnd! : board.rightEnd!;
    if (piece.a !== targetValue && piece.b !== targetValue) {
      return withError(state, "Essa peça não encaixa na ponta escolhida.");
    }
    const resultingValue = piece.a === piece.b ? piece.a : piece.a === targetValue ? piece.b : piece.a;
    if (action.end === "left") {
      leftEnd = resultingValue;
      rightEnd = board.rightEnd!;
      placed = { piece, leftValue: resultingValue, rightValue: targetValue };
    } else {
      rightEnd = resultingValue;
      leftEnd = board.leftEnd!;
      placed = { piece, leftValue: targetValue, rightValue: resultingValue };
    }
  }

  const sequence = !boardEmpty && action.end === "left" ? [placed, ...board.sequence] : [...board.sequence, placed];

  const players = state.players.map((p) => {
    if (p.id !== action.playerId) return p;
    const updated = applySuitPlayed(p, piece);
    if (p.role === "user") {
      return { ...updated, hand: p.hand!.filter((h) => h.id !== piece.id), handSize: p.handSize - 1 };
    }
    return { ...updated, handSize: p.handSize - 1 };
  });

  const mover = players.find((p) => p.id === action.playerId)!;
  const move: Move = { type: "play", playerId: action.playerId, pieceId: piece.id, end: action.end };
  const battedOut = mover.handSize === 0;

  let roundEndBonus: GameState["roundEndBonus"] = null;
  if (battedOut) {
    const laELo = !boardEmpty && board.leftEnd === board.rightEnd;
    const rivals = state.players.filter(
      (p) => p.id !== action.playerId && (state.config.mode !== "duplas" || p.team !== mover.team)
    );
    const bucha = rivals.length > 0 && rivals.every((r) => !state.history.some((m) => m.type === "play" && m.playerId === r.id));
    roundEndBonus = { laELo, bucha };
  }

  return {
    ...state,
    error: null,
    board: { sequence, leftEnd, rightEnd },
    players,
    history: [...state.history, move],
    passStreak: 0,
    phase: battedOut ? "round-end" : "playing",
    roundEndReason: battedOut ? "batida" : null,
    roundEndBonus,
    currentPlayerIndex: battedOut ? state.currentPlayerIndex : nextPlayerIndex(state),
  };
}

function handlePass(state: GameState, action: Extract<GameAction, { type: "PASS" }>): GameState {
  if (state.phase !== "playing") return withError(state, "A partida não está em andamento.");
  if (action.playerId !== state.currentPlayerIndex) return withError(state, "Não é a vez deste jogador.");
  if (state.config.boneyardEnabled && state.boneyardRemaining > 0) {
    return withError(state, "Ainda há peças no monte — é preciso comprar antes de passar.");
  }

  const afterPass = registerPass(state, action.playerId);
  const move: Move = { type: "pass", playerId: action.playerId, drewFirst: state.config.boneyardEnabled };
  const passStreak = state.passStreak + 1;
  const locked = passStreak >= state.config.numPlayers;

  return {
    ...afterPass,
    error: null,
    history: [...state.history, move],
    passStreak,
    phase: locked ? "round-end" : "playing",
    roundEndReason: locked ? "lock" : null,
    currentPlayerIndex: locked ? state.currentPlayerIndex : nextPlayerIndex(state),
  };
}

function handleDraw(state: GameState, action: Extract<GameAction, { type: "DRAW" }>): GameState {
  if (state.phase !== "playing") return withError(state, "A partida não está em andamento.");
  if (action.playerId !== state.currentPlayerIndex) return withError(state, "Não é a vez deste jogador.");
  if (!state.config.boneyardEnabled || state.boneyardRemaining <= 0) {
    return withError(state, "Não há peças no monte para comprar.");
  }

  const player = state.players.find((p) => p.id === action.playerId)!;

  if (player.role === "user") {
    if (!action.pieceId) return withError(state, "Selecione a peça comprada.");
    const piece = createDeck().find((p) => p.id === action.pieceId);
    const alreadyKnown = state.players.some((p) => p.hand?.some((h) => h.id === action.pieceId));
    const onBoard = state.board.sequence.some((s) => s.piece.id === action.pieceId);
    if (!piece || alreadyKnown || onBoard) {
      return withError(state, "Peça comprada inválida ou já em jogo.");
    }
    const players = state.players.map((p) =>
      p.id === action.playerId ? { ...p, hand: [...(p.hand ?? []), piece], handSize: (p.hand?.length ?? 0) + 1 } : p
    );
    return {
      ...state,
      error: null,
      players,
      boneyardRemaining: state.boneyardRemaining - 1,
      history: [...state.history, { type: "draw", playerId: action.playerId, count: 1, pieceId: action.pieceId }],
    };
  }

  const players = state.players.map((p) => (p.id === action.playerId ? { ...p, handSize: p.handSize + 1 } : p));
  return {
    ...state,
    error: null,
    players,
    boneyardRemaining: state.boneyardRemaining - 1,
    history: [...state.history, { type: "draw", playerId: action.playerId, count: 1 }],
  };
}

function handleRevealHands(state: GameState, action: Extract<GameAction, { type: "REVEAL_HANDS" }>): GameState {
  const allRevealedIds = Object.values(action.hands).flat().map((p) => p.id);
  if (new Set(allRevealedIds).size !== allRevealedIds.length) {
    return withError(state, "Uma mesma peça foi atribuída a mais de um jogador.");
  }
  const players = state.players.map((p) => {
    const revealed = action.hands[p.id];
    if (!revealed) return p;
    return { ...p, hand: revealed, handSize: revealed.length };
  });
  return { ...state, error: null, players };
}

function handleFinishRound(state: GameState, action: Extract<GameAction, { type: "FINISH_ROUND" }>): GameState {
  const { winnerKey, points: basePoints } = computeRoundScore(state, action.winnerPlayerId, createDeck());
  let multiplier = 1;
  if (state.roundEndBonus?.laELo) multiplier *= 2;
  if (state.roundEndBonus?.bucha) multiplier *= 2;
  const points = basePoints * multiplier;
  const scores = { ...state.scores, [winnerKey]: (state.scores[winnerKey] ?? 0) + points };
  return { ...state, error: null, phase: "finished", scores, lastWinnerId: action.winnerPlayerId };
}

function handleNewRound(state: GameState, action: Extract<GameAction, { type: "NEW_ROUND" }>): GameState {
  const startingPlayer = state.lastWinnerId ?? state.config.startingPlayer;
  const dealtTotal = state.config.numPlayers * state.config.handSize;
  const boneyardRemaining = Math.max(0, 28 - dealtTotal);
  return {
    ...state,
    phase: "playing",
    error: null,
    board: { sequence: [], leftEnd: null, rightEnd: null },
    players: buildPlayers({ ...state.config, startingPlayer }, action.userHand),
    boneyardRemaining,
    currentPlayerIndex: startingPlayer,
    history: [],
    roundNumber: state.roundNumber + 1,
    roundEndReason: null,
    roundEndBonus: null,
    passStreak: 0,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SETUP_COMPLETE":
      return handleSetupComplete(state, action);
    case "PLAY_PIECE":
      return handlePlayPiece(clearError(state), action);
    case "PASS":
      return handlePass(clearError(state), action);
    case "DRAW":
      return handleDraw(clearError(state), action);
    case "REVEAL_HANDS":
      return handleRevealHands(clearError(state), action);
    case "FINISH_ROUND":
      return handleFinishRound(clearError(state), action);
    case "NEW_ROUND":
      return handleNewRound(clearError(state), action);
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test hooks/gameReducer.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS, all suites (deck, inference, solver, gameReducer).

- [ ] **Step 6: Commit**

```bash
git add hooks/gameReducer.ts hooks/gameReducer.test.ts
git commit -m "feat: add pure game reducer with setup/play/pass/draw/reveal/score actions"
```

---

### Task 7: `useDominoGame` hook

**Files:**
- Create: `hooks/useDominoGame.ts`

This is a thin wrapper with no branching logic (state + an undo stack via `useRef`) — it is verified in Task 16 by using the running app, not by a unit test.

- [ ] **Step 1: Write the hook**

```ts
"use client";

import { useCallback, useRef, useState } from "react";
import { GameState } from "@/engine/types";
import { GameAction, createInitialState, gameReducer } from "./gameReducer";

export function useDominoGame() {
  const [state, setState] = useState<GameState>(createInitialState);
  const pastRef = useRef<GameState[]>([]);

  const dispatch = useCallback((action: GameAction) => {
    setState((prev) => {
      pastRef.current.push(prev);
      return gameReducer(prev, action);
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => pastRef.current.pop() ?? prev);
  }, []);

  return { state, dispatch, undo };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useDominoGame.ts
git commit -m "feat: add useDominoGame hook with undo stack"
```

---

### Task 8: `DominoTile` shared UI primitive

**Files:**
- Create: `components/DominoTile.tsx`

This small shared primitive is used by `SetupWizard`, `UserHand`, `BoardDisplay`, and `RoundEndPanel` (Tasks 9-14) to avoid duplicating piece-rendering markup across five files (DRY). It is verified visually once it's used in Task 9.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Piece } from "@/engine/types";

interface DominoTileProps {
  piece: Piece;
  size?: "sm" | "md" | "lg";
  highlighted?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<DominoTileProps["size"]>, string> = {
  sm: "w-10 h-16 text-sm",
  md: "w-12 h-20 text-base",
  lg: "w-14 h-24 text-lg",
};

export function DominoTile({ piece, size = "md", highlighted = false, disabled = false, selected = false, onClick }: DominoTileProps) {
  const isInteractive = typeof onClick === "function";
  const Tag = isInteractive ? "button" : "div";

  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={isInteractive && !disabled ? onClick : undefined}
      disabled={isInteractive ? disabled : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      aria-label={`Peça ${piece.a}-${piece.b}`}
      className={[
        SIZE_CLASSES[size],
        "flex flex-col shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors duration-150",
        highlighted ? "border-amber-500 ring-2 ring-amber-300" : "border-slate-800",
        selected ? "bg-amber-100" : "",
        disabled ? "opacity-40 pointer-events-none" : "",
        isInteractive && !disabled
          ? "cursor-pointer hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          : "",
      ].join(" ")}
    >
      <span className="flex flex-1 items-center justify-center border-b-2 border-slate-800 font-semibold tabular-nums text-slate-900">
        {piece.a}
      </span>
      <span className="flex flex-1 items-center justify-center font-semibold tabular-nums text-slate-900">
        {piece.b}
      </span>
    </Tag>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/DominoTile.tsx
git commit -m "feat: add shared DominoTile component"
```

---

### Task 9: `SetupWizard`

**Files:**
- Create: `components/SetupWizard.tsx`

Depends on Task 8.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { createDeck } from "@/engine/deck";
import { GameConfig, Piece } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface SetupWizardProps {
  onComplete: (config: GameConfig, userHand: Piece[]) => void;
}

type Step = "players" | "mode" | "direction" | "handSize" | "boneyard" | "starter" | "hand";

const DECK = createDeck();

function StepButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-lg border-2 px-4 py-3 text-left font-semibold transition-colors ${
        active ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("players");
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(4);
  const [mode, setMode] = useState<"individual" | "duplas">("individual");
  const [direction, setDirection] = useState<"cw" | "ccw">("cw");
  const [handSize, setHandSize] = useState(7);
  const [boneyardEnabled, setBoneyardEnabled] = useState(false);
  const [startingPlayer, setStartingPlayer] = useState(0);
  const [selectedHand, setSelectedHand] = useState<Piece[]>([]);

  const dealtTotal = numPlayers * handSize;
  const hasBoneyard = dealtTotal < 28;

  const starterOptions: { id: number; label: string }[] = [{ id: 0, label: "Você" }];
  if (mode === "duplas" && numPlayers === 4) starterOptions.push({ id: 2, label: "Parceiro" });
  for (let i = 1; i < numPlayers; i++) {
    if (mode === "duplas" && numPlayers === 4 && i === 2) continue;
    starterOptions.push({ id: i, label: `Adversário ${i}` });
  }

  function togglePiece(piece: Piece) {
    setSelectedHand((prev) => {
      const exists = prev.some((p) => p.id === piece.id);
      if (exists) return prev.filter((p) => p.id !== piece.id);
      if (prev.length >= handSize) return prev;
      return [...prev, piece];
    });
  }

  function goNext() {
    if (step === "players") setStep(numPlayers === 4 ? "mode" : "direction");
    else if (step === "mode") setStep("direction");
    else if (step === "direction") setStep("handSize");
    else if (step === "handSize") setStep(hasBoneyard ? "boneyard" : "starter");
    else if (step === "boneyard") setStep("starter");
    else if (step === "starter") setStep("hand");
  }

  function goBack() {
    if (step === "hand") setStep("starter");
    else if (step === "starter") setStep(hasBoneyard ? "boneyard" : "handSize");
    else if (step === "boneyard") setStep("handSize");
    else if (step === "handSize") setStep("direction");
    else if (step === "direction") setStep(numPlayers === 4 ? "mode" : "players");
    else if (step === "mode") setStep("players");
  }

  function handleSubmit() {
    onComplete(
      {
        numPlayers,
        mode: numPlayers === 4 ? mode : "individual",
        direction,
        handSize,
        boneyardEnabled: hasBoneyard && boneyardEnabled,
        startingPlayer,
      },
      selectedHand
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Configurar Partida</h1>

      {step === "players" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Quantos jogadores?</h2>
          <div className="grid grid-cols-3 gap-3">
            {[2, 3, 4].map((n) => (
              <StepButton key={n} active={numPlayers === n} onClick={() => setNumPlayers(n as 2 | 3 | 4)}>
                <span className="block text-center">{n}</span>
              </StepButton>
            ))}
          </div>
        </section>
      )}

      {step === "mode" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Modo de jogo</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <StepButton active={mode === "individual"} onClick={() => setMode("individual")}>
              Individual
            </StepButton>
            <StepButton active={mode === "duplas"} onClick={() => setMode("duplas")}>
              Duplas (0+2 vs 1+3)
            </StepButton>
          </div>
        </section>
      )}

      {step === "direction" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Sentido do jogo</h2>
          <div className="grid grid-cols-2 gap-3">
            <StepButton active={direction === "cw"} onClick={() => setDirection("cw")}>
              Horário
            </StepButton>
            <StepButton active={direction === "ccw"} onClick={() => setDirection("ccw")}>
              Anti-horário
            </StepButton>
          </div>
        </section>
      )}

      {step === "handSize" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Pedras iniciais por jogador</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setHandSize((h) => Math.max(1, h - 1))}
              className="min-h-11 min-w-11 rounded-lg border-2 border-slate-300 text-xl font-bold hover:bg-slate-50"
              aria-label="Diminuir"
            >
              −
            </button>
            <span className="w-12 text-center text-2xl font-semibold tabular-nums">{handSize}</span>
            <button
              type="button"
              onClick={() => setHandSize((h) => Math.min(14, h + 1))}
              className="min-h-11 min-w-11 rounded-lg border-2 border-slate-300 text-xl font-bold hover:bg-slate-50"
              aria-label="Aumentar"
            >
              +
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {dealtTotal} de 28 peças distribuídas
            {hasBoneyard ? ` — ${28 - dealtTotal} peças formarão o monte.` : " — todas as peças distribuídas."}
          </p>
        </section>
      )}

      {step === "boneyard" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Regra do monte</h2>
          <div className="grid grid-cols-1 gap-3">
            <StepButton active={boneyardEnabled} onClick={() => setBoneyardEnabled(true)}>
              Com monte — comprar antes de passar
            </StepButton>
            <StepButton active={!boneyardEnabled} onClick={() => setBoneyardEnabled(false)}>
              Sem monte — peças restantes ficam fora do jogo
            </StepButton>
          </div>
        </section>
      )}

      {step === "starter" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Quem inicia?</h2>
          <div className="grid grid-cols-2 gap-3">
            {starterOptions.map((opt) => (
              <StepButton key={opt.id} active={startingPlayer === opt.id} onClick={() => setStartingPlayer(opt.id)}>
                {opt.label}
              </StepButton>
            ))}
          </div>
        </section>
      )}

      {step === "hand" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Selecione sua mão ({selectedHand.length}/{handSize})
          </h2>
          <div className="flex flex-wrap gap-2">
            {DECK.map((piece) => {
              const selected = selectedHand.some((p) => p.id === piece.id);
              return (
                <DominoTile
                  key={piece.id}
                  piece={piece}
                  size="sm"
                  selected={selected}
                  disabled={!selected && selectedHand.length >= handSize}
                  onClick={() => togglePiece(piece)}
                />
              );
            })}
          </div>
        </section>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === "players"}
          className="min-h-11 rounded-lg border-2 border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Voltar
        </button>
        {step === "hand" ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={selectedHand.length !== handSize}
            className="min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
          >
            Começar Partida
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            className="min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800"
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SetupWizard.tsx
git commit -m "feat: add setup wizard component"
```

---

### Task 10: `BoardDisplay`

**Files:**
- Create: `components/BoardDisplay.tsx`

Depends on Task 8.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Board } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface BoardDisplayProps {
  board: Board;
}

export function BoardDisplay({ board }: BoardDisplayProps) {
  if (board.sequence.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400">
        Mesa vazia — aguardando primeira jogada
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-sm font-semibold text-slate-600">
        <span>Ponta esquerda: {board.leftEnd}</span>
        <span className="ml-auto">Ponta direita: {board.rightEnd}</span>
      </div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-4">
        {board.sequence.map((placed, i) => (
          <DominoTile key={`${placed.piece.id}-${i}`} piece={placed.piece} size="sm" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/BoardDisplay.tsx
git commit -m "feat: add board display component"
```

---

### Task 11: `UserHand`

**Files:**
- Create: `components/UserHand.tsx`

Depends on Task 8.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Board, Piece } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface UserHandProps {
  hand: Piece[];
  board: Board;
  topRecommendedPieceId?: string;
}

function isPlayable(piece: Piece, board: Board): boolean {
  if (board.leftEnd === null && board.rightEnd === null) return true;
  return piece.a === board.leftEnd || piece.b === board.leftEnd || piece.a === board.rightEnd || piece.b === board.rightEnd;
}

export function UserHand({ hand, board, topRecommendedPieceId }: UserHandProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-600">Sua mão ({hand.length})</h3>
      <div className="flex flex-wrap gap-2">
        {hand.map((piece) => (
          <DominoTile
            key={piece.id}
            piece={piece}
            size="md"
            disabled={!isPlayable(piece, board)}
            highlighted={piece.id === topRecommendedPieceId}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/UserHand.tsx
git commit -m "feat: add user hand display component"
```

---

### Task 12: `RecommendationList`

**Files:**
- Create: `components/RecommendationList.tsx`

Depends on Task 8 (types only) and `engine/solver.ts` (Task 5).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { Trophy } from "lucide-react";
import { RankedMove } from "@/engine/solver";

interface RecommendationListProps {
  moves: RankedMove[];
  onChoose: (move: RankedMove) => void;
}

export function RecommendationList({ moves, onChoose }: RecommendationListProps) {
  if (moves.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">
        Nenhuma jogada válida — é preciso passar a vez.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600">Jogadas recomendadas</h3>
      {moves.map((move, index) => {
        const isTop = index === 0;
        return (
          <button
            key={`${move.piece.id}-${move.end}`}
            type="button"
            onClick={() => onChoose(move)}
            className={`min-h-11 w-full rounded-xl border-2 p-4 text-left transition-colors ${
              isTop ? "border-amber-500 bg-amber-50 shadow-md" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2">
              {isTop && <Trophy size={20} className="text-amber-600" aria-hidden="true" />}
              <span className="font-semibold text-slate-900">
                Peça {move.piece.a}-{move.piece.b} → ponta {move.end === "left" ? "esquerda" : "direita"}
              </span>
              <span className="ml-auto rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {move.score} pts
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {move.reasoning.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RecommendationList.tsx
git commit -m "feat: add recommendation list component"
```

---

### Task 13: `TurnController`

**Files:**
- Create: `components/TurnController.tsx`

Depends on Task 2 (types).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { End, GameState, Suit } from "@/engine/types";

interface TurnControllerProps {
  state: GameState;
  onPlayOpponentPiece: (a: Suit, b: Suit, end: End) => void;
  onPass: () => void;
  onDraw: () => void;
  onUndo: () => void;
}

const SUITS: Suit[] = [0, 1, 2, 3, 4, 5, 6];

function SuitPicker({ label, value, onChange }: { label: string; value: Suit | null; onChange: (v: Suit) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {SUITS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`min-h-11 min-w-11 rounded-md border-2 text-sm font-semibold tabular-nums ${
              value === s ? "border-amber-500 bg-amber-50" : "border-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TurnController({ state, onPlayOpponentPiece, onPass, onDraw, onUndo }: TurnControllerProps) {
  const [a, setA] = useState<Suit | null>(null);
  const [b, setB] = useState<Suit | null>(null);
  const [end, setEnd] = useState<End>("left");

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isUserTurn = currentPlayer?.role === "user";
  const mustDraw = state.config.boneyardEnabled && state.boneyardRemaining > 0;

  function handleConfirmPlay() {
    if (a === null || b === null) return;
    onPlayOpponentPiece(a, b, end);
    setA(null);
    setB(null);
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800">
          {isUserTurn ? "Sua vez" : `Vez de: jogador ${currentPlayer?.id}`}
        </span>
        <button
          type="button"
          onClick={onUndo}
          disabled={state.history.length === 0}
          className="flex min-h-11 items-center gap-1 rounded-lg border-2 border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          <Undo2 size={20} aria-hidden="true" />
          Desfazer
        </button>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {!isUserTurn && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Registrar jogada deste jogador:</p>
          <div className="flex flex-wrap items-start gap-4">
            <SuitPicker label="Naipe A" value={a} onChange={setA} />
            <SuitPicker label="Naipe B" value={b} onChange={setB} />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Ponta</p>
              <div className="flex gap-2">
                {(["left", "right"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnd(e)}
                    className={`min-h-11 rounded-lg border-2 px-3 py-2 font-semibold ${
                      end === e ? "border-amber-500 bg-amber-50" : "border-slate-300"
                    }`}
                  >
                    {e === "left" ? "Esquerda" : "Direita"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmPlay}
              disabled={a === null || b === null}
              className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
            >
              Confirmar jogada
            </button>
            {mustDraw ? (
              <button
                type="button"
                onClick={onDraw}
                className="min-h-11 rounded-lg border-2 border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Comprou do monte
              </button>
            ) : (
              <button
                type="button"
                onClick={onPass}
                className="min-h-11 rounded-lg border-2 border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Passou a vez
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/TurnController.tsx
git commit -m "feat: add turn controller component"
```

---

### Task 14: `GameHistoryLog`

**Files:**
- Create: `components/GameHistoryLog.tsx`

Depends on Task 2 (types).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { GameState, Move } from "@/engine/types";

interface GameHistoryLogProps {
  state: GameState;
}

function describeMove(move: Move, state: GameState): string {
  const player = state.players.find((p) => p.id === move.playerId);
  const label = player?.role === "user" ? "Você" : `Jogador ${move.playerId}`;
  if (move.type === "play") {
    return `${label} jogou ${move.pieceId} na ponta ${move.end === "left" ? "esquerda" : "direita"}`;
  }
  if (move.type === "pass") {
    return `${label} passou a vez`;
  }
  return `${label} comprou uma peça do monte`;
}

export function GameHistoryLog({ state }: GameHistoryLogProps) {
  if (state.history.length === 0) {
    return <p className="text-sm text-slate-400">Nenhuma jogada registrada ainda.</p>;
  }

  return (
    <ol className="space-y-1 text-sm text-slate-600">
      {[...state.history].reverse().map((move, i) => (
        <li key={i} className="border-b border-slate-100 pb-1">
          {describeMove(move, state)}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/GameHistoryLog.tsx
git commit -m "feat: add game history log component"
```

---

### Task 15: `RoundEndPanel`

**Files:**
- Create: `components/RoundEndPanel.tsx`

Depends on Task 8, and `engine/inference.ts` (Task 4). This is a small addition beyond the six components in the original file list: it isolates the "reveal hands / pick winner / score / start next round" flow so `app/page.tsx` (Task 16) doesn't grow an unwieldy inline branch — a single-responsibility split, not scope creep.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { createDeck } from "@/engine/deck";
import { getScoreKey, getUnknownPieces } from "@/engine/inference";
import { GameState, Piece, PlayerState } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface RoundEndPanelProps {
  state: GameState;
  onFinishRound: (winnerPlayerId: number, revealedHands: Record<number, Piece[]>) => void;
  onNewRound: (userHand: Piece[]) => void;
}

function RevealRow({
  player,
  unknown,
  revealedCount,
  revealed,
  onToggle,
  onConfirm,
}: {
  player: PlayerState;
  unknown: Piece[];
  revealedCount: number;
  revealed: boolean;
  onToggle: () => void;
  onConfirm: (pieces: Piece[]) => void;
}) {
  const [picked, setPicked] = useState<Piece[]>([]);

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <button type="button" onClick={onToggle} className="min-h-11 w-full text-left text-sm font-semibold text-slate-700">
        Jogador {player.id} {revealedCount > 0 ? `— ${revealedCount} peça(s) revelada(s)` : "— não revelado"}
      </button>
      {revealed && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-500">
            Selecione {player.handSize} peça(s) ({picked.length}/{player.handSize})
          </p>
          <div className="flex flex-wrap gap-2">
            {unknown.map((piece) => {
              const selected = picked.some((p) => p.id === piece.id);
              return (
                <DominoTile
                  key={piece.id}
                  piece={piece}
                  size="sm"
                  selected={selected}
                  disabled={!selected && picked.length >= player.handSize}
                  onClick={() => setPicked((prev) => (selected ? prev.filter((p) => p.id !== piece.id) : [...prev, piece]))}
                />
              );
            })}
          </div>
          <button
            type="button"
            disabled={picked.length !== player.handSize}
            onClick={() => onConfirm(picked)}
            className="min-h-11 rounded-lg border-2 border-amber-500 px-3 py-2 font-semibold text-amber-900 disabled:pointer-events-none disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}

export function RoundEndPanel({ state, onFinishRound, onNewRound }: RoundEndPanelProps) {
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [revealing, setRevealing] = useState<number | null>(null);
  const [revealedHands, setRevealedHands] = useState<Record<number, Piece[]>>({});
  const [newHand, setNewHand] = useState<Piece[]>([]);

  const deck = createDeck();
  const revealedIds = new Set(Object.values(revealedHands).flat().map((p) => p.id));
  const unknown = getUnknownPieces(state, deck).filter((p) => !revealedIds.has(p.id));
  const nonUserPlayers = state.players.filter((p) => p.role !== "user");

  if (state.phase === "finished") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Rodada {state.roundNumber} encerrada</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {Object.entries(state.scores).map(([key, points]) => (
            <li key={key} className="tabular-nums">
              {key}: {points} pontos
            </li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold text-slate-600">
          Selecione a nova mão ({newHand.length}/{state.config.handSize})
        </h3>
        <div className="flex flex-wrap gap-2">
          {deck.map((piece) => {
            const selected = newHand.some((p) => p.id === piece.id);
            return (
              <DominoTile
                key={piece.id}
                piece={piece}
                size="sm"
                selected={selected}
                disabled={!selected && newHand.length >= state.config.handSize}
                onClick={() => setNewHand((prev) => (selected ? prev.filter((p) => p.id !== piece.id) : [...prev, piece]))}
              />
            );
          })}
        </div>
        <button
          type="button"
          disabled={newHand.length !== state.config.handSize}
          onClick={() => onNewRound(newHand)}
          className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
        >
          Iniciar nova rodada
        </button>
      </div>
    );
  }

  const bonusLabels: string[] = [];
  if (state.roundEndBonus?.laELo) bonusLabels.push("Lá-e-Lô");
  if (state.roundEndBonus?.bucha) bonusLabels.push("Bucha");

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <h2 className="text-lg font-semibold text-slate-900">
        {state.roundEndReason === "batida" ? "Batida!" : "Jogo trancado"}
      </h2>

      {bonusLabels.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {bonusLabels.join(" + ")} — pontuação em {bonusLabels.length === 2 ? "quádruplo" : "dobro"}!
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-600">Quem venceu a rodada?</p>
        <div className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setWinnerId(p.id)}
              className={`min-h-11 rounded-lg border-2 px-3 py-2 font-semibold ${
                winnerId === p.id ? "border-amber-500 bg-amber-50" : "border-slate-300"
              }`}
            >
              {p.role === "user" ? "Você" : `Jogador ${p.id}`} ({getScoreKey(state, p)})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-600">Revelar mãos (opcional, para pontuação exata):</p>
        {nonUserPlayers.map((p) => (
          <RevealRow
            key={p.id}
            player={p}
            unknown={unknown}
            revealedCount={revealedHands[p.id]?.length ?? 0}
            revealed={revealing === p.id}
            onToggle={() => setRevealing(revealing === p.id ? null : p.id)}
            onConfirm={(pieces) => {
              setRevealedHands((prev) => ({ ...prev, [p.id]: pieces }));
              setRevealing(null);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={winnerId === null}
        onClick={() => winnerId !== null && onFinishRound(winnerId, revealedHands)}
        className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
      >
        Calcular pontuação
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RoundEndPanel.tsx
git commit -m "feat: add round-end panel for reveal, scoring, and new round"
```

---

### Task 16: Wire up `app/page.tsx` and `app/layout.tsx`, then verify end-to-end

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx:1-20` (title/description only)

Depends on all previous tasks.

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { BoardDisplay } from "@/components/BoardDisplay";
import { GameHistoryLog } from "@/components/GameHistoryLog";
import { RecommendationList } from "@/components/RecommendationList";
import { RoundEndPanel } from "@/components/RoundEndPanel";
import { SetupWizard } from "@/components/SetupWizard";
import { TurnController } from "@/components/TurnController";
import { UserHand } from "@/components/UserHand";
import { RankedMove, rankMoves } from "@/engine/solver";
import { End, Suit } from "@/engine/types";
import { useDominoGame } from "@/hooks/useDominoGame";

export default function Home() {
  const { state, dispatch, undo } = useDominoGame();

  const user = state.players.find((p) => p.role === "user");
  const recommendations = useMemo(() => (state.phase === "playing" ? rankMoves(state) : []), [state]);
  const isUserTurn = state.players[state.currentPlayerIndex]?.role === "user";

  function handleChooseMove(move: RankedMove) {
    if (!user) return;
    dispatch({ type: "PLAY_PIECE", playerId: user.id, pieceId: move.piece.id, end: move.end });
  }

  function handleOpponentPlay(a: Suit, b: Suit, end: End) {
    const current = state.players[state.currentPlayerIndex];
    if (!current) return;
    const pieceId = a <= b ? `${a}-${b}` : `${b}-${a}`;
    dispatch({ type: "PLAY_PIECE", playerId: current.id, pieceId, end });
  }

  function handlePass() {
    const current = state.players[state.currentPlayerIndex];
    if (!current) return;
    dispatch({ type: "PASS", playerId: current.id });
  }

  function handleDraw() {
    const current = state.players[state.currentPlayerIndex];
    if (!current) return;
    dispatch({ type: "DRAW", playerId: current.id });
  }

  if (state.phase === "setup") {
    return <SetupWizard onComplete={(config, userHand) => dispatch({ type: "SETUP_COMPLETE", config, userHand })} />;
  }

  if (state.phase === "round-end" || state.phase === "finished") {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <BoardDisplay board={state.board} />
        <RoundEndPanel
          state={state}
          onFinishRound={(winnerPlayerId, revealedHands) => {
            if (Object.keys(revealedHands).length > 0) {
              dispatch({ type: "REVEAL_HANDS", hands: revealedHands });
            }
            dispatch({ type: "FINISH_ROUND", winnerPlayerId });
          }}
          onNewRound={(userHand) => dispatch({ type: "NEW_ROUND", userHand })}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Dominó — Assistente</h1>
        <div className="text-sm font-semibold tabular-nums text-slate-600">Rodada {state.roundNumber}</div>
      </header>

      <BoardDisplay board={state.board} />

      <TurnController
        state={state}
        onPlayOpponentPiece={handleOpponentPlay}
        onPass={handlePass}
        onDraw={handleDraw}
        onUndo={undo}
      />

      {isUserTurn && user?.hand && (
        <>
          <UserHand hand={user.hand} board={state.board} topRecommendedPieceId={recommendations[0]?.piece.id} />
          <RecommendationList moves={recommendations} onChoose={handleChooseMove} />
        </>
      )}

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Histórico</h2>
        <GameHistoryLog state={state} />
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Update the metadata in `app/layout.tsx`**

Open `app/layout.tsx` and change the `metadata` export's `title` and `description` to:

```ts
export const metadata: Metadata = {
  title: "Dominó — Solver e Assistente",
  description: "Acompanhe uma partida de dominó duplo-6 em tempo real e receba as melhores jogadas ranqueadas.",
};
```

Leave the rest of the file (font setup, `<html>`/`<body>` structure) untouched.

- [ ] **Step 3: Run the full automated test suite one more time**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 4: Type-check and lint**

Run:
```bash
pnpm exec tsc --noEmit
pnpm lint
```
Expected: no errors.

- [ ] **Step 5: Manual verification in the browser**

Run: `pnpm dev`, then open `http://localhost:3000` and walk through:

1. **Setup:** configure 4 players, Duplas, Horário, 7 pedras iniciais (no monte step should appear, since 4×7=28), Você inicia, select any 7 pieces for your hand. Click "Começar Partida" and confirm the board/turn UI appears.
2. **First move:** confirm `RecommendationList` shows ranked moves for your hand on the empty board, and clicking one places it on `BoardDisplay` with both ends set.
3. **Opponent turn:** use `TurnController`'s suit pickers to register an opponent's play at an open end; confirm the board updates and the turn advances to the next player in clockwise order (partner, id 2).
4. **Pass and inference:** have an opponent pass; confirm no error is shown (since boneyardEnabled is false for 4×7) and that a subsequent recommendation for a move that would leave that opponent's void suit open shows a "Castiga" reasoning line with a positive score contribution.
5. **Undo:** click "Desfazer" and confirm the previous board/turn state is restored.
6. **2-player game with monte:** start a new browser session (reload) and configure 2 players, 7 pedras (monte step should now appear since 2×7=14 < 28); pick "Com monte"; confirm that when the current player has no valid move, `TurnController` shows "Comprou do monte" instead of "Passou a vez", and that clicking it prompts nothing further for opponents but decrements the monte count (visible via a subsequent pass once the monte reaches 0).
7. **Round end (batida):** play down to one piece in the user's hand across a full test round (or set up a game with `handSize: 1` to reach this quickly) and confirm that playing the last piece shows the `RoundEndPanel` "Batida!" screen, that picking a winner and clicking "Calcular pontuação" shows a score, and that "Iniciar nova rodada" returns to a fresh board with a new hand-selection step.
8. **Responsive check:** resize the browser to a narrow (mobile) width and confirm no horizontal scrolling on the page body, the piece grids wrap, and the board's tile row scrolls horizontally within its own container.
9. **Lá-e-lô / bucha bonus:** start a 1-piece-hand test round (as in step 7) and bat on the very first move of the round (empty board); confirm `RoundEndPanel` shows a "Bucha — pontuação em dobro!" badge and the final score is double the base pip sum. Separately, play out a round far enough that both ends become equal before your final piece, and confirm the "Lá-e-Lô" badge appears instead (or both badges plus "quádruplo" if both conditions are met). Also confirm a `RecommendationList` entry for a finishing move shows a reasoning line mentioning "lá-e-lô" or "bucha" when applicable.

If any step fails, fix the relevant component/reducer before proceeding — do not report the task complete until all 8 steps pass.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: wire up domino solver app end-to-end"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Setup wizard (Task 9) covers all fields in the design doc's Setup Wizard section, including the monte toggle only shown when applicable. Live tracking (Tasks 13, 14, 16) covers registering opponent/partner plays and passes, listing recommendations, undo, and history. Inference (Task 4) covers `voidSuits` on pass and suit-preference tracking. Solver (Task 5) covers all five heuristic categories from the design doc. End-of-game detection and scoring (Task 6, 15) cover batida, lock, and known/estimated scoring via optional hand reveal.
- **Type consistency:** `Suit`, `Piece`, `Board`, `PlayerState`, `GameConfig`, `Move`, `GameState` are defined once in Task 2 and reused verbatim (same field names) through every later task — verified `voidSuits: Suit[]` (not `Set`), `scores: Record<string, number>`, and `hand: Piece[] | null` stay consistent from `types.ts` through `inference.ts`, `solver.ts`, `gameReducer.ts`, and all components.
- **Lá-e-lô / bucha bonus:** `GameState.roundEndBonus` (Task 2) is computed in `handlePlayPiece` (Task 6) at the moment of a batida, scores a ×2 multiplier each (×4 combined) in `handleFinishRound` (Task 6), is reset on `NEW_ROUND`, and is surfaced to the user in `RoundEndPanel` (Task 15). The solver (Task 5) additionally scores finishing moves that qualify for either bonus, plus a smaller speculative bonus for non-finishing moves that equalize the open ends while the user retains a follow-up piece — added per user request mid-plan.
- **Scope decision:** UI components are not unit-tested (no React Testing Library in this repo); they're verified manually per Task 16 Step 5, consistent with this project's convention of browser-verifying UI work. All business logic (engine + reducer) is fully TDD'd.
