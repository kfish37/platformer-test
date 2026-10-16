/**
 * Sloomoo with a simulated slime body.
 *
 * Head (magenta blob, yellow goo cap, eyes, mouth, freckles) = the novel art
 * as a cut-out puppet (puppet.ts, slimey_head.png). Body = a metaball slime:
 * belly + shoulders under the cap, a puddle that spreads on the floor and
 * smears behind him, goo drips on verlet chains that run down his sides into
 * the puddle, hang under him in the air, stick to the floor on takeoff and
 * can pinch off, plus a fading slime trail. The iso-contour is drawn in the
 * novel's flat style: blue fill, darker blue cel band, purple outline.
 *
 * Units: "art px" of Sloomoo_Slimey.png. Game px are converted with pxToArt.
 */
import { Puppet } from "./puppet.js";
export const BTUNE = {
    pxToArt: 7.7, // art px per game px (standing figure ~845 art = ~110 px)
    headBaseY: 545, // art y of the head/cap reference point (x = art centre)
    restH: 285, // head base above the floor when settled
    runH: 270, riseH: 390, fallH: 340,
    hK: 150, hC: 10, landSquash: 0.60, takeoffKick: 0.22,
    headK: 160, headC: 12, headInertia: 0.030, headMax: 120,
    bellyK: 60, bellyC: 5.5, bellyInertia: 0.075, bellyMax: 190,
    bellyRx: 305, bellyDy: 0.32, bellyRyK: 0.50,
    shoulderRx: 225, shoulderRy: 70, shoulderDy: 45,
    puddleW: 360, puddleH: 34, puddleFollow: 8, splat: 0.35,
    trailEvery: 55, trailLife: 0.85, trailR: 58, trailMinV: 500,
    lumps: 4, lumpR: 48, lumpWob: 14,
    strandMax: 85,
    drips: 5, dripPts: 6, seg0: 17, dripG: 6500, dripInertia: 0.35, dripDamp: 4, dripMaxSeg: 46,
    iso: 0.226, kr: 1.6, cellPx: 1.7,
    ow: 6.5, shadeDx: 20, shadeDy: -16,
    blue: "#56a9dd", blueS: "#5b99d0", line: "#85358c", fold: "rgba(70,120,190,0.55)",
};
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export class SlimeSloomoo {
    puppet;
    P = { x: 0, y: 0 };
    h = BTUNE.restH;
    hv = 0;
    hx = 0;
    hxv = 0; // head offset (art) from feet
    bx = 0;
    bxv = 0; // belly offset
    F = 0;
    W = BTUNE.puddleW;
    Wv = 0;
    c = 1; // floor contact 0..1
    floor = 0;
    grounded = true;
    pvx = 0;
    pvy = 0;
    drips = [];
    drops = [];
    trail = [];
    trailAcc = 0;
    t = 0;
    init = false;
    rnd = rng(11);
    lumpPh = [];
    runs = [{ side: 1, u: 0.3, wait: 0, sp: 0.4 }, { side: -1, u: 0.75, wait: 0, sp: 0.33 }, { side: 1, u: 0, wait: 1.6, sp: 0.36 }, { side: -1, u: 0, wait: 2.5, sp: 0.42 }];
    balls = [];
    constructor(a) {
        this.puppet = new Puppet(a, { baseY: BTUNE.headBaseY, noDrips: true });
        const gA = [1.20, 1.38, 1.94, 1.76, 1.55], aA = [0.95, 1.30, 1.85, 2.20, 1.58];
        for (let i = 0; i < BTUNE.drips; i++) {
            const pts = [];
            for (let k = 0; k < BTUNE.dripPts; k++)
                pts.push({ x: 0, y: 0, px: 0, py: 0, stick: 0, sx: 0, sy: 0 });
            this.drips.push({ gAng: gA[i % 5], aAng: aA[i % 5], pts, seg: BTUNE.seg0, ph: this.rnd() * 6.28, rate: 0.7 + this.rnd() * 0.6 });
        }
        for (let i = 0; i < BTUNE.lumps; i++)
            this.lumpPh.push(this.rnd() * 6.28);
    }
    setMood(m) { this.puppet.setMood(m); }
    bellyGeom() {
        const T = BTUNE, h = this.h;
        const ry = h * T.bellyRyK, rx = T.bellyRx * Math.pow(T.restH / h, 0.35);
        return { bx: this.P.x + this.bx, by: this.P.y - h + h * T.bellyDy, rx, ry };
    }
    update(inp) {
        const T = BTUNE, dt = Math.min(0.05, inp.dt);
        if (dt <= 0)
            return;
        this.t += dt;
        const k = T.pxToArt;
        const Px = inp.x * k, Py = inp.y * k, vx = inp.vx * k, vy = inp.vy * k;
        if (inp.grounded)
            this.floor = Py;
        else if (inp.floorY !== undefined)
            this.floor = inp.floorY * k;
        if (!this.init) {
            this.init = true;
            this.P = { x: Px, y: Py };
            this.F = Px;
            this.floor = inp.floorY !== undefined ? inp.floorY * k : Py;
            this.pvx = vx;
            this.pvy = vy;
            this.grounded = inp.grounded;
            this.c = inp.grounded ? 1 : 0;
            const g = this.bellyGeom();
            for (const d of this.drips) {
                const ax = g.bx - Px + Math.cos(d.gAng) * g.rx * 0.85, ay = g.by - Py + Math.sin(d.gAng) * g.ry * 0.85;
                d.pts.forEach((p, i) => { p.x = p.px = ax; p.y = p.py = Math.min(this.floor - Py - 8, ay + i * d.seg); });
            }
        }
        const ax = Math.max(-9000 * k, Math.min(9000 * k, (vx - this.pvx) / dt));
        const landed = inp.grounded && !this.grounded, tookOff = !inp.grounded && this.grounded;
        this.P = { x: Px, y: Py };
        // body height spring
        let hT = inp.grounded ? T.restH + (T.runH - T.restH) * Math.min(1, Math.abs(vx) / (260 * k)) : (vy < 0 ? T.riseH : T.fallH);
        hT += Math.sin(this.t * 2.6) * 6;
        if (landed) {
            this.hv -= Math.min(1.4, Math.abs(this.pvy) / (900 * k)) * T.restH * T.landSquash * 9;
            this.Wv += Math.abs(this.pvy) * T.splat;
        }
        if (tookOff)
            this.hv += Math.abs(vy) * T.takeoffKick;
        this.hv += (T.hK * (hT - this.h) - T.hC * this.hv) * dt;
        this.h += this.hv * dt;
        this.h = Math.max(150, Math.min(470, this.h));
        // head and belly lag
        this.hxv += (-T.headK * this.hx - T.headC * this.hxv - ax * T.headInertia) * dt;
        this.hx += this.hxv * dt;
        this.hx = Math.max(-T.headMax, Math.min(T.headMax, this.hx));
        this.bxv += (-T.bellyK * this.bx - T.bellyC * this.bxv - ax * T.bellyInertia) * dt;
        this.bx += this.bxv * dt;
        this.bx = Math.max(-T.bellyMax, Math.min(T.bellyMax, this.bx));
        // floor contact and puddle
        this.c += ((inp.grounded ? 1 : 0) - this.c) * Math.min(1, dt * (inp.grounded ? 22 : 12));
        this.F += (Px - this.F) * Math.min(1, dt * T.puddleFollow);
        if (!inp.grounded)
            this.F += (Px - this.F) * Math.min(1, dt * 6);
        const WT = T.puddleW + Math.abs(Px - this.F) * 0.25 + Math.sin(this.t * 1.7) * 10;
        this.Wv += (90 * (WT - this.W) - 9 * this.Wv) * dt;
        this.W += this.Wv * dt;
        this.W = Math.max(200, Math.min(720, this.W));
        // goo sliding down his sides into the puddle
        for (const r of this.runs) {
            if (r.wait > 0) {
                r.wait -= dt;
                continue;
            }
            r.u += dt * r.sp * (0.35 + 1.3 * r.u) * (inp.grounded ? 1 : 0.3);
            if (r.u >= 1) {
                r.u = 0;
                r.wait = 0.6 + this.rnd() * 2.2;
                r.sp = 0.3 + this.rnd() * 0.18;
            }
        }
        // trail
        if (inp.grounded && Math.abs(vx) > T.trailMinV) {
            this.trailAcc += Math.abs(vx) * dt;
            while (this.trailAcc > T.trailEvery) {
                this.trailAcc -= T.trailEvery;
                this.trail.push({ x: this.F - Math.sign(vx) * this.W * 0.55, y: this.floor - 14, life: 1, r: T.trailR * (0.8 + this.rnd() * 0.4) });
            }
        }
        for (const tr of this.trail)
            tr.life -= dt / T.trailLife;
        this.trail = this.trail.filter(tr => tr.life > 0);
        // drips: simulated relative to the body so they always hang, with a bit of inertia
        const g = this.bellyGeom();
        const ay = Math.max(-20000, Math.min(20000, (vy - this.pvy) / dt));
        const fx = -ax * T.dripInertia, fy = T.dripG - ay * T.dripInertia;
        const relFloor = this.floor - Py;
        for (const d of this.drips) {
            const segT = inp.grounded ? T.seg0 * (0.85 + 0.3 * Math.sin(this.t * d.rate + d.ph)) : Math.min(T.dripMaxSeg, d.seg + dt * 140 * d.rate);
            d.seg += (segT - d.seg) * Math.min(1, dt * (inp.grounded ? 3 : 6));
            const ang = d.aAng + (d.gAng - d.aAng) * this.c + Math.sin(this.t * 0.9 * d.rate + d.ph) * 0.06;
            const a0 = d.pts[0];
            a0.x = g.bx - Px + Math.cos(ang) * g.rx * 0.90;
            a0.y = g.by - Py + Math.sin(ang) * g.ry * 0.90;
            a0.px = a0.x;
            a0.py = a0.y;
            if (tookOff)
                for (const p of d.pts)
                    if (p.y > relFloor - 30) {
                        p.stick = 0.16;
                        p.sx = p.x + Px;
                        p.sy = p.y + Py;
                    }
            const damp = Math.max(0, 1 - T.dripDamp * dt);
            for (let i = 1; i < d.pts.length; i++) {
                const p = d.pts[i];
                if (p.stick > 0) {
                    p.stick -= dt;
                    p.x = p.px = p.sx - Px;
                    p.y = p.py = p.sy - Py;
                    continue;
                }
                let vxp = (p.x - p.px) * damp, vyp = (p.y - p.py) * damp;
                const vm = Math.hypot(vxp, vyp), vcap = 2600 * dt;
                if (vm > vcap) {
                    vxp *= vcap / vm;
                    vyp *= vcap / vm;
                }
                p.px = p.x;
                p.py = p.y;
                p.x += vxp + fx * dt * dt;
                p.y += vyp + fy * dt * dt;
            }
            for (let it = 0; it < 4; it++) {
                for (let i = 1; i < d.pts.length; i++) {
                    const a = d.pts[i - 1], b = d.pts[i];
                    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1e-6;
                    const maxL = b.stick > 0 ? T.strandMax : d.seg;
                    if (L > maxL) {
                        if (b.stick > 0) {
                            b.stick = 0;
                            b.px = b.x;
                            b.py = b.y;
                            continue;
                        }
                        const f = (L - maxL) / L;
                        if (i === 1) {
                            b.x -= dx * f;
                            b.y -= dy * f;
                        }
                        else {
                            a.x += dx * f * 0.5;
                            a.y += dy * f * 0.5;
                            b.x -= dx * f * 0.5;
                            b.y -= dy * f * 0.5;
                        }
                    }
                }
                if (this.c > 0.5)
                    for (let i = 1; i < d.pts.length; i++) {
                        const p = d.pts[i];
                        if (p.y > relFloor - 10) {
                            p.y = relFloor - 10;
                            p.px += (p.x - p.px) * 0.6;
                        }
                    }
            }
            if (!inp.grounded && d.seg > T.dripMaxSeg * 0.97 && this.rnd() < dt * 1.5) {
                const tip = d.pts[d.pts.length - 1];
                this.drops.push({ x: tip.x + Px, y: tip.y + Py + 10, vx: vx + (tip.x - tip.px) / dt, vy: vy + (tip.y - tip.py) / dt, life: 1, r: 26, flat: 0 });
                d.seg = T.seg0;
            }
        }
        // droplets
        for (const dr of this.drops) {
            if (dr.flat > 0) {
                dr.life -= dt / 0.9;
                continue;
            }
            dr.vy += 14000 * dt;
            dr.x += dr.vx * dt;
            dr.y += dr.vy * dt;
            if (dr.y > this.floor - 8) {
                dr.y = this.floor - 8;
                dr.flat = 1;
            }
            dr.life -= dt / 2.5;
        }
        this.drops = this.drops.filter(dr => dr.life > 0);
        this.pvx = vx;
        this.pvy = vy;
        this.grounded = inp.grounded;
        this.puppet.update({ vx: inp.vx, vy: inp.vy, grounded: inp.grounded, facing: inp.facing, dt, timeMs: inp.timeMs });
        this.buildBalls();
    }
    buildBalls() {
        const T = BTUNE, B = [], kr = T.kr;
        const add = (x, y, rx, ry, w = 1) => { if (w > 0.01)
            B.push({ x, y, rx: rx * kr, ry: ry * kr, w }); };
        const P = this.P, h = this.h, g = this.bellyGeom();
        const Hx = P.x + this.hx, Hy = P.y - h;
        // shoulders hidden under the cap
        add(Hx, Hy + T.shoulderDy, T.shoulderRx, T.shoulderRy);
        // belly: a wide dome
        add(g.bx, g.by, g.rx, g.ry);
        // small wobbling lumps on the upper sides so the outline isn't a perfect ellipse
        for (let i = 0; i < T.lumps; i++) {
            const side = i % 2 ? 1 : -1, k2 = Math.floor(i / 2);
            const a = (side > 0 ? 0 : Math.PI) + side * (-0.25 + 0.55 * k2) + Math.sin(this.t * 0.7 + this.lumpPh[i]) * 0.10;
            const rr = T.lumpR + Math.sin(this.t * 1.3 + this.lumpPh[i] * 2) * T.lumpWob;
            add(g.bx + Math.cos(a) * g.rx * 0.80, g.by + Math.sin(a) * g.ry * 0.80, rr, rr, 0.8);
        }
        const c = this.c;
        for (const r of this.runs) {
            if (r.wait > 0)
                continue;
            const u = r.u, e = u * u * (3 - 2 * u);
            const yb = g.by + 0.15 * g.ry, y1 = this.grounded ? this.floor - 30 : g.by + g.ry * 0.85 + (this.floor - 30 - g.by - g.ry * 0.85) * c * c;
            const x = g.bx + r.side * g.rx * (0.95 - 0.10 * e), y = yb + (y1 - yb) * e;
            const rr = 26 + 16 * u;
            add(x, y, rr * (1 + 0.25 * u), rr * (1.25 - 0.3 * u), Math.min(1, u * 6) * (0.4 + 0.6 * c));
            // thin streak connecting it back up to the body
            add(x - r.side * 6, (yb + y) / 2, 16, Math.max(16, (y - yb) / 2), Math.min(1, u * 6) * 0.7);
        }
        if (c > 0.02) {
            // puddle: spreads between where he is and where his bottom is dragging
            const cx = (this.F + P.x) / 2, span = this.W + Math.abs(P.x - this.F) * 0.5;
            // in the air the puddle gathers back up under the belly
            const lift = this.grounded ? 0 : 1 - c;
            const fy0 = this.floor + (g.by + g.ry * 0.7 - this.floor) * lift;
            const sp = span * (1 - 0.6 * lift);
            for (let i = 0; i < 5; i++) {
                const u = (i - 2) / 2;
                add(cx + u * sp * 0.62, fy0 - T.puddleH * 0.45, sp * 0.34, T.puddleH * (1.0 - 0.25 * Math.abs(u)), c);
            }
            // the neck where the belly sags into the puddle
            add((g.bx * 0.6 + cx * 0.4), fy0 - 60 * c, g.rx * 0.72, 70, c);
        }
        else {
            add(g.bx, g.by + g.ry * 0.55, g.rx * 0.7, g.ry * 0.45);
        }
        // drips
        for (const d of this.drips) {
            const n = d.pts.length;
            for (let i = 0; i < n - 1; i++) {
                const a = d.pts[i], b = d.pts[i + 1];
                const u0 = i / (n - 1), u1 = (i + 1) / (n - 1);
                const r = (u) => 30 - 15 * Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5) + 13 * Math.max(0, (u - 0.75) / 0.25);
                for (let s = 0; s < 3; s++) {
                    const v = s / 3, u = u0 + (u1 - u0) * v;
                    add(P.x + a.x + (b.x - a.x) * v, P.y + a.y + (b.y - a.y) * v, r(u), r(u), 0.8);
                }
            }
            const tip = d.pts[n - 1];
            add(P.x + tip.x, P.y + tip.y, r1(), r1());
        }
        for (const dr of this.drops) {
            const fl = dr.flat > 0 ? dr.life : 1;
            add(dr.x, dr.y, dr.r * (dr.flat > 0 ? 1.8 : 0.85), dr.r * (dr.flat > 0 ? 0.45 : 1.15), Math.min(1, fl * 1.5));
        }
        for (const tr of this.trail)
            add(tr.x, tr.y, tr.r * (0.6 + 0.4 * tr.life), tr.r * 0.45 * tr.life + 4, Math.min(1, tr.life * 1.6));
        this.balls = B;
        function r1() { return 25; }
    }
    /** Draw with the feet at screen (sx, sy); S = screen px per art px. */
    draw(ctx, sx, sy, S) {
        const T = BTUNE, P = this.P;
        if (!this.balls.length)
            return;
        const toX = (x) => sx + (x - P.x) * S, toY = (y) => sy + (y - P.y) * S;
        // ---- field on a grid
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const b of this.balls) {
            x0 = Math.min(x0, b.x - b.rx);
            x1 = Math.max(x1, b.x + b.rx);
            y0 = Math.min(y0, b.y - b.ry);
            y1 = Math.max(y1, b.y + b.ry);
        }
        const cs = Math.max(4, T.cellPx / S);
        const contact = this.grounded;
        // align a grid row with the floor so the contact edge is perfectly flat
        y0 = this.floor - Math.ceil((this.floor - y0) / cs) * cs;
        const nx = Math.ceil((x1 - x0) / cs) + 2, ny = Math.ceil((y1 - y0) / cs) + 2;
        const f = new Float32Array(nx * ny);
        for (const b of this.balls) {
            const i0 = Math.max(0, Math.floor((b.x - b.rx - x0) / cs)), i1 = Math.min(nx - 1, Math.ceil((b.x + b.rx - x0) / cs));
            const j0 = Math.max(0, Math.floor((b.y - b.ry - y0) / cs)), j1 = Math.min(ny - 1, Math.ceil((b.y + b.ry - y0) / cs));
            const irx = 1 / b.rx, iry = 1 / b.ry;
            for (let j = j0; j <= j1; j++) {
                const dy = (y0 + j * cs - b.y) * iry, dy2 = dy * dy;
                if (dy2 >= 1)
                    continue;
                const row = j * nx;
                for (let i = i0; i <= i1; i++) {
                    const dx = (x0 + i * cs - b.x) * irx, d2 = dx * dx + dy2;
                    if (d2 < 1) {
                        const q = 1 - d2;
                        f[row + i] += b.w * q * q * q;
                    }
                }
            }
        }
        const iso = T.iso;
        if (contact) {
            const jf = Math.round((this.floor - y0) / cs);
            for (let j = Math.max(0, jf); j < ny; j++)
                for (let i = 0; i < nx; i++) {
                    const v = f[j * nx + i];
                    f[j * nx + i] = j === jf ? (v >= iso ? iso : v) : 0;
                }
        }
        // ---- marching squares -> loops
        const loops = march(f, nx, ny, iso);
        const path = new Path2D();
        for (const L of loops) {
            if (L.length < 3)
                continue;
            const pt = (q) => [toX(x0 + q[0] * cs), toY(y0 + q[1] * cs)];
            const pts = L.map(pt);
            const n = pts.length;
            let m = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
            path.moveTo(m[0], m[1]);
            for (let i = 0; i < n; i++) {
                const a = pts[i], b = pts[(i + 1) % n];
                m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
                path.quadraticCurveTo(a[0], a[1], m[0], m[1]);
            }
            path.closePath();
        }
        ctx.save();
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.fillStyle = T.blueS;
        ctx.fill(path, "evenodd");
        ctx.save();
        ctx.clip(path, "evenodd");
        ctx.translate(T.shadeDx * S * -this.puppetFacing(), T.shadeDy * S);
        ctx.fillStyle = T.blue;
        ctx.fill(path, "evenodd");
        ctx.restore();
        // a couple of soft fold lines like the novel art (belly rim)
        ctx.save();
        ctx.clip(path, "evenodd");
        const g = this.bellyGeom();
        ctx.strokeStyle = T.fold;
        ctx.lineWidth = Math.max(0.7, 5 * S);
        ctx.beginPath();
        ctx.ellipse(toX(g.bx), toY(g.by + g.ry * 0.15), g.rx * 0.78 * S, g.ry * 0.62 * S, 0, 0.22 * Math.PI, 0.42 * Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(toX(g.bx), toY(g.by + g.ry * 0.15), g.rx * 0.78 * S, g.ry * 0.62 * S, 0, 0.62 * Math.PI, 0.74 * Math.PI);
        ctx.stroke();
        ctx.restore();
        ctx.strokeStyle = T.line;
        ctx.lineWidth = Math.max(0.9, T.ow * S);
        ctx.stroke(path);
        ctx.restore();
        // ---- goo running down the body when he's sitting on the floor
        // ---- head art on top
        const Hx = toX(P.x + this.hx), Hy = toY(P.y - this.h);
        const A = this.puppet.a.meta;
        this.puppet.draw(ctx, Hx, Hy + (A.h - T.headBaseY) * S, A.h * S);
    }
    puppetFacing() { return 1; }
}
/** Marching squares on a scalar grid; returns closed loops in grid coordinates. */
export function march(f, nx, ny, iso) {
    const W1 = nx;
    const eid = (i, j, v) => ((j * W1 + i) << 1) | v;
    const pos = new Map();
    const adj = new Map();
    const val = (i, j) => f[j * nx + i];
    const ep = (i, j, v) => {
        const id = eid(i, j, v);
        if (!pos.has(id)) {
            const a = val(i, j), b = v === 0 ? val(i + 1, j) : val(i, j + 1);
            const t = Math.abs(b - a) < 1e-9 ? 0.5 : (iso - a) / (b - a);
            pos.set(id, v === 0 ? [i + t, j] : [i, j + t]);
        }
        return id;
    };
    const link = (a, b) => {
        (adj.get(a) ?? adj.set(a, []).get(a)).push(b);
        (adj.get(b) ?? adj.set(b, []).get(b)).push(a);
    };
    for (let j = 0; j < ny - 1; j++)
        for (let i = 0; i < nx - 1; i++) {
            const a = val(i, j) >= iso ? 1 : 0, b = val(i + 1, j) >= iso ? 1 : 0, c = val(i + 1, j + 1) >= iso ? 1 : 0, d = val(i, j + 1) >= iso ? 1 : 0;
            const code = a | (b << 1) | (c << 2) | (d << 3);
            if (code === 0 || code === 15)
                continue;
            const T = () => ep(i, j, 0), R = () => ep(i + 1, j, 1), Bm = () => ep(i, j + 1, 0), L = () => ep(i, j, 1);
            switch (code) {
                case 1:
                case 14:
                    link(L(), T());
                    break;
                case 2:
                case 13:
                    link(T(), R());
                    break;
                case 3:
                case 12:
                    link(L(), R());
                    break;
                case 4:
                case 11:
                    link(R(), Bm());
                    break;
                case 6:
                case 9:
                    link(T(), Bm());
                    break;
                case 7:
                case 8:
                    link(L(), Bm());
                    break;
                case 5:
                case 10: {
                    const ctr = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 >= iso ? 1 : 0;
                    if ((code === 5) === (ctr === 1)) {
                        link(L(), Bm());
                        link(T(), R());
                    }
                    else {
                        link(L(), T());
                        link(R(), Bm());
                    }
                    break;
                }
            }
        }
    const seen = new Set(), loops = [];
    for (const start of adj.keys()) {
        if (seen.has(start))
            continue;
        const loop = [];
        let prev = -1, cur = start;
        while (cur !== undefined && !seen.has(cur)) {
            seen.add(cur);
            loop.push(pos.get(cur));
            const nb = adj.get(cur);
            const nxt = nb[0] !== prev ? nb[0] : nb[1];
            prev = cur;
            cur = nxt;
        }
        loops.push(loop);
    }
    return loops;
}
//# sourceMappingURL=slimebody.js.map