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
    const bucha =
      rivals.length > 0 &&
      rivals.every((r) => !state.history.some((m) => m.type === "play" && m.playerId === r.id));
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
