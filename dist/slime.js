/**
 * Soft-body Sloomoo.
 *
 * The body is a ring of points that spring toward a droplet rest shape,
 * kept inflated by area pressure, squashed by the ground and walls and
 * thrown around by the player's acceleration. The snoozle is a verlet rope
 * that wants to stand up but trails and overshoots with motion. Drips are
 * floppy springs that puddle on the ground and can snap off as droplets.
 * Visual style (palette, cel shade, rim light, face) follows sloomoo.ts.
 *
 * All knobs are in TUNE below.
 */
import { SL } from "./sloomoo.js";
import { spawnDrop, spawnRing, spawnSpark, spawnSplat, spawnTrail, spawnWallSplat } from "./particles.js";
export const TUNE = {
    points: 36,
    bodyWFrac: 1.50, // body width vs player hitbox width (drawn bigger than the hitbox)
    bodyHFrac: 1.50, // body height vs player hitbox height
    topNarrow: 0.70, // width at the top vs widest point
    stiffness: 240, // spring toward rest shape (1/s²)
    damping: 10, // velocity damping (1/s) (13 -> 10 in the slimey pass: more jiggle)
    pressure: 2600, // area restoring force (px/s² at 100% area loss)
    inertia: 0.40, // fraction of a velocity change that lags into the body
    inertiaClamp: 700, // max velocity change considered per frame (px/s)
    runLean: 0.12, // how much the top leans INTO the run per px/s of speed (x100)
    runBounce: 0.10, // squash/stretch amplitude of the run hop
    runElong: 0.28, // Rushed-style horizontal streamer at full run speed (x body width)
    dashElong: 0.80, // streamer length while dashing
    airElong: 0.18, // streamer from horizontal air speed
    airStretch: 0.30, // vertical stretch at full jump speed
    landSquash: 0.30, // extra squash on a hard landing (fraction)
    landMs: 260, // landing squash duration (with one rebound)
    wallFlatten: 0.70, // body half-width allowed on the wall side
    // snoozle
    ropeSegs: 8,
    ropeSegFrac: 0.072, // segment length vs hitbox height
    ropeStiffness: 0.24, // bend stiffness toward "up" (0..1 per substep)
    ropeGravity: 250,
    ropeDamping: 0.985,
    bulbFrac: 0.190,
    ropeStretch: 0.85, // snoozle segments lengthen by this much at high speed (goo stretch)
    capDepth: 0.40, // yellow goo cap: how far down the head it drapes (fraction of body height)
    eyeFrac: 0.215, // eye radius vs min(body w, h)
    outlineW: 1.3,
    ropeTrail: 1.15, // stalk sweep-back angle (rad) at full run speed
    ropeTrailV: 0.45, // extra sweep from vertical speed (rad at 650 px/s)
    ropeCarry: 0.55, // how much of the head's motion the stalk follows rigidly (0 = pure rope)
    // drips
    dripStiffness: 90,
    dripDamping: 7,
    dripInertia: 0.28,
    dripGravity: 160,
    dripSnapLen: 2.4, // multiple of rest length at which a drip snaps off
    // slimey pass (2026-10-02)
    jiggle: 0.018, // idle surface ripple (fraction of body height)
    gloss: 1, // wet specular streaks + rim + cap shine (0 = off)
    bubbles: 4, // bubbles drifting up inside the jelly
    puddle: 1, // goo foot spreading on the ground while grounded (0 = off)
    trailMs: 45, // slime smear on the floor every N ms while running (0 = off)
    // turning pass (2026-10-04): face swings to the side he moves toward (Rushed 3/4 view)
    turnRate: 13, // how fast the face swings round on a direction change (1/s)
    profileIdle: 0.35, // standing: how far the face sits toward the facing side (0 = straight on, 1 = side)
    profileRun: 1.0, // running / dashing / air-moving: full 3/4 view, eyes up front
    runTailY: 0.40, // grounded streamer height (fraction of body height above the floor)
    tailPow: 2.0, // >1 = only the very back pours out (round head + thin neck, Rushed); 1 = wedge
    tailWave: 0.16, // travelling wave amplitude down the streamer (x body height)
    tailNeck: 0.35, // 0 = old taper from the front; ~0.4 = head stays round, then pinches into a thin tail
    strandSnap: 1.6, // goo strands to ground/wall on takeoff snap at this x hitbox height
    strandMs: 260, // ...or after this long
    // fluid pass (2026-10-16): pressure-body "sludge" model after Slime Sandbox. Ring held by neighbour springs +
    // internal pressure + gravity, only weakly pulled to the droplet shape. fluid=0 (or ?fluid=0) = old jelly model.
    fluid: 1,
    goo: 1, // goop look (after Slime Sandbox goop): gel body, glowing translucent rim, extra drips, wide puddle (?goo=0 = off)
    gooRim: 7, // width of the translucent rim glow (px at hitbox scale)
    fluidMaxDev: 0.38, // max distance of a point from its target, x body height
    fluidShape: 95, // weak pull toward the droplet shape (1/s2); old model used stiffness (240)
    fluidEdge: 1800, // neighbour spring along the outline (1/s2)
    fluidEdgeDamp: 14, // damping of relative motion between neighbours (1/s)
    fluidGravity: 420, // sag (px/s2), full on the ground, 15% in the air
    fluidPressure: 1.6, // multiplier on pressure
    fluidDamping: 6, // velocity damping (lower = sloshier)
    fluidInertia: 0.45, // fraction of a velocity change that lags into the body (old: inertia)
    fluidFloorSlide: 0.975, // horizontal velocity kept per substep on the floor (old: 0.92)
    // squish pass (2026-10-28, Fish: "how his body reacts to movement" + green WALK slime ref): low wide mound,
    // flat base planted on the floor, top wobbles, creeping crawl (front pushes, rear catches up), rounds into a
    // blob in the air, pancakes on landing, presses flat on walls. No drips/bubbles/heavy gloss/dash shards.
    // squish=0 (or ?squish=0) = previous behaviour (droplet body + goo look).
    squish: 1,
    squishW: 1.95, // mound width vs hitbox width (drawn wider than the 28 px box)
    squishH: 1.02, // mound height vs hitbox height (lower than the old 1.5)
    squishFlat: 0.22, // bottom curve exponent (smaller = flatter, wider contact patch)
    squishShape: 150, // shape pull toward the mound/blob target (1/s2); stiffer than fluidShape so poses read
    crawlLen: 85, // px of travel per crawl cycle (front pushes forward, rear catches up); ~3.7 Hz at full run, slow enough for the body to follow
    crawlAmp: 0.55, // crawl stretch amplitude (fraction of body width) at full run speed
    crawlHump: 0.12, // top bulk rolls forward during the catch-up half (x body half-width)
    rearDrag: 0.03, // running: rear sits a little lower and trails (x body height); keep small (wedge!)
    airRound: 0.80, // how far the mound rounds into a blob in the air (0 = stays a mound, 1 = round)
    fallTaper: 0.22, // falling: top narrows into a soft teardrop
    takeoffStretch: 0.42, // vertical stretch at full jump speed (base releases the floor)
    landSpread: 0.45, // pancake squash on a hard landing (fraction, scaled by impact speed)
    wallBulge: 0.3, // wall slide: body bulges away from the wall (x body half-width)
    dashStretch: 0.45, // dash: clean stretch along the dash direction
    dashTrail: 0.04, // dash: extra drag on the rear (x body half-width)
    stickyBase: 0.88, // horizontal velocity kept per substep by points touching the floor (lower = stickier)
    squishDamp: 7, // velocity damping of the squish body (fluidDamping is 6); 8 let a hard landing ring into a flat disc
    squishEdgeDamp: 9, // neighbour damping in squish mode (fluidEdgeDamp is 14)
    landKick: 0.5, // share of the landing velocity snap that goes into the body (pancake comes from landSpread)
    mouthScale: 0.72, // squish: mouth size vs the old face (old grin was oversized on the wide body)
    shine: 1, // one small wet highlight (0 = off)
};
if (typeof location !== "undefined") {
    const qs = new URLSearchParams(location.search);
    const q = qs.get("fluid"), qg = qs.get("goo");
    if (q !== null)
        TUNE.fluid = Number(q) ? 1 : 0;
    if (qg !== null)
        TUNE.goo = Number(qg) ? 1 : 0;
    const qsq = qs.get("squish");
    if (qsq !== null)
        TUNE.squish = Number(qsq) ? 1 : 0;
}
/** Body size vs hitbox: the squish mound is wider and lower than the old droplet. */
const BW = () => TUNE.squish ? TUNE.squishW : TUNE.bodyWFrac;
const BH = () => TUNE.squish ? TUNE.squishH : TUNE.bodyHFrac;
const sim = {
    init: false, strands: [], trailMs: 0, prevWallSliding: false, prevWallSide: 0, w: 0, h: 0, rest: [], edge: [], pos: [], vel: [], restArea: 1,
    rope: [], ropePrev: [], drips: [],
    prevVx: 0, prevVy: 0, prevX: 0, prevY: 0, prevGrounded: false, airMaxVy: 0,
    runDist: 0, squintMs: 0, wallFxMs: 0, runFxMs: 0, lastMs: 0, landMs: 0, landK: 0, elong: 0, elongDir: 1, prevDashing: false,
    turn: 1, prof: 0,
    sqAir: 0, sqRun: 0, sqPhase: 0, sqWall: 0, sqWallSide: 1, sqDash: 0, sqDir: 1, sqSx: 1, sqSy: 1,
};
// ------------------------------------------------------------------ setup
/** Squish shape: point i of a low wide mound (air = 0) morphing into a rounder blob (air = 1).
 *  W = half width, H = full height; local coords, y = 0 is the floor, 0 = top, clockwise. */
function moundPoint(i, n, W, H, air, fallK) {
    const th = (i / n) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const xs = Math.sign(s) * Math.pow(Math.abs(s), 0.8); // full, slightly boxy sides
    const mx = W * xs * (1 - 0.16 * Math.max(0, c));
    const my = c >= 0 ? -H * 0.42 - H * 0.58 * Math.pow(c, 0.9) // dome
        : -H * 0.42 + H * 0.42 * Math.pow(-c, TUNE.squishFlat); // flat base
    const bx = W * 0.88 * s * (1 - TUNE.fallTaper * fallK * Math.max(0, c));
    const by = -H * 0.54 - H * 0.54 * c;
    return { x: mx + (bx - mx) * air, y: my + (by - my) * air };
}
/** Per-frame target outline for the squish body (constant over the substeps). */
function squishTargets(inp, dt) {
    const n = TUNE.points, rect = inp.rect;
    const W = rect.w * BW() / 2, H = rect.h * BH();
    const t = inp.timeMs;
    const ez = (cur, tg, rate) => cur + (tg - cur) * Math.min(1, dt * rate);
    const wall = inp.wallSliding && inp.wallSide !== 0;
    // base releases the floor quickly on takeoff and re-plants at once on landing
    const airT = inp.grounded ? 0 : wall ? 0.5 : TUNE.airRound;
    sim.sqAir = ez(sim.sqAir, airT, inp.grounded ? 18 : 8);
    const speed = Math.abs(inp.vx);
    const spK = inp.grounded && !inp.dashing ? Math.min(1, speed / 220) : 0;
    sim.sqRun = ez(sim.sqRun, spK, spK > sim.sqRun ? 6 : 5);
    if (inp.grounded)
        sim.sqPhase += speed * dt / TUNE.crawlLen * Math.PI * 2;
    sim.sqWall = ez(sim.sqWall, wall ? 1 : 0, wall ? 14 : 9);
    if (wall)
        sim.sqWallSide = inp.wallSide;
    sim.sqDash = ez(sim.sqDash, inp.dashing ? 1 : 0, inp.dashing ? 22 : 9);
    if (speed > 30)
        sim.sqDir = inp.vx > 0 ? 1 : -1;
    else if (speed < 5 && sim.sqRun < 0.05)
        sim.sqDir = inp.facing;
    const dir = sim.sqDir;
    let sx = 1, sy = 1;
    // breathing: top rises and falls, base stays planted
    const breath = inp.grounded ? Math.sin(t / 650) * 0.035 * (1 - sim.sqRun) : 0;
    sy += breath;
    sx -= breath * 0.7;
    if (!inp.grounded && !wall && !inp.dashing) {
        const k = Math.max(-1, Math.min(1, -inp.vy / 650));
        if (k > 0) {
            const st = TUNE.takeoffStretch * k;
            sy *= 1 + st;
            sx /= Math.sqrt(1 + st * 1.4);
        }
        else {
            const st = 0.10 * -k;
            sy *= 1 + st;
            sx /= 1 + st * 0.6;
        }
    }
    if (sim.landMs > 0) {
        const u = 1 - sim.landMs / TUNE.landMs;
        const env = Math.sin(u * Math.PI * 1.5) * (1 - u) * TUNE.landSpread * sim.landK;
        sy *= 1 - env;
        sx *= 1 + env * 0.9;
    }
    // dash: clean stretch along the dash direction
    if (sim.sqDash > 0.01) {
        const sp = Math.hypot(inp.vx, inp.vy) || 1, along = inp.dashing ? Math.abs(inp.vx) / sp : 1;
        const d = TUNE.dashStretch * sim.sqDash;
        sx *= (1 + d * along) / (1 + d * 0.5 * (1 - along));
        sy *= (1 + d * (1 - along)) / (1 + d * 0.35 * along);
    }
    // crawl: stretch (front pushes ahead, rear stays put) then contract (rear catches up, top rolls forward)
    const ph = sim.sqPhase;
    const L = TUNE.crawlAmp * sim.sqRun * (0.5 - 0.5 * Math.cos(ph));
    const hump = TUNE.crawlHump * sim.sqRun * Math.max(0, -Math.sin(ph));
    sx *= 1 + L;
    sy /= 1 + L * 1.15; // sloppy pass 2026-10-28: flatter when stretched (gif WALK)
    const fallK = !inp.grounded && inp.vy > 0 ? Math.min(1, inp.vy / 600) : 0;
    const out = [];
    for (let i = 0; i < n; i++) {
        const m = moundPoint(i, n, W, H, sim.sqAir, fallK);
        let x = m.x * sx, y = m.y * sy;
        const hF = Math.min(1, Math.max(0, -y / H));
        const u = Math.max(-1, Math.min(1, m.x / W));
        const back = Math.max(0, -dir * u);
        x += dir * W * L * 0.6 * (1 - 0.7 * hF); // the foot pushes ahead first, the top follows
        y -= back * hF * H * 0.22 * sim.sqRun * Math.max(0, -Math.sin(ph)); // rear bunches up as it catches up
        x += dir * W * hump * hF * hF; // top bulk rolls forward on the catch-up
        y += back * Math.sqrt(back) * hF * H * TUNE.rearDrag * sim.sqRun; // rear trails a little lower
        if (sim.sqWall > 0.01) {
            const ws = sim.sqWallSide, onWall = Math.max(0, ws * u);
            x -= ws * W * TUNE.wallBulge * sim.sqWall; // bulge away from the wall
            y -= onWall * H * 0.10 * sim.sqWall; // wall side drags a bit as he slides down
        }
        if (sim.sqDash > 0.01) {
            x -= dir * back * back * W * TUNE.dashTrail * sim.sqDash;
            y += (-H * 0.45 * sy - y) * back * 0.08 * sim.sqDash; // rear stays round (a strong pull to mid height makes a point)
        }
        if (TUNE.jiggle > 0) {
            // top wobble only, never lifts the base
            const rp = Math.sin(i * 0.52 * 6 / Math.max(1, n / 12) + t / 210) + 0.5 * Math.sin(i * 1.3 - t / 330);
            const wob = 1 + 0.8 * sim.sqRun;
            y += rp * TUNE.jiggle * H * Math.pow(hF, 1.5) * wob;
            x += Math.sin(i * 0.9 + t / 260) * TUNE.jiggle * 1.2 * W * hF;
        }
        out.push({ x, y });
    }
    sim.sqSx = sx;
    sim.sqSy = sy;
    return out;
}
function buildRest(w, h) {
    const n = TUNE.points, out = [];
    if (TUNE.squish) {
        const W = w * BW() / 2, H = h * BH();
        for (let i = 0; i < n; i++)
            out.push(moundPoint(i, n, W, H, 0, 0));
        return out;
    }
    const W = w * BW() / 2, H = h * BH() / 2;
    for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2; // 0 = top, clockwise
        const c = Math.cos(th), s = Math.sin(th);
        const narrow = TUNE.topNarrow + (1 - TUNE.topNarrow) * Math.min(1, (1 - c) / 1.3);
        const yUnit = c >= 0 ? c : -Math.pow(-c, 0.55); // flatter, plumper bottom
        out.push({ x: s * W * narrow, y: -H - yUnit * H });
    }
    return out;
}
function area(p) {
    let a = 0;
    for (let i = 0, n = p.length; i < n; i++) {
        const q = p[i], r = p[(i + 1) % n];
        a += q.x * r.y - r.x * q.y;
    }
    return Math.abs(a) / 2;
}
function reset(inp) {
    const { rect } = inp;
    sim.w = rect.w;
    sim.h = rect.h;
    sim.rest = buildRest(rect.w, rect.h);
    sim.edge = sim.rest.map((p, i) => { const q = sim.rest[(i + 1) % sim.rest.length]; return Math.hypot(q.x - p.x, q.y - p.y); });
    sim.pos = sim.rest.map(p => ({ x: p.x, y: p.y }));
    sim.vel = sim.rest.map(() => ({ x: 0, y: 0 }));
    sim.restArea = area(sim.rest);
    const ax = rect.x + rect.w / 2, ay = rect.y + rect.h;
    const top = sim.rest[0];
    const seg = rect.h * TUNE.ropeSegFrac;
    sim.rope = [];
    sim.ropePrev = [];
    for (let i = 0; i <= TUNE.ropeSegs; i++) {
        const p = { x: ax + top.x + i * seg * 0.15, y: ay + top.y - i * seg };
        sim.rope.push(p);
        sim.ropePrev.push({ x: p.x, y: p.y });
    }
    const n = TUNE.points;
    const mk = (frac, rest, rad, yellow) => ({ anchor: Math.round(n * frac) % n, rest, rad, tip: { x: 0, y: rest }, vel: { x: 0, y: 0 }, yellow });
    sim.drips = [
        mk(0.38, rect.h * 0.08, rect.w * 0.10, false),
        mk(0.56, rect.h * 0.10, rect.w * 0.095, false),
        mk(0.64, rect.h * 0.05, rect.w * 0.08, false),
    ];
    sim.prevVx = inp.vx;
    sim.prevVy = inp.vy;
    sim.prevX = rect.x;
    sim.prevY = rect.y;
    sim.prevGrounded = inp.grounded;
    sim.turn = inp.facing;
    sim.init = true;
}
// ------------------------------------------------------------------ simulation
function step(inp) {
    const { rect, dt } = inp;
    if (!sim.init || rect.w !== sim.w || rect.h !== sim.h ||
        Math.abs(rect.x - sim.prevX) > 80 || Math.abs(rect.y - sim.prevY) > 80) {
        reset(inp);
    }
    if (dt <= 0)
        return;
    const n = TUNE.points;
    const ax = rect.x + rect.w / 2, ay = rect.y + rect.h;
    // Velocity change since last frame -> lag into the body (inertia).
    const cl = (v) => Math.max(-TUNE.inertiaClamp, Math.min(TUNE.inertiaClamp, v));
    // a dash start/stop is a big velocity snap; let the dash shape do the work instead
    const kick = inp.dashing !== sim.prevDashing ? 0.3 : 1;
    // the fall-speed snap on landing arrives a frame before 'grounded' flips, so detect it from vy itself
    const landing = TUNE.squish && sim.prevVy > 150 && inp.vy < sim.prevVy * 0.3 ? TUNE.landKick : 1;
    const dvx = cl(inp.vx - sim.prevVx) * kick, dvy = cl(inp.vy - sim.prevVy) * kick * landing;
    for (let i = 0; i < n; i++) {
        const hFrac = Math.min(1, Math.max(0, -sim.rest[i].y / (rect.h * BH())));
        const wgt = (TUNE.fluid ? TUNE.fluidInertia : TUNE.inertia) * (inp.grounded ? (TUNE.squish ? 0.04 + 0.96 * hFrac * hFrac : 0.35 + 0.65 * hFrac) : 1);
        sim.vel[i].x -= dvx * wgt;
        sim.vel[i].y -= dvy * wgt;
    }
    for (const d of sim.drips) {
        d.vel.x -= dvx * TUNE.dripInertia;
        d.vel.y -= dvy * TUNE.dripInertia;
    }
    // Target shape modifiers.
    const t = inp.timeMs;
    let sx = 1, sy = 1;
    if (inp.grounded) {
        const speed = Math.abs(inp.vx);
        sim.runDist += speed * dt;
        const bounce = speed > 20 ? Math.sin(sim.runDist / 10) * TUNE.runBounce * Math.min(1, speed / 200) : 0;
        const breath = speed > 20 ? 0 : Math.sin(t / 700) * 0.025;
        sy = 1 + bounce + breath;
        sx = 1 - bounce * 0.8 - breath;
    }
    else {
        const k = Math.max(-1, Math.min(1, -inp.vy / 650));
        const st = TUNE.airStretch * Math.abs(k);
        sy = 1 + st;
        sx = 1 / Math.sqrt(1 + st * 2.2);
    }
    // elongation: the head leads, the back of the body pulls out into a tapered streamer
    const edir = inp.vx > 1 ? 1 : inp.vx < -1 ? -1 : inp.facing;
    let elongT = inp.grounded ? TUNE.runElong * Math.min(1, Math.abs(inp.vx) / 260)
        : TUNE.airElong * Math.min(1, Math.abs(inp.vx) / 260);
    if (inp.dashing) {
        const sp = Math.hypot(inp.vx, inp.vy) || 1;
        const along = Math.abs(inp.vx) / sp;
        elongT = TUNE.dashElong * along;
        sy *= 1 + 0.45 * (1 - along) - 0.06 * along;
    }
    if (inp.wallSliding || TUNE.squish)
        elongT = 0;
    // ease so the streamer stretches out and snaps back like goo
    sim.elong += (elongT - sim.elong) * Math.min(1, dt * (elongT > sim.elong ? 9 : 6));
    sim.elongDir = edir;
    // face turns toward the facing side; more side-on the faster he goes
    sim.turn += (inp.facing - sim.turn) * Math.min(1, dt * TUNE.turnRate);
    const spd = inp.dashing ? 1 : Math.min(1, Math.abs(inp.vx) / 200);
    const profT = inp.wallSliding ? 0.2 : TUNE.profileIdle + (TUNE.profileRun - TUNE.profileIdle) * spd;
    sim.prof += (profT - sim.prof) * Math.min(1, dt * (profT > sim.prof ? 10 : 4));
    const elong = sim.elong;
    const bodyW = rect.w * BW();
    if (sim.landMs > 0) {
        // hard landing: squash, then one small rebound
        const u = 1 - sim.landMs / TUNE.landMs;
        const env = Math.sin(u * Math.PI * 1.5) * (1 - u) * TUNE.landSquash * sim.landK;
        sy *= 1 - env;
        sx *= 1 + env * 0.9;
        sim.landMs -= dt * 1000;
    }
    const lean = inp.grounded && !TUNE.squish ? Math.max(-0.5, Math.min(0.5, inp.vx * TUNE.runLean / 100)) : 0;
    const bodyH = rect.h * BH();
    const wallX = inp.wallSliding && inp.wallSide !== 0 ? inp.wallSide * rect.w * BW() * 0.5 * TUNE.wallFlatten : 0;
    // squish: per-frame target outline + matching edge lengths and area (springs only add wobble)
    const tgt = TUNE.squish ? squishTargets(inp, dt) : null;
    const tgtEdge = tgt ? tgt.map((p, i) => { const q = tgt[(i + 1) % n]; return Math.hypot(q.x - p.x, q.y - p.y); }) : null;
    const tgtArea = tgt ? area(tgt) : 0;
    if (tgt) {
        sx = sim.sqSx;
        sy = sim.sqSy;
    }
    const sub = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
        // pressure
        const A = area(sim.pos);
        // while streaming, ease off the inflation so the tail can go thin instead of ballooning
        const press = TUNE.pressure * (TUNE.fluid ? TUNE.fluidPressure : 1) * (1 - 0.65 * Math.min(1, elong)) * ((tgt ? tgtArea : sim.restArea * sx * sy * (1 + elong * 0.04)) - A) / sim.restArea;
        for (let i = 0; i < n; i++) {
            const r = sim.rest[i], p = sim.pos[i], v = sim.vel[i];
            const hFrac = -r.y / bodyH;
            let tx = r.x * sx + lean * hFrac * bodyH * 0.6;
            let ty = r.y * sy;
            if (tgt) {
                tx = tgt[i].x;
                ty = tgt[i].y;
            }
            else if (elong > 0.01) {
                const u = r.x / (bodyW * 0.5); // -1..1 across the body
                const back = Math.max(0, -edir * u), front = Math.max(0, edir * u);
                const low = Math.min(1, hFrac * 1.6); // tail comes off the lower body
                // Sloomoo Rushed: big round head leads, the body pours out behind it into a long
                // thin wavy tail at about head-centre height
                const e = Math.min(1, elong);
                const bk = Math.pow(back, TUNE.tailPow);
                tx += -edir * bk * elong * bodyW * (1.25 - 0.35 * hFrac);
                tx += edir * front * e * bodyW * 0.10;
                let thin = Math.min(0.96, Math.pow(back, 0.5 * TUNE.tailPow / 1.25) * (0.35 + 0.62 * e));
                if (TUNE.tailNeck > 0) {
                    // Rushed: round head first, then a quick pinch into a thin streamer
                    const u0 = Math.max(0, Math.min(1, (back - TUNE.tailNeck) / (0.95 - TUNE.tailNeck)));
                    thin = Math.min(0.97, (u0 * u0 * (3 - 2 * u0)) * (0.55 + 0.42 * e) + back * 0.12);
                }
                const mid = inp.grounded ? -bodyH * TUNE.runTailY : -bodyH * 0.42;
                ty = ty + (mid - ty) * thin * (0.75 + 0.25 * low);
                // head rounds off and sits lower while streaming
                if (back < 0.35)
                    ty *= 1 - 0.14 * e;
                // travelling wave down the tail
                ty += Math.sin(bk * 7 - t / 70 * edir * edir) * bk * e * bodyH * TUNE.tailWave;
            }
            // jelly surface ripple (strongest on the upper body, never lifts the foot)
            if (!tgt && TUNE.jiggle > 0) {
                const rp = Math.sin(i * 0.52 * 6 / Math.max(1, n / 12) + t / 210) + 0.5 * Math.sin(i * 1.3 - t / 330);
                ty += rp * TUNE.jiggle * bodyH * Math.min(1, hFrac * 1.4) * (1 - 0.6 * Math.min(1, elong));
                tx += Math.sin(i * 0.9 + t / 260) * TUNE.jiggle * 0.6 * bodyW * hFrac;
            }
            if (wallX > 0 && tx > wallX)
                tx = wallX;
            if (wallX < 0 && tx < wallX)
                tx = wallX;
            const prev = sim.pos[(i - 1 + n) % n], next = sim.pos[(i + 1) % n];
            let nx = next.y - prev.y, ny = -(next.x - prev.x);
            const nl = Math.hypot(nx, ny) || 1;
            nx /= nl;
            ny /= nl;
            let ks = TUNE.stiffness, kd = TUNE.damping, fx = 0, fy = 0;
            if (TUNE.fluid) {
                ks = TUNE.fluidShape + (TUNE.stiffness - TUNE.fluidShape) * 0.6 * Math.min(1, elong);
                kd = TUNE.fluidDamping;
                if (tgt) {
                    ks = TUNE.squishShape;
                    kd = TUNE.squishDamp;
                }
                const edgeDamp = tgt ? TUNE.squishEdgeDamp : TUNE.fluidEdgeDamp;
                for (const j of [(i + 1) % n, (i - 1 + n) % n]) {
                    const o = sim.pos[j], ei = j === (i + 1) % n ? i : j, rl = tgtEdge ? tgtEdge[ei] : sim.edge[ei] * Math.sqrt(sx * sy);
                    const ex = o.x - p.x, ey = o.y - p.y, el = Math.hypot(ex, ey) || 1e-6;
                    const f = TUNE.fluidEdge * (el - rl) / el;
                    fx += f * ex + edgeDamp * (sim.vel[j].x - v.x);
                    fy += f * ey + edgeDamp * (sim.vel[j].y - v.y);
                }
                fy += TUNE.fluidGravity * (inp.grounded ? 1 : 0.15);
            }
            v.x += (ks * (tx - p.x) - kd * v.x + press * nx + fx) * h;
            v.y += (ks * (ty - p.y) - kd * v.y + press * ny + fy) * h;
            p.x += v.x * h;
            p.y += v.y * h;
            if (TUNE.fluid) {
                const ddx = p.x - tx, ddy = p.y - ty, dd = Math.hypot(ddx, ddy), lim = bodyH * TUNE.fluidMaxDev * (1 + elong);
                if (dd > lim) {
                    const k = lim / dd;
                    p.x = tx + ddx * k;
                    p.y = ty + ddy * k;
                    v.x *= 0.8;
                    v.y *= 0.8;
                }
            }
            // ground squash
            if (inp.grounded && p.y > 0) {
                p.y = 0;
                if (v.y > 0)
                    v.y = -v.y * (TUNE.fluid ? 0.04 : 0.1);
                v.x *= tgt ? TUNE.stickyBase : TUNE.fluid ? TUNE.fluidFloorSlide : 0.92;
            }
            // wall squash
            if (inp.wallSliding && inp.wallSide !== 0) {
                const lim = inp.wallSide * rect.w * 0.5;
                if (inp.wallSide > 0 && p.x > lim) {
                    p.x = lim;
                    v.x = Math.min(v.x, 0);
                }
                if (inp.wallSide < 0 && p.x < lim) {
                    p.x = lim;
                    v.x = Math.max(v.x, 0);
                }
            }
        }
        // drips
        for (const d of sim.drips) {
            d.vel.x += (TUNE.dripStiffness * (0 - d.tip.x) - TUNE.dripDamping * d.vel.x) * h;
            // drips pull up into the body while it stretches, so the streamer doesn't sprout legs
            const dRest = d.rest * Math.max(0.25, 1 - elong * 0.9);
            d.vel.y += (TUNE.dripStiffness * (dRest - d.tip.y) - TUNE.dripDamping * d.vel.y + TUNE.dripGravity * (1 - Math.min(0.8, elong))) * h;
            d.tip.x += d.vel.x * h;
            d.tip.y += d.vel.y * h;
            const a = sim.pos[d.anchor];
            if (inp.grounded && a.y + d.tip.y > 0) {
                d.tip.y = -a.y;
                d.vel.y = Math.min(0, d.vel.y);
                d.tip.x *= 0.9;
            }
            if (d.tip.y < d.rad * 0.5)
                d.tip.y = d.rad * 0.5;
        }
        // snoozle rope (world space)
        const top = sim.pos[0];
        const base = { x: ax + top.x, y: ay + top.y + 1 };
        const spdK = Math.min(1, Math.hypot(inp.vx, inp.vy) / 500);
        const seg = rect.h * TUNE.ropeSegFrac * (1 + TUNE.ropeStretch * spdK * spdK);
        // carry the stalk partly with the head so jumps/landings don't fold it flat
        const bdx = base.x - sim.rope[0].x, bdy = base.y - sim.rope[0].y;
        for (let i = 1; i <= TUNE.ropeSegs; i++) {
            const c = TUNE.ropeCarry;
            sim.rope[i].x += bdx * c;
            sim.rope[i].y += bdy * c;
            sim.ropePrev[i].x += bdx * c;
            sim.ropePrev[i].y += bdy * c;
        }
        sim.rope[0].x = base.x;
        sim.rope[0].y = base.y;
        sim.ropePrev[0].x = base.x;
        sim.ropePrev[0].y = base.y;
        // the stalk grows out along the body's local "up" at the top
        const p1 = sim.pos[1], pn = sim.pos[n - 1];
        let upx = (p1.y - pn.y), upy = -(p1.x - pn.x);
        const ul = Math.hypot(upx, upy) || 1;
        upx /= ul;
        upy /= ul;
        if (upy > 0) {
            upx = -upx;
            upy = -upy;
        }
        // air drag sweeps the stalk back against the motion
        const trail = Math.max(-1.55, Math.min(1.55, -inp.vx / 260 * TUNE.ropeTrail + (inp.vy < 0 ? 0 : 0) - Math.sign(inp.vx || inp.facing) * Math.min(1, Math.abs(inp.vy) / 650) * TUNE.ropeTrailV * 0.5));
        for (let i = 1; i <= TUNE.ropeSegs; i++) {
            const p = sim.rope[i], q = sim.ropePrev[i];
            const vx = (p.x - q.x) * TUNE.ropeDamping, vy = (p.y - q.y) * TUNE.ropeDamping;
            q.x = p.x;
            q.y = p.y;
            p.x += vx;
            p.y += vy + TUNE.ropeGravity * h * h;
        }
        for (let iter = 0; iter < 3; iter++) {
            for (let i = 1; i <= TUNE.ropeSegs; i++) {
                const a = sim.rope[i - 1], p = sim.rope[i];
                // bend stiffness: pull toward "up" from the previous node (curling slightly forward)
                // sweep back, but never past ~horizontal so the bulb trails behind the head, not over the face
                const rawCurl = 0.10 * inp.facing * (i / TUNE.ropeSegs) + trail * (0.35 + 0.9 * i / TUNE.ropeSegs);
                const curl = Math.sign(rawCurl) * Math.min(Math.abs(rawCurl), 1.12);
                const dx = upx * Math.cos(curl) - upy * Math.sin(curl), dy = upx * Math.sin(curl) + upy * Math.cos(curl);
                const stiff = TUNE.ropeStiffness * (1 - (i - 1) / (TUNE.ropeSegs + 1));
                p.x += (a.x + dx * seg - p.x) * stiff;
                p.y += (a.y + dy * seg - p.y) * stiff;
                // length constraint
                const ex = p.x - a.x, ey = p.y - a.y;
                const el = Math.hypot(ex, ey) || 1;
                p.x = a.x + ex / el * seg;
                p.y = a.y + ey / el * seg;
            }
        }
    }
    // ---- events -> particles
    const footY = ay;
    if (!inp.grounded)
        sim.airMaxVy = Math.max(sim.airMaxVy, inp.vy);
    if (inp.grounded && !sim.prevGrounded) {
        const impact = Math.max(sim.prevVy, sim.airMaxVy);
        if (impact > 120) {
            sim.landK = Math.min(1, (impact - 120) / 650);
            sim.landMs = TUNE.landMs;
        }
        if (impact > 260) {
            const k = Math.min(1, (impact - 260) / 600);
            const count = TUNE.squish ? 2 + Math.round(k * 3) : 3 + Math.round(k * 9);
            for (let i = 0; i < count; i++) {
                const dir = i % 2 === 0 ? 1 : -1;
                spawnDrop(ax + dir * rect.w * 0.35, footY - 3, dir * (60 + Math.random() * 160 * (0.5 + k)), -(120 + Math.random() * 220 * (0.4 + k)), 1.4 + Math.random() * 1.6, Math.random() < 0.15);
            }
            spawnRing(ax, footY, rect.w * (1 + k));
            spawnSplat(ax, footY, rect.w * (0.4 + 0.3 * k), 1.4);
            if (k > 0.5)
                sim.squintMs = 160;
        }
        sim.airMaxVy = 0;
    }
    // goo strands: peeling off the floor on takeoff and off the wall on a wall jump
    if (!inp.grounded && sim.prevGrounded && inp.vy < -200) {
        for (const f of [0.5]) {
            const pi = Math.round(n * f) % n, bp = sim.pos[pi];
            sim.strands.push({ gx: ax + bp.x, gy: footY, pi, w: rect.w * 0.12, age: 0 });
        }
    }
    if (!inp.wallSliding && sim.prevWallSliding && !inp.grounded && sim.prevWallSide !== 0) {
        const side = sim.prevWallSide;
        const wx = side > 0 ? sim.prevX + rect.w : sim.prevX;
        for (const f of [0.22, 0.34]) {
            const pi = Math.round(n * (side > 0 ? f : 1 - f)) % n;
            sim.strands.push({ gx: wx, gy: sim.prevY + rect.h + sim.pos[pi].y, pi, w: rect.w * 0.11, age: 0 });
        }
    }
    for (let k = sim.strands.length - 1; k >= 0; k--) {
        const s = sim.strands[k];
        s.age += dt * 1000;
        const bp = sim.pos[s.pi];
        const len = Math.hypot(ax + bp.x - s.gx, ay + bp.y - s.gy);
        if (len > rect.h * TUNE.strandSnap || s.age > TUNE.strandMs || inp.grounded) {
            if (!inp.grounded) {
                const mx = (ax + bp.x + s.gx) / 2, my = (ay + bp.y + s.gy) / 2;
                spawnDrop(mx, my, inp.vx * 0.2 + (Math.random() - 0.5) * 30, 30 + Math.random() * 40, 1.1 + Math.random() * 0.7);
            }
            sim.strands.splice(k, 1);
        }
    }
    if (!inp.grounded && sim.prevGrounded && inp.vy < -200) {
        for (let i = 0; i < (TUNE.squish ? 2 : 4); i++)
            spawnDrop(ax + (Math.random() - 0.5) * rect.w * 0.6, footY - 2, (Math.random() - 0.5) * 80, 40 + Math.random() * 60, 1.2 + Math.random());
        spawnRing(ax, footY, rect.w * 0.7);
    }
    if (inp.wallSliding && inp.wallSide !== 0) {
        sim.wallFxMs -= dt * 1000;
        if (sim.wallFxMs <= 0) {
            sim.wallFxMs = 70;
            const wx = inp.wallSide > 0 ? rect.x + rect.w : rect.x;
            spawnWallSplat(wx, rect.y + rect.h * (0.4 + Math.random() * 0.4), 2 + Math.random() * 1.5, inp.wallSide > 0 ? -1 : 1, 0.9);
            if (Math.random() < 0.3)
                spawnDrop(wx - inp.wallSide * 2, rect.y + rect.h * 0.8, -inp.wallSide * 30, 20, 1.2);
        }
    }
    // wet smear trail on the floor
    if (TUNE.trailMs > 0 && inp.grounded && Math.abs(inp.vx) > 60) {
        sim.trailMs -= dt * 1000;
        if (sim.trailMs <= 0) {
            sim.trailMs = TUNE.trailMs;
            const sp = Math.min(1, Math.abs(inp.vx) / 260);
            spawnTrail(ax - Math.sign(inp.vx) * rect.w * 0.2, footY, rect.w * (0.30 + 0.25 * sp) * (0.8 + Math.random() * 0.4));
        }
    }
    if (inp.grounded && Math.abs(inp.vx) > 150) {
        sim.runFxMs -= dt * 1000;
        if (sim.runFxMs <= 0) {
            sim.runFxMs = 160 + Math.random() * 200;
            spawnDrop(ax - Math.sign(inp.vx) * rect.w * 0.4, footY - 3, -inp.vx * 0.3 + (Math.random() - 0.5) * 40, -60 - Math.random() * 90, 1.1 + Math.random() * 0.8);
        }
    }
    if (inp.dashing && !TUNE.squish) { // squish: no shard sparks
        const back = -Math.sign(inp.vx || 0) * rect.w * 0.45;
        for (let i = 0; i < 2; i++)
            spawnSpark(ax + back + (Math.random() - 0.5) * rect.w * 0.5, rect.y + Math.random() * rect.h, -inp.vx * 0.2 + (Math.random() - 0.5) * 60, -inp.vy * 0.2 + (Math.random() - 0.5) * 60);
    }
    // drips that stretch too far snap off as droplets
    for (const d of sim.drips) {
        const len = Math.hypot(d.tip.x, d.tip.y);
        if (!TUNE.squish && !inp.grounded && len > d.rest * TUNE.dripSnapLen) {
            const a = sim.pos[d.anchor];
            spawnDrop(ax + a.x + d.tip.x, ay + a.y + d.tip.y, inp.vx * 0.8 + d.vel.x * 0.3, inp.vy * 0.8 + d.vel.y * 0.3, d.rad * 1.1, d.yellow);
            d.tip.x = 0;
            d.tip.y = d.rest * 0.3;
            d.vel.x = 0;
            d.vel.y = 0;
        }
    }
    if (sim.squintMs > 0)
        sim.squintMs -= dt * 1000;
    sim.prevVx = inp.vx;
    sim.prevVy = inp.vy;
    sim.prevX = rect.x;
    sim.prevY = rect.y;
    sim.prevGrounded = inp.grounded;
    sim.prevDashing = inp.dashing;
    sim.prevWallSliding = inp.wallSliding;
    sim.prevWallSide = inp.wallSliding ? inp.wallSide : 0;
}
// ------------------------------------------------------------------ drawing
function smoothClosed(ctx, pts, ox, oy) {
    const n = pts.length;
    ctx.beginPath();
    const p0 = pts[0];
    ctx.moveTo(ox + p0.x, oy + p0.y);
    for (let i = 0; i < n; i++) {
        const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
        ctx.bezierCurveTo(ox + b.x + (c.x - a.x) / 6, oy + b.y + (c.y - a.y) / 6, ox + c.x - (d.x - b.x) / 6, oy + c.y - (d.y - b.y) / 6, ox + c.x, oy + c.y);
    }
    ctx.closePath();
}
function bounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sx = 0, sy = 0;
    for (const p of sim.pos) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
        sx += p.x;
        sy += p.y;
    }
    const n = sim.pos.length;
    return { cx: sx / n, cy: sy / n, w: maxX - minX, h: maxY - minY, top: minY, bot: maxY };
}
/** The head part of the body: centroid of the upper points, size capped near rest so the
 *  face and cap stay at the front while the back stretches into a streamer. */
function head(b) {
    const bodyH = sim.h * BH(), restW = sim.w * BW();
    let sx = 0, cnt = 0;
    for (let i = 0; i < sim.pos.length; i++) {
        if (-sim.rest[i].y > bodyH * 0.55) {
            sx += sim.pos[i].x;
            cnt++;
        }
    }
    const w = Math.min(b.w, restW * 1.12), h = Math.min(b.h, bodyH * 1.25);
    const cx = cnt ? sx / cnt : b.cx;
    return { cx, cy: b.top + h * 0.56, w, h };
}
/** Advance the simulation and draw Sloomoo. */
export function drawSlime(ctx, inp) {
    step(inp);
    updateRush(inp);
    if (rush.on) {
        for (const s of sim.strands)
            drawStrand(ctx, s, inp.rect.x + inp.rect.w / 2, inp.rect.y + inp.rect.h, inp.rect.h);
        drawRush(ctx, inp);
        return;
    }
    facingSign = inp.facing;
    const { rect } = inp;
    const ox = rect.x + rect.w / 2, oy = rect.y + rect.h;
    const b = bounds();
    const hd = head(b);
    // contact shadow
    if (inp.grounded) {
        ctx.save();
        ctx.fillStyle = "rgba(20, 15, 45, 0.28)";
        ctx.beginPath();
        ctx.ellipse(ox + b.cx, oy, b.w * 0.55, rect.h * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    // if the snoozle has swung down beside the head, tuck it behind the body
    const tip = sim.rope[sim.rope.length - 1];
    const ropeBehind = tip.y > oy + b.top + hd.h * 0.22;
    if (ropeBehind) {
        drawRope(ctx, rect.h);
        drawBulb(ctx, rect.h);
    }
    // goo strands still stuck to the floor / wall
    for (const s of sim.strands)
        drawStrand(ctx, s, ox, oy, rect.h);
    // drips (behind body so they merge into it)
    if (!TUNE.squish)
        for (const d of sim.drips)
            drawDrip(ctx, d, ox, oy);
    // goo foot: a wet puddle the body sits in (its bottom outline is hidden below)
    const foot = inp.grounded && TUNE.puddle > 0 ? footSpan() : null;
    if (foot)
        drawPuddle(ctx, ox, oy, foot, rect.w, inp.timeMs);
    // body fill + cel shade + rim light
    if (TUNE.goo && !TUNE.squish) {
        // wet halo: the soft translucent edge of the goop
        smoothClosed(ctx, sim.pos, ox, oy);
        ctx.lineWidth = TUNE.gooRim * 0.7;
        ctx.strokeStyle = "rgba(155,219,247,0.40)";
        ctx.stroke();
    }
    smoothClosed(ctx, sim.pos, ox, oy);
    ctx.fillStyle = SL.body;
    if (TUNE.goo && !TUNE.squish)
        ctx.globalAlpha = 0.93;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    smoothClosed(ctx, sim.pos, ox, oy);
    ctx.clip();
    // flat cel shade: darker crescent on the back-lower side
    ctx.fillStyle = SL.bodyShade;
    ctx.fillRect(ox + b.cx - b.w, oy + b.top - b.h, b.w * 2, b.h * 3);
    ctx.save();
    ctx.translate(-sim.turn * b.w * 0.10, -b.h * 0.07);
    smoothClosed(ctx, sim.pos, ox, oy);
    ctx.fillStyle = SL.body;
    ctx.fill();
    ctx.restore();
    if (TUNE.goo && !TUNE.squish) {
        // gel depth: pale top, dense blue bottom, bright translucent rim just inside the outline
        const g = ctx.createLinearGradient(0, oy + b.top, 0, oy + b.bot);
        g.addColorStop(0, "rgba(200,240,255,0.30)");
        g.addColorStop(0.5, "rgba(120,200,245,0.04)");
        g.addColorStop(1, "rgba(25,80,165,0.42)");
        ctx.fillStyle = g;
        ctx.fillRect(ox + b.cx - b.w, oy + b.top - 4, b.w * 2, b.h + 8);
        smoothClosed(ctx, sim.pos, ox, oy);
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(TUNE.gooRim, hd.w * 0.17);
        ctx.strokeStyle = "rgba(205,242,255,0.28)";
        ctx.stroke();
        ctx.lineWidth = Math.max(TUNE.gooRim * 0.5, hd.w * 0.085);
        ctx.strokeStyle = "rgba(225,248,255,0.30)";
        ctx.stroke();
        // thick glossy blob highlight on the belly + a dark refraction crescent at the bottom
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.beginPath();
        ctx.ellipse(ox + hd.cx - sim.turn * hd.w * 0.22, oy + b.bot - b.h * 0.34, hd.w * 0.09, hd.h * 0.07, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(20,70,150,0.20)";
        ctx.beginPath();
        ctx.ellipse(ox + b.cx, oy + b.bot - 1, b.w * 0.42, b.h * 0.10, 0, Math.PI, 0);
        ctx.fill();
    }
    // yellow goo cap draped over the top of the head
    drawCap(ctx, ox + sim.pos[0].x * 0.6 + hd.cx * 0.4, oy + b.top, hd.w, hd.h, inp.timeMs);
    if (TUNE.squish)
        drawShine(ctx, ox, oy, b, hd);
    else
        drawJelly(ctx, ox, oy, b, hd, inp.timeMs);
    ctx.restore();
    ctx.save();
    if (foot) {
        ctx.beginPath();
        ctx.rect(ox - 2000, oy - 2000, 4000, 2000 - 1.4);
        ctx.clip();
    }
    smoothClosed(ctx, sim.pos, ox, oy);
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW;
    ctx.stroke();
    ctx.restore();
    // snoozle neck melts into the cap (drawn over the outline at the joint)
    if (!ropeBehind)
        drawRope(ctx, rect.h);
    facingSign = inp.facing;
    // face
    drawFace(ctx, inp, ox + hd.cx, oy + hd.cy, hd.w, hd.h);
    // bulb in front
    if (!ropeBehind)
        drawBulb(ctx, rect.h);
    ctx.restore();
}
/** Body silhouette only, for dash afterimages. */
export function drawSlimeGhost(ctx, x, y, rect) {
    if (!sim.init)
        return;
    if (rush.on && rush.path) {
        ctx.save();
        ctx.translate(x + rect.w / 2, y + rect.h);
        ctx.fill(rush.path, "nonzero");
        ctx.restore();
        return;
    }
    smoothClosed(ctx, sim.pos, x + rect.w / 2, y + rect.h);
    ctx.fill();
}
/** x-extent of the body points pressed onto the floor (local), or null. */
function footSpan() {
    let l = Infinity, r = -Infinity;
    for (const p of sim.pos)
        if (p.y > -1.5) {
            l = Math.min(l, p.x);
            r = Math.max(r, p.x);
        }
    return l < r ? { l, r } : null;
}
function drawPuddle(ctx, ox, oy, f, pw, tMs) {
    const spread = pw * (TUNE.squish ? 0.10 : TUNE.goo ? 0.55 : 0.30) * TUNE.puddle;
    const cx = ox + (f.l + f.r) / 2, rx = (f.r - f.l) / 2 + spread;
    const ry = pw * (TUNE.squish ? 0.07 : TUNE.goo ? 0.19 : 0.15) * (1 + 0.08 * Math.sin(tMs / 400));
    ctx.beginPath();
    ctx.ellipse(cx, oy - 0.3, rx, ry, 0, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = SL.body;
    ctx.fill();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW * 0.85;
    ctx.beginPath();
    ctx.ellipse(cx, oy - 0.3, rx, ry, 0, Math.PI, 0);
    ctx.stroke();
    if (TUNE.gloss > 0 && !TUNE.squish) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = Math.max(0.6, pw * 0.035);
        const s = facingSign;
        ctx.beginPath();
        ctx.ellipse(cx, oy - 0.3, rx * 0.86, ry * 0.62, 0, s > 0 ? -0.55 : -Math.PI + 0.18, s > 0 ? -0.18 : -Math.PI + 0.55);
        ctx.stroke();
    }
}
function drawStrand(ctx, s, ox, oy, ph) {
    const bp = sim.pos[s.pi];
    const x0 = ox + bp.x, y0 = oy + bp.y, x1 = s.gx, y1 = s.gy;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const k = Math.min(1, len / (ph * TUNE.strandSnap));
    const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
    const wEnd = s.w, wMid = Math.max(0.3, s.w * 0.3 * Math.pow(1 - k, 2));
    const sway = Math.sin(s.age / 60 + s.pi) * len * 0.12;
    const mx = (x0 + x1) / 2 + sway, my = (y0 + y1) / 2 + len * 0.10; // sags and wobbles
    ctx.beginPath();
    ctx.moveTo(x0 + nx * wEnd, y0 + ny * wEnd);
    ctx.quadraticCurveTo(mx + nx * wMid, my + ny * wMid, x1 + nx * wEnd * 1.3, y1 + ny * wEnd * 1.3);
    ctx.lineTo(x1 - nx * wEnd * 1.3, y1 - ny * wEnd * 1.3);
    ctx.quadraticCurveTo(mx - nx * wMid, my - ny * wMid, x0 - nx * wEnd, y0 - ny * wEnd);
    ctx.closePath();
    ctx.fillStyle = SL.body;
    ctx.fill();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // blob where it is still stuck
    ctx.beginPath();
    ctx.ellipse(x1, y1, wEnd * 1.6, wEnd * 0.9, Math.atan2(ny, nx), 0, Math.PI * 2);
    ctx.fillStyle = SL.body;
    ctx.fill();
}
/** Squish look: flat cel shade + one small wet highlight on the back-upper flank (no bubbles/rim/halo). */
function drawShine(ctx, ox, oy, b, hd) {
    if (TUNE.shine <= 0)
        return;
    const f = facingSign;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineCap = "round";
    ctx.lineWidth = Math.max(0.8, hd.w * 0.04);
    const x = ox + hd.cx - f * hd.w * 0.36, y = oy + b.top + b.h * 0.58;
    ctx.beginPath();
    ctx.ellipse(x, y, hd.w * 0.10, b.h * 0.16, f * 0.25, f > 0 ? Math.PI * 0.80 : Math.PI * 0.05, f > 0 ? Math.PI * 1.15 : Math.PI * 0.20);
    ctx.stroke();
    ctx.restore();
}
/** Wet, translucent jelly: inner glow, rising bubbles, rim + specular streaks that follow
 *  the deforming outline. Drawn inside the body clip. */
function drawJelly(ctx, ox, oy, b, hd, tMs) {
    if (TUNE.gloss <= 0 && TUNE.bubbles <= 0)
        return;
    const n = sim.pos.length, f = facingSign;
    const top = oy + b.top, bot = oy + b.bot, H = bot - top, cx = ox + hd.cx, w = hd.w;
    // translucent inner glow, low on the belly
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = SL.bodyLight;
    ctx.beginPath();
    ctx.ellipse(cx + f * w * 0.06, bot - H * 0.26, w * 0.30, H * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // bubbles drifting up through the jelly
    for (let i = 0; i < TUNE.bubbles; i++) {
        const ph = ((tMs / 1000) * (0.16 + 0.05 * (i % 3)) + i * 0.29) % 1;
        const bx = cx + Math.sin(i * 2.4 + 0.7) * w * 0.28 + Math.sin(tMs / 500 + i * 1.7) * w * 0.025;
        const by = bot - H * (0.08 + 0.50 * ph);
        const r = w * (0.028 + 0.018 * ((i * 7) % 3) / 2);
        ctx.save();
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.9;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fillStyle = SL.bodyLight;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(0.4, r * 0.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(bx - r * 0.35, by - r * 0.35, r * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.restore();
    }
    if (TUNE.gloss <= 0)
        return;
    // inset polyline along the outline between two angles (0 = top, clockwise)
    const cxL = b.cx, cyL = b.top + b.h * 0.5;
    const edge = (a0, a1, inset) => {
        ctx.beginPath();
        const steps = 10;
        for (let s = 0; s <= steps; s++) {
            let a = a0 + (a1 - a0) * s / steps;
            if (f < 0)
                a = Math.PI * 2 - a;
            const fi = (a / (Math.PI * 2)) * n;
            const i0 = Math.floor(fi), u = fi - i0;
            const p = sim.pos[((i0 % n) + n) % n], q = sim.pos[(((i0 + 1) % n) + n) % n];
            let x = p.x + (q.x - p.x) * u, y = p.y + (q.y - p.y) * u;
            const dx = cxL - x, dy = cyL - y, dl = Math.hypot(dx, dy) || 1;
            x += dx / dl * inset;
            y += dy / dl * inset;
            if (s === 0)
                ctx.moveTo(ox + x, oy + y);
            else
                ctx.lineTo(ox + x, oy + y);
        }
    };
    ctx.lineCap = "round";
    // wet rim light on the back-lower edge
    ctx.strokeStyle = SL.bodyLight;
    ctx.lineWidth = Math.max(1, w * 0.07);
    edge(Math.PI * 1.18, Math.PI * 1.62, w * 0.07);
    ctx.stroke();
    // main specular streak hugging the front-lower edge + a dot above it
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = Math.max(0.9, w * 0.055);
    edge(Math.PI * 0.56, Math.PI * 0.78, w * 0.08);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.6, w * 0.03);
    edge(Math.PI * 0.40, Math.PI * 0.47, w * 0.09);
    ctx.stroke();
    // shine on the goo cap
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = Math.max(0.8, w * 0.045);
    ctx.beginPath();
    const gx = cx + f * w * 0.24, gy = top + H * 0.07;
    ctx.moveTo(gx - f * w * 0.10, gy);
    ctx.quadraticCurveTo(gx + f * w * 0.04, gy - H * 0.01, gx + f * w * 0.10, gy + H * 0.06);
    ctx.stroke();
    void hd.cy;
}
function drawRope(ctx, ph) {
    const r = sim.rope;
    if (r.length < 2)
        return;
    const w0 = ph * 0.075, w1 = ph * 0.038;
    // build a tapered ribbon along the rope
    const left = [], right = [];
    for (let i = 0; i < r.length; i++) {
        const a = r[Math.max(0, i - 1)], c = r[Math.min(r.length - 1, i + 1)];
        let nx = -(c.y - a.y), ny = c.x - a.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const u = i / (r.length - 1);
        const w = (w1 + (w0 - w1) * Math.pow(1 - u, 2)) * (i === 0 ? 1.6 : 1);
        const sink = i === 0 ? ph * 0.07 : 0; // root sinks into the cap so it melts in
        left.push({ x: r[i].x + nx * w, y: r[i].y + ny * w + sink });
        right.push({ x: r[i].x - nx * w, y: r[i].y - ny * w + sink });
    }
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) {
        const m = { x: (left[i - 1].x + left[i].x) / 2, y: (left[i - 1].y + left[i].y) / 2 };
        ctx.quadraticCurveTo(left[i - 1].x, left[i - 1].y, m.x, m.y);
    }
    ctx.lineTo(left[left.length - 1].x, left[left.length - 1].y);
    ctx.lineTo(right[right.length - 1].x, right[right.length - 1].y);
    for (let i = right.length - 2; i >= 0; i--) {
        const m = { x: (right[i + 1].x + right[i].x) / 2, y: (right[i + 1].y + right[i].y) / 2 };
        ctx.quadraticCurveTo(right[i + 1].x, right[i + 1].y, m.x, m.y);
    }
    ctx.lineTo(right[0].x, right[0].y);
    ctx.closePath();
    ctx.fillStyle = SL.bodyYellow;
    ctx.fill();
    // outline the two sides only, fading out before the root
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW * 0.8;
    for (const side of [left, right]) {
        ctx.beginPath();
        ctx.moveTo(side[1].x * 0.5 + side[0].x * 0.5, side[1].y * 0.5 + side[0].y * 0.5);
        for (let i = 1; i < side.length; i++)
            ctx.lineTo(side[i].x, side[i].y);
        ctx.stroke();
    }
}
/** Yellow goo cap with drippy lower edge, drawn inside the body clip. */
function drawCap(ctx, cx, top, bw, bh, tMs) {
    const depth = bh * TUNE.capDepth;
    const L = cx - bw * 0.75, Rr = cx + bw * 0.75;
    // lobes: [x fraction across, drop length vs depth]
    const lobes = [[-0.62, 0.55], [-0.38, 0.95], [-0.12, 0.70], [0.10, 1.05], [0.36, 0.78], [0.60, 0.50]];
    const wob = (k) => Math.sin(tMs / 520 + k * 1.7) * depth * 0.04;
    const edge = () => {
        ctx.moveTo(L, top - 4);
        ctx.lineTo(L, top + depth * 0.45);
        let px = L, py = top + depth * 0.45;
        lobes.forEach(([fx, d], k) => {
            const x = cx + fx * bw * 0.5, y = top + depth * d + wob(k);
            const gapY = top + depth * Math.min(d, 0.6) * 0.62;
            const w = bw * 0.07;
            ctx.quadraticCurveTo(px + (x - w - px) * 0.5, gapY, x - w, y - w * 0.6);
            ctx.quadraticCurveTo(x, y + w * 0.9, x + w, y - w * 0.6);
            px = x + w;
            py = y;
        });
        void py;
        ctx.quadraticCurveTo(Rr - bw * 0.1, top + depth * 0.4, Rr, top + depth * 0.4);
    };
    ctx.beginPath();
    edge();
    ctx.lineTo(Rr, top - 4);
    ctx.closePath();
    ctx.fillStyle = SL.bodyYellow;
    ctx.fill();
    ctx.beginPath();
    edge();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW * 0.75;
    ctx.stroke();
}
let facingSign = 1;
function drawBulb(ctx, ph) {
    const r = sim.rope;
    if (r.length < 2)
        return;
    const tip = r[r.length - 1], pre = r[r.length - 2];
    const ang = Math.atan2(tip.y - pre.y, tip.x - pre.x);
    const R = ph * TUNE.bulbFrac;
    // teardrop: stretched slightly along the motion of the tip
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(ang + Math.PI / 2);
    const shape = () => {
        ctx.beginPath();
        ctx.moveTo(0, R * 0.9);
        ctx.bezierCurveTo(R * 1.15, R * 0.75, R * 1.25, -R * 1.05, 0, -R * 1.05);
        ctx.bezierCurveTo(-R * 1.25, -R * 1.05, -R * 1.15, R * 0.75, 0, R * 0.9);
        ctx.closePath();
    };
    // magenta goo blob with a couple of drips running down onto the yellow neck
    const blob = () => {
        shape();
        ctx.moveTo(R * 0.15, R * 0.6);
        ctx.quadraticCurveTo(R * 0.50, R * 0.9, R * 0.40, R * 1.25);
        ctx.quadraticCurveTo(R * 0.30, R * 1.42, R * 0.20, R * 1.22);
        ctx.quadraticCurveTo(R * 0.12, R * 1.0, R * -0.05, R * 0.8);
    };
    blob();
    ctx.fillStyle = SL.snoozle;
    ctx.fill("nonzero");
    ctx.save();
    shape();
    ctx.clip();
    ctx.fillStyle = SL.snoozleShade;
    ctx.beginPath();
    ctx.ellipse(-facingSign * R * 0.75, R * 0.1, R * 0.55, R * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    blob();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW * 0.8;
    ctx.stroke();
    // glossy highlight streak
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = Math.max(0.8, R * 0.16);
    ctx.beginPath();
    ctx.moveTo(facingSign * R * 0.45, -R * 0.55);
    ctx.quadraticCurveTo(facingSign * R * 0.62, -R * 0.2, facingSign * R * 0.52, R * 0.05);
    ctx.stroke();
    ctx.restore();
}
function drawDrip(ctx, d, ox, oy) {
    const a = sim.pos[d.anchor];
    const bx = ox + a.x, by = oy + a.y - d.rad * 0.6;
    const tx = bx + d.tip.x, ty = by + d.tip.y + d.rad * 0.6;
    const path = () => {
        ctx.beginPath();
        ctx.moveTo(bx - d.rad, by);
        ctx.bezierCurveTo(bx - d.rad * 0.6, by + (ty - by) * 0.45, tx - d.rad * 0.9, ty - d.rad * 0.8, tx, ty);
        ctx.bezierCurveTo(tx + d.rad * 0.9, ty - d.rad * 0.8, bx + d.rad * 0.6, by + (ty - by) * 0.45, bx + d.rad, by);
        ctx.closePath();
    };
    path();
    ctx.fillStyle = SL.body;
    ctx.fill();
    if (d.yellow) {
        ctx.save();
        path();
        ctx.clip();
        ctx.fillStyle = SL.bodyYellow;
        ctx.beginPath();
        ctx.ellipse(tx, ty - d.rad * 0.6, d.rad * 1.3, d.rad * 1.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    path();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = 1.0;
    ctx.stroke();
}
function drawFace(ctx, inp, cx, cy, bw, bh) {
    let mouth = "smile";
    let eyeStretch = 1, lid = 0;
    if (!inp.grounded && inp.vy < 0) {
        mouth = "o";
        eyeStretch = 1.1;
    }
    else if (inp.wallSliding) {
        mouth = "worried";
        lid = 0.15;
    }
    else if (!inp.grounded && inp.vy > 300) {
        mouth = "worried";
        eyeStretch = 1.15;
    }
    if (sim.squintMs > 0) {
        lid = 0.55;
        mouth = "worried";
    }
    if (inp.grounded && Math.abs(inp.vx) < 20 && (inp.timeMs % 4000) > 3860)
        lid = 1;
    // side = eased facing x how side-on he is: 0 = straight on, +-1 = 3/4 view toward that side
    const side = sim.turn * sim.prof, a = Math.abs(side);
    const dir = side > 0.001 ? 1 : side < -0.001 ? -1 : inp.facing;
    const fast = inp.dashing || (Math.abs(inp.vx) > 200 && !inp.wallSliding);
    if (fast && mouth === "smile")
        mouth = "grin";
    const ex = cx + side * bw * 0.15;
    const ey = cy - bh * 0.14 - a * bh * 0.03;
    const r = Math.min(bw, bh) * TUNE.eyeFrac;
    const gap = r * 1.02;
    // pupils glance toward motion and toward the side he's facing
    const lookX = Math.max(-1, Math.min(1, inp.vx / 260 + side * 0.6)) * r * 0.18;
    const lookY = Math.max(-1, Math.min(1, inp.vy / 600)) * r * 0.18;
    // 3/4 view: both eyes slide toward the front; the far one tucks behind, narrower and a bit higher
    const nearX = ex + dir * gap * (1 - 0.12 * a), farX = ex - dir * gap * (1 - 0.48 * a);
    const farSq = 1 - 0.24 * a;
    eye(ctx, farX, ey - a * r * 0.10, r * (1 - 0.06 * a), eyeStretch, lid, lookX, lookY, farSq);
    eye(ctx, nearX, ey, r, eyeStretch, lid, lookX, lookY, 1);
    // white freckles under the outer edge of each eye (the far cheek's fade out as he turns)
    ctx.fillStyle = SL.hi;
    const fr = Math.max(0.45, bw * 0.022);
    for (const sgn of [-dir, dir]) {
        const far = sgn !== dir;
        if (far && a > 0.75)
            continue;
        const bx = (far ? farX : nearX) + sgn * (r * (far ? farSq : 1) + r * 0.15 - r), by = ey + r * 1.3;
        for (const [dx, dy, k] of [[-0.25, 0, 1], [0.2, -0.12, 0.8], [0.05, 0.3, 0.9], [0.45, 0.2, 0.7]]) {
            ctx.beginPath();
            ctx.arc(bx + dx * r * sgn * (far ? farSq : 1), by + dy * r, fr * k * (far ? 1 - 0.5 * a : 1), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW * 0.85;
    const my = ey + r * 1.45;
    const mx = cx + side * bw * 0.20;
    const mb = TUNE.squish ? bw * TUNE.mouthScale : bw; // mouth size base
    ctx.beginPath();
    if (mouth === "grin") {
        // Sloomoo Rushed: big open grin with a pink tongue, opening toward the front
        const gw = mb * 0.17, gh = mb * 0.15, gx = mx + dir * a * mb * 0.03, gy = my - mb * 0.05;
        const grin = () => {
            ctx.beginPath();
            ctx.moveTo(gx - gw, gy);
            ctx.quadraticCurveTo(gx, gy - gh * 0.12, gx + gw, gy);
            ctx.quadraticCurveTo(gx + gw * 0.9, gy + gh * 1.2, gx, gy + gh * 1.15);
            ctx.quadraticCurveTo(gx - gw * 0.9, gy + gh * 1.2, gx - gw, gy);
            ctx.closePath();
        };
        grin();
        ctx.fillStyle = SL.eyePupil;
        ctx.fill();
        ctx.save();
        grin();
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(gx + dir * gw * 0.35, gy + gh * 1.0, gw * 0.55, gh * 0.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = SL.snoozle;
        ctx.fill();
        ctx.restore();
        grin();
        ctx.stroke();
    }
    else if (mouth === "smile") {
        ctx.arc(mx, my - mb * 0.07, mb * 0.09, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
    }
    else if (mouth === "o") {
        ctx.ellipse(mx, my, mb * 0.06, mb * 0.08, 0, 0, Math.PI * 2);
        ctx.fillStyle = SL.eyePupil;
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(mx, my + mb * 0.04, mb * 0.04, mb * 0.03, 0, 0, Math.PI * 2);
        ctx.fillStyle = SL.snoozle;
        ctx.fill();
    }
    else {
        ctx.arc(mx, my + mb * 0.06, mb * 0.08, 1.2 * Math.PI, 1.8 * Math.PI);
        ctx.stroke();
    }
}
function eye(ctx, cx, cy, r, stretch, lid, lx, ly, squashX) {
    ctx.save();
    if (squashX !== 1) {
        ctx.translate(cx, cy);
        ctx.scale(squashX, 1);
        ctx.translate(-cx, -cy);
    }
    const ry = r * stretch;
    const ring = (k, color, dx = 0, dy = 0) => {
        ctx.beginPath();
        ctx.ellipse(cx + dx, cy + dy, r * k, ry * k, 0, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    };
    ring(1, SL.eyeOuter);
    ring(0.80, SL.eyeMid, lx * 0.4, ly * 0.4);
    ring(0.60, SL.eyeIris, lx * 0.8, ly * 0.8);
    ring(0.40, SL.eyePupil, lx, ly);
    // sparkle highlight + small dot
    ctx.fillStyle = SL.hi;
    const hx = cx + lx + r * 0.12, hy = cy + ly - ry * 0.18, hs = r * 0.20;
    ctx.beginPath();
    ctx.moveTo(hx, hy - hs * 1.3);
    ctx.quadraticCurveTo(hx + hs * 0.15, hy - hs * 0.15, hx + hs * 1.1, hy);
    ctx.quadraticCurveTo(hx + hs * 0.15, hy + hs * 0.15, hx, hy + hs * 1.3);
    ctx.quadraticCurveTo(hx - hs * 0.15, hy + hs * 0.15, hx - hs * 1.1, hy);
    ctx.quadraticCurveTo(hx - hs * 0.15, hy - hs * 0.15, hx, hy - hs * 1.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + lx - r * 0.22, cy + ly + ry * 0.2, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    if (lid > 0.001) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r + 0.5, ry + 0.5, 0, 0, Math.PI * 2);
        ctx.clip();
        const lidY = cy - ry + lid * 2 * ry;
        ctx.fillStyle = SL.body;
        ctx.fillRect(cx - r - 1, cy - ry - 1, 2 * r + 2, lidY - (cy - ry) + 1);
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(cx - r, lidY);
        ctx.quadraticCurveTo(cx, lidY + r * 0.1, cx + r, lidY);
        ctx.stroke();
        ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = TUNE.outlineW * 0.75;
    ctx.stroke();
    ctx.restore();
}
// ------------------------------------------------------------------ Rushed form
/*
 * When Sloomoo moves fast he stops being the upright blob and becomes the
 * Sloomoo_Rushed drawing: a round head tipped into the motion with a side-on
 * face (eyes up front, huge open mouth), a long thin wavy tail that follows the
 * path the head just travelled, a flat streaming snoozle and yellow speed
 * swooshes. Strength R (0..1) scales the tail, mouth and swooshes: small at
 * walking speed, full at top run speed and while dashing. Below RUSH.exit he
 * goes back to the soft body.
 */
export const RUSH = {
    minSpeed: 50, // |vx| where the rushed form starts to grow (px/s)
    fullSpeed: 235, // |vx| for the full form
    enter: 0.16, exit: 0.08, // hysteresis on R for switching forms
    rise: 9, fall: 11, // R easing (1/s)
    straighten: 0.45, // blend the path-following tail toward a straight line behind him (stops loops on reversals)
    head: 1.0, // head radius vs half the drawn body width
    tailLen: 6.0, // full tail length (x head radius)
    tailWave: 0.38, // wave amplitude at the tip (x head radius)
    waveLen: 2.6, // wavelength (x head radius)
    waveHz: 2.4,
    tilt: 0.20, // nose-down tilt while running (rad)
    turnRate: 16, // how fast the head mirrors on a direction change (1/s)
    swoosh: 1, // yellow speed swooshes (0 = off)
    enabled: 0, // 0 = never use the Rushed ribbon-tail form; run/dash come from the soft body (?rush=1 turns it back on)
};
if (typeof location !== "undefined") {
    const qr = new URLSearchParams(location.search).get("rush");
    if (qr !== null)
        RUSH.enabled = Number(qr) ? 1 : 0;
}
const rush = { R: 0, on: false, hist: [], ds: 1, tilt: 0, snz: { x: 0, y: 0, vx: 0, vy: 0 }, snzInit: false, path: null };
function rushHeadR(rect) { return rect.w * BW() * 0.5 * RUSH.head; }
/** Head centre in world coords for the current frame. */
function rushHead(inp) {
    const { rect } = inp, Rh = rushHeadR(rect);
    const ox = rect.x + rect.w / 2, oy = rect.y + rect.h;
    const bob = inp.grounded ? Math.abs(Math.sin(sim.runDist / 13)) * Rh * 0.10 * rush.R : 0;
    return { x: ox + Math.sign(rush.ds || 1) * Rh * 0.15, y: oy - Rh * 0.92 - bob };
}
function updateRush(inp) {
    const dt = inp.dt;
    if (dt <= 0)
        return;
    if (!RUSH.enabled) {
        rush.on = false;
        rush.R = 0;
        return;
    }
    let Rt = Math.max(0, Math.min(1, (Math.abs(inp.vx) - RUSH.minSpeed) / (RUSH.fullSpeed - RUSH.minSpeed)));
    if (inp.dashing)
        Rt = 1;
    if (inp.wallSliding)
        Rt = 0;
    rush.R += (Rt - rush.R) * Math.min(1, dt * (Rt > rush.R ? RUSH.rise : inp.wallSliding ? 30 : RUSH.fall));
    if (!rush.on && rush.R > RUSH.enter)
        rush.on = true;
    else if (rush.on && rush.R < RUSH.exit)
        rush.on = false;
    const want = Math.abs(inp.vx) > 20 ? Math.sign(inp.vx) : inp.facing;
    const prevS = rush.ds >= 0 ? 1 : -1;
    rush.ds += (want - rush.ds) * Math.min(1, dt * RUSH.turnRate);
    const sgn = rush.ds >= 0 ? 1 : -1;
    if (sgn !== prevS)
        rush.hist = rush.hist.slice(-3); // reversal: regrow the tail on the new side
    // nose-down on the ground, follow the flight angle in the air
    let tt = RUSH.tilt * rush.R;
    if (!inp.grounded)
        tt = Math.max(-0.55, Math.min(0.55, Math.atan2(inp.vy, Math.abs(inp.vx) + 60) * 0.6));
    rush.tilt += (sgn * tt - rush.tilt) * Math.min(1, dt * 10);
    // path history of the head
    const hc = rushHead(inp), Rh = rushHeadR(inp.rect);
    const last = rush.hist[rush.hist.length - 1];
    if (!last || Math.hypot(hc.x - last.x, hc.y - last.y) > 90)
        rush.hist = [hc];
    else if (Math.hypot(hc.x - last.x, hc.y - last.y) > 0.5)
        rush.hist.push(hc);
    let len = 0;
    for (let i = rush.hist.length - 1; i > 0; i--) {
        len += Math.hypot(rush.hist[i].x - rush.hist[i - 1].x, rush.hist[i].y - rush.hist[i - 1].y);
        if (len > Rh * RUSH.tailLen * 1.6) {
            rush.hist.splice(0, i - 1);
            break;
        }
    }
    // snoozle tip: world-space spring toward a point behind and above the head, so it lags and swings
    const tgt = { x: hc.x - sgn * Rh * (0.75 + 0.45 * rush.R), y: hc.y - Rh * (1.55 - 0.35 * rush.R) };
    const s = rush.snz;
    if (!rush.snzInit || Math.hypot(s.x - tgt.x, s.y - tgt.y) > Rh * 6) {
        s.x = tgt.x;
        s.y = tgt.y;
        s.vx = 0;
        s.vy = 0;
        rush.snzInit = true;
    }
    s.vx += ((tgt.x - s.x) * 140 - s.vx * 11) * dt;
    s.vy += ((tgt.y - s.y) * 140 - s.vy * 11) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
}
/** Tail centre line in world coords: walks back along the head's path; straight behind if the path is short. */
function rushSpine(hc, L, step) {
    const out = [{ x: hc.x, y: hc.y }];
    const h = rush.hist;
    let i = h.length - 1, cur = { x: hc.x, y: hc.y }, need = step;
    while (out.length * step < L + 0.01) {
        const nxt = i >= 0 ? h[i] : null;
        if (!nxt) {
            const a = out[out.length - 1], b = out.length > 1 ? out[out.length - 2] : { x: a.x + Math.sign(rush.ds || 1), y: a.y };
            const dx = a.x - b.x, dy = a.y - b.y, dl = Math.hypot(dx, dy) || 1;
            const p = { x: a.x + dx / dl * step, y: a.y + dy / dl * step };
            out.push(p);
            cur = p;
            continue;
        }
        const d = Math.hypot(nxt.x - cur.x, nxt.y - cur.y);
        if (d >= need) {
            const u = need / d;
            cur = { x: cur.x + (nxt.x - cur.x) * u, y: cur.y + (nxt.y - cur.y) * u };
            out.push(cur);
            need = step;
        }
        else {
            need -= d;
            cur = { x: nxt.x, y: nxt.y };
            i--;
        }
    }
    return out;
}
function drawRush(ctx, inp) {
    const { rect } = inp, R = rush.R, t = inp.timeMs / 1000;
    const ox = rect.x + rect.w / 2, oy = rect.y + rect.h;
    const Rh = rushHeadR(rect), hc = rushHead(inp);
    const ds = rush.ds, sgn = ds >= 0 ? 1 : -1;
    const ow = TUNE.outlineW;
    const L = Rh * RUSH.tailLen * (0.25 + 0.75 * R);
    const step = Rh * 0.22;
    const spine = rushSpine(hc, L, step);
    const n = spine.length;
    // offsets: travelling wave across the tail, growing toward the tip
    const pts = [];
    for (let k = 0; k < n; k++) {
        const a = spine[Math.max(0, k - 1)], b = spine[Math.min(n - 1, k + 1)];
        let tx = b.x - a.x, ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const nx = -ty, ny = tx;
        const s = k * step, u = s / L;
        const amp = Rh * RUSH.tailWave * Math.pow(u, 0.9) * (0.5 + 0.5 * R);
        const off = Math.sin(2 * Math.PI * (s / (Rh * RUSH.waveLen) - t * RUSH.waveHz)) * amp;
        // straight line behind the head along the motion, blended in so reversals don't loop
        const st = RUSH.straighten * Math.min(1, s / (Rh * 2));
        const bx = hc.x - sgn * s * Math.cos(rush.tilt * 0.6), by = hc.y - sgn * s * Math.sin(rush.tilt * 0.6);
        const p = { x: spine[k].x * (1 - st) + bx * st + nx * off - ox, y: spine[k].y * (1 - st) + by * st + ny * off - oy };
        // width: fat root inside the head, quick pinch into a thin streamer, a goo bulge, thin tip
        const root = Math.max(0, 1 - s / (Rh * 2.3));
        const bulge = 0.12 * Math.exp(-Math.pow((u - 0.62) / 0.09, 2));
        const w = Rh * (0.07 + 0.26 * Math.pow(1 - u, 1.3) + 0.55 * root * root + bulge) * (0.75 + 0.25 * R);
        pts.push({ p, nx, ny, w });
    }
    ctx.save();
    ctx.translate(ox, oy);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const hx = hc.x - ox, hy = hc.y - oy;
    const rx = Rh * 1.08, ry = Rh * 0.94;
    // contact shadow
    if (inp.grounded) {
        ctx.fillStyle = "rgba(20, 15, 45, 0.25)";
        ctx.beginPath();
        ctx.ellipse(hx - sgn * L * 0.25, 0, rx + L * 0.3, rect.h * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    // yellow speed swooshes behind him
    if (RUSH.swoosh > 0 && R > 0.35) {
        const k0 = Math.min(n - 1, Math.round(n * 0.45)), k1 = Math.min(n - 1, Math.round(n * 0.30));
        const sw = (k, side, lenK, flick) => {
            const q = pts[k];
            const a = Math.atan2(-q.nx * side * 0 + (pts[Math.min(n - 1, k + 1)].p.y - q.p.y), pts[Math.min(n - 1, k + 1)].p.x - q.p.x);
            const cx = q.p.x + q.nx * side * Rh * (side > 0 ? 1.5 : 1.0), cy = q.p.y + q.ny * side * Rh * (side > 0 ? 1.5 : 1.0);
            const len = Rh * lenK * (0.6 + 0.4 * R) * (0.9 + 0.1 * Math.sin(t * 17 + flick)), th = Rh * 0.32;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(a);
            ctx.globalAlpha = Math.min(1, (R - 0.35) / 0.4);
            ctx.beginPath();
            ctx.moveTo(-len * 0.15, 0); // pointed front (toward the head)
            ctx.quadraticCurveTo(len * 0.35, -th * side, len, -th * 0.6 * side);
            ctx.quadraticCurveTo(len * 0.80, -th * 0.15 * side, len * 0.92, th * 0.25 * side); // little hook at the back
            ctx.quadraticCurveTo(len * 0.45, -th * 0.25 * side, -len * 0.15, 0);
            ctx.closePath();
            ctx.fillStyle = SL.bodyYellow;
            ctx.fill();
            ctx.strokeStyle = SL.outline;
            ctx.lineWidth = ow * 0.7;
            ctx.stroke();
            ctx.restore();
        };
        sw(k0, 1, 2.6, 0);
        sw(k1, -1, 1.7, 2);
    }
    // silhouette: head ellipse + tail ribbon
    const Lp = pts.map(q => ({ x: q.p.x + q.nx * q.w, y: q.p.y + q.ny * q.w }));
    const Rp = pts.map(q => ({ x: q.p.x - q.nx * q.w, y: q.p.y - q.ny * q.w }));
    // match the head's winding to the tail's so the nonzero union has no hole where they overlap
    const ring = Lp.concat(Rp.slice().reverse());
    let sa = 0;
    for (let k = 0; k < ring.length; k++) {
        const a = ring[k], b = ring[(k + 1) % ring.length];
        sa += a.x * b.y - b.x * a.y;
    }
    const body = new Path2D();
    body.ellipse(hx, hy, rx, ry, rush.tilt, 0, Math.PI * 2, sa < 0);
    const tail = new Path2D();
    tail.moveTo(Lp[0].x, Lp[0].y);
    for (let k = 1; k < n; k++)
        tail.quadraticCurveTo(Lp[k - 1].x, Lp[k - 1].y, (Lp[k - 1].x + Lp[k].x) / 2, (Lp[k - 1].y + Lp[k].y) / 2);
    const tip = pts[n - 1].p;
    tail.quadraticCurveTo(Lp[n - 1].x, Lp[n - 1].y, tip.x, tip.y);
    tail.quadraticCurveTo(Rp[n - 1].x, Rp[n - 1].y, (Rp[n - 1].x + Rp[n - 2].x) / 2, (Rp[n - 1].y + Rp[n - 2].y) / 2);
    for (let k = n - 2; k > 0; k--)
        tail.quadraticCurveTo(Rp[k].x, Rp[k].y, (Rp[k].x + Rp[k - 1].x) / 2, (Rp[k].y + Rp[k - 1].y) / 2);
    tail.lineTo(Rp[0].x, Rp[0].y);
    tail.closePath();
    body.addPath(tail);
    // forked splash at the tip (Rushed's curled ends)
    const tp = pts[n - 1], tq = pts[Math.max(0, n - 3)];
    const ta = Math.atan2(tp.p.y - tq.p.y, tp.p.x - tq.p.x);
    const prong = (da, len, curl) => {
        const pr = new Path2D();
        const ex = tp.p.x + Math.cos(ta + da) * len, ey = tp.p.y + Math.sin(ta + da) * len;
        const mx = tp.p.x + Math.cos(ta + da * 0.4) * len * 0.6, my = tp.p.y + Math.sin(ta + da * 0.4) * len * 0.6;
        pr.moveTo(tq.p.x, tq.p.y);
        pr.quadraticCurveTo(mx, my, ex, ey);
        pr.quadraticCurveTo(ex + Math.cos(ta + da + curl) * len * 0.25, ey + Math.sin(ta + da + curl) * len * 0.25, ex + Math.cos(ta + da + curl * 2) * len * 0.15, ey + Math.sin(ta + da + curl * 2) * len * 0.15);
        return pr;
    };
    const pk = Math.max(0, (R - 0.5) / 0.5);
    const prongs = pk > 0.05 ? [prong(-0.55, Rh * 0.8 * pk, -1.1), prong(0.35, Rh * 0.5 * pk, 1.2)] : [];
    const prW = Math.max(1, Rh * 0.11);
    // outline underlay, then fill (hides internal seams)
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = ow * 2;
    ctx.stroke(body);
    for (const pr of prongs) {
        ctx.lineWidth = prW + ow * 2;
        ctx.stroke(pr);
    }
    ctx.fillStyle = SL.body;
    ctx.fill(body, "nonzero");
    ctx.strokeStyle = SL.body;
    for (const pr of prongs) {
        ctx.lineWidth = prW;
        ctx.stroke(pr);
    }
    rush.path = body;
    // cel shade along the underside, yellow goo band over the head
    ctx.save();
    ctx.clip(body, "nonzero");
    ctx.fillStyle = SL.bodyShade;
    ctx.fillRect(-4000, -4000, 8000, 8000);
    ctx.save();
    ctx.translate(-sgn * Rh * 0.08, -Rh * 0.17);
    ctx.fillStyle = SL.body;
    ctx.fill(body, "nonzero");
    ctx.restore();
    // head frame: rotate with the tilt, mirror (with a squash through the turn) by ds
    ctx.translate(hx, hy);
    ctx.rotate(rush.tilt);
    ctx.scale(ds, 1);
    ctx.beginPath();
    ctx.ellipse(-Rh * 0.05, -Rh * 0.62, Rh * 0.95, Rh * 0.48, -0.12, 0, Math.PI * 2);
    ctx.fillStyle = SL.bodyYellow;
    ctx.fill();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = ow * 0.75;
    ctx.stroke();
    ctx.restore();
    // snoozle: thick yellow neck from the top-back of the head to a big glossy magenta blob
    {
        const c = Math.cos(rush.tilt), sn = Math.sin(rush.tilt);
        const L2W = (lx, ly) => ({ x: hx + (lx * ds) * c - ly * sn, y: hy + (lx * ds) * sn + ly * c });
        const r0 = L2W(-Rh * 0.30, -Rh * 0.80);
        const tipP = { x: rush.snz.x - ox, y: rush.snz.y - oy };
        const mid = { x: (r0.x + tipP.x) / 2, y: Math.min(r0.y, tipP.y) - Rh * 0.35 };
        const seg = 10, Lr = [], Rr = [];
        for (let k = 0; k <= seg; k++) {
            const u = k / seg, iu = 1 - u;
            const p = { x: iu * iu * r0.x + 2 * iu * u * mid.x + u * u * tipP.x, y: iu * iu * r0.y + 2 * iu * u * mid.y + u * u * tipP.y };
            const d = { x: 2 * iu * (mid.x - r0.x) + 2 * u * (tipP.x - mid.x), y: 2 * iu * (mid.y - r0.y) + 2 * u * (tipP.y - mid.y) };
            const dl = Math.hypot(d.x, d.y) || 1;
            const w = Rh * (0.19 - 0.08 * u);
            Lr.push({ x: p.x - d.y / dl * w, y: p.y + d.x / dl * w });
            Rr.push({ x: p.x + d.y / dl * w, y: p.y - d.x / dl * w });
        }
        const neck = new Path2D();
        neck.moveTo(Lr[0].x, Lr[0].y);
        for (let k = 1; k <= seg; k++)
            neck.lineTo(Lr[k].x, Lr[k].y);
        for (let k = seg; k >= 0; k--)
            neck.lineTo(Rr[k].x, Rr[k].y);
        neck.closePath();
        ctx.fillStyle = SL.bodyYellow;
        ctx.fill(neck);
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = ow * 0.8;
        ctx.beginPath();
        ctx.moveTo(Lr[1].x, Lr[1].y);
        for (let k = 2; k <= seg; k++)
            ctx.lineTo(Lr[k].x, Lr[k].y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(Rr[1].x, Rr[1].y);
        for (let k = 2; k <= seg; k++)
            ctx.lineTo(Rr[k].x, Rr[k].y);
        ctx.stroke();
        // bulb, stretched along the neck direction
        const ang = Math.atan2(tipP.y - mid.y, tipP.x - mid.x);
        const bR = Rh * 0.42;
        ctx.save();
        ctx.translate(tipP.x, tipP.y);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.ellipse(bR * 0.35, 0, bR * 1.15, bR * 0.85, 0, 0, Math.PI * 2);
        ctx.fillStyle = SL.snoozle;
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.ellipse(bR * 0.35, bR * 0.55, bR * 1.2, bR * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = SL.snoozleShade;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(bR * 0.35, 0, bR * 1.15, bR * 0.85, 0, 0, Math.PI * 2);
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = ow * 0.8;
        ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = Math.max(0.8, bR * 0.16);
        ctx.beginPath();
        ctx.ellipse(bR * 0.35, 0, bR * 0.80, bR * 0.50, 0, -2.4, -1.5);
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(bR * 0.95, -bR * 0.42, bR * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // face, side-on
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(rush.tilt);
    ctx.scale(ds, 1);
    const head = new Path2D();
    head.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    const er = Rh * 0.36;
    const look = er * 0.22;
    eye(ctx, -Rh * 0.02, -Rh * 0.50, er * 0.92, 1, 0, look, 0, 0.82); // far eye, tucked behind
    eye(ctx, Rh * 0.50, -Rh * 0.36, er, 1, 0, look, 0, 1); // near eye, up front
    // freckles behind the eye
    ctx.fillStyle = SL.hi;
    for (const [fx, fy, k] of [[-0.45, 0.02, 1], [-0.30, -0.08, 0.8], [-0.36, 0.12, 0.7], [-0.20, 0.06, 0.6]]) {
        ctx.beginPath();
        ctx.arc(Rh * fx, Rh * fy, Math.max(0.45, Rh * 0.045) * k, 0, Math.PI * 2);
        ctx.fill();
    }
    // mouth: the huge Rushed grin opening to the front, scaled by R; a smile when slow
    ctx.save();
    ctx.clip(head);
    if (R > 0.4) {
        const m = 0.45 + 0.55 * Math.min(1, (R - 0.4) / 0.5);
        const mouth = new Path2D();
        const mt = Rh * 0.16;
        mouth.moveTo(-Rh * 0.20 * m, mt);
        mouth.quadraticCurveTo(Rh * 0.45, mt - Rh * 0.06, Rh * 1.05, mt + Rh * 0.02);
        mouth.bezierCurveTo(Rh * 1.0, mt + Rh * 0.55 * m, Rh * 0.70, mt + Rh * 0.72 * m, Rh * 0.35, mt + Rh * 0.70 * m);
        mouth.bezierCurveTo(Rh * 0.0, mt + Rh * 0.66 * m, -Rh * 0.20 * m, mt + Rh * 0.30 * m, -Rh * 0.20 * m, mt);
        mouth.closePath();
        ctx.fillStyle = SL.eyePupil;
        ctx.fill(mouth);
        ctx.save();
        ctx.clip(mouth);
        ctx.beginPath();
        ctx.ellipse(Rh * 0.62, mt + Rh * 0.62 * m, Rh * 0.40 * m, Rh * 0.26 * m, -0.25, 0, Math.PI * 2);
        ctx.fillStyle = SL.snoozle;
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = ow * 0.85;
        ctx.stroke(mouth);
    }
    else {
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = ow * 0.85;
        ctx.beginPath();
        ctx.arc(Rh * 0.42, Rh * 0.08, Rh * 0.22, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke();
    }
    ctx.restore();
    // wet shine on the front of the head
    if (TUNE.gloss > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = Math.max(0.8, Rh * 0.07);
        ctx.beginPath();
        ctx.ellipse(0, 0, rx * 0.80, ry * 0.80, 0, 0.62 * Math.PI, 0.82 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(-rx * 0.80 * Math.cos(0.12 * Math.PI), ry * 0.80 * Math.sin(0.12 * Math.PI), Rh * 0.05, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
    ctx.restore();
}
//# sourceMappingURL=slime.js.map