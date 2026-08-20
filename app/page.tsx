"use client";

import { useMemo } from "react";
import { BoardDisplay } from "@/components/BoardDisplay";
import { GameHistoryLog } from "@/components/GameHistoryLog";
import { RecommendationList } from "@/components/RecommendationList";
import { RoundEndPanel } from "@/components/RoundEndPanel";
import { SeatMap } from "@/components/SeatMap";
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

  const headerChips = (
    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
      <span className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-mist tabular-nums">
        Rodada {state.roundNumber}
      </span>
      {state.config.boneyardEnabled && (
        <span className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-mist tabular-nums">
          Monte {state.boneyardRemaining}
        </span>
      )}
      {isPlaying && (
        <span
          className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 ${
            isUserTurn ? "bg-gold text-gold-ink" : "border border-line bg-surface text-mist"
          }`}
        >
          {isUserTurn && <span aria-hidden="true" className="turn-dot size-2 rounded-full bg-gold-ink" />}
          {isUserTurn
            ? "Sua vez"
            : `Vez de ${
                currentPlayer?.role === "partner" ? "Parceiro" : `Adversário ${currentPlayer?.id ?? ""}`
              }`}
        </span>
      )}
    </div>
  );

  const header = (
    <header className="panel-in flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-2xl font-semibold italic text-ivory">
        Dominó <span className="not-italic text-sm font-sans font-medium tracking-wide text-faint">assistente de mesa</span>
      </h1>
      {headerChips}
    </header>
  );

  if (state.phase === "round-end") {
    return (
      <main className="mx-auto w-full max-w-[1200px] space-y-6 px-5 py-6 xl:px-8">
        {header}
        <div className="panel-in [animation-delay:80ms]">
          <BoardDisplay board={state.board} />
        </div>
        <RoundEndPanel
          state={state}
          onNewRound={(userHand, startingPlayer) => dispatch({ type: "NEW_ROUND", userHand, startingPlayer })}
          onUndo={undo}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1680px] space-y-6 px-5 py-6 xl:px-10">
      {header}

      <div className="panel-in [animation-delay:80ms]">
        <BoardDisplay board={state.board} />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="panel-in space-y-6 [animation-delay:160ms] xl:col-span-7">
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

        <div className="panel-in space-y-6 self-start [animation-delay:240ms] xl:sticky xl:top-6 xl:col-span-5">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Mesa</h2>
            <SeatMap state={state} currentPlayerIndex={state.currentPlayerIndex} />
          </section>

          {user?.hand && (
            <UserHand
              hand={user.hand}
              board={state.board}
              topRecommendedPieceId={recommendations[0]?.piece.id}
              isUserTurn={isUserTurn}
            />
          )}

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_6px_24px_rgba(0,0,0,0.35)]">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Histórico</h2>
            <GameHistoryLog state={state} />
          </section>
        </div>
      </div>
    </main>
  );
}
