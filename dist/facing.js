/**
 * Player facing latch — separated into its own module to break a circular
 * dependency between sprite/sloomoo renderers (which set it as a side effect
 * of drawing) and player logic (which reads it for dash-in-place direction).
 *
 * We use a wrapper object so mutation crosses module boundaries cleanly.
 */
export const facingRef = { value: 1 };
//# sourceMappingURL=facing.js.map