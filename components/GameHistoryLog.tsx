"use client";

import { GameState, Move } from "@/engine/types";

interface GameHistoryLogProps {
  state: GameState;
}

function describeMove(move: Move, state: GameState): string {
  const player = state.players.find((p) => p.id === move.playerId);
  const label = player?.role === "user" ? "Você" : `Jogador ${move.playerId}`;
  if (move.type === "play") {
    return `${label} jogou ${move.pieceId} na ponta ${move.end === "left" ? "esquerda" : "direita"}`;
  }
  if (move.type === "pass") {
    return `${label} passou a vez`;
  }
  return `${label} comprou uma peça do monte`;
}

export function GameHistoryLog({ state }: GameHistoryLogProps) {
  if (state.history.length === 0) {
    return <p className="text-sm text-slate-500">Nenhuma jogada registrada ainda.</p>;
  }

  return (
    <ol className="space-y-1 text-sm text-slate-600">
      {[...state.history].reverse().map((move, i) => {
        const originalIndex = state.history.length - 1 - i;
        return (
          <li key={originalIndex} className="border-b border-slate-100 pb-1">
            {describeMove(move, state)}
          </li>
        );
      })}
    </ol>
  );
}
