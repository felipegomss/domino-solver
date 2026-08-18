"use client";

import { useState } from "react";
import { createDeck } from "@/engine/deck";
import { GameConfig, Piece, Suit } from "@/engine/types";
import { DominoTile } from "./DominoTile";

interface SetupWizardProps {
  onComplete: (config: GameConfig, userHand: Piece[]) => void;
}

type Step = "players" | "mode" | "direction" | "handSize" | "boneyard" | "starter" | "hand";

const DECK = createDeck();
const SUIT_GROUPS: Suit[] = [0, 1, 2, 3, 4, 5, 6];

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
      className={`min-h-11 rounded-lg border-2 px-4 py-3 text-left font-semibold transition-colors ${
        active ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300 text-slate-700 hover:bg-slate-50"
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

  const dealtTotal = numPlayers * handSize;
  const hasBoneyard = dealtTotal < 28;

  const starterOptions: { id: number; label: string }[] = [{ id: 0, label: "Você" }];
  if (mode === "duplas" && numPlayers === 4) starterOptions.push({ id: 2, label: "Parceiro" });
  for (let i = 1; i < numPlayers; i++) {
    if (mode === "duplas" && numPlayers === 4 && i === 2) continue;
    starterOptions.push({ id: i, label: `Adversário ${i}` });
  }

  function togglePiece(piece: Piece) {
    setSelectedHand((prev) => {
      const exists = prev.some((p) => p.id === piece.id);
      if (exists) return prev.filter((p) => p.id !== piece.id);
      if (prev.length >= handSize) return prev;
      return [...prev, piece];
    });
  }

  function goNext() {
    if (step === "players") setStep(numPlayers === 4 ? "mode" : "direction");
    else if (step === "mode") setStep("direction");
    else if (step === "direction") setStep("handSize");
    else if (step === "handSize") setStep(hasBoneyard ? "boneyard" : "hand");
    else if (step === "boneyard") setStep("hand");
    else if (step === "hand") setStep("starter");
  }

  function goBack() {
    if (step === "starter") setStep("hand");
    else if (step === "hand") setStep(hasBoneyard ? "boneyard" : "handSize");
    else if (step === "boneyard") setStep("handSize");
    else if (step === "handSize") setStep("direction");
    else if (step === "direction") setStep(numPlayers === 4 ? "mode" : "players");
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
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Configurar Partida</h1>

      {step === "players" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Quantos jogadores?</h2>
          <div className="grid grid-cols-3 gap-3">
            {[2, 3, 4].map((n) => (
              <StepButton
                key={n}
                active={numPlayers === n}
                onClick={() => {
                  setNumPlayers(n as 2 | 3 | 4);
                  setStartingPlayer(0);
                }}
              >
                <span className="block text-center">{n}</span>
              </StepButton>
            ))}
          </div>
        </section>
      )}

      {step === "mode" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Modo de jogo</h2>
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

      {step === "direction" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Sentido do jogo</h2>
          <div className="grid grid-cols-2 gap-3">
            <StepButton active={direction === "cw"} onClick={() => setDirection("cw")}>
              Horário
            </StepButton>
            <StepButton active={direction === "ccw"} onClick={() => setDirection("ccw")}>
              Anti-horário
            </StepButton>
          </div>
        </section>
      )}

      {step === "handSize" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Pedras iniciais por jogador</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setHandSize((h) => Math.max(1, h - 1))}
              className="min-h-11 min-w-11 rounded-lg border-2 border-slate-300 text-xl font-bold hover:bg-slate-50"
              aria-label="Diminuir"
            >
              −
            </button>
            <span className="w-12 text-center text-2xl font-semibold tabular-nums">{handSize}</span>
            <button
              type="button"
              onClick={() => setHandSize((h) => Math.min(14, h + 1))}
              className="min-h-11 min-w-11 rounded-lg border-2 border-slate-300 text-xl font-bold hover:bg-slate-50"
              aria-label="Aumentar"
            >
              +
            </button>
          </div>
          <p className="text-sm text-slate-500">
            {dealtTotal} de 28 peças distribuídas
            {hasBoneyard ? ` — ${28 - dealtTotal} peças formarão o monte.` : " — todas as peças distribuídas."}
          </p>
        </section>
      )}

      {step === "boneyard" && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Regra do monte</h2>
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
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Quem inicia?</h2>
          <div className="grid grid-cols-2 gap-3">
            {starterOptions.map((opt) => (
              <StepButton key={opt.id} active={startingPlayer === opt.id} onClick={() => setStartingPlayer(opt.id)}>
                {opt.label}
              </StepButton>
            ))}
          </div>
        </section>
      )}

      {step === "hand" && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Selecione sua mão</h2>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${
                selectedHand.length === handSize ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
              }`}
            >
              {selectedHand.length}/{handSize}
            </span>
          </div>

          {selectedHand.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">Sua mão</p>
              <div className="flex flex-wrap gap-2">
                {selectedHand.map((piece) => (
                  <DominoTile
                    key={piece.id}
                    piece={piece}
                    size="sm"
                    selected
                    onClick={() => togglePiece(piece)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {SUIT_GROUPS.map((suit) => (
              <div key={suit} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">{suit}</span>
                <div className="flex flex-wrap gap-2">
                  {DECK.filter((piece) => piece.a === suit).map((piece) => {
                    const selected = selectedHand.some((p) => p.id === piece.id);
                    return (
                      <DominoTile
                        key={piece.id}
                        piece={piece}
                        size="sm"
                        selected={selected}
                        disabled={!selected && selectedHand.length >= handSize}
                        onClick={() => togglePiece(piece)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={goBack}
          disabled={step === "players"}
          className="min-h-11 rounded-lg border-2 border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
        >
          Voltar
        </button>
        {step === "starter" ? (
          <button
            type="button"
            onClick={handleSubmit}
            className="min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800"
          >
            Começar Partida
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={step === "hand" && selectedHand.length !== handSize}
            className="min-h-11 rounded-lg bg-amber-700 px-5 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  );
}
