"use client";

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
  /** Turns seats into buttons for choosing who opens the round. */
  selectable?: boolean;
  selectedId?: number | null;
  onSelect?: (playerId: number) => void;
  /** Supply both to make the table's own settings editable (setup only). */
  onSetDirection?: (direction: Direction) => void;
  onSetMode?: (mode: GameMode) => void;
  compact?: boolean;
}

/**
 * The table, drawn as a table: a felt top with the seats around its edge in
 * the order people actually sit. In duplas the partner lands across from the
 * user and the opponents on the sides, so "você → adversário → parceiro →
 * adversário" is something you see rather than infer from player numbers.
 */
const SLOT_ORDER: Record<Direction, Slot[]> = {
  cw: ["bottom", "left", "top", "right"],
  ccw: ["bottom", "right", "top", "left"],
};

const SLOT_POSITION: Record<Slot, string> = {
  top: "col-start-2 row-start-1 justify-self-center",
  left: "col-start-1 row-start-2 justify-self-center",
  right: "col-start-3 row-start-2 justify-self-center",
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

/** Arrow curving around the felt, showing which way play travels. */
function DirectionArc({ direction, size }: { direction: Direction; size: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 m-auto text-gold/45 ${
        direction === "ccw" ? "-scale-x-100" : ""
      }`}
    >
      <defs>
        <marker id="seat-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>
      <path
        d="M 50 8 A 42 42 0 1 1 8 50"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="5 7"
        markerEnd="url(#seat-arrow)"
      />
    </svg>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="w-full">
      <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-[0.16em] text-mist">{label}</p>
      <div role="group" aria-label={label} className="flex rounded-lg border border-line-strong bg-felt-950/70 p-0.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`min-h-9 flex-1 rounded-md px-2 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                active ? "bg-gold text-gold-ink" : "text-mist hover:text-ivory"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SeatMap({
  seats,
  direction,
  mode,
  currentPlayerIndex,
  selectable = false,
  selectedId,
  onSelect,
  onSetDirection,
  onSetMode,
  compact = false,
}: SeatMapProps) {
  const slots = slotsFor(seats.length, direction);
  const isDuplas = mode === "duplas";
  const userTeam = seats.find((s) => s.role === "user")?.team ?? null;
  const editable = Boolean(onSetDirection && onSetMode);
  const feltSize = editable ? "size-52" : compact ? "size-24" : "size-32";

  return (
    <div className="relative">
      {/* In duplas each pair sits on one axis of the table. */}
      {isDuplas && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-full border-l-2 border-dashed border-gold/25"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-1/2 w-full border-t-2 border-dashed border-line-strong/60"
          />
        </>
      )}

      <div
        className={`relative grid grid-cols-[1fr_auto_1fr] items-center ${compact ? "gap-2" : "gap-3"}`}
      >
        {seats.map((seat, i) => {
          const slot = slots[i] ?? "bottom";
          const isTurn = currentPlayerIndex === seat.id;
          const isSelected = selectedId === seat.id;
          const isAlly = isDuplas && seat.team !== null && seat.team === userTeam;
          const isUser = seat.role === "user";

          const tone =
            isSelected || isTurn
              ? "border-gold bg-gold/15 text-gold-2 shadow-[0_0_18px_rgba(217,164,65,0.25)]"
              : isAlly
                ? "border-gold/30 bg-surface text-ivory"
                : "border-line bg-surface/80 text-mist";

          const detail = [
            seat.handSize !== undefined ? `${seat.handSize} peça${seat.handSize === 1 ? "" : "s"}` : null,
            isDuplas && seat.team !== null ? `dupla ${seat.team}` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          const body = (
            <>
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {isTurn && <span aria-hidden="true" className="turn-dot size-1.5 rounded-full bg-gold" />}
                {seatLabel(seat)}
              </span>
              {detail && <span className="text-[11px] tabular-nums text-faint">{detail}</span>}
              {isSelected && (
                <span className="mt-1 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-gold-ink">
                  Sai
                </span>
              )}
            </>
          );

          const shape = `relative z-10 flex min-h-11 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-all ${
            compact ? "w-28" : "w-36"
          } ${isUser ? "ring-1 ring-gold/20" : ""}`;

          return selectable ? (
            <button
              key={seat.id}
              type="button"
              onClick={() => onSelect?.(seat.id)}
              aria-pressed={isSelected}
              className={`${SLOT_POSITION[slot]} ${shape} ${tone} hover:-translate-y-0.5 hover:border-gold/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold`}
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

        {/* The felt itself, carrying whatever the table can be set to. */}
        <div
          className={`relative z-10 col-start-2 row-start-2 flex ${feltSize} flex-col items-center justify-center gap-2 justify-self-center rounded-full border-4 border-rail bg-gradient-to-b from-felt-700 to-felt-900 shadow-[inset_0_2px_12px_rgba(0,0,0,0.55)]`}
        >
          <DirectionArc direction={direction} size={editable ? 176 : compact ? 78 : 104} />

          {editable ? (
            <div className="z-10 flex w-32 flex-col gap-2">
              <Segmented
                label="Sentido"
                value={direction}
                onChange={(value) => onSetDirection?.(value)}
                options={[
                  { value: "cw", label: "↻ Horário" },
                  { value: "ccw", label: "↺ Anti" },
                ]}
              />
              {seats.length === 4 && (
                <Segmented
                  label="Modo"
                  value={mode}
                  onChange={(value) => onSetMode?.(value)}
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "duplas", label: "Duplas" },
                  ]}
                />
              )}
            </div>
          ) : (
            <span className="z-10 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">
              {direction === "cw" ? "Horário" : "Anti-horário"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
