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

/**
 * Pieces a given player could legally play right now, from the app's point of
 * view: still unaccounted for (not in a known hand, not on the table), and
 * matching an open end that this player has not shown themselves void in.
 * On an empty board every unaccounted-for piece qualifies.
 */
export function getCandidatePieces(state: GameState, playerId: number, deck: Piece[]): Piece[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  // Once a hand is known (the user's, or one revealed at round end) the pool of
  // pieces that player could play is that hand — not the pieces still
  // unaccounted for, which by definition excludes everything they hold.
  const pool = player.hand ?? getUnknownPieces(state, deck);

  const { leftEnd, rightEnd } = state.board;
  if (leftEnd === null && rightEnd === null) return pool;

  const openEnds = Array.from(new Set([leftEnd, rightEnd].filter((v): v is Suit => v !== null)));
  const playableEnds = openEnds.filter((v) => !player.voidSuits.includes(v));
  if (playableEnds.length === 0) return [];

  return pool.filter((p) => playableEnds.some((v) => p.a === v || p.b === v));
}

/**
 * True when the app can prove this player has no legal move — every remaining
 * unaccounted-for piece either does not match an open end, or matches only a
 * suit this player is known to be void in. Always false while the boneyard
 * still has pieces (they would draw instead of passing), and false on an
 * empty board.
 */
export function willSurelyPass(state: GameState, playerId: number, deck: Piece[]): boolean {
  const { leftEnd, rightEnd } = state.board;
  if (leftEnd === null && rightEnd === null) return false;
  if (state.config.boneyardEnabled && state.boneyardRemaining > 0) return false;
  return getCandidatePieces(state, playerId, deck).length === 0;
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
