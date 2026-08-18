"use client";

import { useMemo } from "react";
import { BoardDisplay } from "@/components/BoardDisplay";
import { GameHistoryLog } from "@/components/GameHistoryLog";
import { RecommendationList } from "@/components/RecommendationList";
import { RoundEndPanel } from "@/components/RoundEndPanel";
import { SetupWizard } from "@/components/SetupWizard";
import { TurnController } from "@/components/TurnController";
import { UserHand } from "@/components/UserHand";
import { createDeck } from "@/engine/deck";
import { getCandidatePieces, getUnknownPieces, willSurelyPass } from "@/engine/inference";
import { RankedMove, rankMoves } from "@/engine/solver";
import { End } from "@/engine/types";
import { useDominoGame } from "@/hooks/useDominoGame";

const DECK = createDeck();

export default function Home() {
  const { state, dispatch, undo } = useDominoGame();

  const user = state.players.find((p) => p.role === "user");
  const currentPlayer = state.players[state.currentPlayerIndex];
  const isUserTurn = currentPlayer?.role === "user";
  const isPlaying = state.phase === "playing";

  const recommendations = useMemo(() => (isPlaying ? rankMoves(state) : []), [state, isPlaying]);
  const candidates = useMemo(
    () => (isPlaying && currentPlayer ? getCandidatePieces(state, currentPlayer.id, DECK) : []),
    [state, isPlaying, currentPlayer]
  );
  const surePass = useMemo(
    () => (isPlaying && currentPlayer ? willSurelyPass(state, currentPlayer.id, DECK) : false),
    [state, isPlaying, currentPlayer]
  );
  const drawablePieces = useMemo(() => (isPlaying ? getUnknownPieces(state, DECK) : []), [state, isPlaying]);

  const mustDraw = state.config.boneyardEnabled && state.boneyardRemaining > 0;

  function handleChooseMove(move: RankedMove) {
    if (!user) return;
    dispatch({ type: "PLAY_PIECE", playerId: user.id, pieceId: move.piece.id, end: move.end });
  }

  function handlePlayPiece(pieceId: string, end: End) {
    if (!currentPlayer) return;
    dispatch({ type: "PLAY_PIECE", playerId: currentPlayer.id, pieceId, end });
  }

  function handlePass() {
    if (!currentPlayer) return;
    dispatch({ type: "PASS", playerId: currentPlayer.id });
  }

  function handleDraw(pieceId?: string) {
    if (!currentPlayer) return;
    dispatch({ type: "DRAW", playerId: currentPlayer.id, pieceId });
  }

  if (state.phase === "setup") {
    return <SetupWizard onComplete={(config, userHand) => dispatch({ type: "SETUP_COMPLETE", config, userHand })} />;
  }

  if (state.phase === "round-end") {
    return (
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <BoardDisplay board={state.board} />
        <RoundEndPanel
          state={state}
          onNewRound={(userHand) => dispatch({ type: "NEW_ROUND", userHand })}
          onUndo={undo}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Dominó — Assistente</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-600">
          <span className="tabular-nums">Rodada {state.roundNumber}</span>
          {state.config.boneyardEnabled && <span className="tabular-nums">Monte: {state.boneyardRemaining}</span>}
        </div>
      </header>

      <BoardDisplay board={state.board} />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <TurnController
            state={state}
            candidates={candidates}
            surePass={surePass}
            onPlayPiece={handlePlayPiece}
            onPass={handlePass}
            onDraw={() => handleDraw()}
            onUndo={undo}
          />

          {isUserTurn && (
            <RecommendationList
              moves={recommendations}
              onChoose={handleChooseMove}
              mustDraw={mustDraw}
              drawablePieces={drawablePieces}
              onPass={handlePass}
              onDrawPiece={(pieceId) => handleDraw(pieceId)}
            />
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          {user?.hand && (
            <UserHand
              hand={user.hand}
              board={state.board}
              topRecommendedPieceId={recommendations[0]?.piece.id}
              isUserTurn={isUserTurn}
            />
          )}

          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Histórico</h2>
            <GameHistoryLog state={state} />
          </section>
        </div>
      </div>
    </main>
  );
}
