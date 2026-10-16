/**
 * Sloomoo v2: rebased on the novel's "drop" look (sloomusic / activ / bag / corporate),
 * not Slimey/melt. Smooth onion-shaped blue body (simulated metaballs, no hanging drips),
 * yellow stalk + magenta bulb cut from sloomusic.png, ringed eyes and mouths cut from the
 * high-res refs. Assets: assets/puppet2 (tools/puppet/cut_music.py, cut_mouths2.py).
 * Units are sloomusic.png art px; everything is built relative to the feet, facing right.
 */
import { march } from "./slimebody.js";
const MOUTHS = ["smile", "open", "o", "grin", "scared"];
function img(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; }); }
export async function loadS2(base) {
    const meta = await (await fetch(base + "music.json")).json();
    const [head, bL, bR, iL, iR] = await Promise.all(["head", "eyebaseL", "eyebaseR", "irisL", "irisR"].map(n => img(base + n + ".png")));
    const mouths = {};
    await Promise.all(MOUTHS.map(async (m) => { mouths[m] = await img(base + "mouth_" + m + ".png"); }));
    return { meta, head: head, eyeBase: [bL, bR], iris: [iL, iR], mouths };
}
// art reference points (sloomusic.png)
const FEET = { x: 516, y: 900 };
const ANCHOR = { x: 520, y: 562 }; // where the stalk meets the body (under the yellow collar)
const FACE = { x: 516, y: 740 }; // face centre on the belly
export const S2 = {
    pxToArt: 6.4,
    restH: 338, runH: 300, riseH: 410, fallH: 370,
    hK: 160, hC: 11, landSquash: 0.55, takeoffKick: 0.25,
    headK: 140, headC: 10, headInertia: 0.022, headMax: 110,
    bellyK: 70, bellyC: 6, bellyInertia: 0.05, bellyMax: 150,
    runLean: 55, runWiden: 0.10,
    dome: { y: -172, rx: 246, ry: 180 }, base: { y: -55, rx: 236, ry: 62 }, top: { y: -300, rx: 120, ry: 70 }, neck: { y: -350, rx: 62, ry: 44 },
    lip: { rx: 95, ry: 11, spread: 165 },
    trailEvery: 50, trailLife: 0.8, trailR: 50, trailMinV: 450,
    iso: 0.226, kr: 1.6, cellPx: 1.6, ow: 9.5, shadeDx: 34, shadeDy: -10,
    blinkMin: 1.8, blinkMax: 4.8, blinkMs: 150,
};
export const MOODS2 = {
    smile: { mouth: "smile", ms: 1.0, lidTop: 0, tilt: 0, lidBot: 0, iris: 1 },
    happy: { mouth: "open", ms: 0.8, lidTop: 0, tilt: 0, lidBot: 0.12, iris: 1 },
    excited: { mouth: "open", ms: 0.95, lidTop: 0, tilt: 0, lidBot: 0, iris: 1.06 },
    surprised: { mouth: "o", ms: 0.8, lidTop: 0, tilt: 0, lidBot: 0, iris: 0.8 },
    worried: { mouth: "o", ms: 0.5, lidTop: 0.22, tilt: 0.3, lidBot: 0, iris: 0.92 },
    scared: { mouth: "scared", ms: 0.85, lidTop: 0.06, tilt: 0.35, lidBot: 0, iris: 0.72 },
    sad: { mouth: "smile", ms: 0.9, flip: true, lidTop: 0.38, tilt: 0.3, lidBot: 0, iris: 1 },
    sleepy: { mouth: "smile", ms: 0.8, lidTop: 0.55, tilt: 0, lidBot: 0.08, iris: 1 },
    determined: { mouth: "smile", ms: 0.7, flip: true, lidTop: 0.3, tilt: -0.32, lidBot: 0.05, iris: 1 },
};
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export class Sloomoo2 {
    a;
    P = { x: 0, y: 0 };
    h = S2.restH;
    hv = 0;
    hx = 0;
    hxv = 0;
    bx = 0;
    bxv = 0;
    F = 0;
    c = 1;
    floor = 0;
    grounded = true;
    pvx = 0;
    pvy = 0;
    init = false;
    t = 0;
    run = 0;
    vyN = 0;
    trail = [];
    trailAcc = 0;
    facing = 1;
    turn = 1;
    look = { x: 0, y: 0 };
    lookT = { x: 0, y: 0 };
    nextSac = 0;
    blinkT = 0;
    nextBlink = 1.4;
    blink = 0;
    lid = { top: 0, tilt: 0, bot: 0, iris: 1 };
    mood = "smile";
    mouthPop = 0;
    rnd = rng(5);
    balls = [];
    geo = { k: 1, domeX: 0, domeY: 0, rx: 0, ry: 0, faceX: 0, faceY: 0, headX: 0, headY: 0, headRot: 0 };
    constructor(a) { this.a = a; }
    setMood(m) { if (m !== this.mood) {
        if (MOODS2[m].mouth !== MOODS2[this.mood].mouth || MOODS2[m].flip !== MOODS2[this.mood].flip)
            this.mouthPop = 1;
        this.mood = m;
    } }
    update(inp) {
        const T = S2, dt = Math.min(0.05, inp.dt);
        if (dt <= 0)
            return;
        this.t += dt;
        const k = T.pxToArt, Px = inp.x * k, Py = inp.y * k, vx = inp.vx * k, vy = inp.vy * k;
        if (inp.grounded)
            this.floor = Py;
        else if (inp.floorY !== undefined)
            this.floor = inp.floorY * k;
        if (!this.init) {
            this.init = true;
            this.F = Px;
            this.pvx = vx;
            this.pvy = vy;
            this.grounded = inp.grounded;
            this.c = inp.grounded ? 1 : 0;
            this.facing = inp.facing;
            this.turn = inp.facing;
        }
        const ax = clamp((vx - this.pvx) / dt, -60000, 60000);
        const landed = inp.grounded && !this.grounded, tookOff = !inp.grounded && this.grounded;
        this.P = { x: Px, y: Py };
        this.run += (clamp(Math.abs(vx) / (240 * k), 0, 1) * (inp.grounded ? 1 : 0.4) - this.run) * Math.min(1, dt * 8);
        this.vyN = clamp(vy / (650 * k), -1, 1);
        let hT = inp.grounded ? T.restH + (T.runH - T.restH) * this.run : (vy < 0 ? T.riseH : T.fallH);
        hT += Math.sin(this.t * 2.4) * 5;
        if (landed)
            this.hv -= Math.min(1.5, Math.abs(this.pvy) / (900 * k)) * T.restH * T.landSquash * 9;
        if (tookOff)
            this.hv += Math.abs(vy) * T.takeoffKick;
        this.hv += (T.hK * (hT - this.h) - T.hC * this.hv) * dt;
        this.h += this.hv * dt;
        this.h = clamp(this.h, 170, 470);
        this.hxv += (-T.headK * this.hx - T.headC * this.hxv - ax * T.headInertia) * dt;
        this.hx = clamp(this.hx + this.hxv * dt, -T.headMax, T.headMax);
        this.bxv += (-T.bellyK * this.bx - T.bellyC * this.bxv - ax * T.bellyInertia) * dt;
        this.bx = clamp(this.bx + this.bxv * dt, -T.bellyMax, T.bellyMax);
        this.c += ((inp.grounded ? 1 : 0) - this.c) * Math.min(1, dt * (inp.grounded ? 22 : 12));
        this.F += (Px - this.F) * Math.min(1, dt * (inp.grounded ? 7 : 14));
        if (inp.grounded && Math.abs(vx) > T.trailMinV) {
            this.trailAcc += Math.abs(vx) * dt;
            while (this.trailAcc > T.trailEvery) {
                this.trailAcc -= T.trailEvery;
                this.trail.push({ x: this.F - Math.sign(vx) * 150, y: this.floor - 8, life: 1, r: T.trailR * (0.8 + this.rnd() * 0.4) });
            }
        }
        for (const tr of this.trail)
            tr.life -= dt / T.trailLife;
        this.trail = this.trail.filter(tr => tr.life > 0);
        this.facing = inp.facing;
        this.turn += (inp.facing - this.turn) * Math.min(1, dt * 14);
        // face
        const md = MOODS2[this.mood], e = Math.min(1, dt * 12);
        this.lid.top += (md.lidTop - this.lid.top) * e;
        this.lid.tilt += (md.tilt - this.lid.tilt) * e;
        this.lid.bot += (md.lidBot - this.lid.bot) * e;
        this.lid.iris += (md.iris - this.lid.iris) * e;
        this.blinkT += dt;
        if (this.blinkT > this.nextBlink) {
            this.blinkT = 0;
            this.nextBlink = T.blinkMin + (T.blinkMax - T.blinkMin) * this.rnd();
            if (this.rnd() < 0.2)
                this.nextBlink = 0.22;
        }
        const bt = this.blinkT * 1000 / T.blinkMs;
        this.blink = bt < 1 ? Math.sin(bt * Math.PI) : 0;
        if (this.t > this.nextSac) {
            this.nextSac = this.t + 0.6 + this.rnd() * 1.8;
            this.lookT = { x: (this.rnd() * 2 - 1) * 0.7, y: (this.rnd() * 2 - 1) * 0.4 };
        }
        const moving = Math.abs(vx) > 200;
        const lx = moving ? 0.9 : this.lookT.x, ly = !inp.grounded ? clamp(this.vyN, -0.8, 0.8) : (moving ? 0.05 : this.lookT.y);
        const ls = Math.min(1, dt * 22);
        this.look.x += (lx - this.look.x) * ls;
        this.look.y += (ly - this.look.y) * ls;
        this.mouthPop = Math.max(0, this.mouthPop - dt * 7);
        this.pvx = vx;
        this.pvy = vy;
        this.grounded = inp.grounded;
        this.build();
    }
    /** Geometry in facing-local art px relative to the feet (y up is negative). */
    build() {
        const T = S2, B = [], kr = T.kr, f = this.facing;
        const add = (x, y, rx, ry, w = 1) => { if (w > 0.01)
            B.push({ x, y, rx: rx * kr, ry: ry * kr, w }); };
        const k = this.h / T.restH, wk = 1 / Math.sqrt(k) * (1 + T.runWiden * this.run);
        const air = 1 - this.c;
        const lift = air * 60; // in the air the base pulls up off the floor
        const bxL = this.bx * f, hxL = this.hx * f;
        const lean = T.runLean * this.run;
        const domeX = bxL * 0.6 + lean * 0.3, domeY = T.dome.y * k - lift * 0.5;
        const rx = T.dome.rx * wk * (1 - 0.12 * air), ry = T.dome.ry * k;
        add(domeX, domeY, rx, ry);
        add(bxL * 0.25, T.base.y * k - lift, T.base.rx * wk * (1 - 0.25 * air), T.base.ry * Math.max(0.6, k), 0.55 * (1 - air));
        const topX = bxL * 0.3 + hxL * 0.5 + lean, topY = T.top.y * k - lift * 0.4;
        add(topX, topY, T.top.rx * wk, T.top.ry * k, 0.6);
        const headX = hxL + lean * 1.2, headY = -(ANCHOR.y - FEET.y < 0 ? FEET.y - ANCHOR.y : 0) * k - lift * 0.4;
        add((topX + headX) / 2, T.neck.y * k - lift * 0.4, T.neck.rx, T.neck.ry);
        // base: in the air a teardrop tail trails behind the motion
        if (air > 0.05)
            add(-bxL * 0.3, -60 * k - lift + this.vyN * 70, 120 * wk, 70, air);
        // lip that sticks to the floor + smear while moving
        const c = this.c;
        if (c > 0.02) {
            const dragL = (this.F - this.P.x) * f;
            const fl = this.floor - this.P.y;
            const lipW = Math.min(1, Math.abs(dragL) / 60 + Math.max(0, 1 - k) * 4);
            if (lipW > 0.02)
                for (let i = -1; i <= 1; i++)
                    add(i * T.lip.spread * (1 + 0.15 * (1 - k)) + dragL * (0.5 + 0.5 * i * Math.sign(dragL || 1)) * 0.6, fl - T.lip.ry * 0.6, T.lip.rx * (1 + 0.6 * (1 - k)), T.lip.ry, c * lipW);
        }
        for (const tr of this.trail)
            add((tr.x - this.P.x) * f, tr.y - this.P.y, tr.r * (0.6 + 0.4 * tr.life), tr.r * 0.32 * tr.life + 3, Math.min(1, tr.life * 1.6));
        this.balls = B;
        const headRot = clamp((hxL - bxL * 0.5) / 600, -0.25, 0.25) + lean / 900;
        this.geo = { k, domeX, domeY, rx, ry, faceX: domeX + lean * 0.12, faceY: domeY + (FACE.y - FEET.y - T.dome.y) * k, headX, headY, headRot };
    }
    /** Draw with the feet at screen (sx, sy); S = screen px per art px. */
    draw(ctx, sx, sy, S) {
        if (!this.balls.length)
            return;
        const T = S2, A = this.a, M = A.meta, C = M.colors;
        const tf = Math.sign(this.turn || 1) * (0.82 + 0.18 * Math.abs(this.turn));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(S * tf, S);
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        // ---- body field
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const b of this.balls) {
            x0 = Math.min(x0, b.x - b.rx);
            x1 = Math.max(x1, b.x + b.rx);
            y0 = Math.min(y0, b.y - b.ry);
            y1 = Math.max(y1, b.y + b.ry);
        }
        const cs = Math.max(4, T.cellPx / S);
        const fl = this.floor - this.P.y;
        y0 = fl - Math.ceil((fl - y0) / cs) * cs;
        const nx = Math.ceil((x1 - x0) / cs) + 2, ny = Math.ceil((y1 - y0) / cs) + 2;
        const fld = new Float32Array(nx * ny);
        for (const b of this.balls) {
            const i0 = Math.max(0, Math.floor((b.x - b.rx - x0) / cs)), i1 = Math.min(nx - 1, Math.ceil((b.x + b.rx - x0) / cs));
            const j0 = Math.max(0, Math.floor((b.y - b.ry - y0) / cs)), j1 = Math.min(ny - 1, Math.ceil((b.y + b.ry - y0) / cs));
            const irx = 1 / b.rx, iry = 1 / b.ry;
            for (let j = j0; j <= j1; j++) {
                const dy = (y0 + j * cs - b.y) * iry, dy2 = dy * dy;
                if (dy2 >= 1)
                    continue;
                for (let i = i0; i <= i1; i++) {
                    const dx = (x0 + i * cs - b.x) * irx, d2 = dx * dx + dy2;
                    if (d2 < 1) {
                        const q = 1 - d2;
                        fld[j * nx + i] += b.w * q * q * q;
                    }
                }
            }
        }
        if (this.grounded) {
            const jf = Math.round((fl - y0) / cs);
            for (let j = Math.max(0, jf); j < ny; j++)
                for (let i = 0; i < nx; i++) {
                    const v = fld[j * nx + i];
                    fld[j * nx + i] = j === jf ? Math.min(v, T.iso) : 0;
                }
        }
        const loops = march(fld, nx, ny, T.iso);
        const path = new Path2D();
        for (const L of loops) {
            if (L.length < 3)
                continue;
            const pts = L.map(q => [x0 + q[0] * cs, y0 + q[1] * cs]);
            const n = pts.length;
            path.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
            for (let i = 0; i < n; i++) {
                const a = pts[i], b = pts[(i + 1) % n];
                path.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            }
            path.closePath();
        }
        const g = this.geo;
        // fill: darker blue, lighter blue offset toward the light (upper right), like the art
        ctx.fillStyle = C["blueS"] ?? "#099cd2";
        ctx.fill(path, "evenodd");
        ctx.save();
        ctx.clip(path, "evenodd");
        ctx.beginPath();
        ctx.ellipse(g.domeX + T.shadeDx, g.domeY + T.shadeDy, g.rx * 0.93, g.ry * 1.25, 0, 0, Math.PI * 2);
        ctx.ellipse(g.domeX + T.shadeDx * 0.6, g.domeY - g.ry, g.rx * 0.6, g.ry * 0.9, 0, 0, Math.PI * 2);
        ctx.fillStyle = C["blue"] ?? "#21b5e3";
        ctx.fill();
        // soft gloss on the shoulder (activ / bag)
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.ellipse(g.domeX + g.rx * 0.62, g.domeY - g.ry * 0.45, 9, 26, 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = C["purple"] ?? "#8b2ca5";
        ctx.lineWidth = Math.max(1 / S, T.ow);
        ctx.stroke(path);
        // ---- head (stalk + bulb) art
        ctx.save();
        ctx.translate(g.headX, g.headY);
        ctx.rotate(g.headRot);
        ctx.scale(1, 0.85 + 0.15 * g.k);
        const H = M.head;
        ctx.drawImage(A.head, H.x - ANCHOR.x, H.y - ANCHOR.y);
        ctx.restore();
        // ---- face
        ctx.save();
        ctx.translate(g.faceX, g.faceY);
        const fk = 0.9 + 0.1 * g.k;
        ctx.scale(1 / Math.sqrt(fk), fk);
        for (const [x, y, r] of M.freckles) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(x - FACE.x, y - FACE.y, r * 1.05, 0, Math.PI * 2);
            ctx.fill();
        }
        M.eyes.forEach((e, i) => this.drawEye(ctx, e, i, C));
        // mouth
        const md = MOODS2[this.mood], mi = A.mouths[md.mouth];
        const pop = 1 + Math.sin(this.mouthPop * Math.PI) * 0.18;
        const ms = md.ms * (md.mouth === "smile" ? 1 : 1);
        ctx.save();
        ctx.translate(M.mouth.cx - FACE.x, M.mouth.y - FACE.y + 4);
        ctx.scale(ms * (2 - pop), ms * pop * (md.flip ? -1 : 1));
        ctx.drawImage(mi, -mi.width / 2, md.flip ? -mi.height * 0.8 : -6);
        ctx.restore();
        ctx.restore();
        ctx.restore();
    }
    drawEye(ctx, e, i, C) {
        const A = this.a, F = FACE;
        const cx = e.cx - F.x, cy = e.cy - F.y;
        ctx.drawImage(A.eyeBase[i], e.spr.x - F.x, e.spr.y - F.y);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, e.r - 3, 0, Math.PI * 2);
        ctx.clip();
        const free = e.r * 0.42;
        const ix = e.iris.cx - F.x + this.look.x * free, iy = e.iris.cy - F.y + this.look.y * free;
        ctx.translate(ix, iy);
        ctx.scale(this.lid.iris, this.lid.iris);
        ctx.drawImage(A.iris[i], e.irisSpr.x - e.iris.cx, e.irisSpr.y - e.iris.cy);
        ctx.restore();
        // lids in body blue with a purple edge
        const top = Math.max(this.lid.top, this.blink), tilt = this.lid.tilt * (1 - this.blink) * (i === 0 ? 1 : -1), bot = this.lid.bot * (1 - this.blink);
        const r = e.r + 6;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = C["blue"] ?? "#21b5e3";
        ctx.strokeStyle = C["purple"] ?? "#8b2ca5";
        ctx.lineWidth = 8;
        if (top > 0.02 || Math.abs(tilt) > 0.02) {
            const base = cy - r + 2 * r * Math.min(1, top);
            const yR = base - tilt * r * 0.8 * (1 - top * 0.5), yL = base + tilt * r * 0.8 * (1 - top * 0.5);
            const xl = cx - r - 4, xr = cx + r + 4, sag = r * 0.2 * (1 - Math.min(1, top));
            ctx.beginPath();
            ctx.moveTo(xl, cy - r - 10);
            ctx.lineTo(xl, yL);
            ctx.quadraticCurveTo(cx, (yL + yR) / 2 + sag, xr, yR);
            ctx.lineTo(xr, cy - r - 10);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(xl, yL);
            ctx.quadraticCurveTo(cx, (yL + yR) / 2 + sag, xr, yR);
            ctx.stroke();
        }
        if (bot > 0.02) {
            const yb = cy + r - 2 * r * bot, bu = r * 0.3;
            ctx.beginPath();
            ctx.moveTo(cx - r - 4, cy + r + 10);
            ctx.lineTo(cx - r - 4, yb + bu * 0.6);
            ctx.quadraticCurveTo(cx, yb - bu, cx + r + 4, yb + bu * 0.6);
            ctx.lineTo(cx + r + 4, cy + r + 10);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(cx - r - 4, yb + bu * 0.6);
            ctx.quadraticCurveTo(cx, yb - bu, cx + r + 4, yb + bu * 0.6);
            ctx.stroke();
        }
        ctx.restore();
    }
}
//# sourceMappingURL=sloomoo2.js.map