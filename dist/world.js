/**
 * World — level loading, AABB collision, camera math.
 *
 * All the pure world-manipulation code that doesn't depend on player-specific
 * logic. `moveAndCollide` sets wall-touch flags on the player during the
 * horizontal pass and grounded during the vertical pass.
 */
import { CORNER_CORRECTION_PX, DEFAULT_LEVEL_HEIGHT, VIEW_W, VIEW_H, CAM_DEADZONE_W, CAM_DEADZONE_H, CAM_LERP, } from "./tuning.js";
export function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
// Move axis-by-axis and resolve against static rects.
// Records wall-contact state on horizontal pass; grounded on vertical pass.
export function moveAndCollide(p, dx, dy, platforms) {
    p.touchingWallL = false;
    p.touchingWallR = false;
    p.x += dx;
    for (const plat of platforms) {
        if (!overlaps(p, plat))
            continue;
        if (dx > 0) {
            p.x = plat.x - p.w;
            p.touchingWallR = true;
        }
        else if (dx < 0) {
            p.x = plat.x + plat.w;
            p.touchingWallL = true;
        }
        p.vx = 0;
    }
    p.y += dy;
    p.grounded = false;
    for (const plat of platforms) {
        if (!overlaps(p, plat))
            continue;
        if (dy > 0) {
            p.y = plat.y - p.h;
            p.vy = 0;
            p.grounded = true;
        }
        else if (dy < 0) {
            // Corner correction: rising player clipping platform corner by a few px →
            // nudge horizontally around it instead of bonking. Only when actively rising.
            const overlapL = (p.x + p.w) - plat.x;
            const overlapR = (plat.x + plat.w) - p.x;
            const overlapTop = (plat.y + plat.h) - p.y;
            const nearlyClearOnTop = overlapTop <= 6;
            if (nearlyClearOnTop && overlapL > 0 && overlapL <= CORNER_CORRECTION_PX) {
                p.x -= overlapL;
                continue;
            }
            if (nearlyClearOnTop && overlapR > 0 && overlapR <= CORNER_CORRECTION_PX) {
                p.x += overlapR;
                continue;
            }
            p.y = plat.y + plat.h;
            p.vy = 0;
        }
    }
}
export async function loadLevel(id) {
    const res = await fetch(`assets/levels/${id}.json`);
    if (!res.ok)
        throw new Error(`level ${id}: ${res.status}`);
    const raw = (await res.json());
    if (typeof raw.id !== "string")
        throw new Error(`level ${id}: missing id`);
    if (!Array.isArray(raw.platforms))
        throw new Error(`level ${id}: platforms not array`);
    if (typeof raw.height !== "number")
        raw.height = DEFAULT_LEVEL_HEIGHT;
    return raw;
}
export function clampCameraX(desiredX, levelWidth) {
    const maxX = Math.max(0, levelWidth - VIEW_W);
    if (desiredX < 0)
        return 0;
    if (desiredX > maxX)
        return maxX;
    return desiredX;
}
export function clampCameraY(desiredY, levelHeight) {
    const maxY = Math.max(0, levelHeight - VIEW_H);
    if (desiredY < 0)
        return 0;
    if (desiredY > maxY)
        return maxY;
    return desiredY;
}
export function updateCamera(camera, player, dt, level) {
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    const ccx = camera.x + VIEW_W / 2;
    const ccy = camera.y + VIEW_H / 2;
    const dx = pcx - ccx;
    const dy = pcy - ccy;
    let camTargetX = camera.x;
    if (dx > CAM_DEADZONE_W / 2)
        camTargetX = camera.x + (dx - CAM_DEADZONE_W / 2);
    else if (dx < -CAM_DEADZONE_W / 2)
        camTargetX = camera.x + (dx + CAM_DEADZONE_W / 2);
    let camTargetY = camera.y;
    if (dy > CAM_DEADZONE_H / 2)
        camTargetY = camera.y + (dy - CAM_DEADZONE_H / 2);
    else if (dy < -CAM_DEADZONE_H / 2)
        camTargetY = camera.y + (dy + CAM_DEADZONE_H / 2);
    const lerpAmt = 1 - Math.exp(-CAM_LERP * dt);
    camera.x = camera.x + (camTargetX - camera.x) * lerpAmt;
    camera.y = camera.y + (camTargetY - camera.y) * lerpAmt;
    camera.x = clampCameraX(camera.x, level.width);
    camera.y = clampCameraY(camera.y, level.height);
}
//# sourceMappingURL=world.js.map