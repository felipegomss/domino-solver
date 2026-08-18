"use client";

import { GameState, Move } from "@/engine/types";

interface GameHistoryLogProps {
  state: GameState;
}

function describeMove(move: Move, state: GameState): { label: string; action: string; isUser: boolean } {
  const player = state.players.find((p) => p.id === move.playerId);
  const isUser = player?.role === "user";
  const label = isUser ? "Você" : player?.role === "partner" ? "Parceiro" : `Adversário ${move.playerId}`;
  if (move.type === "play") {
    return { label, action: `jogou ${move.pieceId} na ponta ${move.end === "left" ? "esquerda" : "direita"}`, isUser };
  }
  if (move.type === "pass") {
    return { label, action: "passou a vez", isUser };
  }
  return { label, action: "comprou uma peça do monte", isUser };
}

export function GameHistoryLog({ state }: GameHistoryLogProps) {
  if (state.history.length === 0) {
    return <p className="text-sm text-faint">Nenhuma jogada registrada ainda.</p>;
  }

  return (
    <ol className="scroll-slim max-h-72 space-y-0.5 overflow-y-auto pr-1 text-sm">
      {[...state.history].reverse().map((move, i) => {
        const originalIndex = state.history.length - 1 - i;
        const { label, action, isUser } = describeMove(move, state);
        return (
          <li key={originalIndex} className="flex gap-2 border-b border-line/40 py-1.5">
            <span className="w-6 shrink-0 text-right text-xs text-faint tabular-nums">{originalIndex + 1}.</span>
            <span className={isUser ? "text-ivory" : "text-mist"}>
              <span className="font-semibold">{label}</span> {action}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
