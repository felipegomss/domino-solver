"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { End, GameState, Suit } from "@/engine/types";

interface TurnControllerProps {
  state: GameState;
  onPlayOpponentPiece: (a: Suit, b: Suit, end: End) => void;
  onPass: () => void;
  onDraw: () => void;
  onUndo: () => void;
}

const SUITS: Suit[] = [0, 1, 2, 3, 4, 5, 6];

function SuitPicker({ label, value, onChange }: { label: string; value: Suit | null; onChange: (v: Suit) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {SUITS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            aria-pressed={value === s}
            aria-label={`${label}: ${s}`}
            className={`min-h-11 min-w-11 rounded-md border-2 text-sm font-semibold tabular-nums ${
              value === s ? "border-amber-500 bg-amber-50" : "border-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TurnController({ state, onPlayOpponentPiece, onPass, onDraw, onUndo }: TurnControllerProps) {
  const [a, setA] = useState<Suit | null>(null);
  const [b, setB] = useState<Suit | null>(null);
  const [end, setEnd] = useState<End>("left");

  const currentPlayer = state.players[state.currentPlayerIndex];
  const isUserTurn = currentPlayer?.role === "user";
  const mustDraw = state.config.boneyardEnabled && state.boneyardRemaining > 0;

  function handleConfirmPlay() {
    if (a === null || b === null) return;
    onPlayOpponentPiece(a, b, end);
    setA(null);
    setB(null);
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800">
          {isUserTurn ? "Sua vez" : `Vez de: jogador ${currentPlayer?.id}`}
        </span>
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

      {!isUserTurn && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Registrar jogada deste jogador:</p>
          <div className="flex flex-wrap items-start gap-4">
            <SuitPicker label="Naipe A" value={a} onChange={setA} />
            <SuitPicker label="Naipe B" value={b} onChange={setB} />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500">Ponta</p>
              <div className="flex gap-2">
                {(["left", "right"] as const).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEnd(e)}
                    aria-pressed={end === e}
                    className={`min-h-11 rounded-lg border-2 px-3 py-2 font-semibold ${
                      end === e ? "border-amber-500 bg-amber-50" : "border-slate-300"
                    }`}
                  >
                    {e === "left" ? "Esquerda" : "Direita"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmPlay}
              disabled={a === null || b === null}
              className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 font-semibold text-white hover:bg-amber-800 disabled:pointer-events-none disabled:opacity-40"
            >
              Confirmar jogada
            </button>
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
        </div>
      )}
    </div>
  );
}
