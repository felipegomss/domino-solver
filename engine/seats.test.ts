import { describe, expect, it } from "vitest";
import { assignSeats } from "./seats";

describe("assignSeats", () => {
  it("interleaves partners and opponents at a 4-player duplas table", () => {
    // The real seating order: you → opponent → partner → opponent.
    expect(assignSeats({ numPlayers: 4, mode: "duplas" })).toEqual([
      { id: 0, role: "user", team: "A" },
      { id: 1, role: "opponent", team: "B" },
      { id: 2, role: "partner", team: "A" },
      { id: 3, role: "opponent", team: "B" },
    ]);
  });

  it("has no partner or teams in individual mode", () => {
    const seats = assignSeats({ numPlayers: 4, mode: "individual" });
    expect(seats.map((s) => s.role)).toEqual(["user", "opponent", "opponent", "opponent"]);
    expect(seats.every((s) => s.team === null)).toBe(true);
  });

  it("seats only the configured number of players", () => {
    expect(assignSeats({ numPlayers: 2, mode: "individual" }).map((s) => s.id)).toEqual([0, 1]);
    expect(assignSeats({ numPlayers: 3, mode: "individual" })).toHaveLength(3);
  });

  it("ignores duplas below a full 4-player table", () => {
    const seats = assignSeats({ numPlayers: 3, mode: "duplas" });
    expect(seats.every((s) => s.team === null)).toBe(true);
    expect(seats.some((s) => s.role === "partner")).toBe(false);
  });
});
