"use client";

import { RotateCcw, RotateCw } from "lucide-react";
import { Seat } from "@/engine/seats";
import { Direction, GameMode } from "@/engine/types";

type Slot = "top" | "left" | "right" | "bottom";

/** A seat plus, when a match is running, how many pieces it holds. */
export type SeatView = Seat & { handSize?: number };

interface SeatMapProps {
  seats: SeatView[];
  direction: Direction;
  mode: GameMode;
  /** Turn to highlight; omit to highlight nothing (setup, between rounds). */
  currentPlayerIndex?: number;
  /** Turns seats into radio-style buttons for choosing who opens. */
  selectable?: boolean;
  selectedId?: number | null;
  onSelect?: (playerId: number) => void;
  /** When given, the centre becomes a toggle for the direction of play. */
  onToggleDirection?: () => void;
  compact?: boolean;
}

/**
 * Seats laid out the way they actually sit at the table, so the play order is
 * readable at a glance. In duplas the partner ends up across from the user and
 * the opponents on the sides — the real arrangement, which makes
 * "você → adversário → parceiro → adversário" obvious instead of something to
 * infer from player numbers.
 */
const SLOT_ORDER: Record<Direction, Slot[]> = {
  cw: ["bottom", "left", "top", "right"],
  ccw: ["bottom", "right", "top", "left"],
};

const SLOT_POSITION: Record<Slot, string> = {
  top: "col-start-2 row-start-1 justify-self-center",
  left: "col-start-1 row-start-2 justify-self-start",
  right: "col-start-3 row-start-2 justify-self-end",
  bottom: "col-start-2 row-start-3 justify-self-center",
};

export function seatLabel(seat: Seat): string {
  if (seat.role === "user") return "Você";
  if (seat.role === "partner") return "Parceiro";
  return `Adversário ${seat.id}`;
}

function slotsFor(count: number, direction: Direction): Slot[] {
  // Head-to-head reads better facing each other than rotating around a corner.
  if (count === 2) return ["bottom", "top"];
  return SLOT_ORDER[direction].slice(0, count);
}

export function SeatMap({
  seats,
  direction,
  mode,
  currentPlayerIndex,
  selectable = false,
  selectedId,
  onSelect,
  onToggleDirection,
  compact = false,
}: SeatMapProps) {
  const slots = slotsFor(seats.length, direction);
  const isDuplas = mode === "duplas";
  const userTeam = seats.find((s) => s.role === "user")?.team ?? null;
  const DirectionIcon = direction === "cw" ? RotateCw : RotateCcw;

  return (
    <div
      className={`grid grid-cols-3 grid-rows-3 rounded-xl border border-line bg-felt-900/60 ${
        compact ? "gap-1.5 p-2" : "gap-2 p-3"
      }`}
    >
      {seats.map((seat, i) => {
        const slot = slots[i] ?? "bottom";
        const isTurn = currentPlayerIndex === seat.id;
        const isSelected = selectedId === seat.id;
        const isAlly = isDuplas && seat.team !== null && seat.team === userTeam;

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
              {seatLabel(seat)}
            </span>
            {(seat.handSize !== undefined || (isDuplas && seat.team !== null)) && (
              <span className="text-[11px] tabular-nums text-faint">
                {seat.handSize !== undefined && `${seat.handSize} peça${seat.handSize === 1 ? "" : "s"}`}
                {seat.handSize !== undefined && isDuplas && seat.team !== null && " · "}
                {isDuplas && seat.team !== null && `dupla ${seat.team}`}
              </span>
            )}
          </>
        );

        const shape = `flex min-h-11 flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition-colors ${
          compact ? "w-28" : "w-32"
        }`;

        return selectable ? (
          <button
            key={seat.id}
            type="button"
            onClick={() => onSelect?.(seat.id)}
            aria-pressed={isSelected}
            className={`${SLOT_POSITION[slot]} ${shape} ${tone} hover:border-gold/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`}
          >
            {body}
          </button>
        ) : (
          <div
            key={seat.id}
            aria-current={isTurn ? "true" : undefined}
            className={`${SLOT_POSITION[slot]} ${shape} ${tone}`}
          >
            {body}
          </div>
        );
      })}

      {onToggleDirection ? (
        <button
          type="button"
          onClick={onToggleDirection}
          aria-label={`Sentido ${direction === "cw" ? "horário" : "anti-horário"} — tocar para inverter`}
          className="col-start-2 row-start-2 flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border border-line px-2 py-1 text-faint transition-colors hover:border-gold/60 hover:text-gold-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <DirectionIcon size={compact ? 18 : 22} aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
            {direction === "cw" ? "Horário" : "Anti-horário"}
          </span>
        </button>
      ) : (
        <div className="col-start-2 row-start-2 flex flex-col items-center justify-center gap-1 text-faint">
          <DirectionIcon size={compact ? 18 : 22} aria-hidden="true" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
            {direction === "cw" ? "Horário" : "Anti-horário"}
          </span>
        </div>
      )}
    </div>
  );
}
