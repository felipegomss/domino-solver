import { Piece, Suit } from "./types";

export function createDeck(): Piece[] {
  const deck: Piece[] = [];
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      deck.push({ id: `${a}-${b}`, a: a as Suit, b: b as Suit });
    }
  }
  return deck;
}

export function isDouble(piece: Piece): boolean {
  return piece.a === piece.b;
}

export function pipSum(piece: Piece): number {
  return piece.a + piece.b;
}

export function handPipSum(pieces: Piece[]): number {
  return pieces.reduce((sum, p) => sum + pipSum(p), 0);
}
