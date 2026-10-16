/**
 * PNG sprite loader for Sloomoo.
 *
 * Sprites live at assets/sprites/sloomoo_<state>.png (96x144 authoring,
 * drawn at 32x48 on-screen). Loading is per-state and non-fatal: any file
 * that 404s leaves that state to fall back to the parametric drawSloomoo().
 */
import { facingRef } from "./facing.js";
const SLOOMOO_SPRITE_KEYS = [
    "idle", "run_1", "run_2", "jump", "fall", "wall",
];
// On-screen draw size. Authoring size is 3x this (96x144).
const SPRITE_DRAW_W = 32;
const SPRITE_DRAW_H = 48;
// Run cycle timing — matches the parametric run animation cadence (~100ms/frame).
const RUN_CYCLE_MS = 200;
const sloomooSprites = {};
export const spriteLoadState = { count: 0 };
export function loadSloomooSprites() {
    for (const key of SLOOMOO_SPRITE_KEYS) {
        const img = new Image();
        img.onload = () => {
            sloomooSprites[key] = img;
            spriteLoadState.count++;
            // eslint-disable-next-line no-console
            console.log(`[sprites] loaded sloomoo_${key} (${spriteLoadState.count}/6)`);
        };
        img.onerror = () => {
            // eslint-disable-next-line no-console
            console.warn(`[sprites] missing assets/sprites/sloomoo_${key}.png (using parametric fallback)`);
        };
        img.src = `assets/sprites/sloomoo_${key}.png`;
    }
}
export function pickSpriteKey(s) {
    if (s.wallSliding)
        return "wall";
    if (s.jumping)
        return "jump";
    if (s.falling)
        return "fall";
    if (s.running) {
        const phase = Math.floor(s.timeMs / (RUN_CYCLE_MS / 2)) % 2;
        return phase === 0 ? "run_1" : "run_2";
    }
    return "idle";
}
export function getSpriteImage(key) {
    return sloomooSprites[key];
}
export function drawSloomooSprite(ctx, img, p, facing, grounded, timeMs) {
    facingRef.value = facing;
    const cx = p.x + p.w / 2;
    const drawX = cx - SPRITE_DRAW_W / 2;
    const drawY = p.y + p.h - SPRITE_DRAW_H;
    // Contact shadow.
    if (grounded) {
        ctx.save();
        ctx.fillStyle = "rgba(20, 15, 45, 0.28)";
        ctx.beginPath();
        ctx.ellipse(cx, p.y + p.h - 1, p.w * 0.42, p.h * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.save();
    if (facing === -1) {
        ctx.translate(cx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-cx, 0);
    }
    const prevSmooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, drawX, drawY, SPRITE_DRAW_W, SPRITE_DRAW_H);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.restore();
    // Reserved for future per-sprite animation timing.
    void timeMs;
}
//# sourceMappingURL=sprites.js.map