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
    const mismatched = {
      ...first,
      currentPlayerIndex: 0,
      players: first.players.map((p) => (p.id === 0 ? { ...p, hand: [{ id: "1-2", a: 1, b: 2 } as Piece] } : p)),
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

  it("rejects a non-user play of a piece already on the board", () => {
    const state = playingState();
    const afterFirst = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    const rejected = gameReducer(afterFirst, { type: "PLAY_PIECE", playerId: 1, pieceId: "3-3", end: "left" });
    expect(rejected.error).toBe("Essa peça já está em jogo.");
    expect(rejected.board).toEqual(afterFirst.board);
  });

  // These classification tests inject the board's ends directly (rather than replaying every
  // intervening turn) since batidaType depends only on the pre-move ends and the winning
  // piece — see the dedicated la-e-lo test below for a fixture built via real PLAY_PIECE turns.
  function stateWithBoard(leftEnd: number | null, rightEnd: number | null, hand: Piece[]) {
    const started = gameReducer(createInitialState(), { type: "SETUP_COMPLETE", config: duplasConfig, userHand: hand });
    return {
      ...started,
      board: { sequence: [], leftEnd, rightEnd } as typeof started.board,
      currentPlayerIndex: 0,
    };
  }

  it("marks a batida when the mover's hand reaches zero, with batidaType 'simples' for a non-double, non-bridging piece", () => {
    // Ends (2,4); user holds a single non-double piece that fits the left end (2) but does
    // not bridge both ends (bridging would require 2-4).
    const state = stateWithBoard(2, 4, [{ id: "0-2", a: 0, b: 2 }]);
    const next = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "0-2", end: "left" });
    expect(next.phase).toBe("round-end");
    expect(next.roundEndReason).toBe("batida");
    expect(next.batidaType).toBe("simples");
    expect(next.lastWinnerId).toBe(0);
  });

  it("classifies la-e-lo when batting with piece x-y on ends (x,y), x !== y", () => {
    // 3-player individual game so the turn order (0,1,2,0) lets the user open the board,
    // two opponents shape the ends, and the user comes back around to finish.
    const threeConfig: GameConfig = {
      numPlayers: 3,
      mode: "individual",
      direction: "cw",
      handSize: 7,
      boneyardEnabled: false,
      startingPlayer: 0,
    };
    const started = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: threeConfig,
      userHand: [
        { id: "6-6", a: 6, b: 6 },
        { id: "1-2", a: 1, b: 2 },
      ],
    });
    // User opens the empty board with 6-6 -> ends (6,6).
    const afterOpen = gameReducer(started, { type: "PLAY_PIECE", playerId: 0, pieceId: "6-6", end: "left" });
    // Opponent 1 plays 1-6 on the left end (6) -> resultingValue=1, leftEnd=1. Ends now (1,6).
    const afterOpp1 = gameReducer(afterOpen, { type: "PLAY_PIECE", playerId: 1, pieceId: "1-6", end: "left" });
    // Opponent 2 plays 2-6 on the right end (6) -> resultingValue=2, rightEnd=2. Ends now (1,2),
    // the bridging pair for the user's remaining 1-2 piece.
    const afterOpp2 = gameReducer(afterOpp1, { type: "PLAY_PIECE", playerId: 2, pieceId: "2-6", end: "right" });
    expect(afterOpp2.board.leftEnd).toBe(1);
    expect(afterOpp2.board.rightEnd).toBe(2);
    expect(afterOpp2.currentPlayerIndex).toBe(0);
    const next = gameReducer(afterOpp2, { type: "PLAY_PIECE", playerId: 0, pieceId: "1-2", end: "left" });
    expect(next.batidaType).toBe("la-e-lo");
  });

  it("classifies carroca when batting with a double on a normal (non-matching) end", () => {
    // Ends (3,4); user holds the double 4-4, played on the right end (4) — a double
    // that does not match the "both ends equal" cruzada case.
    const state = stateWithBoard(3, 4, [{ id: "4-4", a: 4, b: 4 }]);
    const next = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "4-4", end: "right" });
    expect(next.phase).toBe("round-end");
    expect(next.batidaType).toBe("carroca");
  });

  it("classifies cruzada when batting with the double v-v on ends (v,v)", () => {
    // Ends (4,4); user holds the double 4-4 — the strongest batida.
    const state = stateWithBoard(4, 4, [{ id: "4-4", a: 4, b: 4 }]);
    const next = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "4-4", end: "left" });
    expect(next.phase).toBe("round-end");
    expect(next.batidaType).toBe("cruzada");
  });

  it("regression: ends (5,5), batting with 2-5 -> 'simples', NOT la-e-lo", () => {
    // The user's reported bug: ends already equal (5,5) batted with a non-double 2-5.
    // Lá-e-lô requires the winning piece to close two DIFFERENT ends, which does not
    // apply here even though both board ends happen to share a value.
    const state = stateWithBoard(5, 5, [{ id: "2-5", a: 2, b: 5 }]);
    const next = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "2-5", end: "left" });
    expect(next.phase).toBe("round-end");
    expect(next.batidaType).toBe("simples");
    expect(next.batidaType).not.toBe("la-e-lo");
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

  it("locks the round and sets lastWinnerId to the unique fewest-hand player", () => {
    let state = playingStateWithBoard();
    // After the initial PLAY_PIECE, player 0 has 1 piece left (3-5), others have 7.
    // Reduce player 1's hand to make them the unique fewest before the lock.
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 1 ? { ...p, handSize: 0 } : p)),
    };
    for (const playerId of [1, 2, 3, 0]) {
      state = gameReducer(state, { type: "PASS", playerId });
    }
    expect(state.phase).toBe("round-end");
    expect(state.roundEndReason).toBe("lock");
    expect(state.lastWinnerId).toBe(1);
    expect(state.batidaType).toBeNull();
  });

  it("sets lastWinnerId to null (empate) when the fewest-hand count is tied", () => {
    let state = playingStateWithBoard();
    // player 0 has 1 piece (3-5). Tie player 1 at 1 piece too.
    state = {
      ...state,
      players: state.players.map((p) => (p.id === 1 ? { ...p, handSize: 1 } : p)),
    };
    for (const playerId of [1, 2, 3, 0]) {
      state = gameReducer(state, { type: "PASS", playerId });
    }
    expect(state.phase).toBe("round-end");
    expect(state.roundEndReason).toBe("lock");
    expect(state.lastWinnerId).toBeNull();
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

  it("rejects drawing a piece that is already known (in a hand or on the board)", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: twoPlayerConfig,
      userHand,
    });
    const rejected = gameReducer(state, { type: "DRAW", playerId: 0, pieceId: "3-3" });
    expect(rejected.error).toBe("Peça comprada inválida ou já em jogo.");
    expect(rejected.boneyardRemaining).toBe(state.boneyardRemaining);
  });

  it("increments a non-user player's handSize without requiring a pieceId", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: twoPlayerConfig,
      userHand,
    });
    const afterPlay = gameReducer(state, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    const next = gameReducer(afterPlay, { type: "DRAW", playerId: 1 });
    expect(next.error).toBeNull();
    expect(next.players[1].handSize).toBe(state.players[1].handSize + 1);
    expect(next.boneyardRemaining).toBe(afterPlay.boneyardRemaining - 1);
  });

  it("rejects drawing when the boneyard is empty or disabled", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand,
    });
    const next = gameReducer(state, { type: "DRAW", playerId: 0 });
    expect(next.error).toBe("Não há peças no monte para comprar.");
  });

  it("rejects a draw out of turn", () => {
    const state = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: twoPlayerConfig,
      userHand,
    });
    const next = gameReducer(state, { type: "DRAW", playerId: 1 });
    expect(next.error).toBe("Não é a vez deste jogador.");
  });
});

describe("NEW_ROUND", () => {
  it("starts the next round with the previous batida winner and resets round state", () => {
    const started = gameReducer(createInitialState(), {
      type: "SETUP_COMPLETE",
      config: duplasConfig,
      userHand: [{ id: "3-3", a: 3, b: 3 }],
    });
    const batted = gameReducer(started, { type: "PLAY_PIECE", playerId: 0, pieceId: "3-3", end: "left" });
    expect(batted.phase).toBe("round-end");
    expect(batted.lastWinnerId).toBe(0);

    const newRound = gameReducer(batted, { type: "NEW_ROUND", userHand: [{ id: "1-1", a: 1, b: 1 }] });
    expect(newRound.phase).toBe("playing");
    expect(newRound.board.sequence).toEqual([]);
    expect(newRound.currentPlayerIndex).toBe(0);
    expect(newRound.roundNumber).toBe(2);
    expect(newRound.batidaType).toBeNull();
  });
});
