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

function getNextPlayer(state: GameState, afterId: number): PlayerState | undefined {
  const { numPlayers, direction } = state.config;
  const delta = direction === "cw" ? 1 : -1;
  const nextId = (afterId + delta + numPlayers) % numPlayers;
  return state.players.find((p) => p.id === nextId);
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
        if (next && next.role === "opponent" && next.voidSuits.includes(resultingValue)) {
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
          if (partner.voidSuits.includes(resultingValue) && !(next && next.voidSuits.includes(resultingValue))) {
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
