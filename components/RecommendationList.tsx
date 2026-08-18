"use client";

import { Trophy } from "lucide-react";
import { RankedMove } from "@/engine/solver";

interface RecommendationListProps {
  moves: RankedMove[];
  onChoose: (move: RankedMove) => void;
}

export function RecommendationList({ moves, onChoose }: RecommendationListProps) {
  if (moves.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500">
        Nenhuma jogada válida — é preciso passar a vez.
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
