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
      hands: { 1: [{ id: "6-6", a: 6, b: 6 }], 3: [] },
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
