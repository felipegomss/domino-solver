"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { RankedMove } from "@/engine/solver";
import { Piece } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface RecommendationListProps {
  moves: RankedMove[];
  onChoose: (move: RankedMove) => void;
  mustDraw: boolean;
  drawablePieces: Piece[];
  onPass: () => void;
  onDrawPiece: (pieceId: string) => void;
}

export function RecommendationList({
  moves,
  onChoose,
  mustDraw,
  drawablePieces,
  onPass,
  onDrawPiece,
}: RecommendationListProps) {
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  if (moves.length === 0) {
    if (mustDraw) {
      return (
        <div className="space-y-4 rounded-2xl border border-dashed border-line-strong bg-surface/60 p-5">
          <p className="text-center text-sm text-mist">
            Nenhuma jogada válida — compre uma peça do monte e selecione qual foi.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {drawablePieces.map((piece) => (
              <DominoTile
                key={piece.id}
                piece={piece}
                size="sm"
                selected={selectedPieceId === piece.id}
                onClick={() => setSelectedPieceId(piece.id)}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={!selectedPieceId}
            onClick={() => {
              if (selectedPieceId) {
                onDrawPiece(selectedPieceId);
                setSelectedPieceId(null);
              }
            }}
            className="mx-auto block min-h-11 rounded-lg bg-gold px-5 py-2 font-semibold text-gold-ink transition-colors hover:bg-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
          >
            Comprei esta peça
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4 rounded-2xl border border-dashed border-line-strong bg-surface/60 p-6 text-center">
        <p className="text-sm text-mist">Nenhuma jogada válida — é preciso passar a vez.</p>
        <button
          type="button"
          onClick={onPass}
          className="mx-auto block min-h-11 rounded-lg bg-gold px-5 py-2 font-semibold text-gold-ink transition-colors hover:bg-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Passar a vez
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Jogadas recomendadas</h3>
      {moves.map((move, index) => {
        const isTop = index === 0;
        const reasoningId = `reasoning-${move.piece.id}-${move.end}`;
        return (
          <div
            key={`${move.piece.id}-${move.end}`}
            className={`relative rounded-2xl border p-4 transition-colors ${
              isTop
                ? "border-gold/70 bg-gradient-to-br from-gold/15 via-surface-2 to-surface shadow-[0_0_24px_rgba(217,164,65,0.15)]"
                : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            <button
              type="button"
              onClick={() => onChoose(move)}
              aria-describedby={reasoningId}
              className="flex min-h-11 w-full items-center gap-3 text-left after:absolute after:inset-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {isTop && <Trophy size={20} className="shrink-0 text-gold" aria-hidden="true" />}
              <span className={`font-display text-lg font-semibold ${isTop ? "text-gold-2" : "text-ivory"}`}>
                {isTop && <span className="sr-only">Melhor jogada: </span>}
                Peça {move.piece.a}-{move.piece.b} → ponta {move.end === "left" ? "esquerda" : "direita"}
              </span>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                  isTop ? "bg-gold text-gold-ink" : "bg-felt-950 text-mist"
                }`}
              >
                {move.score} pts
              </span>
            </button>
            <ul id={reasoningId} className="mt-2 space-y-1 text-sm text-mist">
              {move.reasoning.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
