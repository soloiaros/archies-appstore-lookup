export const POP_OUT = 150; // ms: the old image shrinks away
export const POP_IN = 280; // ms: the new one springs up in its place

/** How large an icon is drawn while it is being swapped: 1 -> 0, then 0 -> a small overshoot -> 1. */
export function popScale(elapsed: number): number {
  if (elapsed <= 0) return 1;
  if (elapsed < POP_OUT) {
    const u = elapsed / POP_OUT;
    return 1 - u * u;
  }
  const u = Math.min(1, (elapsed - POP_OUT) / POP_IN);
  const back = 2.2; // ease-out-back: overshoots to about 1.12 before settling
  return 1 + (back + 1) * (u - 1) ** 3 + back * (u - 1) ** 2;
}
