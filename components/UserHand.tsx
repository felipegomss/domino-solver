"use client";

import { handPipSum } from "@/engine/deck";
import { Board, Piece } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface UserHandProps {
  hand: Piece[];
  board: Board;
  topRecommendedPieceId?: string;
  isUserTurn: boolean;
}

function isPlayable(piece: Piece, board: Board): boolean {
  if (board.leftEnd === null && board.rightEnd === null) return true;
  return (
    piece.a === board.leftEnd || piece.b === board.leftEnd || piece.a === board.rightEnd || piece.b === board.rightEnd
  );
}

export function UserHand({ hand, board, topRecommendedPieceId, isUserTurn }: UserHandProps) {
  const playableCount = hand.filter((p) => isPlayable(p, board)).length;

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-ivory">Sua mão ({hand.length})</h2>
        <p className="text-xs text-faint tabular-nums">
          {handPipSum(hand)} pontos ·{" "}
          {playableCount > 0 ? `${playableCount} jogável(is)` : "nenhuma encaixa"}
        </p>
      </div>

      {hand.length === 0 ? (
        <p className="text-sm text-faint">Mão vazia.</p>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          {hand.map((piece) => (
            <DominoTile
              key={piece.id}
              piece={piece}
              size="md"
              disabled={!isPlayable(piece, board)}
              highlighted={isUserTurn && piece.id === topRecommendedPieceId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
