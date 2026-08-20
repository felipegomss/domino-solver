"use client";

import { RotateCcw, RotateCw } from "lucide-react";
import { GameState, PlayerState } from "@/engine/types";

type Slot = "top" | "left" | "right" | "bottom";

interface SeatMapProps {
  state: GameState;
  /** Turn to highlight; omit to highlight nothing (e.g. between rounds). */
  currentPlayerIndex?: number;
  /** Turns seats into radio-style buttons for choosing who opens. */
  selectable?: boolean;
  selectedId?: number | null;
  onSelect?: (playerId: number) => void;
}

/**
 * Seats laid out the way they actually sit at the table, so the play order is
 * readable at a glance. In duplas the partner ends up across from the user and
 * the opponents on the sides — which is exactly the real arrangement, and makes
 * "you → opponent → partner → opponent" obvious instead of something to infer
 * from player numbers.
 */
const SLOT_ORDER: Record<"cw" | "ccw", Slot[]> = {
  cw: ["bottom", "left", "top", "right"],
  ccw: ["bottom", "right", "top", "left"],
};

const SLOT_POSITION: Record<Slot, string> = {
  top: "col-start-2 row-start-1 justify-self-center",
  left: "col-start-1 row-start-2 justify-self-start",
  right: "col-start-3 row-start-2 justify-self-end",
  bottom: "col-start-2 row-start-3 justify-self-center",
};

export function seatLabel(player: PlayerState): string {
  if (player.role === "user") return "Você";
  if (player.role === "partner") return "Parceiro";
  return `Adversário ${player.id}`;
}

function slotsFor(state: GameState): Slot[] {
  const { numPlayers, direction } = state.config;
  // Head-to-head reads better facing each other than rotating around a corner.
  if (numPlayers === 2) return ["bottom", "top"];
  return SLOT_ORDER[direction].slice(0, numPlayers);
}

export function SeatMap({ state, currentPlayerIndex, selectable = false, selectedId, onSelect }: SeatMapProps) {
  const slots = slotsFor(state);
  const isDuplas = state.config.mode === "duplas";
  const userTeam = state.players.find((p) => p.role === "user")?.team ?? null;
  const DirectionIcon = state.config.direction === "cw" ? RotateCw : RotateCcw;

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-line bg-felt-900/60 p-3">
      {state.players.map((player, i) => {
        const slot = slots[i] ?? "bottom";
        const isTurn = currentPlayerIndex === player.id;
        const isSelected = selectedId === player.id;
        const isAlly = isDuplas && player.team !== null && player.team === userTeam;

        const tone = isSelected
          ? "border-gold bg-gold/15 text-gold-2"
          : isTurn
            ? "border-gold bg-gold/10 text-gold-2"
            : isAlly
              ? "border-line-strong bg-surface text-ivory"
              : "border-line bg-surface/70 text-mist";

        const body = (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              {isTurn && <span aria-hidden="true" className="turn-dot size-1.5 rounded-full bg-gold" />}
              {seatLabel(player)}
            </span>
            <span className="text-[11px] tabular-nums text-faint">
              {player.handSize} peça{player.handSize === 1 ? "" : "s"}
              {isDuplas && player.team !== null && ` · dupla ${player.team}`}
            </span>
          </>
        );

        const shape = "flex min-h-11 w-32 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition-colors";

        return selectable ? (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelect?.(player.id)}
            aria-pressed={isSelected}
            className={`${SLOT_POSITION[slot]} ${shape} ${tone} hover:border-gold/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`}
          >
            {body}
          </button>
        ) : (
          <div
            key={player.id}
            aria-current={isTurn ? "true" : undefined}
            className={`${SLOT_POSITION[slot]} ${shape} ${tone}`}
          >
            {body}
          </div>
        );
      })}

      <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-1 text-faint">
        <DirectionIcon size={22} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
          {state.config.direction === "cw" ? "Horário" : "Anti-horário"}
        </span>
      </div>
    </div>
  );
}
