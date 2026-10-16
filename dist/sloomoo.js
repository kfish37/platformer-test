/**
 * Parametric Sloomoo renderer — fallback when PNG sprites aren't loaded.
 *
 * Palette locked in docs/ART_STYLE.md (2026-07-20). Bezier silhouette,
 * cel-shade layers, rim light, drippy tendrils, eyelids, contact shadow,
 * variable line weight. Everything is parametric on SloomooState.
 */
import { facingRef } from "./facing.js";
// ---------- Sloomoo palette (locked in docs/ART_STYLE.md, 2026-07-20) ----------
// Palette sampled from the reference art (assets/graphic source/Sloomoo_*.png).
export const SL = {
    body: "#56AADF",
    bodyShade: "#4A8FCB",
    bodyLight: "#9BDBF7", // translucent jelly glow / wet rim (slimey pass)
    snoozle: "#DD2E8A",
    snoozleShade: "#B92679",
    bodyYellow: "#F8EA55",
    yellowShade: "#E3C640",
    eyeOuter: "#F8EA55",
    eyeMid: "#EFA238",
    eyeIris: "#DD2E8A",
    eyePupil: "#86328F",
    hi: "#FFFFFF",
    outline: "#7A2C8C",
};
// Line weight scale — tuned so silhouette reads at 28x36 without smearing.
const LW_SILHOUETTE = 1.8;
const LW_INTERIOR = 1.0;
const LW_EYE_RING = 0.9;
export function drawSloomoo(ctx, p, s) {
    facingRef.value = s.facing;
    // ---- Per-state morph params ----
    let squashX = 1.0, squashY = 1.0, tilt = 0;
    let mouth = "smile";
    let eyeStretch = 1.0;
    let eyelidDrop = 0.0;
    let dripSwayAmp = 1.0;
    let dripStretch = 1.0;
    if (s.running) {
        const phase = Math.floor(s.timeMs / 100) % 2;
        if (phase === 0) {
            squashX = 0.90;
            squashY = 1.08;
            tilt = 0.22 * s.facing;
        }
        else {
            squashX = 1.10;
            squashY = 0.92;
            tilt = -0.16 * s.facing;
        }
        dripSwayAmp = 2.5;
    }
    else if (s.jumping) {
        squashX = 0.86;
        squashY = 1.17;
        tilt = -0.22 * s.facing;
        mouth = "o";
        eyeStretch = 1.10;
        dripStretch = 1.6;
    }
    else if (s.wallSliding) {
        squashX = 0.78;
        squashY = 1.08;
        tilt = 0.35 * -s.wallSide;
        mouth = "worried";
        eyelidDrop = 0.15;
        dripStretch = 1.3;
    }
    else if (s.falling) {
        squashX = 1.05;
        squashY = 0.95;
        tilt = 0.20 * s.facing;
        mouth = "worried";
        eyeStretch = 1.15;
        dripStretch = 1.4;
    }
    else {
        const breath = Math.sin(s.timeMs / 700) * 0.03;
        squashX = 1.0 - breath;
        squashY = 1.0 + breath;
        const blinkT = (s.timeMs % 4000);
        if (blinkT > 3860)
            eyelidDrop = 1.0;
        else if (blinkT > 3800)
            eyelidDrop = (blinkT - 3800) / 60;
        dripSwayAmp = 1.0;
    }
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    // ---- Ground contact shadow (outside transform) ----
    if (s.grounded) {
        ctx.save();
        ctx.fillStyle = "rgba(20, 15, 45, 0.28)";
        ctx.beginPath();
        ctx.ellipse(cx, p.y + p.h - 1, p.w * 0.42, p.h * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s.facing, 1);
    // Droplet body: narrower at top, widest ~60% down, plump rounded bottom.
    const bodyW = p.w * 0.88 * squashX;
    const bodyH = p.h * 0.62 * squashY;
    const bodyCY = p.h * 0.14;
    const wobble = Math.sin(s.timeMs / 380) * 0.5;
    const wobble2 = Math.sin(s.timeMs / 540 + 1.3) * 0.4;
    function bodyPath() {
        const w = bodyW / 2;
        const h = bodyH / 2;
        const topW = w * 0.55;
        const yTop = bodyCY - h;
        const yWide = bodyCY + h * 0.15;
        const yBot = bodyCY + h;
        const dripRX = w * 0.98 + wobble;
        const dripRY = yBot - h * 0.15;
        const dripLX = -w * 0.95 - wobble2;
        const dripLY = yBot - h * 0.10;
        ctx.beginPath();
        ctx.moveTo(0, yTop);
        ctx.bezierCurveTo(topW * 0.9, yTop, w * 0.75, bodyCY - h * 0.55, w * 0.92, bodyCY - h * 0.15);
        ctx.bezierCurveTo(w * 1.02, bodyCY - h * 0.05, w, yWide - h * 0.05, w, yWide);
        ctx.bezierCurveTo(w * 1.00, yWide + h * 0.35, dripRX, dripRY - h * 0.10, dripRX, dripRY);
        ctx.bezierCurveTo(dripRX, dripRY + h * 0.30, w * 0.70, yBot, w * 0.30, yBot);
        ctx.bezierCurveTo(w * 0.10, yBot + 1, -w * 0.10, yBot + 1, -w * 0.30, yBot);
        ctx.bezierCurveTo(-w * 0.70, yBot, dripLX, dripLY + h * 0.30, dripLX, dripLY);
        ctx.bezierCurveTo(dripLX, dripLY - h * 0.10, -w * 1.00, yWide + h * 0.35, -w, yWide);
        ctx.bezierCurveTo(-w, yWide - h * 0.05, -w * 1.02, bodyCY - h * 0.05, -w * 0.92, bodyCY - h * 0.15);
        ctx.bezierCurveTo(-w * 0.75, bodyCY - h * 0.55, -topW * 0.9, yTop, 0, yTop);
        ctx.closePath();
    }
    bodyPath();
    ctx.fillStyle = SL.body;
    ctx.fill();
    // ---- Cel shadow layer ----
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = SL.bodyShade;
    ctx.beginPath();
    ctx.ellipse(bodyW * 0.20, bodyCY + bodyH * 0.28, bodyW * 0.75, bodyH * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ---- Rim light crescent ----
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.24, bodyCY - bodyH * 0.32, bodyW * 0.30, bodyH * 0.13, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.10, bodyCY - bodyH * 0.42, bodyW * 0.14, bodyH * 0.06, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ---- Yellow cheek patches ----
    ctx.save();
    bodyPath();
    ctx.clip();
    ctx.fillStyle = SL.bodyYellow;
    ctx.beginPath();
    ctx.ellipse(-bodyW * 0.30, bodyCY + bodyH * 0.02, bodyW * 0.16, bodyH * 0.11, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bodyW * 0.30, bodyCY + bodyH * 0.02, bodyW * 0.16, bodyH * 0.11, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // ---- Body outline ----
    bodyPath();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = LW_SILHOUETTE;
    ctx.lineJoin = "round";
    ctx.stroke();
    drawDrips(ctx, bodyW, bodyH, bodyCY, s.timeMs, dripSwayAmp, dripStretch);
    const antennaBaseX = 0;
    const antennaBaseY = bodyCY - bodyH / 2 + 1;
    drawAntenna(ctx, antennaBaseX, antennaBaseY, p.h, tilt, s.timeMs);
    const eyeR = Math.min(bodyW, bodyH) * 0.19;
    const eyeGap = bodyW * 0.24;
    const eyeCY = bodyCY - bodyH * 0.06;
    drawSloomooEye(ctx, -eyeGap, eyeCY, eyeR, eyeStretch, eyelidDrop);
    drawSloomooEye(ctx, eyeGap, eyeCY, eyeR, eyeStretch, eyelidDrop);
    // Mouth.
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = LW_INTERIOR;
    ctx.lineCap = "round";
    const mouthY = bodyCY + bodyH * 0.30;
    ctx.beginPath();
    if (mouth === "smile") {
        ctx.arc(0, mouthY - 2, bodyW * 0.10, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
    }
    else if (mouth === "o") {
        ctx.arc(0, mouthY, bodyW * 0.06, 0, Math.PI * 2);
        ctx.fillStyle = SL.outline;
        ctx.fill();
    }
    else {
        ctx.arc(0, mouthY + 3, bodyW * 0.10, 1.15 * Math.PI, 1.85 * Math.PI);
        ctx.stroke();
    }
    ctx.restore();
}
function drawDrips(ctx, bodyW, bodyH, bodyCY, timeMs, swayAmp, stretch) {
    const yBot = bodyCY + bodyH / 2 - 1;
    const anchors = [
        { x: -bodyW * 0.24, len: bodyH * 0.20, rad: bodyW * 0.06, phase: 0.0, yellowTip: false },
        { x: bodyW * 0.02, len: bodyH * 0.28, rad: bodyW * 0.05, phase: 1.7, yellowTip: true },
        { x: bodyW * 0.28, len: bodyH * 0.16, rad: bodyW * 0.05, phase: 3.1, yellowTip: false },
    ];
    for (const a of anchors) {
        const sway = Math.sin(timeMs / 420 + a.phase) * swayAmp;
        const dLen = a.len * stretch;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(a.x - a.rad, yBot);
        ctx.bezierCurveTo(a.x - a.rad * 0.6, yBot + dLen * 0.4, a.x - a.rad * 0.5 + sway, yBot + dLen * 0.85, a.x + sway, yBot + dLen);
        ctx.bezierCurveTo(a.x + a.rad * 0.5 + sway, yBot + dLen * 0.85, a.x + a.rad * 0.6, yBot + dLen * 0.4, a.x + a.rad, yBot);
        ctx.closePath();
        ctx.fillStyle = SL.body;
        ctx.fill();
        if (a.yellowTip) {
            ctx.save();
            ctx.clip();
            ctx.fillStyle = SL.bodyYellow;
            ctx.beginPath();
            ctx.ellipse(a.x + sway, yBot + dLen * 0.75, a.rad * 1.4, dLen * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.beginPath();
        ctx.moveTo(a.x - a.rad, yBot);
        ctx.bezierCurveTo(a.x - a.rad * 0.6, yBot + dLen * 0.4, a.x - a.rad * 0.5 + sway, yBot + dLen * 0.85, a.x + sway, yBot + dLen);
        ctx.bezierCurveTo(a.x + a.rad * 0.5 + sway, yBot + dLen * 0.85, a.x + a.rad * 0.6, yBot + dLen * 0.4, a.x + a.rad, yBot);
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = LW_INTERIOR;
        ctx.stroke();
        ctx.restore();
    }
}
function drawAntenna(ctx, baseX, baseY, ph, tilt, timeMs) {
    const stalkH = ph * 0.32;
    const bulbR = ph * 0.075;
    const wobble = Math.sin(timeMs / 520) * 0.08;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.rotate(tilt + wobble);
    const tipX = stalkH * 0.30;
    const tipY = -stalkH;
    const midX = stalkH * 0.12;
    const midY = -stalkH * 0.55;
    const stalkWBase = ph * 0.030;
    const stalkWTop = ph * 0.022;
    ctx.beginPath();
    ctx.moveTo(-stalkWBase, 0);
    ctx.bezierCurveTo(-stalkWBase + midX * 0.7, midY + stalkH * 0.10, -stalkWTop + tipX * 0.9, tipY + bulbR * 0.4, tipX - stalkWTop, tipY + bulbR * 0.2);
    ctx.lineTo(tipX + stalkWTop, tipY + bulbR * 0.2);
    ctx.bezierCurveTo(stalkWTop + tipX * 0.9, tipY + bulbR * 0.4, stalkWBase + midX * 0.7, midY + stalkH * 0.10, stalkWBase, 0);
    ctx.closePath();
    ctx.fillStyle = SL.body;
    ctx.fill();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = LW_INTERIOR;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, bulbR, bulbR * 1.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = SL.snoozle;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = "rgba(30, 10, 55, 0.25)";
    ctx.beginPath();
    ctx.ellipse(tipX + bulbR * 0.3, tipY + bulbR * 0.35, bulbR * 0.85, bulbR * 0.90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(tipX, tipY, bulbR, bulbR * 1.05, 0, 0, Math.PI * 2);
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = LW_INTERIOR * 1.1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(tipX - bulbR * 0.30, tipY - bulbR * 0.35, bulbR * 0.35, bulbR * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();
    ctx.restore();
}
function drawSloomooEye(ctx, cx, cy, r, stretch, eyelidDrop) {
    const ry = r * stretch;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = SL.eyeOuter;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.76, ry * 0.76, 0, 0, Math.PI * 2);
    ctx.fillStyle = SL.eyeMid;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.53, ry * 0.53, 0, 0, Math.PI * 2);
    ctx.fillStyle = SL.eyeIris;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.24, ry * 0.24, 0, 0, Math.PI * 2);
    ctx.fillStyle = SL.eyePupil;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.30, cy - ry * 0.32, r * 0.20, ry * 0.24, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = SL.hi;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.48, cy + ry * 0.05, r * 0.08, ry * 0.10, -0.4, 0, Math.PI * 2);
    ctx.fill();
    if (eyelidDrop > 0.001) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, r + 0.5, ry + 0.5, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = SL.body;
        ctx.beginPath();
        ctx.ellipse(cx, cy - ry + eyelidDrop * (2 * ry), r * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = SL.outline;
        ctx.lineWidth = LW_INTERIOR;
        ctx.beginPath();
        const lidY = cy - ry + eyelidDrop * (2 * ry);
        ctx.moveTo(cx - r, lidY);
        ctx.quadraticCurveTo(cx, lidY + r * 0.10, cx + r, lidY);
        ctx.stroke();
        ctx.restore();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = LW_EYE_RING;
    ctx.stroke();
    ctx.strokeStyle = SL.outline;
    ctx.lineWidth = LW_INTERIOR;
    ctx.lineCap = "round";
    ctx.beginPath();
    const lashStartX = cx - r * 0.85;
    const lashStartY = cy - ry * 0.7;
    ctx.moveTo(lashStartX, lashStartY);
    ctx.quadraticCurveTo(lashStartX - r * 0.35, lashStartY - r * 0.55, lashStartX - r * 0.55, lashStartY - r * 0.30);
    ctx.stroke();
}
//# sourceMappingURL=sloomoo.js.map