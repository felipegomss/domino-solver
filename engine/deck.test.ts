import { describe, expect, it } from "vitest";
import { createDeck, handPipSum, isDouble, pipSum } from "./deck";

describe("createDeck", () => {
  it("creates all 28 double-6 pieces exactly once", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(28);
    const ids = new Set(deck.map((p) => p.id));
    expect(ids.size).toBe(28);
    expect(ids.has("0-0")).toBe(true);
    expect(ids.has("6-6")).toBe(true);
    expect(ids.has("2-5")).toBe(true);
  });

  it("always returns canonical pieces with a <= b", () => {
    const deck = createDeck();
    for (const piece of deck) {
      expect(piece.a).toBeLessThanOrEqual(piece.b);
    }
  });
});

describe("isDouble", () => {
  it("returns true only when both sides match", () => {
    expect(isDouble({ id: "3-3", a: 3, b: 3 })).toBe(true);
    expect(isDouble({ id: "2-5", a: 2, b: 5 })).toBe(false);
  });
});

describe("pipSum and handPipSum", () => {
  it("sums the pips of a single piece", () => {
    expect(pipSum({ id: "2-5", a: 2, b: 5 })).toBe(7);
  });

  it("sums pips across a hand", () => {
    const hand = [
      { id: "2-5", a: 2 as const, b: 5 as const },
      { id: "0-0", a: 0 as const, b: 0 as const },
      { id: "6-6", a: 6 as const, b: 6 as const },
    ];
    expect(handPipSum(hand)).toBe(19);
  });

  it("returns 0 for an empty hand", () => {
    expect(handPipSum([])).toBe(0);
  });
});
