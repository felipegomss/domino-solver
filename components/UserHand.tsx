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
    <section className="space-y-2 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">Sua mão ({hand.length})</h2>
        <p className="text-xs text-slate-500 tabular-nums">
          {handPipSum(hand)} pontos na mão ·{" "}
          {playableCount > 0 ? `${playableCount} jogável(is) agora` : "nenhuma peça encaixa nas pontas"}
        </p>
      </div>

      {hand.length === 0 ? (
        <p className="text-sm text-slate-400">Mão vazia.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {hand.map((piece) => (
            <DominoTile
              key={piece.id}
              piece={piece}
              size="sm"
              disabled={!isPlayable(piece, board)}
              highlighted={isUserTurn && piece.id === topRecommendedPieceId}
            />
          ))}
        </div>
      )}
    </section>
  );
}
