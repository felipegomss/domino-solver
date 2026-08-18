"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { End, GameState, Piece } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface TurnControllerProps {
  state: GameState;
  /** Pieces that could still legally be played here, per the inference engine. */
  candidates: Piece[];
  /** True when the engine can prove this player has no legal move at all. */
  surePass: boolean;
  onPlayPiece: (pieceId: string, end: End) => void;
  onPass: () => void;
  onDraw: () => void;
  onUndo: () => void;
}

function playableEnds(piece: Piece, state: GameState): End[] {
  const { leftEnd, rightEnd } = state.board;
  if (leftEnd === null && rightEnd === null) return ["left"];
  const ends: End[] = [];
  if (piece.a === leftEnd || piece.b === leftEnd) ends.push("left");
  if (piece.a === rightEnd || piece.b === rightEnd) ends.push("right");
  return ends;
}

function playerLabel(state: GameState, playerId: number): string {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return `Jogador ${playerId}`;
  if (player.role === "user") return "Você";
  if (player.role === "partner") return "Parceiro";
  return `Adversário ${player.id}`;
}

export function TurnController({
  state,
  candidates,
  surePass,
  onPlayPiece,
  onPass,
  onDraw,
  onUndo,
}: TurnControllerProps) {
  const [pendingPiece, setPendingPiece] = useState<Piece | null>(null);

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isUserTurn = currentPlayer?.role === "user";
  const mustDraw = state.config.boneyardEnabled && state.boneyardRemaining > 0;

  function choosePiece(piece: Piece) {
    const ends = playableEnds(piece, state);
    if (ends.length === 1) {
      onPlayPiece(piece.id, ends[0]);
      setPendingPiece(null);
      return;
    }
    setPendingPiece(piece);
  }

  function chooseEnd(end: End) {
    if (!pendingPiece) return;
    onPlayPiece(pendingPiece.id, end);
    setPendingPiece(null);
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-slate-800">
          {isUserTurn ? "Sua vez" : `Vez de ${currentPlayer ? playerLabel(state, currentPlayer.id) : "—"}`}
        </h2>
        <button
          type="button"
          onClick={onUndo}
          disabled={state.history.length === 0}
          className="flex min-h-11 items-center gap-1 rounded-lg border-2 border-slate-300 px-3 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          <Undo2 size={20} aria-hidden="true" />
          Desfazer
        </button>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {!isUserTurn && currentPlayer && (
        <div className="space-y-3">
          {surePass ? (
            <>
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                Nenhuma peça que encaixe nas pontas {state.board.leftEnd} e {state.board.rightEnd} ainda está em jogo —{" "}
                {playerLabel(state, currentPlayer.id)} só pode passar.
              </p>
              <button
                type="button"
                onClick={onPass}
                className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800"
              >
                Passou a vez
              </button>
            </>
          ) : pendingPiece ? (
            <>
              <p className="text-sm text-slate-600">Em qual ponta essa peça foi jogada?</p>
              <div className="flex flex-wrap items-center gap-3">
                <DominoTile piece={pendingPiece} size="sm" selected />
                {playableEnds(pendingPiece, state).map((end) => (
                  <button
                    key={end}
                    type="button"
                    onClick={() => chooseEnd(end)}
                    className="min-h-11 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-2 font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    {end === "left" ? `Esquerda (${state.board.leftEnd})` : `Direita (${state.board.rightEnd})`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPendingPiece(null)}
                  className="min-h-11 rounded-lg border-2 border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Qual peça {playerLabel(state, currentPlayer.id)} jogou?{" "}
                <span className="text-slate-400">
                  ({candidates.length} possíve{candidates.length === 1 ? "l" : "is"})
                </span>
              </p>
              {candidates.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma peça possível — registre um passe ou uma compra.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {candidates.map((piece) => (
                    <DominoTile key={piece.id} piece={piece} size="sm" onClick={() => choosePiece(piece)} />
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                {mustDraw ? (
                  <button
                    type="button"
                    onClick={onDraw}
                    className="min-h-11 rounded-lg border-2 border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Comprou do monte
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPass}
                    className="min-h-11 rounded-lg border-2 border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Passou a vez
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
