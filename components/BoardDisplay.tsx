"use client";

import { Board, Piece, Suit } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface BoardDisplayProps {
  board: Board;
}

/**
 * The stored piece is canonical (a <= b), but on the table it has a real
 * orientation: whichever value faces left must render on the left. Rebuild a
 * display-only piece so the pips match how the tile actually sits.
 */
function orientForTable(piece: Piece, leftValue: Suit, rightValue: Suit): Piece {
  return { id: piece.id, a: leftValue, b: rightValue };
}

function EndMarker({ label, value }: { label: string; value: Suit | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80">{label}</span>
      <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-950/40 text-lg font-bold tabular-nums text-white ring-1 ring-emerald-300/30">
        {value ?? "—"}
      </span>
    </div>
  );
}

export function BoardDisplay({ board }: BoardDisplayProps) {
  const isEmpty = board.sequence.length === 0;

  return (
    <section
      aria-label="Mesa"
      className="overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-900 shadow-inner ring-1 ring-emerald-950/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-emerald-950/30 bg-emerald-950/20 px-4 py-2">
        <EndMarker label="Ponta esquerda" value={board.leftEnd} />
        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-100/60">
          {isEmpty ? "Mesa vazia" : `${board.sequence.length} peça(s) na mesa`}
        </span>
        <EndMarker label="Ponta direita" value={board.rightEnd} />
      </div>

      {isEmpty ? (
        <p className="flex h-28 items-center justify-center px-4 text-center text-sm text-emerald-100/70">
          Aguardando a primeira jogada
        </p>
      ) : (
        <div
          role="region"
          aria-label="Peças na mesa, da ponta esquerda para a direita"
          className="flex min-h-28 items-center gap-1 overflow-x-auto px-4 py-5"
        >
          {board.sequence.map((placed, i) => {
            const isDouble = placed.piece.a === placed.piece.b;
            return (
              <DominoTile
                key={`${placed.piece.id}-${i}`}
                piece={orientForTable(placed.piece, placed.leftValue, placed.rightValue)}
                size="sm"
                orientation={isDouble ? "vertical" : "horizontal"}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
