"use client";

import { useState } from "react";
import { createDeck } from "@/engine/deck";
import { getScoreKey, getUnknownPieces } from "@/engine/inference";
import { GameState, Piece, PlayerState } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface RoundEndPanelProps {
  state: GameState;
  onFinishRound: (winnerPlayerId: number, revealedHands: Record<number, Piece[]>) => void;
  onNewRound: (userHand: Piece[]) => void;
}

function RevealRow({
  player,
  unknown,
  revealedCount,
  revealed,
  onToggle,
  onConfirm,
}: {
  player: PlayerState;
  unknown: Piece[];
  revealedCount: number;
  revealed: boolean;
  onToggle: () => void;
  onConfirm: (pieces: Piece[]) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={revealed}
        className="min-h-11 w-full text-left text-sm font-semibold text-slate-700"
      >
        Jogador {player.id} {revealedCount > 0 ? `— ${revealedCount} peça(s) revelada(s)` : "— não revelado"}
      </button>
      {/* Mounted only while expanded, so its local `picked` selection is
          discarded on collapse instead of going stale against `unknown`. */}
      {revealed && <RevealPicker player={player} unknown={unknown} onConfirm={onConfirm} />}
    </div>
  );
}

function RevealPicker({
  player,
  unknown,
  onConfirm,
}: {
  player: PlayerState;
  unknown: Piece[];
  onConfirm: (pieces: Piece[]) => void;
}) {
  const [picked, setPicked] = useState<Piece[]>([]);

  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-slate-500">
        Selecione {player.handSize} peça(s) ({picked.length}/{player.handSize})
      </p>
      <div className="flex flex-wrap gap-2">
        {unknown.map((piece) => {
          const selected = picked.some((p) => p.id === piece.id);
          return (
            <DominoTile
              key={piece.id}
              piece={piece}
              size="sm"
              selected={selected}
              disabled={!selected && picked.length >= player.handSize}
              onClick={() => setPicked((prev) => (selected ? prev.filter((p) => p.id !== piece.id) : [...prev, piece]))}
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={picked.length !== player.handSize}
        onClick={() => onConfirm(picked)}
        className="min-h-11 rounded-lg border-2 border-amber-500 px-3 py-2 font-semibold text-amber-900 disabled:pointer-events-none disabled:opacity-40"
      >
        Confirmar
      </button>
    </div>
  );
}

// Assumes the parent unmounts/remounts this component between rounds (phase
// transitions out of "round-end"/"finished" and back to "playing" via a
// separate render branch) — local state here is never explicitly reset.
export function RoundEndPanel({ state, onFinishRound, onNewRound }: RoundEndPanelProps) {
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [revealing, setRevealing] = useState<number | null>(null);
  const [revealedHands, setRevealedHands] = useState<Record<number, Piece[]>>({});
  const [newHand, setNewHand] = useState<Piece[]>([]);

  const deck = createDeck();
  const revealedIds = new Set(Object.values(revealedHands).flat().map((p) => p.id));
  const unknown = getUnknownPieces(state, deck).filter((p) => !revealedIds.has(p.id));
  const nonUserPlayers = state.players.filter((p) => p.role !== "user");

  if (state.phase === "finished") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        {state.error && (
          <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <h2 className="text-lg font-semibold text-slate-900">Rodada {state.roundNumber} encerrada</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {Object.entries(state.scores).map(([key, points]) => (
            <li key={key} className="tabular-nums">
              {key}: {points} pontos
            </li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold text-slate-600">
          Selecione a nova mão ({newHand.length}/{state.config.handSize})
        </h3>
        <div className="flex flex-wrap gap-2">
          {deck.map((piece) => {
            const selected = newHand.some((p) => p.id === piece.id);
            return (
              <DominoTile
                key={piece.id}
                piece={piece}
                size="sm"
                selected={selected}
                disabled={!selected && newHand.length >= state.config.handSize}
                onClick={() => setNewHand((prev) => (selected ? prev.filter((p) => p.id !== piece.id) : [...prev, piece]))}
              />
            );
          })}
        </div>
        <button
          type="button"
          disabled={newHand.length !== state.config.handSize}
          onClick={() => onNewRound(newHand)}
          className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
        >
          Iniciar nova rodada
        </button>
      </div>
    );
  }

  const bonusLabels: string[] = [];
  if (state.roundEndBonus?.laELo) bonusLabels.push("Lá-e-Lô");
  if (state.roundEndBonus?.bucha) bonusLabels.push("Bucha");

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <h2 className="text-lg font-semibold text-slate-900">
        {state.roundEndReason === "batida" ? "Batida!" : "Jogo trancado"}
      </h2>

      {bonusLabels.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          {bonusLabels.join(" + ")} — pontuação em {bonusLabels.length === 2 ? "quádruplo" : "dobro"}!
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-600">Quem venceu a rodada?</p>
        <div className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setWinnerId(p.id)}
              aria-pressed={winnerId === p.id}
              className={`min-h-11 rounded-lg border-2 px-3 py-2 font-semibold ${
                winnerId === p.id ? "border-amber-500 bg-amber-50" : "border-slate-300"
              }`}
            >
              {p.role === "user" ? "Você" : `Jogador ${p.id}`} ({getScoreKey(state, p)})
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-600">Revelar mãos (opcional, para pontuação exata):</p>
        {nonUserPlayers.map((p) => (
          <RevealRow
            key={p.id}
            player={p}
            unknown={unknown}
            revealedCount={revealedHands[p.id]?.length ?? 0}
            revealed={revealing === p.id}
            onToggle={() => setRevealing(revealing === p.id ? null : p.id)}
            onConfirm={(pieces) => {
              setRevealedHands((prev) => ({ ...prev, [p.id]: pieces }));
              setRevealing(null);
            }}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={winnerId === null}
        onClick={() => winnerId !== null && onFinishRound(winnerId, revealedHands)}
        className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
      >
        Calcular pontuação
      </button>
    </div>
  );
}
