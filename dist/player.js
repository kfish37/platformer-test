/**
 * Player state + physics update.
 *
 * Contains: the player singleton, spawn/reset logic, dash commit + trail
 * snapshotting, and the big updatePlaying() function that runs every frame
 * when state === "playing". updatePlaying handles input, jump resolution,
 * wall interactions, dash windows, integration, enemy collisions, and
 * transitions to level_complete when the goal is reached.
 */
import { facingRef } from "./facing.js";
import { isDown, wasPressed } from "./input.js";
import { moveAndCollide, updateCamera, clampCameraX, clampCameraY, overlaps } from "./world.js";
import { camera, dashTrail, session, shakeState } from "./game.js";
import { getSolids, updateSwitches, resetDoors } from "./switches.js";
import { resetEnemies, updateEnemies, resolvePlayerEnemyCollisions } from "./enemies.js";
import { respawnPoint, updateCheckpoints } from "./checkpoints.js";
import { markLevelCompleted, recordDeath, tickPlayTime } from "./save.js";
import { VIEW_W, VIEW_H, GRAVITY, JUMP_V, RUN_V, AIR_ACCEL, GROUND_ACCEL, FRICTION, MAX_FALL_V, COYOTE_MS, JUMP_BUFFER_MS, JUMP_CUT_V, WALL_SLIDE_MAX_V, WALL_GRIP_MAX_V, WALL_JUMP_V_X, WALL_JUMP_V_Y, WALL_LOCKOUT_MS, WALL_COYOTE_MS, DASH_V, DASH_DURATION_MS, DASH_HITSTOP_MS, DASH_COOLDOWN_MS, DASH_CARRY_X, DASH_CARRY_Y_UP, DASH_TRAIL_MS, DASH_TRAIL_STEP_MS, DASH_JUMP_WINDOW_MS, DASH_JUMP_CARRY_X_MIN, DASH_SHAKE_MS, PLAYER_MAX_HP, FALL_OFF_BUFFER, } from "./tuning.js";
export const player = {
    x: 0, y: 0, w: 28, h: 36,
    vx: 0, vy: 0,
    grounded: false,
    coyoteMs: 0,
    jumpBufferMs: 0,
    touchingWallL: false,
    touchingWallR: false,
    wallCoyoteL: 0,
    wallCoyoteR: 0,
    wallLockoutMs: 0,
    wallLockoutDir: 0,
    dashesRemaining: 1,
    dashActiveMs: 0,
    dashHitstopMs: 0,
    dashCooldownMs: 0,
    dashDirX: 0,
    dashDirY: 0,
    postDashMs: 0,
    postDashVx: 0,
    dashMomentum: false,
    hp: PLAYER_MAX_HP,
    iframeMs: 0,
};
// spawnInLevel: use the current checkpoint (if any) as respawn origin.
// countAsDeath=true records this respawn in the save's per-level death counter.
// The very first spawn on level entry (fresh load) passes false.
export function spawnInLevel(level, countAsDeath = false) {
    if (!countAsDeath)
        resetDoors();
    if (countAsDeath)
        recordDeath(level.id);
    const rp = respawnPoint(level);
    player.x = rp.x;
    player.y = rp.y;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.coyoteMs = 0;
    player.jumpBufferMs = 0;
    player.touchingWallL = false;
    player.touchingWallR = false;
    player.wallCoyoteL = 0;
    player.wallCoyoteR = 0;
    player.wallLockoutMs = 0;
    player.wallLockoutDir = 0;
    player.dashesRemaining = 1;
    player.dashActiveMs = 0;
    player.dashHitstopMs = 0;
    player.dashCooldownMs = 0;
    player.dashDirX = 0;
    player.dashDirY = 0;
    player.postDashMs = 0;
    player.postDashVx = 0;
    player.dashMomentum = false;
    player.hp = PLAYER_MAX_HP;
    player.iframeMs = 0;
    resetEnemies();
    dashTrail.list = [];
    dashTrail.accumMs = 0;
    shakeState.ms = 0;
    camera.x = clampCameraX(player.x + player.w / 2 - VIEW_W / 2, level.width);
    camera.y = clampCameraY(player.y + player.h / 2 - VIEW_H / 2, level.height);
    session.state = "playing";
}
// Kill plane: optional per-level killY, else level.height + FALL_OFF_BUFFER.
function killY(level) {
    return level.killY ?? level.height + FALL_OFF_BUFFER;
}
function snapshotDashTrail(nowMs, facing) {
    dashTrail.list.push({
        x: player.x,
        y: player.y,
        facing,
        bornMs: nowMs,
    });
    if (dashTrail.list.length > 40)
        dashTrail.list.shift();
}
function tryStartDash() {
    if (player.dashCooldownMs > 0)
        return false;
    if (player.dashesRemaining <= 0)
        return false;
    if (!wasPressed("shift"))
        return false;
    let dx = 0, dy = 0;
    if (isDown("arrowleft", "a"))
        dx -= 1;
    if (isDown("arrowright", "d"))
        dx += 1;
    if (isDown("arrowup", "w", "touchup"))
        dy -= 1;
    if (isDown("arrowdown", "s"))
        dy += 1;
    if (dx === 0 && dy === 0) {
        dx = facingRef.value;
        dy = 0;
    }
    const len = Math.hypot(dx, dy);
    player.dashDirX = dx / len;
    player.dashDirY = dy / len;
    player.dashHitstopMs = DASH_HITSTOP_MS;
    player.dashActiveMs = DASH_DURATION_MS;
    player.dashCooldownMs = DASH_HITSTOP_MS + DASH_DURATION_MS + DASH_COOLDOWN_MS;
    player.dashesRemaining -= 1;
    player.coyoteMs = 0; // no ground coyote jump after dashing off a ledge
    shakeState.ms = DASH_SHAKE_MS;
    dashTrail.list = [];
    dashTrail.accumMs = 0;
    player.jumpBufferMs = 0;
    return true;
}
export function updatePlaying(dt, level) {
    const dtMs = dt * 1000;
    // ---- Dash cooldowns tick every frame regardless of state ----
    player.dashCooldownMs = Math.max(0, player.dashCooldownMs - dtMs);
    // A dash press this frame wins over everything else.
    const dashJustStarted = tryStartDash();
    // ---- HITSTOP: freeze-frame at dash commit ----
    if (player.dashHitstopMs > 0) {
        player.dashHitstopMs = Math.max(0, player.dashHitstopMs - dtMs);
        if (dashJustStarted) {
            snapshotDashTrail(performance.now(), facingRef.value);
        }
        return;
    }
    // ---- ACTIVE DASH: fixed-velocity override, no gravity, no input ----
    if (player.dashActiveMs > 0) {
        player.dashActiveMs = Math.max(0, player.dashActiveMs - dtMs);
        player.vx = player.dashDirX * DASH_V;
        player.vy = player.dashDirY * DASH_V;
        if (player.dashDirX > 0.1)
            facingRef.value = 1;
        else if (player.dashDirX < -0.1)
            facingRef.value = -1;
        moveAndCollide(player, player.vx * dt, player.vy * dt, getSolids(level));
        dashTrail.accumMs += dtMs;
        while (dashTrail.accumMs >= DASH_TRAIL_STEP_MS) {
            dashTrail.accumMs -= DASH_TRAIL_STEP_MS;
            snapshotDashTrail(performance.now(), facingRef.value);
        }
        // Dash ended this frame — apply carry-with-clamps + open dash-jump window.
        if (player.dashActiveMs === 0) {
            player.vx = player.vx * DASH_CARRY_X;
            if (player.dashDirY < -0.1) {
                player.vy = Math.max(player.vy, DASH_CARRY_Y_UP);
            }
            player.postDashMs = DASH_JUMP_WINDOW_MS;
            player.postDashVx = player.dashDirX * DASH_V;
            player.dashMomentum = true;
        }
        updateCamera(camera, player, dt, level);
        if (player.y > killY(level)) {
            spawnInLevel(level, true);
            return;
        }
        updateCheckpoints(dt, player);
        updateSwitches(level, player);
        if (overlaps(player, level.goal)) {
            session.state = "level_complete";
            markLevelCompleted(level.id);
        }
        // No dash refresh during an active dash (ground / wall jump only, below).
        player.iframeMs = Math.max(0, player.iframeMs - dtMs);
        updateEnemies(dt, level);
        // Still a dash on its last frame (dashActiveMs may already be 0 here).
        const result = resolvePlayerEnemyCollisions(player, () => { shakeState.ms = DASH_SHAKE_MS; }, true);
        if (result === "died") {
            spawnInLevel(level, true);
            return;
        }
        if (result === "hit")
            shakeState.ms = DASH_SHAKE_MS;
        tickPlayTime(dtMs);
        return;
    }
    // ---- Age dash trail (post-dash fade) ----
    {
        const nowMs = performance.now();
        dashTrail.list = dashTrail.list.filter((n) => nowMs - n.bornMs < DASH_TRAIL_MS);
    }
    // ---- Age dash-jump preservation window ----
    player.postDashMs = Math.max(0, player.postDashMs - dtMs);
    if (player.postDashMs === 0)
        player.postDashVx = 0;
    // ---- Screen shake decay ----
    shakeState.ms = Math.max(0, shakeState.ms - dtMs);
    // Horizontal input
    let left = isDown("arrowleft", "a");
    let right = isDown("arrowright", "d");
    // Directional lockout after a wall jump.
    if (player.wallLockoutMs > 0) {
        if (player.wallLockoutDir === -1)
            left = false;
        else if (player.wallLockoutDir === 1)
            right = false;
    }
    player.wallLockoutMs = Math.max(0, player.wallLockoutMs - dtMs);
    if (player.wallLockoutMs === 0)
        player.wallLockoutDir = 0;
    const targetVx = (right ? RUN_V : 0) - (left ? RUN_V : 0);
    // Dash momentum: in the air, holding the direction of a dash/dash-jump keeps
    // its speed instead of pulling it back to RUN_V. Ends on landing or reversing.
    if (player.grounded || (targetVx !== 0 && Math.sign(targetVx) !== Math.sign(player.vx))) {
        player.dashMomentum = false;
    }
    const holdDashSpeed = player.dashMomentum && targetVx !== 0 && Math.abs(player.vx) > RUN_V;
    const accel = player.grounded ? GROUND_ACCEL : AIR_ACCEL;
    if (holdDashSpeed) {
        // keep current vx
    }
    else if (targetVx !== 0) {
        if (player.vx < targetVx)
            player.vx = Math.min(targetVx, player.vx + accel * dt);
        else if (player.vx > targetVx)
            player.vx = Math.max(targetVx, player.vx - accel * dt);
    }
    else if (player.grounded) {
        if (player.vx > 0)
            player.vx = Math.max(0, player.vx - FRICTION * dt);
        else if (player.vx < 0)
            player.vx = Math.min(0, player.vx + FRICTION * dt);
    }
    // Jump buffer + ground coyote
    if (wasPressed(" ", "arrowup", "w"))
        player.jumpBufferMs = JUMP_BUFFER_MS;
    if (player.grounded)
        player.coyoteMs = COYOTE_MS;
    else
        player.coyoteMs = Math.max(0, player.coyoteMs - dtMs);
    player.jumpBufferMs = Math.max(0, player.jumpBufferMs - dtMs);
    // Wall coyote
    if (player.touchingWallL)
        player.wallCoyoteL = WALL_COYOTE_MS;
    else
        player.wallCoyoteL = Math.max(0, player.wallCoyoteL - dtMs);
    if (player.touchingWallR)
        player.wallCoyoteR = WALL_COYOTE_MS;
    else
        player.wallCoyoteR = Math.max(0, player.wallCoyoteR - dtMs);
    // ---- Jump resolution ----
    const jumpBuffered = player.jumpBufferMs > 0;
    if (jumpBuffered && player.coyoteMs > 0) {
        player.vy = -JUMP_V;
        if (player.postDashMs > 0 && Math.abs(player.postDashVx) >= DASH_JUMP_CARRY_X_MIN) {
            player.vx = player.postDashVx;
            player.dashMomentum = true;
            player.postDashMs = 0;
            player.postDashVx = 0;
        }
        player.coyoteMs = 0;
        player.jumpBufferMs = 0;
    }
    else if (jumpBuffered && !player.grounded && (player.wallCoyoteL > 0 || player.wallCoyoteR > 0)) {
        let awayDir;
        if (player.wallCoyoteL > 0 && player.wallCoyoteR > 0) {
            awayDir = player.vx >= 0 ? 1 : -1;
        }
        else if (player.wallCoyoteL > 0) {
            awayDir = 1;
        }
        else {
            awayDir = -1;
        }
        player.vx = awayDir * WALL_JUMP_V_X;
        player.vy = -WALL_JUMP_V_Y;
        player.jumpBufferMs = 0;
        player.wallCoyoteL = 0;
        player.wallCoyoteR = 0;
        player.wallLockoutMs = WALL_LOCKOUT_MS;
        player.wallLockoutDir = (awayDir === 1 ? -1 : 1);
        player.dashMomentum = false;
        player.dashesRemaining = 1; // a wall jump refreshes the dash
    }
    // Variable jump height
    const jumpHeld = isDown(" ", "arrowup", "w");
    if (!jumpHeld && player.vy < -JUMP_CUT_V)
        player.vy = -JUMP_CUT_V;
    // Gravity
    player.vy += GRAVITY * dt;
    if (player.vy > MAX_FALL_V)
        player.vy = MAX_FALL_V;
    // Wall slide / grip.
    if (!player.grounded && player.vy > 0) {
        const pressingIntoLeftWall = player.touchingWallL && left;
        const pressingIntoRightWall = player.touchingWallR && right;
        if (pressingIntoLeftWall || pressingIntoRightWall) {
            const cap = jumpHeld ? WALL_GRIP_MAX_V : WALL_SLIDE_MAX_V;
            if (player.vy > cap)
                player.vy = cap;
        }
    }
    // Integrate
    moveAndCollide(player, player.vx * dt, player.vy * dt, getSolids(level));
    // Clamp inside level horizontally
    if (player.x < 0) {
        player.x = 0;
        player.vx = 0;
    }
    if (player.x + player.w > level.width) {
        player.x = level.width - player.w;
        player.vx = 0;
    }
    // Fall off bottom
    if (player.y > killY(level)) {
        spawnInLevel(level, true);
        return;
    }
    // Checkpoints (activation + flash tick)
    updateCheckpoints(dt, player);
    updateSwitches(level, player);
    // Goal
    if (overlaps(player, level.goal)) {
        session.state = "level_complete";
        markLevelCompleted(level.id);
    }
    // Refresh dash on ground (wall jumps refresh it in the jump code above).
    if (player.grounded) {
        player.dashesRemaining = 1;
    }
    // Age i-frame timer.
    player.iframeMs = Math.max(0, player.iframeMs - dtMs);
    // Enemies update + collision.
    updateEnemies(dt, level);
    const result = resolvePlayerEnemyCollisions(player, () => { shakeState.ms = DASH_SHAKE_MS; });
    if (result === "died") {
        spawnInLevel(level, true);
        return;
    }
    if (result === "hit")
        shakeState.ms = DASH_SHAKE_MS;
    updateCamera(camera, player, dt, level);
    tickPlayTime(dtMs);
}
//# sourceMappingURL=player.js.map