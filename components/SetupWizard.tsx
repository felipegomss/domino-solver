"use client";

import { useState } from "react";
import { assignSeats } from "@/engine/seats";
import { GameConfig, Piece } from "@/engine/types";
import { HandPicker } from "./HandPicker";
import { SeatMap } from "./SeatMap";

interface SetupWizardProps {
  onComplete: (config: GameConfig, userHand: Piece[]) => void;
}

type Step = "players" | "mode" | "handSize" | "boneyard" | "starter" | "hand";

const STEP_TITLES: Record<Step, string> = {
  players: "Quantos jogadores?",
  mode: "Modo de jogo",
  handSize: "Pedras iniciais por jogador",
  boneyard: "Regra do monte",
  hand: "Selecione sua mão",
  starter: "Quem inicia?",
};

function StepButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 rounded-lg border px-4 py-3 text-left font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
        active
          ? "border-gold bg-gold/10 text-gold-2"
          : "border-line-strong text-mist hover:bg-surface-2 hover:text-ivory"
      }`}
    >
      {children}
    </button>
  );
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<Step>("players");
  const [numPlayers, setNumPlayers] = useState<2 | 3 | 4>(4);
  const [mode, setMode] = useState<"individual" | "duplas">("individual");
  const [direction, setDirection] = useState<"cw" | "ccw">("cw");
  const [handSize, setHandSize] = useState(7);
  const [boneyardEnabled, setBoneyardEnabled] = useState(false);
  const [startingPlayer, setStartingPlayer] = useState(0);
  const [selectedHand, setSelectedHand] = useState<Piece[]>([]);

  // A double-6 set has 28 pieces, so the table simply cannot deal more than
  // floor(28 / numPlayers) to each player.
  const maxHandSize = Math.floor(28 / numPlayers);
  const dealtTotal = numPlayers * handSize;
  const hasBoneyard = dealtTotal < 28;

  const visibleSteps: Step[] = [
    "players",
    ...(numPlayers === 4 ? (["mode"] as Step[]) : []),
    "handSize",
    ...(hasBoneyard ? (["boneyard"] as Step[]) : []),
    "hand",
    "starter",
  ];
  const stepIndex = visibleSteps.indexOf(step);

  // Same assignment the reducer will use, so the preview table matches the deal.
  const seats = assignSeats({ numPlayers, mode: numPlayers === 4 ? mode : "individual" });

  function togglePiece(piece: Piece) {
    setSelectedHand((prev) => {
      const exists = prev.some((p) => p.id === piece.id);
      if (exists) return prev.filter((p) => p.id !== piece.id);
      if (prev.length >= handSize) return prev;
      return [...prev, piece];
    });
  }

  function goNext() {
    if (step === "players") setStep(numPlayers === 4 ? "mode" : "handSize");
    else if (step === "mode") setStep("handSize");
    else if (step === "handSize") setStep(hasBoneyard ? "boneyard" : "hand");
    else if (step === "boneyard") setStep("hand");
    else if (step === "hand") setStep("starter");
  }

  function goBack() {
    if (step === "starter") setStep("hand");
    else if (step === "hand") setStep(hasBoneyard ? "boneyard" : "handSize");
    else if (step === "boneyard") setStep("handSize");
    else if (step === "handSize") setStep(numPlayers === 4 ? "mode" : "players");
    else if (step === "mode") setStep("players");
  }

  function handleSubmit() {
    onComplete(
      {
        numPlayers,
        mode: numPlayers === 4 ? mode : "individual",
        direction,
        handSize,
        boneyardEnabled: hasBoneyard && boneyardEnabled,
        startingPlayer,
      },
      selectedHand
    );
  }

  return (
    <main className="flex h-dvh items-center justify-center overflow-hidden px-4 py-6">
      <div className="panel-in flex max-h-full w-full max-w-3xl flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-[0_16px_60px_rgba(0,0,0,0.5)] sm:p-7">
        <header className="shrink-0 space-y-2">
          <p className="font-display text-sm italic text-gold">Dominó — assistente de mesa</p>
          <h1 className="font-display text-3xl font-semibold text-ivory">Configurar partida</h1>
          <div className="flex items-center gap-1.5 pt-1" aria-label={`Etapa ${stepIndex + 1} de ${visibleSteps.length}`}>
            {visibleSteps.map((s, i) => (
              <span
                key={s}
                aria-hidden="true"
                className={`h-1 rounded-full transition-all ${
                  i < stepIndex ? "w-5 bg-gold/50" : i === stepIndex ? "w-8 bg-gold" : "w-5 bg-line"
                }`}
              />
            ))}
          </div>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto pr-1">
        {step === "players" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-ivory">{STEP_TITLES.players}</h2>
            <div className="grid grid-cols-3 gap-3">
              {[2, 3, 4].map((n) => (
                <StepButton
                  key={n}
                  active={numPlayers === n}
                  onClick={() => {
                    const next = n as 2 | 3 | 4;
                    const nextMax = Math.floor(28 / next);
                    setNumPlayers(next);
                    setStartingPlayer(0);
                    setHandSize((h) => Math.min(h, nextMax));
                    setSelectedHand((prev) => prev.slice(0, nextMax));
                  }}
                >
                  <span className="block text-center font-display text-2xl">{n}</span>
                </StepButton>
              ))}
            </div>
          </section>
        )}

        {step === "mode" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-ivory">{STEP_TITLES.mode}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StepButton
                active={mode === "individual"}
                onClick={() => {
                  setMode("individual");
                  setStartingPlayer(0);
                }}
              >
                Individual
              </StepButton>
              <StepButton
                active={mode === "duplas"}
                onClick={() => {
                  setMode("duplas");
                  setStartingPlayer(0);
                }}
              >
                Duplas (0+2 vs 1+3)
              </StepButton>
            </div>
          </section>
        )}

        {step === "handSize" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-ivory">{STEP_TITLES.handSize}</h2>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setHandSize((h) => {
                    const next = Math.max(1, h - 1);
                    // Keep an already-picked hand within the new limit.
                    setSelectedHand((prev) => prev.slice(0, next));
                    return next;
                  })
                }
                disabled={handSize <= 1}
                className="min-h-11 min-w-11 rounded-lg border border-line-strong text-xl font-bold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
                aria-label="Diminuir"
              >
                −
              </button>
              <span className="w-12 text-center font-display text-3xl font-semibold tabular-nums text-gold-2">
                {handSize}
              </span>
              <button
                type="button"
                onClick={() => setHandSize((h) => Math.min(maxHandSize, h + 1))}
                disabled={handSize >= maxHandSize}
                className="min-h-11 min-w-11 rounded-lg border border-line-strong text-xl font-bold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
                aria-label="Aumentar"
              >
                +
              </button>
            </div>
            <p className="text-sm text-faint">
              {dealtTotal} de 28 peças distribuídas
              {hasBoneyard ? ` — ${28 - dealtTotal} peças formarão o monte.` : " — todas as peças distribuídas."}
              {handSize >= maxHandSize && (
                <span className="block">Máximo de {maxHandSize} para {numPlayers} jogadores.</span>
              )}
            </p>
          </section>
        )}

        {step === "boneyard" && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-ivory">{STEP_TITLES.boneyard}</h2>
            <div className="grid grid-cols-1 gap-3">
              <StepButton active={boneyardEnabled} onClick={() => setBoneyardEnabled(true)}>
                Com monte — comprar antes de passar
              </StepButton>
              <StepButton active={!boneyardEnabled} onClick={() => setBoneyardEnabled(false)}>
                Sem monte — peças restantes ficam fora do jogo
              </StepButton>
            </div>
          </section>
        )}

        {step === "starter" && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-ivory">{STEP_TITLES.starter}</h2>
            <p className="text-sm text-faint">
              Toque no lugar de quem começa jogando. O centro inverte o sentido do jogo.
            </p>
            <SeatMap
              seats={seats.map((seat) => ({ ...seat, handSize }))}
              direction={direction}
              mode={numPlayers === 4 ? mode : "individual"}
              selectable
              selectedId={startingPlayer}
              onSelect={setStartingPlayer}
              onToggleDirection={() => setDirection((d) => (d === "cw" ? "ccw" : "cw"))}
            />
          </section>
        )}

        {step === "hand" && (
          <section className="space-y-4">
            <HandPicker label={STEP_TITLES.hand} selected={selectedHand} max={handSize} onToggle={togglePiece} />
          </section>
        )}

        </div>

        <div className="flex shrink-0 justify-between border-t border-line/60 pt-4">
          <button
            type="button"
            onClick={goBack}
            disabled={step === "players"}
            className="min-h-11 rounded-lg border border-line-strong px-5 py-2 font-semibold text-mist transition-colors hover:bg-surface-2 hover:text-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
          >
            Voltar
          </button>
          {step === "starter" ? (
            <button
              type="button"
              onClick={handleSubmit}
              className="min-h-11 rounded-lg bg-gold px-6 py-2 font-semibold text-gold-ink transition-colors hover:bg-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              Começar partida
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              disabled={step === "hand" && selectedHand.length !== handSize}
              className="min-h-11 rounded-lg bg-gold px-6 py-2 font-semibold text-gold-ink transition-colors hover:bg-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-40"
            >
              Próximo
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
