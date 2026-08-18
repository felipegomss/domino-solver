export type Suit = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Piece {
  id: string; // canonical `${a}-${b}` with a <= b
  a: Suit;
  b: Suit;
}

export type End = "left" | "right";

export interface PlacedPiece {
  piece: Piece;
  leftValue: Suit;
  rightValue: Suit;
}

export interface Board {
  sequence: PlacedPiece[];
  leftEnd: Suit | null;
  rightEnd: Suit | null;
}

export type PlayerRole = "user" | "partner" | "opponent";
export type Team = "A" | "B";

export interface PlayerState {
  id: number;
  role: PlayerRole;
  team: Team | null;
  hand: Piece[] | null; // known only for the user, or a player whose hand was revealed
  handSize: number;
  voidSuits: Suit[];
  suitPlayCount: Record<Suit, number>;
}

export type GameMode = "individual" | "duplas";
export type Direction = "cw" | "ccw";

export interface GameConfig {
  numPlayers: 2 | 3 | 4;
  mode: GameMode;
  direction: Direction;
  handSize: number;
  boneyardEnabled: boolean;
  startingPlayer: number;
}

export interface PlayMove {
  type: "play";
  playerId: number;
  pieceId: string;
  end: End;
}

export interface PassMove {
  type: "pass";
  playerId: number;
  drewFirst: boolean;
}

export interface DrawMove {
  type: "draw";
  playerId: number;
  count: number;
  pieceId?: string;
}

export type Move = PlayMove | PassMove | DrawMove;

export type GamePhase = "setup" | "playing" | "round-end" | "finished";
export type RoundEndReason = "batida" | "lock" | null;

export interface GameState {
  phase: GamePhase;
  config: GameConfig;
  players: PlayerState[];
  board: Board;
  boneyardRemaining: number;
  currentPlayerIndex: number;
  history: Move[];
  scores: Record<string, number>;
  roundNumber: number;
  error: string | null;
  roundEndReason: RoundEndReason;
  passStreak: number;
  lastWinnerId: number | null;
  roundEndBonus: { laELo: boolean; bucha: boolean } | null;
}
