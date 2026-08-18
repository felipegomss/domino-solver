"use client";

import { useCallback, useRef, useState } from "react";
import { GameState } from "@/engine/types";
import { GameAction, createInitialState, gameReducer } from "./gameReducer";

export function useDominoGame() {
  const [state, setState] = useState<GameState>(createInitialState);
  const pastRef = useRef<GameState[]>([]);

  const dispatch = useCallback((action: GameAction) => {
    setState((prev) => {
      pastRef.current.push(prev);
      return gameReducer(prev, action);
    });
  }, []);

  const undo = useCallback(() => {
    setState((prev) => pastRef.current.pop() ?? prev);
  }, []);

  return { state, dispatch, undo };
}
