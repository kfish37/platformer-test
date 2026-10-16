/**
 * Rendering — world draw, HUD, overlays.
 *
 * `draw()` is the entry point called by the game loop each frame.
 * Reads global state from game.ts / player.ts / enemies.ts and paints
 * the viewport in screen space. No mutation of gameplay state here.
 */
import { facingRef } from "./facing.js";
import { isDown } from "./input.js";
import { player } from "./player.js";
import { enemyState } from "./enemies.js";
import { checkpointState } from "./checkpoints.js";
import { getSolids, isDoorOpen, isSwitchPressed } from "./switches.js";
import { saveData, formatPlayTime } from "./save.js";
import { camera, dashTrail, pauseState, session, shakeState } from "./game.js";
import { drawSloomoo } from "./sloomoo.js";
import { drawSloomooSprite, getSpriteImage, pickSpriteKey, spriteLoadState } from "./sprites.js";
import { drawMenu } from "./menu.js";
import { drawSlime, drawSlimeGhost } from "./slime.js";
import { drawParticles, updateParticles } from "./particles.js";
// Soft-body Sloomoo replaces the PNG sprites (kept loadable for comparison).
const USE_SPRITES = false;
let lastFrameMs = 0;
let frameDt = 0;
import { VIEW_W, VIEW_H, DASH_TRAIL_MS, DASH_SHAKE_MS, DASH_SHAKE_AMPL, PLAYER_MAX_HP, } from "./tuning.js";
const imgCache = new Map();
function drawFgProps(ctx, lvl) {
    if (!lvl.fgProps)
        return;
    for (const pr of lvl.fgProps) {
        if (!onScreen(pr))
            continue;
        const pi = getImg(pr.src);
        if (pi.complete && pi.naturalWidth > 0)
            ctx.drawImage(pi, pr.x, pr.y, pr.w, pr.h);
    }
}
function getImg(src) {
    let im = imgCache.get(src);
    if (!im) {
        im = new Image();
        im.src = src;
        imgCache.set(src, im);
    }
    return im;
}
export function draw(ctx) {
    if (session.state === "menu") {
        drawMenu(ctx);
        return;
    }
    const lvl = session.currentLevel;
    if (!lvl) {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        ctx.fillStyle = "#fff";
        ctx.font = "16px system-ui, sans-serif";
        ctx.fillText("Loading…", 20, 30);
        return;
    }
    // Background
    ctx.fillStyle = lvl.background;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // World-space translate (+ screen shake offset)
    ctx.save();
    let shakeX = 0, shakeY = 0;
    // Don't jitter while paused — the frozen frame should stay put.
    if (shakeState.ms > 0 && session.state === "playing") {
        const t = shakeState.ms / DASH_SHAKE_MS;
        shakeX = (Math.random() * 2 - 1) * DASH_SHAKE_AMPL * t;
        shakeY = (Math.random() * 2 - 1) * DASH_SHAKE_AMPL * t;
    }
    ctx.translate(-Math.round(camera.x) + shakeX, -Math.round(camera.y) + shakeY);
    // Painted background + prop sprites (when the level provides them)
    if (lvl.backgroundImage) {
        const bgi = getImg(lvl.backgroundImage);
        if (bgi.complete && bgi.naturalWidth > 0) {
            const par = lvl.bgParallax;
            if (par && par < 1) {
                const bgW = VIEW_W + (lvl.width - VIEW_W) * par, bgH = VIEW_H + (lvl.height - VIEW_H) * par;
                const kx = bgi.naturalWidth / bgW, ky = bgi.naturalHeight / bgH;
                ctx.drawImage(bgi, camera.x * par * kx, camera.y * par * ky, VIEW_W * kx, VIEW_H * ky, camera.x, camera.y, VIEW_W, VIEW_H);
            }
            else {
                const k = bgi.naturalWidth / lvl.width;
                const vx = Math.max(0, Math.floor(camera.x)), vy = Math.max(0, Math.floor(camera.y));
                const vw = Math.min(lvl.width - vx, VIEW_W + 2), vh = Math.min(lvl.height - vy, VIEW_H + 2);
                if (vw > 0 && vh > 0)
                    ctx.drawImage(bgi, vx * k, vy * k, vw * k, vh * k, vx, vy, vw, vh);
            }
        }
    }
    if (lvl.backgroundImage)
        drawLightShafts(ctx);
    if (lvl.props) {
        for (const pr of lvl.props) {
            if (!onScreen(pr))
                continue;
            if (lvl.backgroundImage)
                drawPropLit(ctx, pr);
            else {
                const pi = getImg(pr.src);
                if (pi.complete && pi.naturalWidth > 0)
                    ctx.drawImage(pi, pr.x, pr.y, pr.w, pr.h);
            }
        }
    }
    if (!lvl.hideGoalFlag) {
        // Flagpole
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(lvl.goal.x, lvl.goal.y, 3, lvl.goal.h + 90);
        // Goal flag
        ctx.fillStyle = "#ffd93d";
        ctx.fillRect(lvl.goal.x, lvl.goal.y, lvl.goal.w, lvl.goal.h);
    }
    // Platforms
    if (!lvl.backgroundImage) {
        ctx.fillStyle = lvl.platformColor;
        for (const p of lvl.platforms)
            ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    // Doors + switches (placeholder boxes)
    if (lvl.doors) {
        for (const d of lvl.doors) {
            if (d.art) {
                const di = getImg(d.art.src);
                if (!isDoorOpen(d.id) && di.complete && di.naturalWidth > 0)
                    ctx.drawImage(di, d.art.x, d.art.y, d.art.w, d.art.h);
                continue;
            }
            if (isDoorOpen(d.id)) {
                ctx.strokeStyle = "rgba(255,200,120,0.35)";
                ctx.lineWidth = 2;
                ctx.strokeRect(d.x + 1, d.y + 1, d.w - 2, d.h - 2);
                ctx.lineWidth = 1;
            }
            else {
                ctx.fillStyle = "#b5651d";
                ctx.fillRect(d.x, d.y, d.w, d.h);
                ctx.fillStyle = "#ffd93d";
                ctx.fillRect(d.x + 4, d.y + d.h / 2 - 3, d.w - 8, 6);
            }
        }
    }
    if (lvl.switches) {
        for (const s of lvl.switches) {
            if (s.art) {
                const si = getImg(s.art.src);
                if (si.complete && si.naturalWidth > 0)
                    ctx.drawImage(si, s.art.x, s.art.y, s.art.w, s.art.h);
                if (isSwitchPressed(s)) {
                    ctx.fillStyle = "rgba(82,210,115,0.85)";
                    ctx.beginPath();
                    ctx.arc(s.x + s.w / 2, s.y - 6, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
                continue;
            }
            ctx.fillStyle = isSwitchPressed(s) ? "#52d273" : "#ff5a4d";
            ctx.fillRect(s.x, s.y + (isSwitchPressed(s) ? s.h * 0.6 : 0), s.w, isSwitchPressed(s) ? s.h * 0.4 : s.h);
        }
    }
    if (lvl.backgroundImage)
        drawDepthAtmosphere(ctx, lvl);
    // Frame time for slime + particles (frozen while paused / not playing).
    {
        const nowMs = performance.now();
        frameDt = lastFrameMs === 0 ? 0 : Math.min(1 / 30, (nowMs - lastFrameMs) / 1000);
        lastFrameMs = nowMs;
        if (session.state !== "playing")
            frameDt = 0;
        updateParticles(frameDt, getSolids(lvl));
        drawParticles(ctx, "back");
    }
    // Checkpoints (before enemies so they render behind)
    drawCheckpoints(ctx);
    // Enemies
    drawEnemies(ctx);
    // I-frame flash: skip player render on half the frames.
    const inIFrames = player.iframeMs > 0;
    const iFrameFlash = inIFrames && Math.floor(performance.now() / 60) % 2 === 0;
    if (iFrameFlash) {
        drawParticles(ctx, "front");
        drawFgProps(ctx, lvl);
        if (lvl.backgroundImage)
            drawFrontAtmosphere(ctx);
        ctx.restore();
        drawVignette(ctx);
        drawHUD(ctx, lvl);
        drawOverlaysIfNeeded(ctx, lvl);
        return;
    }
    if (lvl.backgroundImage)
        drawPlayerLight(ctx);
    // contact shadow
    if (player.grounded) {
        ctx.save();
        ctx.fillStyle = "rgba(6,20,28,0.38)";
        ctx.beginPath();
        ctx.ellipse(player.x + player.w / 2, player.y + player.h + 1, player.w * 0.62, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    drawPlayer(ctx);
    drawParticles(ctx, "front");
    drawFgProps(ctx, lvl);
    if (lvl.backgroundImage)
        drawFrontAtmosphere(ctx);
    ctx.restore();
    drawVignette(ctx);
    drawHUD(ctx, lvl);
    drawOverlaysIfNeeded(ctx, lvl);
}
function drawCheckpoints(ctx) {
    const img = getImg("assets/props/V4_checkpoint.png");
    const ok = img.complete && img.naturalWidth > 0;
    for (const cp of checkpointState.list) {
        const activated = cp.activated;
        const flashT = activated ? (cp.activateFxMs / 500) : 0;
        const w = 44, hh = ok ? Math.round(img.naturalHeight * w / img.naturalWidth) : 70;
        const x = cp.x + cp.w / 2 - w / 2, y = cp.y + cp.h - hh + 2;
        ctx.save();
        if (activated) {
            const g = ctx.createRadialGradient(cp.x + cp.w / 2, y + hh * 0.6, 4, cp.x + cp.w / 2, y + hh * 0.6, 70);
            g.addColorStop(0, "rgba(150,255,210,0.55)");
            g.addColorStop(1, "rgba(150,255,210,0)");
            ctx.fillStyle = g;
            ctx.fillRect(cp.x - 60, y - 40, 140, hh + 100);
        }
        else {
            ctx.globalAlpha = 0.7;
        }
        if (ok)
            ctx.drawImage(img, x, y, w, hh);
        if (flashT > 0.001) {
            ctx.globalAlpha = flashT;
            ctx.strokeStyle = "#9dffd6";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(cp.x + cp.w / 2, y + hh * 0.55, (1 - flashT) * 40, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}
function drawEnemies(ctx) {
    for (const e of enemyState.list) {
        if (!e.alive) {
            if (e.deathFxMs > 0) {
                // Puff-of-smoke death effect — expanding faded ring.
                const t = 1 - e.deathFxMs / 250;
                ctx.save();
                ctx.globalAlpha = 1 - t;
                ctx.strokeStyle = "#ff6b8a";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(e.x + e.w / 2, e.y + e.h / 2, 8 + t * 22, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            continue;
        }
        // Body: dark plum slime blob with glossy highlight, angry yellow eyes.
        ctx.save();
        const bob = Math.sin(performance.now() / 180 + e.x) * 1.5;
        const gx = ctx.createLinearGradient(0, e.y, 0, e.y + e.h);
        gx.addColorStop(0, "#8a5a86");
        gx.addColorStop(1, "#4a2a54");
        ctx.fillStyle = gx;
        ctx.beginPath();
        ctx.roundRect(e.x - 1, e.y + bob, e.w + 2, e.h - bob, [e.w * 0.5, e.w * 0.5, 6, 6]);
        ctx.fill();
        ctx.strokeStyle = "#0e2230";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "rgba(255,230,250,0.45)";
        ctx.beginPath();
        ctx.ellipse(e.x + e.w * 0.3, e.y + e.h * 0.2 + bob, e.w * 0.12, e.h * 0.07, -0.5, 0, Math.PI * 2);
        ctx.fill();
        const eyeY = e.y + e.h * 0.42 + bob, eyeR = 4, eyeGap = e.w * 0.24, cxE = e.x + e.w / 2;
        for (const sg of [-1, 1]) {
            ctx.fillStyle = "#f6e27a";
            ctx.beginPath();
            ctx.arc(cxE + sg * eyeGap, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#1a0a1e";
            ctx.beginPath();
            ctx.arc(cxE + sg * eyeGap + e.facing * 1.5, eyeY, 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#1a0a1e";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cxE + sg * eyeGap - sg * 6, eyeY - 7 + 3 * (sg > 0 ? 0 : 0));
            ctx.lineTo(cxE + sg * eyeGap + sg * 4, eyeY - 4);
            ctx.stroke();
        }
        ctx.restore();
    }
}
function drawPlayer(ctx) {
    const left = isDown("arrowleft", "a");
    const right = isDown("arrowright", "d");
    const wallSliding = !player.grounded && player.vy > 0 &&
        ((player.touchingWallL && left) || (player.touchingWallR && right));
    const facing = player.vx > 5 ? 1 : player.vx < -5 ? -1 : facingRef.value;
    // Freeze the render-time clock while paused so breath/blink/drips don't animate.
    const renderTimeMs = pauseState.pausedAtMs ?? performance.now();
    const sloomooState = {
        running: player.grounded && Math.abs(player.vx) > 20,
        jumping: !player.grounded && player.vy < 0,
        falling: !player.grounded && player.vy >= 0 && !wallSliding,
        wallSliding,
        wallSide: player.touchingWallL ? -1 : player.touchingWallR ? 1 : 0,
        facing,
        timeMs: renderTimeMs,
        grounded: player.grounded,
    };
    const spriteKey = pickSpriteKey(sloomooState);
    const spriteImg = spriteKey ? getSpriteImage(spriteKey) : undefined;
    // ---- Dash afterimage trail (BEFORE live sprite) ----
    if (dashTrail.list.length > 0) {
        const nowMs = performance.now();
        for (const node of dashTrail.list) {
            const age = nowMs - node.bornMs;
            const life = 1 - age / DASH_TRAIL_MS;
            if (life <= 0)
                continue;
            ctx.save();
            ctx.globalAlpha = life * 0.55;
            if (!USE_SPRITES) {
                ctx.fillStyle = "rgba(90, 220, 255, 0.6)";
                drawSlimeGhost(ctx, node.x, node.y, player);
            }
            else if (spriteImg) {
                const trailRect = { x: node.x, y: node.y, w: player.w, h: player.h };
                drawSloomooSprite(ctx, spriteImg, trailRect, node.facing, false, sloomooState.timeMs);
                ctx.globalCompositeOperation = "source-atop";
                ctx.fillStyle = "rgba(90, 220, 255, 0.35)";
                ctx.fillRect(node.x - 20, node.y - 20, player.w + 40, player.h + 40);
            }
            else {
                ctx.fillStyle = "rgba(90, 220, 255, 0.4)";
                ctx.fillRect(node.x, node.y, player.w, player.h);
            }
            ctx.restore();
        }
    }
    // ---- Live sprite ----
    const inHitstop = player.dashHitstopMs > 0;
    const inActiveDash = player.dashActiveMs > 0;
    if (!USE_SPRITES) {
        facingRef.value = facing;
        drawSlime(ctx, {
            rect: player,
            vx: player.vx, vy: player.vy,
            grounded: player.grounded,
            wallSliding,
            wallSide: sloomooState.wallSide,
            facing,
            dashing: inActiveDash,
            timeMs: sloomooState.timeMs,
            dt: frameDt,
        });
    }
    else if (spriteImg) {
        drawSloomooSprite(ctx, spriteImg, player, facing, player.grounded, sloomooState.timeMs);
    }
    else {
        drawSloomoo(ctx, player, sloomooState);
    }
    // Post-flash overlay for hitstop/dash tint.
    if (inHitstop) {
        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        if (USE_SPRITES)
            ctx.fillRect(player.x - 2, player.y - 2, player.w + 4, player.h + 4);
        else
            drawSlimeGhost(ctx, player.x, player.y, player);
        ctx.restore();
    }
    else if (inActiveDash && USE_SPRITES) {
        ctx.save();
        ctx.fillStyle = "rgba(150, 240, 255, 0.25)";
        ctx.fillRect(player.x, player.y, player.w, player.h);
        ctx.restore();
    }
}
function drawHUD(ctx, lvl) {
    ctx.fillStyle = "#e8f6f4";
    /* no shadowBlur (slow) */
    ctx.font = "12px system-ui, sans-serif";
    const wallTag = player.touchingWallL && player.touchingWallR ? "BOTH" :
        player.touchingWallL ? "L" :
            player.touchingWallR ? "R" : "—";
    const dashTag = player.dashHitstopMs > 0 ? "HITSTOP" :
        player.dashActiveMs > 0 ? "DASH" :
            player.dashesRemaining > 0 ? "●" : "○";
    if (location.search.includes("debug"))
        ctx.fillText(`${lvl.name}  ·  x:${player.x.toFixed(0)}  vy:${player.vy.toFixed(0)}  wall:${wallTag}  lockout:${player.wallLockoutMs.toFixed(0)}  spr:${spriteLoadState.count}/6  dash:${dashTag}`, 10, 16);
    // Second row: run stats (top-right, above dash pip).
    const deaths = saveData.deathsPerLevel[lvl.id] ?? 0;
    const timeStr = formatPlayTime(saveData.totalPlayMs);
    ctx.fillStyle = "#e8f6f4";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`deaths:${deaths}  ·  time:${timeStr}`, VIEW_W - 34, 16);
    ctx.textAlign = "start";
    // HP hearts.
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
        const hx = 12 + i * 18;
        const hy = 32;
        const filled = i < player.hp;
        drawHeart(ctx, hx, hy, filled);
    }
    // Dash charge pip top-right.
    {
        const pipX = VIEW_W - 20;
        const pipY = 12;
        ctx.save();
        ctx.beginPath();
        ctx.arc(pipX, pipY, 6, 0, Math.PI * 2);
        if (player.dashesRemaining > 0 && player.dashCooldownMs === 0) {
            ctx.fillStyle = "#5adcff";
        }
        else if (player.dashCooldownMs > 0) {
            ctx.fillStyle = "#555";
        }
        else {
            ctx.fillStyle = "#222";
        }
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}
function drawHeart(ctx, cx, cy, filled) {
    ctx.save();
    const s = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy + s);
    ctx.bezierCurveTo(cx - s * 2, cy - s * 0.4, cx - s * 0.8, cy - s * 1.4, cx, cy - s * 0.2);
    ctx.bezierCurveTo(cx + s * 0.8, cy - s * 1.4, cx + s * 2, cy - s * 0.4, cx, cy + s);
    ctx.closePath();
    if (filled) {
        ctx.fillStyle = "#e63a5c";
        ctx.fill();
    }
    ctx.strokeStyle = "#2a0a15";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.restore();
}
function drawOverlaysIfNeeded(ctx, lvl) {
    if (session.state === "level_complete")
        drawOverlay(ctx, `Level Complete — ${lvl.name}`, "Press Space to continue");
    if (session.state === "game_complete")
        drawOverlay(ctx, "🐠 Thanks for playing", "Press R to play again");
    if (session.state === "paused")
        drawPauseOverlay(ctx, lvl);
}
function drawPauseOverlay(ctx, lvl) {
    // Darken the whole viewport but keep the frozen world visible behind.
    ctx.fillStyle = "rgba(6, 10, 22, 0.72)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Title
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#5adcff";
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText("Paused", VIEW_W / 2, VIEW_H / 2 - 70);
    ctx.fillStyle = "#c9d3e8";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(lvl.name, VIEW_W / 2, VIEW_H / 2 - 48);
    // Options list.
    const opts = [
        { key: "Esc / Space", label: "Resume" },
        { key: "R", label: "Restart at last checkpoint" },
        { key: "Q / M", label: "Main Menu (lose current run)" },
    ];
    ctx.font = "16px system-ui, sans-serif";
    const startY = VIEW_H / 2 - 10;
    const rowH = 26;
    for (let i = 0; i < opts.length; i++) {
        const y = startY + i * rowH;
        ctx.fillStyle = "#EC1C86";
        ctx.textAlign = "right";
        ctx.fillText(opts[i].key, VIEW_W / 2 - 12, y);
        ctx.fillStyle = "#c9d3e8";
        ctx.textAlign = "left";
        ctx.fillText(opts[i].label, VIEW_W / 2 + 12, y);
    }
    ctx.restore();
    ctx.textAlign = "start";
}
function drawOverlay(ctx, title, sub) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 24);
    ctx.textAlign = "start";
}
let vignetteCanvas = null;
function drawVignette(ctx) {
    if (!vignetteCanvas) {
        vignetteCanvas = document.createElement("canvas");
        vignetteCanvas.width = VIEW_W;
        vignetteCanvas.height = VIEW_H;
        const v = vignetteCanvas.getContext("2d");
        const g = v.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.62);
        g.addColorStop(0, "rgba(8,24,34,0)");
        g.addColorStop(1, "rgba(8,24,34,0.42)");
        v.fillStyle = g;
        v.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.drawImage(vignetteCanvas, 0, 0);
}
function onScreen(p) {
    return p.x + p.w > camera.x - 8 && p.x < camera.x + VIEW_W + 8 && p.y + p.h > camera.y - 8 && p.y < camera.y + VIEW_H + 8;
}
// ============================================================================
// Atmosphere / lighting pass (code-only immersion, 2026-10-16). ?amb=0 turns it off.
// Props get a wall drop-shadow + palette grade (cached once), the room gets light
// shafts, drifting mist and dust, slime drips fall from ledges, and Sloomoo lights
// the surfaces around him.
// ============================================================================
const AMB_ON = !location.search.includes("amb=0");
function nowSec() { return (pauseState.pausedAtMs ?? performance.now()) / 1000; }
function hash01(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function wrapN(v, m) { return ((v % m) + m) % m; }
const litCache = new Map();
const LIT_PAD = 28;
function buildLit(img, w, h) {
    const W = Math.ceil(w) + LIT_PAD * 2, H = Math.ceil(h) + LIT_PAD * 2;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d");
    g.save();
    g.shadowColor = "rgba(3,14,20,0.55)";
    g.shadowBlur = 16;
    g.shadowOffsetX = 5;
    g.shadowOffsetY = 9;
    g.drawImage(img, LIT_PAD, LIT_PAD, w, h);
    g.restore();
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = "rgba(14,52,62,0.17)";
    g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, LIT_PAD, 0, LIT_PAD + h);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.55, "rgba(4,18,26,0.05)");
    gr.addColorStop(1, "rgba(4,18,26,0.34)");
    g.fillStyle = gr;
    g.fillRect(0, LIT_PAD, W, h);
    return c;
}
function drawPropLit(ctx, pr) {
    const pi = getImg(pr.src);
    if (!(pi.complete && pi.naturalWidth > 0))
        return;
    if (!AMB_ON || pr.src.indexOf("_shadow") >= 0 || pr.w > 1400 || pr.h > 1400) {
        ctx.drawImage(pi, pr.x, pr.y, pr.w, pr.h);
        return;
    }
    const key = pr.src + "|" + pr.w + "|" + pr.h;
    let c = litCache.get(key);
    if (!c) {
        c = buildLit(pi, pr.w, pr.h);
        litCache.set(key, c);
    }
    ctx.drawImage(c, pr.x - LIT_PAD, pr.y - LIT_PAD);
}
function drawLightShafts(ctx) {
    if (!AMB_ON)
        return;
    const t = nowSec(), cx = Math.round(camera.x), cy = Math.round(camera.y);
    const slant = 220;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 4; i++) {
        const par = 0.22 + i * 0.07, w = 90 + hash01(i + 3) * 110;
        const sx = wrapN(hash01(i + 11) * (VIEW_W + 500) - cx * par + Math.sin(t * 0.07 + i * 2) * 30, VIEW_W + 500) - 250;
        const a = 0.035 + 0.025 * Math.sin(t * 0.35 + i * 1.7);
        ctx.save();
        ctx.translate(cx + sx, cy);
        ctx.transform(1, 0, -slant / VIEW_H, 1, 0, 0);
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, "rgba(140,230,215,0)");
        g.addColorStop(0.5, "rgba(140,230,215," + a.toFixed(3) + ")");
        g.addColorStop(1, "rgba(140,230,215,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, -10, w, VIEW_H + 20);
        ctx.restore();
    }
    ctx.restore();
}
let mistCanvas = null;
const MIST_W = 900, MIST_H = 260;
function getMist() {
    if (mistCanvas)
        return mistCanvas;
    const c = document.createElement("canvas");
    c.width = MIST_W;
    c.height = MIST_H;
    const g = c.getContext("2d");
    for (let i = 0; i < 9; i++) {
        const bx = hash01(i * 3 + 1) * MIST_W, by = MIST_H * (0.3 + 0.4 * hash01(i * 3 + 2)), r = 110 + hash01(i * 3 + 3) * 120;
        for (const ox of [-MIST_W, 0, MIST_W]) {
            g.save();
            g.translate(bx + ox, by);
            g.scale(1, 0.42);
            const rg = g.createRadialGradient(0, 0, 0, 0, 0, r);
            rg.addColorStop(0, "rgba(120,190,190,0.5)");
            rg.addColorStop(1, "rgba(120,190,190,0)");
            g.fillStyle = rg;
            g.fillRect(-r, -r, r * 2, r * 2);
            g.restore();
        }
    }
    mistCanvas = c;
    return c;
}
function drawMist(ctx, par, alpha, scale, yFrac, speed) {
    const m = getMist(), t = nowSec(), cx = Math.round(camera.x), cy = Math.round(camera.y);
    const tw = MIST_W * scale, th = MIST_H * scale;
    const off = wrapN(-cx * par + t * speed, tw);
    ctx.save();
    ctx.globalAlpha = alpha;
    const y = cy + VIEW_H * yFrac - th / 2;
    for (let x = off - tw; x < VIEW_W; x += tw)
        ctx.drawImage(m, cx + x, y, tw, th);
    ctx.restore();
}
function drawDrips(ctx, lvl) {
    if (!lvl.props)
        return;
    const t = nowSec();
    ctx.save();
    for (let i = 0; i < lvl.props.length; i++) {
        const pr = lvl.props[i];
        if (pr.src.indexOf("_shadow") >= 0 || pr.w < 80 || pr.h > 220 || !onScreen(pr))
            continue;
        if (hash01(i * 7 + 1) > 0.55)
            continue;
        const P = 5 + hash01(i * 7 + 2) * 5;
        const u = wrapN(t + hash01(i * 7 + 3) * P, P);
        const x = pr.x + pr.w * (0.12 + 0.76 * hash01(i * 7 + 4));
        const y0 = pr.y + pr.h * 0.93;
        const GROW = 1.7, FALL = 0.6;
        ctx.fillStyle = "#8f6f8a";
        ctx.strokeStyle = "#24343f";
        if (u < GROW) {
            const k = u / GROW, e = k * k, len = 2 + 7 * e, r = 1.2 + 2.0 * e;
            ctx.lineWidth = 2.2;
            ctx.strokeStyle = "#8f6f8a";
            ctx.beginPath();
            ctx.moveTo(x, y0 - 1);
            ctx.lineTo(x, y0 + len);
            ctx.stroke();
            ctx.strokeStyle = "#24343f";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(x, y0 + len, r, r * 1.3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        else if (u < GROW + FALL) {
            const s = u - GROW, d = 520 * s * s, f = s / FALL;
            ctx.globalAlpha = 1 - f * f * f;
            ctx.beginPath();
            ctx.ellipse(x, y0 + 9 + d, 2.2, 3.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 1;
        }
    }
    ctx.restore();
}
function drawDepthAtmosphere(ctx, lvl) {
    if (!AMB_ON)
        return;
    const cx = Math.round(camera.x), cy = Math.round(camera.y);
    ctx.save();
    ctx.fillStyle = "rgba(10,40,52,0.10)";
    ctx.fillRect(cx - 2, cy - 2, VIEW_W + 4, VIEW_H + 4);
    ctx.restore();
    drawMist(ctx, 0.55, 0.13, 1.0, 0.72, 6);
    drawMist(ctx, 0.7, 0.09, 1.4, 0.35, -4);
    drawDrips(ctx, lvl);
}
function drawPlayerLight(ctx) {
    if (!AMB_ON)
        return;
    const t = nowSec();
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const boost = player.dashActiveMs > 0 ? 1.6 : 1;
    const pulse = 0.9 + 0.1 * Math.sin(t * 2.1);
    const R = 230 * boost;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(px, py, 6, px, py, R);
    g.addColorStop(0, "rgba(90,210,255," + (0.26 * pulse).toFixed(3) + ")");
    g.addColorStop(0.35, "rgba(60,170,220,0.09)");
    g.addColorStop(1, "rgba(40,120,170,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px - R, py - R, R * 2, R * 2);
    if (player.grounded) {
        ctx.fillStyle = "rgba(120,235,255," + (0.22 * pulse).toFixed(3) + ")";
        ctx.beginPath();
        ctx.ellipse(px, player.y + player.h + 1, 46, 7, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
const DUST_N = 64;
function drawFrontAtmosphere(ctx) {
    if (!AMB_ON)
        return;
    drawMist(ctx, 1.25, 0.07, 1.8, 0.85, 10);
    const t = nowSec(), cx = Math.round(camera.x), cy = Math.round(camera.y);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < DUST_N; i++) {
        const z = 0.35 + 0.9 * hash01(i * 5 + 1);
        const sx0 = hash01(i * 5 + 2) * (VIEW_W + 60), sy0 = hash01(i * 5 + 3) * (VIEW_H + 60);
        const sp = 4 + 6 * hash01(i * 5 + 4);
        const sx = wrapN(sx0 + t * sp * 0.6 * (i % 2 ? 1 : -1) - cx * z, VIEW_W + 60) - 30;
        const sy = wrapN(sy0 - t * sp * 0.5 + Math.sin(t * 0.6 + i) * 10 - cy * z, VIEW_H + 60) - 30;
        const a = (0.12 + 0.22 * z) * (0.55 + 0.45 * Math.sin(t * 1.3 + i * 2.1));
        ctx.fillStyle = "rgba(170,235,230," + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(cx + sx, cy + sy, 0.8 + z * 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
//# sourceMappingURL=render.js.map