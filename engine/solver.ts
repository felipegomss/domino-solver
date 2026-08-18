import { createDeck, isDouble, pipSum } from "./deck";
import { filterByPlayableEnds, getUnknownPieces } from "./inference";
import { BatidaType, End, GameState, Piece, PlayerState, Suit } from "./types";

export interface RankedMove {
  piece: Piece;
  end: End;
  score: number;
  reasoning: string[];
}

const WEIGHTS = {
  FINISH: 1000, // batting wins the round — dominates everything
  FINISH_TIER: 5, // × tier: simples 0, carroca 1, la-e-lo 2, cruzada 3 (style ordering among winning moves)
  FORCED_PASS: 30, // next opponent provably cannot play
  MOBILITY_PENALTY: 2, // × (number of unknown pieces the next opponent could play after this move)
  OWN_FLEXIBILITY: 3, // × (own remaining pieces playable on the post-move ends)
  DOUBLE_DISCARD: 8, // doubles are single-suit, risky to hold
  PARTNER_STRONG_SUIT_PENALTY: 15, // duplas
  PARTNER_ISOLATE_PENALTY: 10, // duplas
  LA_E_LO_SETUP: 6, // holds the bridging piece for the post-move (distinct) ends
};
const STRONG_SUIT_THRESHOLD = 2;

const BATIDA_TIER: Record<BatidaType, number> = {
  simples: 0,
  carroca: 1,
  "la-e-lo": 2,
  cruzada: 3,
};

const BATIDA_LABEL: Record<BatidaType, string> = {
  simples: "batida simples",
  carroca: "de carroça",
  "la-e-lo": "de lá-e-lô",
  cruzada: "de cruzada",
};

/**
 * Classifies the batida (winning play) type from the board ends BEFORE the
 * winning piece was placed and the piece itself. Mirrors the reducer's
 * classifyBatida (duplicated here since engine/ must not depend on hooks/).
 *
 * - Empty board: a double is "carroca", anything else "simples".
 * - Equal ends (L === R): the double of L is "cruzada" (the strongest
 *   batida). Otherwise: double -> "carroca", non-double -> "simples".
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
  const unknownPool = getUnknownPieces(state, deck);
  const next = getNextPlayer(state, user.id);

  const moves: RankedMove[] = [];
  const ends: End[] = boardEmpty ? ["left"] : ["left", "right"];

  for (const piece of user.hand) {
    for (const end of ends) {
      const targetValue = boardEmpty ? null : end === "left" ? leftEnd : rightEnd;
      if (!boardEmpty && piece.a !== targetValue && piece.b !== targetValue) continue;

      const reasoning: string[] = [];
      let score = 0;

      // 1. Simulate post-move ends.
      let postLeft: Suit;
      let postRight: Suit;
      if (boardEmpty) {
        postLeft = piece.a;
        postRight = piece.b;
      } else if (end === "left") {
        postLeft = otherValue(piece, targetValue as Suit);
        postRight = rightEnd as Suit;
      } else {
        postRight = otherValue(piece, targetValue as Suit);
        postLeft = leftEnd as Suit;
      }

      const isFinishingMove = user.hand.length === 1;

      if (isFinishingMove) {
        // 2. Finish — batting wins the round outright, style differentiates among finishes.
        const batida = classifyBatida(leftEnd, rightEnd, piece);
        const tier = BATIDA_TIER[batida];
        score += WEIGHTS.FINISH + WEIGHTS.FINISH_TIER * tier;
        reasoning.push(`Bate o jogo — ${BATIDA_LABEL[batida]}`);
      } else {
        // 3. Opponent mobility — only meaningful when the next player is an opponent.
        if (next && next.role === "opponent") {
          const mobility = filterByPlayableEnds(unknownPool, postLeft, postRight, next.voidSuits).length;
          if (mobility === 0) {
            score += WEIGHTS.FORCED_PASS;
            reasoning.push(`Trava o adversário — nenhuma peça possível para ele (+${WEIGHTS.FORCED_PASS})`);
          } else {
            const penalty = WEIGHTS.MOBILITY_PENALTY * mobility;
            score -= penalty;
            reasoning.push(`Deixa o adversário com ${mobility} peça(s) possível(is) (−${penalty})`);
          }
        }

        // 4. Own flexibility — other pieces still playable on either post-move end.
        const ownFlexCount = user.hand.filter(
          (p) =>
            p.id !== piece.id && (p.a === postLeft || p.b === postLeft || p.a === postRight || p.b === postRight)
        ).length;
        if (ownFlexCount > 0) {
          const bonus = WEIGHTS.OWN_FLEXIBILITY * ownFlexCount;
          score += bonus;
          reasoning.push(
            `Mantém ${ownFlexCount} peça(s) jogável(is) nas pontas ${postLeft} e ${postRight} (+${bonus})`
          );
        }

        // 5. Partner heuristics (duplas).
        if (partner) {
          if (targetValue !== null && partner.suitPlayCount[targetValue] >= STRONG_SUIT_THRESHOLD) {
            score -= WEIGHTS.PARTNER_STRONG_SUIT_PENALTY;
            reasoning.push(
              `Fecha um naipe forte do parceiro (${targetValue}) (-${WEIGHTS.PARTNER_STRONG_SUIT_PENALTY})`
            );
          }
          const changedValue = end === "left" ? postLeft : postRight;
          if (partner.voidSuits.includes(changedValue) && !(next && next.voidSuits.includes(changedValue))) {
            score -= WEIGHTS.PARTNER_ISOLATE_PENALTY;
            reasoning.push(
              `Deixa uma ponta que só o adversário aproveita, isolando o parceiro (-${WEIGHTS.PARTNER_ISOLATE_PENALTY})`
            );
          }
        }

        // 7. Lá-e-lô setup — keep the bridging piece for the (now distinct) post-move ends.
        if (postLeft !== postRight) {
          const holdsBridge = user.hand.some(
            (p) =>
              p.id !== piece.id &&
              ((p.a === postLeft && p.b === postRight) || (p.a === postRight && p.b === postLeft))
          );
          if (holdsBridge) {
            score += WEIGHTS.LA_E_LO_SETUP;
            reasoning.push(
              `Mantém o ${postLeft}-${postRight} na mão para bater de Lá-e-Lô (+${WEIGHTS.LA_E_LO_SETUP})`
            );
          }
        }

        // 6. Double discard — doubles are single-suit, risky to hold. Only
        // meaningful while the game continues: on a finishing move the hand
        // empties and this bonus would corrupt the batida-tier ordering
        // (carroça finishes are doubles, lá-e-lô finishes never are).
        if (isDouble(piece)) {
          score += WEIGHTS.DOUBLE_DISCARD;
          reasoning.push(`Alivia uma dobra pesada da mão (+${WEIGHTS.DOUBLE_DISCARD})`);
        }
      }

      if (reasoning.length === 0) {
        reasoning.push("Jogada válida sem vantagem estratégica adicional identificada.");
      }

      moves.push({ piece, end, score, reasoning });
    }
  }

  return moves.sort((a, b) => b.score - a.score || pipSum(b.piece) - pipSum(a.piece));
}
