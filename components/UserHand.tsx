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
