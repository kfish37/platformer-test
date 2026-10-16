/**
 * Switches + doors (grey-box puzzle pieces).
 *
 * A switch is a rect; touching it opens its door for good (until the level is
 * restarted from the menu / R). Closed doors are solid. Everything that
 * collides with the level (player, enemies) should use getSolids(level).
 */
import { overlaps } from "./world.js";
export const doorState = {
    level: null,
    open: new Set(),
    solids: [],
};
function rebuild(level) {
    const closed = (level.doors ?? []).filter((d) => !doorState.open.has(d.id));
    doorState.solids = closed.length > 0 ? level.platforms.concat(closed) : level.platforms;
}
export function resetDoors() {
    doorState.level = null;
}
// Platforms + currently closed doors. Resets automatically for a new Level object.
export function getSolids(level) {
    if (doorState.level !== level) {
        doorState.level = level;
        doorState.open = new Set();
        rebuild(level);
    }
    return doorState.solids;
}
export function updateSwitches(level, player) {
    getSolids(level);
    for (const s of level.switches ?? []) {
        if (!doorState.open.has(s.opens) && overlaps(player, s)) {
            doorState.open.add(s.opens);
            rebuild(level);
        }
    }
}
export function isSwitchPressed(s) {
    return doorState.open.has(s.opens);
}
export function isDoorOpen(id) {
    return doorState.open.has(id);
}
//# sourceMappingURL=switches.js.map