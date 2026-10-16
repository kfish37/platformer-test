/**
 * Cut-out puppet Sloomoo, built from the novel art (assets/puppet/*, cut from
 * Sloomoo_Slimey.png and mouths from the other refs by tools/puppet/*.py).
 *
 * The body image is drawn through a deforming mesh (squash, lean, jelly lag,
 * a blob that swings on its neck, drips that sway and ooze). The face is live:
 * irises look around inside the eyes, lids blink and shape expressions, and
 * the mouth swaps between mouths cut from the novel.
 */
const MOUTHS = ["smile", "open", "o", "grin", "shout", "ooh", "rush", "flat"];
function loadImg(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
}
export async function loadPuppet(base, bodyFile = "slimey_body.png") {
    const meta = await (await fetch(base + "slimey.json")).json();
    const [body, irisL, irisR] = await Promise.all([loadImg(base + bodyFile), loadImg(base + "slimey_pupilL.png"), loadImg(base + "slimey_pupilR.png")]);
    const mouths = {};
    await Promise.all(MOUTHS.map(async (m) => { mouths[m] = await loadImg(base + "mouth_" + m + ".png"); }));
    return { body, iris: [irisL, irisR], mouths, meta };
}
// ------------------------------------------------------------------ tuning
export const PTUNE = {
    cols: 10, rows: 22,
    breath: 0.022, breathHz: 0.45,
    squashK: 170, squashC: 11,
    landSquash: 0.0011,
    takeoffStretch: 0.00025,
    airStretch: 0.10,
    leanMax: 0.20, leanK: 90, leanC: 10, leanPerVx: 0.00075,
    jellyK: 150, jellyC: 9, inertia: 0.010, inertiaClamp: 900,
    pivotY: 300, blobK: 55, blobC: 4.5, blobInertia: 0.0016, blobIdle: 0.045, blobLeanFollow: 0.6,
    dripY: 735, dripSway: 14, dripOoze: 26,
    lookRange: 0.85,
    blinkMin: 1.8, blinkMax: 4.8, blinkMs: 150,
    mouthPopMs: 140,
    turnRate: 14,
};
const MOUTH_W = { smile: 71, open: 160, o: 58, grin: 145, shout: 170, ooh: 82, rush: 200, flat: 70 };
export const MOODS = {
    smile: { mouth: "smile", lidTop: 0.00, tilt: 0.00, lidBot: 0.00, iris: 1.00 },
    happy: { mouth: "open", lidTop: 0.00, tilt: 0.00, lidBot: 0.00, iris: 1.04 },
    excited: { mouth: "grin", lidTop: 0.00, tilt: 0.00, lidBot: 0.00, iris: 1.06 },
    surprised: { mouth: "o", lidTop: 0.00, tilt: 0.00, lidBot: 0.00, iris: 0.78 },
    worried: { mouth: "ooh", lidTop: 0.30, tilt: 0.32, lidBot: 0.00, iris: 0.92 },
    scared: { mouth: "shout", lidTop: 0.10, tilt: 0.38, lidBot: 0.00, iris: 0.70 },
    sad: { mouth: "flat", lidTop: 0.42, tilt: 0.30, lidBot: 0.00, iris: 1.00 },
    sleepy: { mouth: "smile", lidTop: 0.58, tilt: 0.00, lidBot: 0.08, iris: 1.00 },
    determined: { mouth: "flat", lidTop: 0.32, tilt: -0.34, lidBot: 0.05, iris: 1.00 },
    rush: { mouth: "rush", lidTop: 0.05, tilt: -0.10, lidBot: 0.10, iris: 1.00 },
};
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export class Puppet {
    a;
    rest = [];
    disp = [];
    dvel = [];
    flex = [];
    def = [];
    sq = 0;
    sqv = 0;
    lean = 0;
    leanv = 0;
    ang = 0;
    angv = 0;
    pvx = 0;
    pvy = 0;
    pGround = true;
    init = false;
    look = { x: 0, y: 0 };
    lookT = { x: 0, y: 0 };
    nextSaccade = 0;
    blinkT = 0;
    nextBlink = 1.5;
    blink = 0;
    lid = { top: 0, tilt: 0, bot: 0, iris: 1 };
    mood = "smile";
    mouth = "smile";
    mouthPop = 0;
    turn = 1;
    t = 0;
    rnd = rng(7);
    baseY;
    noDrips;
    constructor(a, opts = {}) {
        this.a = a;
        this.baseY = opts.baseY ?? a.meta.h;
        this.noDrips = opts.noDrips ?? false;
        const { w, h } = a.meta, C = PTUNE.cols, R = PTUNE.rows;
        for (let j = 0; j <= R; j++)
            for (let i = 0; i <= C; i++) {
                const x = w * i / C, y = h * j / R;
                this.rest.push({ x, y });
                this.disp.push({ x: 0, y: 0 });
                this.dvel.push({ x: 0, y: 0 });
                this.def.push({ x, y });
                const v = y / h;
                const blob = Math.max(0, Math.min(1, (PTUNE.pivotY + 60 - y) / 300));
                const drip = Math.max(0, Math.min(1, (y - PTUNE.dripY) / (h - PTUNE.dripY)));
                this.flex.push(0.25 + 0.35 * (1 - v) + 0.5 * blob + 0.9 * drip);
            }
    }
    setMood(m) {
        if (m === this.mood)
            return;
        this.mood = m;
        const mo = MOODS[m].mouth;
        if (mo !== this.mouth) {
            this.mouth = mo;
            this.mouthPop = 1;
        }
    }
    getMood() { return this.mood; }
    update(inp) {
        const dt = inp.dt;
        if (dt <= 0)
            return;
        this.t += dt;
        if (!this.init) {
            this.pvx = inp.vx;
            this.pvy = inp.vy;
            this.pGround = inp.grounded;
            this.turn = inp.facing;
            this.init = true;
        }
        const cl = (v) => Math.max(-PTUNE.inertiaClamp, Math.min(PTUNE.inertiaClamp, v));
        const ax = cl(inp.vx - this.pvx) / dt, ay = cl(inp.vy - this.pvy) / dt;
        if (inp.grounded && !this.pGround)
            this.sqv += Math.min(0.9, Math.abs(this.pvy) * PTUNE.landSquash) * 8;
        if (!inp.grounded && this.pGround && inp.vy < -100)
            this.sqv -= Math.abs(inp.vy) * PTUNE.takeoffStretch * 8;
        this.pvx = inp.vx;
        this.pvy = inp.vy;
        this.pGround = inp.grounded;
        const sqT = inp.grounded ? 0 : -Math.max(-0.5, Math.min(1, -inp.vy / 650)) * PTUNE.airStretch;
        this.sqv += (PTUNE.squashK * (sqT - this.sq) - PTUNE.squashC * this.sqv) * dt;
        this.sq += this.sqv * dt;
        this.sq = Math.max(-0.22, Math.min(0.40, this.sq));
        const leanT = Math.max(-PTUNE.leanMax, Math.min(PTUNE.leanMax, inp.vx * PTUNE.leanPerVx)) * (inp.grounded ? 1 : 0.5);
        this.leanv += (PTUNE.leanK * (leanT - this.lean) - PTUNE.leanC * this.leanv) * dt;
        this.lean += this.leanv * dt;
        const idle = Math.sin(this.t * 1.3) * PTUNE.blobIdle + Math.sin(this.t * 2.9 + 1) * PTUNE.blobIdle * 0.4;
        this.angv += (PTUNE.blobK * (idle + this.lean * PTUNE.blobLeanFollow - this.ang) - PTUNE.blobC * this.angv - ax * PTUNE.blobInertia * 10) * dt;
        this.ang += this.angv * dt;
        this.ang = Math.max(-0.7, Math.min(0.7, this.ang));
        const n = this.rest.length;
        for (let k = 0; k < n; k++) {
            const d = this.disp[k], v = this.dvel[k], f = this.flex[k];
            v.x += (-PTUNE.jellyK * d.x - PTUNE.jellyC * v.x - ax * PTUNE.inertia * f * 10) * dt;
            v.y += (-PTUNE.jellyK * d.y - PTUNE.jellyC * v.y - ay * PTUNE.inertia * f * 6) * dt;
            d.x += v.x * dt;
            d.y += v.y * dt;
            d.x = Math.max(-60, Math.min(60, d.x));
            d.y = Math.max(-60, Math.min(60, d.y));
        }
        this.turn += (inp.facing - this.turn) * Math.min(1, dt * PTUNE.turnRate);
        const md = MOODS[this.mood];
        const e = Math.min(1, dt * 12);
        this.lid.top += (md.lidTop - this.lid.top) * e;
        this.lid.tilt += (md.tilt - this.lid.tilt) * e;
        this.lid.bot += (md.lidBot - this.lid.bot) * e;
        this.lid.iris += (md.iris - this.lid.iris) * e;
        this.blinkT += dt;
        if (this.blinkT > this.nextBlink) {
            this.blinkT = 0;
            this.nextBlink = PTUNE.blinkMin + (PTUNE.blinkMax - PTUNE.blinkMin) * this.rnd();
            if (this.rnd() < 0.2)
                this.nextBlink = 0.22;
        }
        const bt = this.blinkT * 1000 / PTUNE.blinkMs;
        this.blink = bt < 1 ? Math.sin(bt * Math.PI) : 0;
        if (this.t > this.nextSaccade) {
            this.nextSaccade = this.t + 0.6 + this.rnd() * 1.8;
            this.lookT = { x: (this.rnd() * 2 - 1) * 0.7, y: (this.rnd() * 2 - 1) * 0.45 };
        }
        const lx = Math.abs(inp.vx) > 30 ? Math.sign(inp.vx) * inp.facing * 0.9 : this.lookT.x;
        const ly = !inp.grounded ? Math.max(-0.8, Math.min(0.8, inp.vy / 600)) : (Math.abs(inp.vx) > 30 ? 0.1 : this.lookT.y);
        const ls = Math.min(1, dt * 22);
        this.look.x += (lx - this.look.x) * ls;
        this.look.y += (ly - this.look.y) * ls;
        this.mouthPop = Math.max(0, this.mouthPop - dt * 1000 / PTUNE.mouthPopMs);
        const { w, h } = this.a.meta, cx = w / 2;
        const br = Math.sin(this.t * Math.PI * 2 * PTUNE.breathHz) * PTUNE.breath;
        const sy = 1 - this.sq + br, sx = 1 + this.sq * 0.85 - br * 0.7;
        const piv = { x: this.a.meta.blob.cx + 10, y: PTUNE.pivotY };
        for (let k = 0; k < n; k++) {
            const r = this.rest[k], d = this.disp[k];
            let x = r.x, y = r.y;
            const wb = smooth((PTUNE.pivotY + 90 - y) / 240);
            if (wb > 0) {
                const a = this.ang * wb, c = Math.cos(a), s = Math.sin(a);
                const dx = x - piv.x, dy = y - piv.y;
                x = piv.x + dx * c - dy * s;
                y = piv.y + dx * s + dy * c;
                y = piv.y + (y - piv.y) * (1 - this.sq * 0.6 * wb);
            }
            const kd = this.noDrips ? 0 : Math.max(0, (r.y - PTUNE.dripY) / (h - PTUNE.dripY));
            if (kd > 0) {
                const p = Math.pow(kd, 1.5);
                x += p * (Math.sin(this.t * 1.9 + r.x * 0.021) * PTUNE.dripSway + Math.sin(this.t * 3.3 + r.x * 0.05) * PTUNE.dripSway * 0.35);
                y += p * (Math.sin(this.t * 0.9 + r.x * 0.013) * 0.5 + 0.5) * PTUNE.dripOoze;
            }
            const by = this.baseY;
            x = cx + (x - cx) * sx;
            y = by + (y - by) * sy;
            x += this.lean * (by - r.y) * 0.75 * (1 - 0.35 * kd);
            x += Math.sin(this.t * 2.6 + r.y * 0.012) * 2.2 * (1 - r.y / h);
            this.def[k].x = x + d.x;
            this.def[k].y = y + d.y;
        }
    }
    warp(px, py) {
        const { w, h } = this.a.meta, C = PTUNE.cols, R = PTUNE.rows;
        const fx = Math.max(0, Math.min(C - 1e-6, px / w * C)), fy = Math.max(0, Math.min(R - 1e-6, py / h * R));
        const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
        const p = (ii, jj) => this.def[jj * (C + 1) + ii];
        const a = p(i, j), b = p(i + 1, j), c = p(i, j + 1), d = p(i + 1, j + 1);
        return { x: (a.x * (1 - u) + b.x * u) * (1 - v) + (c.x * (1 - u) + d.x * u) * v,
            y: (a.y * (1 - u) + b.y * u) * (1 - v) + (c.y * (1 - u) + d.y * u) * v };
    }
    local(px, py) {
        const e = 12, o = this.warp(px, py), ex = this.warp(px + e, py), ey = this.warp(px, py + e);
        const a = (ex.x - o.x) / e, b = (ex.y - o.y) / e, c = (ey.x - o.x) / e, d = (ey.y - o.y) / e;
        return [a, b, c, d, o.x - a * px - c * py, o.y - b * px - d * py];
    }
    /** Draw with the bottom-centre of the art at (x, groundY), scaled so the art is heightPx tall. */
    draw(ctx, x, groundY, heightPx) {
        const A = this.a, { w, h } = A.meta, S = heightPx / h;
        ctx.save();
        ctx.translate(x, groundY);
        const tf = Math.sign(this.turn || 1) * (0.8 + 0.2 * Math.abs(this.turn));
        ctx.scale(S * tf, S);
        ctx.translate(-w / 2, -h);
        const C = PTUNE.cols, R = PTUNE.rows, src = this.rest, dst = this.def;
        const at = (i, j) => j * (C + 1) + i;
        for (let j = 0; j < R; j++)
            for (let i = 0; i < C; i++) {
                const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
                tri(ctx, A.body, src[a], src[b], src[d], dst[a], dst[b], dst[d], 1.6 / S);
                tri(ctx, A.body, src[a], src[d], src[c], dst[a], dst[d], dst[c], 1.6 / S);
            }
        const col = A.meta.colors;
        A.meta.eyes.forEach((eye, idx) => {
            const L = this.local(eye.cx, eye.cy);
            ctx.save();
            ctx.transform(L[0], L[1], L[2], L[3], L[4], L[5]);
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(eye.cx, eye.cy, eye.rx - 3, eye.ry - 3, 0, 0, Math.PI * 2);
            ctx.clip();
            const free = { x: Math.max(4, eye.rx - eye.iris.r - 6), y: Math.max(4, eye.ry - eye.iris.r - 6) };
            const ix = eye.iris.cx + this.look.x * free.x * PTUNE.lookRange * 1.6 - (eye.iris.cx - eye.cx) * Math.abs(this.look.x) * 0.5;
            const iy = eye.iris.cy + this.look.y * free.y * PTUNE.lookRange * 1.6;
            const sc = this.lid.iris, p = eye.pupil;
            ctx.translate(ix, iy);
            ctx.scale(sc, sc);
            ctx.drawImage(A.iris[idx], p.x - eye.iris.cx, p.y - eye.iris.cy);
            ctx.restore();
            const inner = idx === 0 ? 1 : -1;
            const top = Math.max(this.lid.top, this.blink);
            const tilt = this.lid.tilt * (1 - this.blink);
            const bot = this.lid.bot * (1 - this.blink);
            drawLids(ctx, eye, top, tilt * inner, bot, col["yellow"] ?? "#f9ee56", col["purple"] ?? "#85358c");
            ctx.restore();
        });
        {
            const m = A.meta.mouth, img = A.mouths[this.mouth];
            const L = this.local(m.cx, m.cy);
            ctx.save();
            ctx.transform(L[0], L[1], L[2], L[3], L[4], L[5]);
            const mw = MOUTH_W[this.mouth], k = mw / img.width, mh = img.height * k;
            const pop = 1 + Math.sin(this.mouthPop * Math.PI) * 0.18;
            ctx.translate(m.cx, m.cy - m.h * 0.5);
            ctx.scale(2 - pop, pop);
            ctx.drawImage(img, -mw / 2, this.mouth === "smile" ? 0 : -mh * 0.12, mw, mh);
            ctx.restore();
        }
        ctx.restore();
    }
}
function smooth(u) { const v = Math.max(0, Math.min(1, u)); return v * v * (3 - 2 * v); }
function tri(ctx, img, s0, s1, s2, d0, d1, d2, pad) {
    const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
    const g = (p) => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + dx / l * pad, y: p.y + dy / l * pad }; };
    const e0 = g(d0), e1 = g(d1), e2 = g(d2);
    const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (Math.abs(den) < 1e-6)
        return;
    const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
    const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
    const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
    const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
    const e = d0.x - a * s0.x - c * s0.y, f = d0.y - b * s0.x - d * s0.y;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(e0.x, e0.y);
    ctx.lineTo(e1.x, e1.y);
    ctx.lineTo(e2.x, e2.y);
    ctx.closePath();
    ctx.clip();
    ctx.transform(a, b, c, d, e, f);
    const m = Math.ceil(pad * 3 + 4);
    const x0 = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)) - m), y0 = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)) - m);
    const x1 = Math.min(img.width, Math.ceil(Math.max(s0.x, s1.x, s2.x)) + m), y1 = Math.min(img.height, Math.ceil(Math.max(s0.y, s1.y, s2.y)) + m);
    if (x1 > x0 && y1 > y0)
        ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
}
function drawLids(ctx, e, top, tilt, bot, fill, line) {
    const { cx, cy, rx, ry } = e;
    const lw = 5.5;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx - 1, ry - 1, 0, 0, Math.PI * 2);
    ctx.clip();
    if (top > 0.02 || Math.abs(tilt) > 0.02) {
        const base = cy - ry + 2 * ry * Math.min(1, top);
        // tilt > 0 raises the +x side (sad/worried brows when +x is the nose side)
        const yR = base - tilt * ry * 0.8 * (1 - top * 0.5), yL = base + tilt * ry * 0.8 * (1 - top * 0.5);
        const xl = cx - rx - 4, xr = cx + rx + 4;
        const sag = ry * 0.22 * (1 - Math.min(1, top));
        ctx.beginPath();
        ctx.moveTo(xl, cy - ry - 10);
        ctx.lineTo(xl, yL);
        ctx.quadraticCurveTo(cx, (yL + yR) / 2 + sag, xr, yR);
        ctx.lineTo(xr, cy - ry - 10);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(xl, yL);
        ctx.quadraticCurveTo(cx, (yL + yR) / 2 + sag, xr, yR);
        ctx.strokeStyle = line;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.stroke();
    }
    if (bot > 0.02) {
        const yb = cy + ry - 2 * ry * bot;
        const bulge = ry * 0.30;
        ctx.beginPath();
        ctx.moveTo(cx - rx - 4, cy + ry + 10);
        ctx.lineTo(cx - rx - 4, yb + bulge * 0.6);
        ctx.quadraticCurveTo(cx, yb - bulge, cx + rx + 4, yb + bulge * 0.6);
        ctx.lineTo(cx + rx + 4, cy + ry + 10);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx - rx - 4, yb + bulge * 0.6);
        ctx.quadraticCurveTo(cx, yb - bulge, cx + rx + 4, yb + bulge * 0.6);
        ctx.strokeStyle = line;
        ctx.lineWidth = lw;
        ctx.stroke();
    }
    ctx.restore();
}
//# sourceMappingURL=puppet.js.map