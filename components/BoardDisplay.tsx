"use client";

import { Board } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface BoardDisplayProps {
  board: Board;
}

export function BoardDisplay({ board }: BoardDisplayProps) {
  if (board.sequence.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400">
        Mesa vazia — aguardando primeira jogada
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-3 text-sm font-semibold text-slate-600">
        <span>Ponta esquerda: {board.leftEnd}</span>
        <span className="ml-auto">Ponta direita: {board.rightEnd}</span>
      </div>
      <div
        className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-4"
        role="region"
        aria-label="Peças colocadas"
      >
        {board.sequence.map((placed, i) => (
          <DominoTile key={`${placed.piece.id}-${i}`} piece={placed.piece} size="sm" />
        ))}
      </div>
    </div>
  );
}
