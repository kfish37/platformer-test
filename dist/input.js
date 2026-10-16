/**
 * Input — global keyboard state.
 *
 * Two sets: `keys` (currently held) and `pressedThisFrame` (fired once
 * on the transition from up→down; cleared by the game loop at end of frame).
 *
 * Consumers use isDown(...) and wasPressed(...) — no direct set access.
 */
const keys = new Set();
const pressedThisFrame = new Set();
export function installInputListeners() {
    window.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (!keys.has(k))
            pressedThisFrame.add(k);
        keys.add(k);
        if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown", "shift"].includes(k)) {
            e.preventDefault();
        }
    });
    window.addEventListener("keyup", (e) => {
        keys.delete(e.key.toLowerCase());
    });
}
export function isDown(...ks) {
    return ks.some((k) => keys.has(k));
}
export function wasPressed(...ks) {
    return ks.some((k) => pressedThisFrame.has(k));
}
export function clearFramePresses() {
    pressedThisFrame.clear();
}
// Synthetic key events for the touch overlay (src/touch.ts).
export function pressKey(k) {
    if (!keys.has(k))
        pressedThisFrame.add(k);
    keys.add(k);
}
export function releaseKey(k) { keys.delete(k); }
//# sourceMappingURL=input.js.map