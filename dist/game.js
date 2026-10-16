/**
 * Session-level game state: current level, high-level game state ("playing",
 * "level_complete", "game_complete"), camera, dash trail, screen shake.
 *
 * Kept small on purpose. This module doesn't contain behavior — just the
 * mutable state other modules manipulate.
 */
export const camera = { x: 0, y: 0 };
export const session = {
    currentLevel: null,
    state: "menu",
};
// Menu state — selected item, current screen, level-select highlight.
export const menuUi = {
    screen: "root",
    rootIndex: 0,
    levelIndex: 0,
};
// Dash afterimage trail snapshots.
export const dashTrail = {
    list: [],
    accumMs: 0,
};
// Screen shake amount (ms remaining) applied on dash commit / damage.
export const shakeState = { ms: 0 };
// When entering paused state, the render-side timeMs freezes here.
// Cleared on resume.
export const pauseState = { pausedAtMs: null };
//# sourceMappingURL=game.js.map