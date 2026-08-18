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
import { getUnknownPieces } from "@/engine/inference";
import { RankedMove, rankMoves } from "@/engine/solver";
import { End, Suit } from "@/engine/types";
import { useDominoGame } from "@/hooks/useDominoGame";

export default function Home() {
  const { state, dispatch, undo } = useDominoGame();

  const user = state.players.find((p) => p.role === "user");
  const recommendations = useMemo(() => (state.phase === "playing" ? rankMoves(state) : []), [state]);
  const isUserTurn = state.players[state.currentPlayerIndex]?.role === "user";
  const mustDraw = state.config.boneyardEnabled && state.boneyardRemaining > 0;
  const drawablePieces = useMemo(
    () => (state.phase === "playing" ? getUnknownPieces(state, createDeck()) : []),
    [state]
  );

  function handleChooseMove(move: RankedMove) {
    if (!user) return;
    dispatch({ type: "PLAY_PIECE", playerId: user.id, pieceId: move.piece.id, end: move.end });
  }

  function handleOpponentPlay(a: Suit, b: Suit, end: End) {
    const current = state.players[state.currentPlayerIndex];
    if (!current) return;
    const pieceId = a <= b ? `${a}-${b}` : `${b}-${a}`;
    dispatch({ type: "PLAY_PIECE", playerId: current.id, pieceId, end });
  }

  function handlePass() {
    const current = state.players[state.currentPlayerIndex];
    if (!current) return;
    dispatch({ type: "PASS", playerId: current.id });
  }

  function handleDraw(pieceId?: string) {
    const current = state.players[state.currentPlayerIndex];
    if (!current) return;
    dispatch({ type: "DRAW", playerId: current.id, pieceId });
  }

  if (state.phase === "setup") {
    return <SetupWizard onComplete={(config, userHand) => dispatch({ type: "SETUP_COMPLETE", config, userHand })} />;
  }

  if (state.phase === "round-end" || state.phase === "finished") {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <BoardDisplay board={state.board} />
        <RoundEndPanel
          state={state}
          onFinishRound={(winnerPlayerId, revealedHands) => {
            if (Object.keys(revealedHands).length > 0) {
              dispatch({ type: "REVEAL_HANDS", hands: revealedHands });
            }
            dispatch({ type: "FINISH_ROUND", winnerPlayerId });
          }}
          onNewRound={(userHand) => dispatch({ type: "NEW_ROUND", userHand })}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Dominó — Assistente</h1>
        <div className="text-sm font-semibold tabular-nums text-slate-600">Rodada {state.roundNumber}</div>
      </header>

      <BoardDisplay board={state.board} />

      <TurnController
        state={state}
        onPlayOpponentPiece={handleOpponentPlay}
        onPass={handlePass}
        onDraw={() => handleDraw()}
        onUndo={undo}
      />

      {isUserTurn && user?.hand && (
        <>
          <UserHand hand={user.hand} board={state.board} topRecommendedPieceId={recommendations[0]?.piece.id} />
          <RecommendationList
            moves={recommendations}
            onChoose={handleChooseMove}
            mustDraw={mustDraw}
            drawablePieces={drawablePieces}
            onPass={handlePass}
            onDrawPiece={(pieceId) => handleDraw(pieceId)}
          />
        </>
      )}

      <section className="rounded-xl border border-slate-200 p-4">
        <h2 className="mb-2 text-sm font-semibold text-slate-600">Histórico</h2>
        <GameHistoryLog state={state} />
      </section>
    </main>
  );
}
