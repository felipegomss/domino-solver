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
        <div className="space-y-3 rounded-xl border-2 border-dashed border-slate-300 p-4">
          <p className="text-center text-sm text-slate-600">
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
            className="mx-auto block min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
          >
            Comprei esta peça
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3 rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">
        <p>Nenhuma jogada válida — é preciso passar a vez.</p>
        <button
          type="button"
          onClick={onPass}
          className="mx-auto block min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800"
        >
          Passar a vez
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-600">Jogadas recomendadas</h3>
      {moves.map((move, index) => {
        const isTop = index === 0;
        const reasoningId = `reasoning-${move.piece.id}-${move.end}`;
        return (
          <div
            key={`${move.piece.id}-${move.end}`}
            className={`relative rounded-xl border-2 p-4 transition-colors ${
              isTop ? "border-amber-500 bg-amber-50 shadow-md" : "border-slate-200 bg-white hover:bg-slate-50"
            }`}
          >
            <button
              type="button"
              onClick={() => onChoose(move)}
              aria-describedby={reasoningId}
              className="flex min-h-11 w-full items-center gap-2 text-left after:absolute after:inset-0"
            >
              {isTop && <Trophy size={20} className="text-amber-700" aria-hidden="true" />}
              <span className="font-semibold text-slate-900">
                {isTop && <span className="sr-only">Melhor jogada: </span>}
                Peça {move.piece.a}-{move.piece.b} → ponta {move.end === "left" ? "esquerda" : "direita"}
              </span>
              <span className="ml-auto rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                {move.score} pts
              </span>
            </button>
            <ul id={reasoningId} className="mt-2 space-y-1 text-sm text-slate-600">
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
