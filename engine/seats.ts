import { GameConfig, PlayerRole, Team } from "./types";

export interface Seat {
  id: number;
  role: PlayerRole;
  team: Team | null;
}

/**
 * Who sits where, by role and team. Single source of truth shared by the
 * reducer (which turns these into real players) and the setup preview, so a
 * table drawn before the match starts matches the one actually dealt.
 *
 * Seat ids follow the physical order around the table, which is why duplas
 * comes out interleaved: user(A) → opponent(B) → partner(A) → opponent(B).
 */
export function assignSeats(config: Pick<GameConfig, "numPlayers" | "mode">): Seat[] {
  const seats: Seat[] = [];
  for (let id = 0; id < config.numPlayers; id++) {
    let role: PlayerRole = id === 0 ? "user" : "opponent";
    let team: Team | null = null;
    if (config.mode === "duplas" && config.numPlayers === 4) {
      team = id % 2 === 0 ? "A" : "B";
      if (id === 2) role = "partner";
    }
    seats.push({ id, role, team });
  }
  return seats;
}
