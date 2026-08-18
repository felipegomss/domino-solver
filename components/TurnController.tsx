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
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold text-ivory">
          {isUserTurn && <span aria-hidden="true" className="turn-dot size-2.5 rounded-full bg-gold" />}
          {isUserTurn ? "Sua vez" : `Vez de ${currentPlayer ? playerLabel(state, currentPlayer.id) : "—"}`}
        </h2>
        <button
          type="button"
          onClick={onUndo}
          disabled={state.history.length === 0}
          className="flex min-h-11 items-center gap-1.5 rounded-lg border border-line-strong px-3 py-2 text-sm font-semibold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
        >
          <Undo2 size={18} aria-hidden="true" />
          Desfazer
        </button>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-danger/50 bg-danger-dim px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      {!isUserTurn && currentPlayer && (
        <div className="space-y-3">
          {surePass ? (
            <>
              <p className="rounded-lg border border-sky-note/30 bg-sky-dim px-3 py-2 text-sm text-sky-note">
                Nenhuma peça que encaixe nas pontas {state.board.leftEnd} e {state.board.rightEnd} ainda está em jogo —{" "}
                {playerLabel(state, currentPlayer.id)} só pode passar.
              </p>
              <button
                type="button"
                onClick={onPass}
                className="min-h-11 rounded-lg bg-gold px-5 py-2 font-semibold text-gold-ink transition-colors hover:bg-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                Passou a vez
              </button>
            </>
          ) : pendingPiece ? (
            <>
              <p className="text-sm text-mist">Em qual ponta essa peça foi jogada?</p>
              <div className="flex flex-wrap items-center gap-3">
                <DominoTile piece={pendingPiece} size="sm" selected />
                {playableEnds(pendingPiece, state).map((end) => (
                  <button
                    key={end}
                    type="button"
                    onClick={() => chooseEnd(end)}
                    className="min-h-11 rounded-lg border border-gold/60 bg-gold/10 px-4 py-2 font-semibold text-gold-2 transition-colors hover:bg-gold/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {end === "left" ? `Esquerda (${state.board.leftEnd})` : `Direita (${state.board.rightEnd})`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPendingPiece(null)}
                  className="min-h-11 rounded-lg border border-line-strong px-4 py-2 font-semibold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-mist">
                Qual peça {playerLabel(state, currentPlayer.id)} jogou?{" "}
                <span className="text-faint">
                  ({candidates.length} possíve{candidates.length === 1 ? "l" : "is"})
                </span>
              </p>
              {candidates.length === 0 ? (
                <p className="text-sm text-faint">Nenhuma peça possível — registre um passe ou uma compra.</p>
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
                    className="min-h-11 rounded-lg border border-line-strong px-4 py-2 font-semibold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    Comprou do monte
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPass}
                    className="min-h-11 rounded-lg border border-line-strong px-4 py-2 font-semibold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
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
