/**
 * Touch controls (phones/tablets). Feeds the same key state as the keyboard,
 * so gameplay code is unchanged. Only shown on touch devices (or ?touch=1).
 * Floating left stick = move / dash direction, right buttons = jump + dash,
 * context buttons for menu / pause / level-complete.
 */
import { pressKey, releaseKey } from "./input.js";
import { session } from "./game.js";
const FORCE = location.search.includes("touch=1");
const IS_TOUCH = FORCE || (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches);
export function installTouchControls() {
    if (!IS_TOUCH)
        return;
    document.body.classList.add("touch");
    const css = document.createElement("style");
    css.textContent = [
        "body.touch{margin:0;padding:0;overflow:hidden;position:fixed;inset:0;background:#06141a;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}",
        "body.touch .wrap{padding:0;gap:0;min-height:0;display:block}",
        "body.touch .wrap h2, body.touch .hint{display:none}",
        "body.touch #game{position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;object-fit:contain;border:none;image-rendering:auto;background:#06141a}",
        "#tc{position:fixed;inset:0;z-index:10;pointer-events:none;font-family:system-ui,sans-serif}",
        "#tc .zone{position:absolute;pointer-events:auto;touch-action:none}",
        "#tc .stickbase{position:absolute;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;border:2px solid rgba(160,235,230,.45);background:rgba(20,60,70,.28);display:none}",
        "#tc .stickknob{position:absolute;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:rgba(150,235,230,.55);border:2px solid rgba(220,255,250,.7);display:none}",
        "#tc .btn{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;border:2px solid rgba(200,245,240,.55);background:rgba(20,70,80,.38);color:#e8fffb;font-weight:700;display:flex;align-items:center;justify-content:center;text-align:center;font-size:15px}",
        "#tc .btn.on{background:rgba(120,230,225,.55)}",
        "#tc .sq{border-radius:14px;font-size:13px;padding:0 6px}",
        "#tc .hint{position:absolute;left:0;right:0;top:40%;text-align:center;color:#cfe;font-size:18px;display:none;pointer-events:none}",
        "#rot{position:fixed;inset:0;z-index:20;background:#06141a;color:#e8fffb;display:none;align-items:center;justify-content:center;text-align:center;font:20px system-ui,sans-serif;padding:30px}",
        "@media (orientation:portrait){#rot{display:flex}}",
    ].join("\n");
    document.head.appendChild(css);
    const meta = document.querySelector('meta[name="viewport"]') || document.head.appendChild(document.createElement("meta"));
    meta.setAttribute("name", "viewport");
    meta.setAttribute("content", "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover");
    const rot = document.createElement("div");
    rot.id = "rot";
    rot.innerHTML = "Rotate your phone to landscape<br>to play 🐠";
    document.body.appendChild(rot);
    const root = document.createElement("div");
    root.id = "tc";
    document.body.appendChild(root);
    const el = (cls, html = "", style = "") => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; d.style.cssText = style; root.appendChild(d); return d; };
    // ---- Floating stick (left) ----
    const stickZone = el("zone", "", "left:0;bottom:0;width:46%;height:70%");
    const base = document.createElement("div");
    base.className = "stickbase";
    stickZone.appendChild(base);
    const knob = document.createElement("div");
    knob.className = "stickknob";
    stickZone.appendChild(knob);
    let stickId = -1, ox = 0, oy = 0;
    const DEAD = 16, DIAG = 0.5;
    const dirKeys = ["arrowleft", "arrowright", "touchup", "arrowdown"];
    const held = new Set();
    const setDir = (k, on) => { if (on && !held.has(k)) {
        held.add(k);
        pressKey(k);
    }
    else if (!on && held.has(k)) {
        held.delete(k);
        releaseKey(k);
    } };
    const clearDir = () => { for (const k of dirKeys)
        setDir(k, false); };
    const rel = (e) => { const r = stickZone.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const upd = (e) => {
        const [x, y] = rel(e);
        let dx = x - ox, dy = y - oy;
        const len = Math.hypot(dx, dy), max = 55;
        if (len > max) {
            ox += dx - dx / len * max;
            oy += dy - dy / len * max;
            base.style.left = ox + "px";
            base.style.top = oy + "px";
            dx = dx / len * max;
            dy = dy / len * max;
        }
        knob.style.left = (ox + dx) + "px";
        knob.style.top = (oy + dy) + "px";
        const l = Math.hypot(dx, dy);
        if (l < DEAD) {
            clearDir();
            return;
        }
        const nx = dx / l, ny = dy / l;
        setDir("arrowleft", nx < -DIAG);
        setDir("arrowright", nx > DIAG);
        setDir("touchup", ny < -DIAG);
        setDir("arrowdown", ny > DIAG);
    };
    stickZone.addEventListener("pointerdown", (e) => {
        if (stickId !== -1)
            return;
        stickId = e.pointerId;
        stickZone.setPointerCapture(e.pointerId);
        [ox, oy] = rel(e);
        base.style.left = ox + "px";
        base.style.top = oy + "px";
        knob.style.left = ox + "px";
        knob.style.top = oy + "px";
        base.style.display = knob.style.display = "block";
        upd(e);
        e.preventDefault();
    });
    stickZone.addEventListener("pointermove", (e) => { if (e.pointerId === stickId) {
        upd(e);
        e.preventDefault();
    } });
    const endStick = (e) => { if (e.pointerId !== stickId)
        return; stickId = -1; clearDir(); base.style.display = knob.style.display = "none"; };
    stickZone.addEventListener("pointerup", endStick);
    stickZone.addEventListener("pointercancel", endStick);
    const btns = [];
    const mk = (label, style, keys, cls = "btn", hold = true) => {
        const d = el(cls, label, style);
        const b = { div: d, keys, hold, id: -1 };
        btns.push(b);
        d.addEventListener("pointerdown", (e) => { if (b.id !== -1)
            return; b.id = e.pointerId; d.setPointerCapture(e.pointerId); d.classList.add("on"); for (const k of keys)
            pressKey(k); if (!hold)
            setTimeout(() => { for (const k of keys)
                releaseKey(k); }, 60); e.preventDefault(); });
        const up = (e) => { if (e.pointerId !== b.id)
            return; b.id = -1; d.classList.remove("on"); if (hold)
            for (const k of keys)
                releaseKey(k); };
        d.addEventListener("pointerup", up);
        d.addEventListener("pointercancel", up);
        return d;
    };
    const pad = "env(safe-area-inset-right,0px)";
    const gameBtns = [
        mk("JUMP", "right:calc(" + pad + " + 24px);bottom:34px;width:92px;height:92px", [" "]),
        mk("DASH", "right:calc(" + pad + " + 128px);bottom:84px;width:80px;height:80px", ["shift"], "btn", false),
        mk("❚❚", "right:calc(" + pad + " + 12px);top:10px;width:44px;height:44px", ["escape"], "btn", false),
    ];
    const pauseBtns = [
        mk("Resume", "left:50%;top:68%;margin-left:-255px;width:150px;height:48px", ["escape"], "btn sq", false),
        mk("Restart at checkpoint", "left:50%;top:68%;margin-left:-95px;width:190px;height:48px", ["r"], "btn sq", false),
        mk("Main menu", "left:50%;top:68%;margin-left:105px;width:150px;height:48px", ["q"], "btn sq", false),
    ];
    const menuBtns = [
        mk("▲", "left:30px;bottom:110px;width:64px;height:64px", ["arrowup"], "btn", false),
        mk("▼", "left:30px;bottom:30px;width:64px;height:64px", ["arrowdown"], "btn", false),
        mk("◀", "left:110px;bottom:70px;width:64px;height:64px", ["arrowleft"], "btn", false),
        mk("▶", "left:190px;bottom:70px;width:64px;height:64px", ["arrowright"], "btn", false),
        mk("OK", "right:40px;bottom:50px;width:96px;height:96px", ["enter"], "btn", false),
        mk("Back", "right:150px;bottom:60px;width:76px;height:76px", ["escape"], "btn", false),
        mk("Yes", "right:240px;bottom:60px;width:60px;height:60px", ["y"], "btn", false),
    ];
    const nextBtn = mk("Continue", "left:50%;top:60%;margin-left:-80px;width:160px;height:56px", [" "], "btn sq", false);
    const againBtn = mk("Play again", "left:50%;top:60%;margin-left:-80px;width:160px;height:56px", ["r"], "btn sq", false);
    const fsBtn = mk("⛶", "left:calc(env(safe-area-inset-left,0px) + 10px);top:10px;width:40px;height:40px", [], "btn", false);
    fsBtn.addEventListener("click", () => { try {
        void document.documentElement.requestFullscreen?.();
        screen.orientation.lock?.("landscape").catch(() => { });
    }
    catch { /* ignore */ } });
    const show = (list, on) => { for (const d of list)
        d.style.display = on ? "flex" : "none"; };
    let last = "";
    setInterval(() => {
        const s = session.state;
        if (s === last)
            return;
        last = s;
        clearDir();
        const playing = s === "playing";
        stickZone.style.display = playing ? "block" : "none";
        show(gameBtns.map(b => b), playing);
        show(pauseBtns, s === "paused");
        show(menuBtns, s === "menu");
        show([nextBtn], s === "level_complete");
        show([againBtn], s === "game_complete");
    }, 100);
}
//# sourceMappingURL=touch.js.map