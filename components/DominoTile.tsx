"use client";

import { Check } from "lucide-react";
import { Piece, Suit } from "@/engine/types";

type TileSize = "sm" | "md" | "lg";
type TileOrientation = "vertical" | "horizontal";

interface DominoTileProps {
  piece: Piece;
  size?: TileSize;
  orientation?: TileOrientation;
  highlighted?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

/**
 * Pip positions on a 3x3 grid, indexed left-to-right, top-to-bottom:
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
const PIP_LAYOUT: Record<Suit, number[]> = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const SIZE_CLASSES: Record<TileOrientation, Record<TileSize, string>> = {
  vertical: {
    sm: "w-11 h-22",
    md: "w-14 h-28",
    lg: "w-16 h-32",
  },
  horizontal: {
    sm: "w-22 h-11",
    md: "w-28 h-14",
    lg: "w-32 h-16",
  },
};

const PIP_SIZE: Record<TileSize, string> = {
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
};

function PipFace({ value, size }: { value: Suit; size: TileSize }) {
  const filled = new Set(PIP_LAYOUT[value]);

  return (
    <div className="grid flex-1 grid-cols-3 grid-rows-3 place-items-center p-1">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={filled.has(i) ? `${PIP_SIZE[size]} rounded-full bg-slate-900` : ""}
        />
      ))}
    </div>
  );
}

export function DominoTile({
  piece,
  size = "md",
  orientation = "vertical",
  highlighted = false,
  disabled = false,
  selected = false,
  onClick,
}: DominoTileProps) {
  const isInteractive = typeof onClick === "function";
  const Tag = isInteractive ? "button" : "div";
  const isVertical = orientation === "vertical";

  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={isInteractive && !disabled ? onClick : undefined}
      disabled={isInteractive ? disabled : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      aria-label={isInteractive ? `Peça ${piece.a}-${piece.b}` : undefined}
      className={[
        SIZE_CLASSES[orientation][size],
        "relative flex shrink-0 overflow-hidden rounded-lg bg-stone-50 shadow-sm transition-all duration-150",
        isVertical ? "flex-col" : "flex-row",
        selected
          ? "border-2 border-amber-600 bg-amber-50 ring-2 ring-amber-400 ring-offset-1"
          : highlighted
            ? "border-2 border-amber-500 ring-2 ring-amber-300"
            : "border-2 border-slate-700",
        disabled ? "pointer-events-none opacity-30" : "",
        isInteractive && !disabled
          ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          : "",
      ].join(" ")}
    >
      <PipFace value={piece.a} size={size} />
      <span
        aria-hidden="true"
        className={isVertical ? "mx-1 border-t-2 border-slate-700" : "my-1 border-l-2 border-slate-700"}
      />
      <PipFace value={piece.b} size={size} />

      {selected && (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-amber-600 text-white shadow"
        >
          <Check size={11} strokeWidth={3} />
        </span>
      )}
    </Tag>
  );
}
