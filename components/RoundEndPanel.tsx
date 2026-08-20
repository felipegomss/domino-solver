"use client";

import { useState } from "react";
import { Trophy, Undo2 } from "lucide-react";
import { BatidaType, GameState, Piece } from "@/engine/types";
import { HandPicker } from "./HandPicker";
import { SeatMap } from "./SeatMap";

interface RoundEndPanelProps {
  state: GameState;
  onNewRound: (userHand: Piece[], startingPlayer: number) => void;
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
  // The winner is only a suggestion: in duplas the partner often opens for the
  // winning side, and some tables rotate regardless of who batted.
  const [starterId, setStarterId] = useState<number | null>(state.lastWinnerId);

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
    <div className="panel-in flex min-h-0 flex-1 flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-[0_16px_60px_rgba(0,0,0,0.5)] sm:p-6">
      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/50 bg-danger-dim px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="flex items-center gap-3 font-display text-3xl font-semibold text-ivory">
            {userSideWon && <Trophy size={28} className="text-gold" aria-hidden="true" />}
            {isBatida
              ? winner
                ? `${playerLabel(state, winner.id)} bateu!`
                : "Batida!"
              : winner
                ? `Jogo trancado — ${playerLabel(state, winner.id)} venceu`
                : "Jogo trancado — empate"}
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-mist">
            {isBatida && state.batidaType && (
              <span className="inline-block rounded-full bg-gold px-3 py-0.5 font-bold text-gold-ink">
                {BATIDA_LABEL[state.batidaType]}
              </span>
            )}
            {!isBatida &&
              (winner ? "Menos peças na mão ao trancar." : "Mesmo número de peças na mão — ninguém leva a rodada.")}
            {isBatida && state.config.mode === "duplas" && winner && (
              <span>{userSideWon ? "Vitória da sua dupla." : "Vitória da dupla adversária."}</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={onUndo}
          disabled={state.history.length === 0}
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
        >
          <Undo2 size={18} aria-hidden="true" />
          Desfazer última jogada
        </button>
      </div>

      <hr className="shrink-0 border-line/60" />

      <div className="scroll-slim grid min-h-0 flex-1 gap-6 overflow-y-auto pr-1 lg:grid-cols-2">
        <HandPicker
          label={`Nova rodada ${state.roundNumber + 1} — selecione sua mão`}
          selected={newHand}
          max={state.config.handSize}
          onToggle={togglePiece}
        />

        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold text-ivory">Quem começa jogando?</h2>
          <p className="text-sm text-faint">
            {winner
              ? `${playerLabel(state, winner.id)} venceu, mas a mesa decide quem sai — confirme ou escolha outro.`
              : "Rodada empatada — escolha quem sai."}
          </p>
          <SeatMap
            seats={state.players}
            direction={state.config.direction}
            mode={state.config.mode}
            selectable
            selectedId={starterId}
            onSelect={setStarterId}
          />
        </div>
      </div>

      <button
        type="button"
        disabled={newHand.length !== state.config.handSize || starterId === null}
        data-pinned-action
        onClick={() => starterId !== null && onNewRound(newHand, starterId)}
        className="min-h-11 shrink-0 self-start rounded-lg bg-gold px-6 py-2 font-semibold text-gold-ink transition-colors hover:bg-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
      >
        Iniciar nova rodada
      </button>
    </div>
  );
}
