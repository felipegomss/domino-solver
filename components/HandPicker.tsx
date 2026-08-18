"use client";

import { createDeck } from "@/engine/deck";
import { Piece, Suit } from "@/engine/types";
import { DominoTile } from "./DominoTile";

const DECK = createDeck();
const SUIT_GROUPS: Suit[] = [0, 1, 2, 3, 4, 5, 6];

interface HandPickerProps {
  label: string;
  selected: Piece[];
  max: number;
  onToggle: (piece: Piece) => void;
}

/**
 * Full-deck piece picker used wherever the user declares a hand: the setup
 * wizard and the new-round step. Shows a running counter, the current
 * selection as a tray, and the 28 pieces grouped by lower suit.
 */
export function HandPicker({ label, selected, max, onToggle }: HandPickerProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ivory">{label}</h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
            selected.length === max ? "bg-gold text-gold-ink" : "bg-surface-2 text-mist"
          }`}
        >
          {selected.length}/{max}
        </span>
      </div>

      {selected.length > 0 && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-2">Sua mão</p>
          <div className="flex flex-wrap gap-2">
            {selected.map((piece) => (
              <DominoTile key={piece.id} piece={piece} size="sm" selected onClick={() => onToggle(piece)} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {SUIT_GROUPS.map((suit) => (
          <div key={suit} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-right font-display text-sm font-semibold tabular-nums text-faint">
              {suit}
            </span>
            <div className="flex flex-wrap gap-2">
              {DECK.filter((piece) => piece.a === suit).map((piece) => {
                const isSelected = selected.some((p) => p.id === piece.id);
                return (
                  <DominoTile
                    key={piece.id}
                    piece={piece}
                    size="sm"
                    selected={isSelected}
                    disabled={!isSelected && selected.length >= max}
                    onClick={() => onToggle(piece)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
