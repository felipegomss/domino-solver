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
    <div className="flex items-center gap-3">
      <span className="flex size-11 items-center justify-center rounded-full border border-gold/50 bg-felt-950/70 font-display text-xl font-semibold tabular-nums text-gold-2 shadow-[inset_0_1px_4px_rgba(0,0,0,0.6)]">
        {value ?? "—"}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist/80">{label}</span>
    </div>
  );
}

export function BoardDisplay({ board }: BoardDisplayProps) {
  const isEmpty = board.sequence.length === 0;

  return (
    <section
      aria-label="Mesa"
      className="overflow-hidden rounded-2xl border-4 border-rail shadow-[0_10px_40px_rgba(0,0,0,0.5),inset_0_0_0_1px_rgba(238,192,106,0.15)]"
    >
      <div className="bg-gradient-to-b from-felt-700 via-felt-800 to-felt-900">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <EndMarker label="Ponta esquerda" value={board.leftEnd} />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-mist/60 sm:block">
            {isEmpty ? "Mesa vazia" : `${board.sequence.length} peça(s) na mesa`}
          </span>
          <div className="flex flex-row-reverse">
            <EndMarker label="Ponta direita" value={board.rightEnd} />
          </div>
        </div>

        {isEmpty ? (
          <p className="flex min-h-36 items-center justify-center px-4 pb-6 text-center font-display text-lg italic text-mist/70">
            Aguardando a primeira jogada…
          </p>
        ) : (
          <div
            role="region"
            aria-label="Peças na mesa, da ponta esquerda para a direita"
            className="scroll-slim flex min-h-36 items-center gap-1.5 overflow-x-auto px-6 pb-7 pt-2"
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
      </div>
    </section>
  );
}
