"use client";

import { useState } from "react";
import { Trophy, Undo2 } from "lucide-react";
import { BatidaType, GameState, Piece } from "@/engine/types";
import { HandPicker } from "./HandPicker";

interface RoundEndPanelProps {
  state: GameState;
  onNewRound: (userHand: Piece[]) => void;
  onUndo: () => void;
}

const BATIDA_LABEL: Record<BatidaType, string> = {
  simples: "Batida simples",
  carroca: "Carroça (bucha)",
  "la-e-lo": "Lá-e-lô",
  cruzada: "Cruzada",
};

function playerLabel(state: GameState, playerId: number): string {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return `Jogador ${playerId}`;
  if (player.role === "user") return "Você";
  if (player.role === "partner") return "Parceiro";
  return `Adversário ${player.id}`;
}

// Assumes the parent unmounts/remounts this component between rounds (phase
// leaves "round-end" and returns to "playing" via a separate render branch) —
// local state here is never explicitly reset.
export function RoundEndPanel({ state, onNewRound, onUndo }: RoundEndPanelProps) {
  const [newHand, setNewHand] = useState<Piece[]>([]);

  const winnerId = state.lastWinnerId;
  const winner = winnerId !== null ? state.players.find((p) => p.id === winnerId) : undefined;
  const user = state.players.find((p) => p.role === "user");
  const isBatida = state.roundEndReason === "batida";
  const userSideWon =
    winner !== undefined &&
    (winner.role === "user" || (state.config.mode === "duplas" && winner.team !== null && winner.team === user?.team));

  function togglePiece(piece: Piece) {
    setNewHand((prev) => {
      const exists = prev.some((p) => p.id === piece.id);
      if (exists) return prev.filter((p) => p.id !== piece.id);
      if (prev.length >= state.config.handSize) return prev;
      return [...prev, piece];
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 p-4 sm:p-6">
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            {userSideWon && <Trophy size={20} className="text-amber-700" aria-hidden="true" />}
            {isBatida
              ? winner
                ? `${playerLabel(state, winner.id)} bateu!`
                : "Batida!"
              : winner
                ? `Jogo trancado — ${playerLabel(state, winner.id)} venceu`
                : "Jogo trancado — empate"}
          </h2>
          <p className="text-sm text-slate-600">
            {isBatida && state.batidaType && (
              <span className="mr-2 inline-block rounded-full bg-amber-100 px-3 py-0.5 font-semibold text-amber-900">
                {BATIDA_LABEL[state.batidaType]}
              </span>
            )}
            {!isBatida &&
              (winner
                ? "Menos peças na mão ao trancar."
                : "Mesmo número de peças na mão — ninguém leva a rodada.")}
            {isBatida && state.config.mode === "duplas" && winner && (
              <span>{userSideWon ? "Vitória da sua dupla." : "Vitória da dupla adversária."}</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onUndo}
          disabled={state.history.length === 0}
          className="flex min-h-11 items-center gap-1 rounded-lg border-2 border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          <Undo2 size={20} aria-hidden="true" />
          Desfazer última jogada
        </button>
      </div>

      <hr className="border-slate-100" />

      <HandPicker
        label={`Nova rodada ${state.roundNumber + 1} — selecione sua mão`}
        selected={newHand}
        max={state.config.handSize}
        onToggle={togglePiece}
      />

      <button
        type="button"
        disabled={newHand.length !== state.config.handSize}
        onClick={() => onNewRound(newHand)}
        className="min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
      >
        Iniciar nova rodada
      </button>
    </div>
  );
}
