/**
 * Enemies — spawning, patrol AI, gravity, ledge detection, and player collision.
 *
 * `enemyState.list` holds the live enemies for the current level. It's a
 * plain array reference exposed as `enemies` for backward-compatible reads,
 * mutated by `instantiateEnemies()` on level load.
 */
import { overlaps } from "./world.js";
import { getSolids } from "./switches.js";
import { ENEMY_PATROL_V, ENEMY_GRAVITY, ENEMY_MAX_FALL_V, DAMAGE_KNOCKBACK_X, DAMAGE_KNOCKBACK_Y, PLAYER_IFRAME_MS, FALL_OFF_BUFFER, } from "./tuning.js";
// Live enemies for the current level. Mutated by instantiateEnemies.
export const enemyState = { list: [] };
export function instantiateEnemies(level) {
    const list = [];
    if (level.enemies) {
        for (const spec of level.enemies) {
            if (spec.type !== "patroller")
                continue;
            const w = 28, h = 28;
            const facing = spec.facing ?? 1;
            list.push({
                type: "patroller",
                x: spec.x,
                y: spec.y,
                w, h,
                vx: ENEMY_PATROL_V * facing,
                vy: 0,
                facing,
                alive: true,
                deathFxMs: 0,
                patrolMin: spec.patrolMin ?? -Infinity,
                patrolMax: spec.patrolMax ?? Infinity,
                spawnX: spec.x,
                spawnY: spec.y,
                spawnFacing: facing,
            });
        }
    }
    enemyState.list = list;
}
export function resetEnemies() {
    for (const e of enemyState.list) {
        e.x = e.spawnX;
        e.y = e.spawnY;
        e.facing = e.spawnFacing;
        e.vx = ENEMY_PATROL_V * e.facing;
        e.vy = 0;
        e.alive = true;
        e.deathFxMs = 0;
    }
}
export function updateEnemies(dt, level) {
    const dtMs = dt * 1000;
    for (const e of enemyState.list) {
        if (!e.alive) {
            e.deathFxMs = Math.max(0, e.deathFxMs - dtMs);
            continue;
        }
        e.vy = Math.min(ENEMY_MAX_FALL_V, e.vy + ENEMY_GRAVITY * dt);
        const nextX = e.x + e.vx * dt;
        if (nextX < e.patrolMin) {
            e.x = e.patrolMin;
            e.facing = 1;
            e.vx = ENEMY_PATROL_V;
        }
        else if (nextX + e.w > e.patrolMax) {
            e.x = e.patrolMax - e.w;
            e.facing = -1;
            e.vx = -ENEMY_PATROL_V;
        }
        else {
            e.x = nextX;
        }
        // Wall collision (turn around).
        for (const plat of getSolids(level)) {
            if (!overlaps(e, plat))
                continue;
            if (e.vx > 0) {
                e.x = plat.x - e.w;
                e.facing = -1;
                e.vx = -ENEMY_PATROL_V;
            }
            else if (e.vx < 0) {
                e.x = plat.x + plat.w;
                e.facing = 1;
                e.vx = ENEMY_PATROL_V;
            }
        }
        // Vertical move + floor / ceiling collision.
        e.y += e.vy * dt;
        let grounded = false;
        for (const plat of getSolids(level)) {
            if (!overlaps(e, plat))
                continue;
            if (e.vy > 0) {
                e.y = plat.y - e.h;
                e.vy = 0;
                grounded = true;
            }
            else if (e.vy < 0) {
                e.y = plat.y + plat.h;
                e.vy = 0;
            }
        }
        // Ledge detection: if unbounded patrol, turn around at ledge edges.
        if (grounded && e.patrolMin === -Infinity && e.patrolMax === Infinity) {
            const probeX = e.facing === 1 ? e.x + e.w + 2 : e.x - 2;
            const probeY = e.y + e.h + 2;
            let hasGround = false;
            for (const plat of getSolids(level)) {
                if (probeX >= plat.x && probeX <= plat.x + plat.w &&
                    probeY >= plat.y && probeY <= plat.y + plat.h) {
                    hasGround = true;
                    break;
                }
            }
            if (!hasGround) {
                e.facing = e.facing === 1 ? -1 : 1;
                e.vx = ENEMY_PATROL_V * e.facing;
            }
        }
        // Fall off level → respawn.
        if (e.y > level.height + FALL_OFF_BUFFER) {
            e.x = e.spawnX;
            e.y = e.spawnY;
            e.vx = ENEMY_PATROL_V * e.spawnFacing;
            e.vy = 0;
            e.facing = e.spawnFacing;
        }
    }
}
export function resolvePlayerEnemyCollisions(player, onDashKill, 
// The dash path passes true: its timer can already be 0 on the dash's last frame.
dashing = player.dashActiveMs > 0) {
    let result = null;
    for (const e of enemyState.list) {
        if (!e.alive)
            continue;
        if (!overlaps(player, e))
            continue;
        // Dash-through defeat.
        if (dashing) {
            e.alive = false;
            e.deathFxMs = 250;
            onDashKill();
            continue;
        }
        // Any other contact → player takes damage. No stomp — dash is the only defeat.
        if (player.iframeMs > 0)
            continue;
        player.hp -= 1;
        player.iframeMs = PLAYER_IFRAME_MS;
        const pushDir = (player.x + player.w / 2) < (e.x + e.w / 2) ? -1 : 1;
        player.vx = DAMAGE_KNOCKBACK_X * pushDir;
        player.vy = DAMAGE_KNOCKBACK_Y;
        player.dashActiveMs = 0;
        player.dashHitstopMs = 0;
        if (player.hp <= 0) {
            result = "died";
            return result;
        }
        result = "hit";
    }
    return result;
}
//# sourceMappingURL=enemies.js.map