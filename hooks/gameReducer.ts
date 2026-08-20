import { createDeck } from "@/engine/deck";
import { applySuitPlayed, registerPass } from "@/engine/inference";
import { assignSeats } from "@/engine/seats";
import { BatidaType, End, GameConfig, GameState, Move, Piece, Suit } from "@/engine/types";

export type GameAction =
  | { type: "SETUP_COMPLETE"; config: GameConfig; userHand: Piece[] }
  | { type: "PLAY_PIECE"; playerId: number; pieceId: string; end: End }
  | { type: "PASS"; playerId: number }
  | { type: "DRAW"; playerId: number; pieceId?: string }
  | { type: "NEW_ROUND"; userHand: Piece[]; startingPlayer: number };

/**
 * Classifies the batida (winning play) type from the board ends BEFORE the
 * winning piece was placed and the piece itself.
 *
 * - Empty board: a double is "carroca", anything else "simples".
 * - Equal ends (L === R): the double of L is "cruzada" (the strongest
 *   batida — playing the double whose value already occupies both ends).
 *   Any other double is unreachable here (it couldn't legally be played on
 *   an end whose value differs from its own). Otherwise: double -> "carroca",
 *   non-double -> "simples".
 * - Different ends (L !== R): the piece bridging both ends (L-R) is
 *   "la-e-lo". A double is "carroca". Otherwise "simples".
 */
function classifyBatida(preLeft: Suit | null, preRight: Suit | null, piece: Piece): BatidaType {
  if (preLeft === null && preRight === null) {
    return piece.a === piece.b ? "carroca" : "simples";
  }
  const left = preLeft as Suit;
  const right = preRight as Suit;
  if (left === right) {
    if (piece.a === piece.b && piece.a === left) return "cruzada";
    return piece.a === piece.b ? "carroca" : "simples";
  }
  const bridges = (piece.a === left && piece.b === right) || (piece.a === right && piece.b === left);
  if (bridges) return "la-e-lo";
  return piece.a === piece.b ? "carroca" : "simples";
}

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
    roundNumber: 1,
    error: null,
    roundEndReason: null,
    passStreak: 0,
    lastWinnerId: null,
    batidaType: null,
  };
}

function buildPlayers(config: GameConfig, userHand: Piece[]) {
  return assignSeats(config).map((seat) => ({
    ...seat,
    hand: seat.role === "user" ? [...userHand] : null,
    handSize: seat.role === "user" ? userHand.length : config.handSize,
    voidSuits: [] as Suit[],
    suitPlayCount: { ...EMPTY_SUIT_COUNT },
  }));
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

  if (player.role !== "user") {
    const alreadyOnBoard = state.board.sequence.some((s) => s.piece.id === piece.id);
    const alreadyKnown = state.players.some((p) => p.hand?.some((h) => h.id === piece.id));
    if (alreadyOnBoard || alreadyKnown) {
      return withError(state, "Essa peça já está em jogo.");
    }
  }

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

  const batidaType = battedOut ? classifyBatida(board.leftEnd, board.rightEnd, piece) : null;

  return {
    ...state,
    error: null,
    board: { sequence, leftEnd, rightEnd },
    players,
    history: [...state.history, move],
    passStreak: 0,
    phase: battedOut ? "round-end" : "playing",
    roundEndReason: battedOut ? "batida" : null,
    batidaType,
    lastWinnerId: battedOut ? mover.id : state.lastWinnerId,
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

  let lastWinnerId = state.lastWinnerId;
  if (locked) {
    const minHandSize = Math.min(...afterPass.players.map((p) => p.handSize));
    const leaders = afterPass.players.filter((p) => p.handSize === minHandSize);
    lastWinnerId = leaders.length === 1 ? leaders[0].id : null;
  }

  return {
    ...afterPass,
    error: null,
    history: [...state.history, move],
    passStreak,
    phase: locked ? "round-end" : "playing",
    roundEndReason: locked ? "lock" : null,
    batidaType: locked ? null : afterPass.batidaType,
    lastWinnerId,
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

function handleNewRound(state: GameState, action: Extract<GameAction, { type: "NEW_ROUND" }>): GameState {
  // Who opens the next round is a table rule, not something the app can infer:
  // in duplas the partner may open for the winning side, and some variants
  // rotate regardless of who batted. The caller always states it explicitly.
  const { startingPlayer } = action;
  if (!Number.isInteger(startingPlayer) || startingPlayer < 0 || startingPlayer >= state.config.numPlayers) {
    return withError(state, "Jogador inicial inválido.");
  }
  const dealtTotal = state.config.numPlayers * state.config.handSize;
  const boneyardRemaining = Math.max(0, 28 - dealtTotal);
  return {
    ...state,
    phase: "playing",
    error: null,
    board: { sequence: [], leftEnd: null, rightEnd: null },
    config: { ...state.config, startingPlayer },
    players: buildPlayers({ ...state.config, startingPlayer }, action.userHand),
    boneyardRemaining,
    currentPlayerIndex: startingPlayer,
    history: [],
    roundNumber: state.roundNumber + 1,
    roundEndReason: null,
    batidaType: null,
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
    case "NEW_ROUND":
      return handleNewRound(clearError(state), action);
    default:
      return state;
  }
}
