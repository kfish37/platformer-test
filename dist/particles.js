/**
 * World-space particle system for slime polish: flung droplets, floor/wall
 * splats, landing rings and dash sparkles. Updated and drawn from render.ts
 * with real frame time (frozen while paused).
 */
import { SL } from "./sloomoo.js";
const MAX_PARTICLES = 320;
const DROP_GRAVITY = 1400;
const list = [];
function push(p) {
    if (list.length >= MAX_PARTICLES)
        list.shift();
    list.push(p);
}
export function clearParticles() {
    list.length = 0;
}
export function spawnDrop(x, y, vx, vy, r, yellow = false) {
    push({ kind: "drop", x, y, vx, vy, r, life: 1.6, maxLife: 1.6, yellow, side: 1 });
}
export function spawnSplat(x, y, r, life = 1.8) {
    push({ kind: "splat", x, y, vx: 0, vy: 0, r, life, maxLife: life, yellow: false, side: 1 });
}
export function spawnWallSplat(x, y, r, side, life = 1.2) {
    push({ kind: "wallsplat", x, y, vx: 0, vy: 0, r, life, maxLife: life, yellow: false, side });
}
/** Glossy slime smear left on the floor while running (r = half length). */
export function spawnTrail(x, y, r, life = 2.4) {
    push({ kind: "trail", x, y, vx: 0, vy: 0, r, life, maxLife: life, yellow: false, side: 1 });
}
export function spawnRing(x, y, r) {
    push({ kind: "ring", x, y, vx: 0, vy: 0, r, life: 0.32, maxLife: 0.32, yellow: false, side: 1 });
}
export function spawnSpark(x, y, vx, vy) {
    const life = 0.25 + Math.random() * 0.25;
    push({ kind: "spark", x, y, vx, vy, r: 1 + Math.random() * 1.5, life, maxLife: life, yellow: Math.random() < 0.3, side: 1 });
}
function hitPlatform(platforms, x, y) {
    for (const p of platforms) {
        if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h)
            return p;
    }
    return null;
}
export function updateParticles(dt, platforms) {
    if (dt <= 0)
        return;
    for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.life -= dt;
        if (p.life <= 0) {
            list.splice(i, 1);
            continue;
        }
        if (p.kind === "drop") {
            const px = p.x, py = p.y;
            p.vy += DROP_GRAVITY * dt;
            p.vx *= Math.exp(-1.5 * dt);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const hit = hitPlatform(platforms, p.x, p.y);
            if (hit) {
                if (py <= hit.y + 1 && p.vy > 0) {
                    spawnSplat(p.x, hit.y, p.r * (1.4 + Math.random() * 0.6));
                }
                else if (px <= hit.x) {
                    spawnWallSplat(hit.x, p.y, p.r * 1.3, 1);
                }
                else if (px >= hit.x + hit.w) {
                    spawnWallSplat(hit.x + hit.w, p.y, p.r * 1.3, -1);
                }
                list.splice(list.indexOf(p), 1);
            }
        }
        else if (p.kind === "spark") {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= Math.exp(-6 * dt);
            p.vy *= Math.exp(-6 * dt);
        }
        else if (p.kind === "wallsplat") {
            p.y += 6 * dt; // slow ooze down the wall
        }
    }
}
export function drawParticles(ctx, layer) {
    for (const p of list) {
        const t = p.life / p.maxLife;
        const isBack = p.kind === "splat" || p.kind === "wallsplat" || p.kind === "ring" || p.kind === "trail";
        if ((layer === "back") !== isBack)
            continue;
        ctx.save();
        switch (p.kind) {
            case "drop": {
                const sp = Math.hypot(p.vx, p.vy);
                const ang = Math.atan2(p.vy, p.vx);
                const stretch = 1 + Math.min(1.2, sp / 600);
                ctx.translate(p.x, p.y);
                ctx.rotate(ang);
                ctx.beginPath();
                ctx.ellipse(0, 0, p.r * stretch, p.r / Math.sqrt(stretch), 0, 0, Math.PI * 2);
                ctx.fillStyle = p.yellow ? SL.bodyYellow : SL.body;
                ctx.fill();
                ctx.lineWidth = 0.8;
                ctx.strokeStyle = SL.outline;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(-p.r * 0.3, -p.r * 0.35, p.r * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.8)";
                ctx.fill();
                break;
            }
            case "splat": {
                ctx.globalAlpha = Math.min(1, t * 2.5);
                const grow = 1 + (1 - t) * 0.25;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y - p.r * 0.18, p.r * grow, p.r * 0.38, 0, Math.PI, 0);
                ctx.closePath();
                ctx.fillStyle = SL.body;
                ctx.fill();
                ctx.fillStyle = "rgba(255,255,255,0.45)";
                ctx.beginPath();
                ctx.ellipse(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.3, p.r * 0.1, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case "trail": {
                // thin wet smear that dries (fades + thins) over its life
                ctx.globalAlpha = Math.min(1, t * 1.6) * 0.85;
                const th = 1.5 + 1.1 * t;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y - th * 0.5, p.r, th, 0, Math.PI, 0);
                ctx.closePath();
                ctx.fillStyle = SL.body;
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.75)";
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(p.x - p.r * 0.55, p.y - th * 0.9);
                ctx.lineTo(p.x + p.r * 0.25, p.y - th * 0.9);
                ctx.stroke();
                break;
            }
            case "wallsplat": {
                ctx.globalAlpha = Math.min(1, t * 2.5);
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.r * 0.38, p.r * 1.2, 0, p.side === 1 ? Math.PI / 2 : -Math.PI / 2, p.side === 1 ? -Math.PI / 2 : Math.PI / 2);
                ctx.closePath();
                ctx.fillStyle = SL.body;
                ctx.fill();
                break;
            }
            case "ring": {
                const k = 1 - t;
                ctx.globalAlpha = t * 0.7;
                ctx.strokeStyle = "rgba(200, 245, 255, 1)";
                ctx.lineWidth = 2 * t + 0.5;
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.r * (0.4 + k * 1.2), p.r * 0.22 * (0.4 + k * 1.2), 0, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case "spark": {
                ctx.globalAlpha = t;
                ctx.fillStyle = p.yellow ? SL.bodyYellow : "#E8FCFF";
                ctx.translate(p.x, p.y);
                ctx.rotate(p.life * 8);
                const s = p.r * (0.6 + t);
                ctx.beginPath();
                ctx.moveTo(0, -s * 2);
                ctx.lineTo(s * 0.5, 0);
                ctx.lineTo(0, s * 2);
                ctx.lineTo(-s * 0.5, 0);
                ctx.closePath();
                ctx.fill();
                break;
            }
        }
        ctx.restore();
    }
}
//# sourceMappingURL=particles.js.map