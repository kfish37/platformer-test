/**
 * Checkpoints — within-run respawn markers.
 *
 * `checkpointState.list` holds the live checkpoints for the current level,
 * seeded by `instantiateCheckpoints()` on level load. The player touching
 * a checkpoint activates it; the highest-id activated checkpoint wins
 * (no downgrading). Activated state is reset on level load, NOT on death.
 *
 * Save/load: nothing here persists across sessions. Cross-session progress
 * is tracked in save.ts (highestLevelReached, deaths, time). Checkpoints
 * are a within-level convenience only.
 */
import { overlaps } from "./world.js";
export const checkpointState = {
    list: [],
    activeId: -1,
    activeRespawn: null,
};
// Checkpoint visual size (matches goal flag proportions).
const CHECKPOINT_W = 20;
const CHECKPOINT_H = 40;
export function instantiateCheckpoints(level) {
    const list = [];
    if (level.checkpoints) {
        for (const spec of level.checkpoints) {
            list.push({
                id: spec.id,
                x: spec.x,
                y: spec.y,
                w: CHECKPOINT_W,
                h: CHECKPOINT_H,
                respawnX: spec.respawnX ?? spec.x,
                respawnY: spec.respawnY ?? spec.y,
                activated: false,
                activateFxMs: 0,
            });
        }
    }
    checkpointState.list = list;
    checkpointState.activeId = -1;
    checkpointState.activeRespawn = null;
}
// Reset activation flash timers each frame; called from updateCheckpoints.
export function updateCheckpoints(dt, player) {
    const dtMs = dt * 1000;
    for (const cp of checkpointState.list) {
        cp.activateFxMs = Math.max(0, cp.activateFxMs - dtMs);
        if (cp.activated)
            continue;
        if (overlaps(player, cp)) {
            cp.activated = true;
            cp.activateFxMs = 500;
            // Only upgrade to a higher-id checkpoint; ignore backtracking.
            if (cp.id > checkpointState.activeId) {
                checkpointState.activeId = cp.id;
                checkpointState.activeRespawn = { x: cp.respawnX, y: cp.respawnY };
            }
        }
    }
}
// Returns the current respawn point for R / death respawns.
// Falls back to the level's own spawn when no checkpoint is active.
export function respawnPoint(level) {
    if (checkpointState.activeRespawn)
        return checkpointState.activeRespawn;
    return level.spawn;
}
//# sourceMappingURL=checkpoints.js.map