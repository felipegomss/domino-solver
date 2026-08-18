"use client";

import { Piece } from "@/engine/types";

interface DominoTileProps {
  piece: Piece;
  size?: "sm" | "md" | "lg";
  highlighted?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<DominoTileProps["size"]>, string> = {
  sm: "w-11 h-16 text-sm",
  md: "w-12 h-20 text-base",
  lg: "w-14 h-24 text-lg",
};

export function DominoTile({ piece, size = "md", highlighted = false, disabled = false, selected = false, onClick }: DominoTileProps) {
  const isInteractive = typeof onClick === "function";
  const Tag = isInteractive ? "button" : "div";

  return (
    <Tag
      type={isInteractive ? "button" : undefined}
      onClick={isInteractive && !disabled ? onClick : undefined}
      disabled={isInteractive ? disabled : undefined}
      aria-pressed={isInteractive ? selected : undefined}
      aria-label={isInteractive ? `Peça ${piece.a}-${piece.b}` : undefined}
      className={[
        SIZE_CLASSES[size],
        "flex flex-col shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors duration-150",
        highlighted ? "border-amber-500 ring-2 ring-amber-300" : "border-slate-800",
        selected ? "bg-amber-100" : "",
        disabled ? "opacity-40 pointer-events-none" : "",
        isInteractive && !disabled
          ? "cursor-pointer hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          : "",
      ].join(" ")}
    >
      <span className="flex flex-1 items-center justify-center border-b-2 border-slate-800 font-semibold tabular-nums text-slate-900">
        {piece.a}
      </span>
      <span className="flex flex-1 items-center justify-center font-semibold tabular-nums text-slate-900">
        {piece.b}
      </span>
    </Tag>
  );
}
