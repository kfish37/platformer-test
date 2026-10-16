/**
 * Title / main-menu screen.
 *
 * Renders into the same canvas as the game. Owns its own input handling
 * (called from main.ts when session.state === "menu"). Emits actions the
 * caller performs (enterLevel, resetSave, etc.) via a small callback
 * interface so this module stays free of async / bootstrap concerns.
 */
import { isDown, wasPressed } from "./input.js";
import { menuUi } from "./game.js";
import { saveData, formatPlayTime } from "./save.js";
import { VIEW_W, VIEW_H } from "./tuning.js";
const levelList = [];
export async function discoverLevels() {
    levelList.length = 0;
    // Level ids are zero-padded numeric strings ("01", "02", ...). Walk sequentially
    // until we hit a 404. Cheap at boot, no manifest needed.
    for (let n = 1; n < 100; n++) {
        const id = n.toString().padStart(2, "0");
        try {
            const res = await fetch(`assets/levels/${id}.json`);
            if (!res.ok)
                break;
            const data = await res.json();
            levelList.push({
                id: typeof data.id === "string" ? data.id : id,
                name: typeof data.name === "string" ? data.name : id,
            });
        }
        catch {
            break;
        }
    }
}
export function getLevelList() {
    return levelList;
}
const ROOT_ITEMS = [
    {
        key: "continue",
        label: () => `Continue \u2014 Level ${saveData.highestLevelReached}`,
        enabled: (hasProgress) => hasProgress,
    },
    {
        key: "new_game",
        label: (hasProgress) => hasProgress ? "New Game (from Level 01)" : "Start Game",
        enabled: () => true,
    },
    {
        key: "level_select",
        label: () => "Level Select",
        enabled: (hasProgress) => hasProgress,
    },
    {
        key: "reset",
        label: () => "Reset Save",
        enabled: (hasProgress) => hasProgress,
    },
];
function hasProgress() {
    return saveData.highestLevelReached !== "01"
        || saveData.levelsCompleted.length > 0
        || saveData.totalPlayMs > 0;
}
function enabledRootItems() {
    const hp = hasProgress();
    return ROOT_ITEMS.filter((it) => it.enabled(hp));
}
// ---------- Update ----------
export function updateMenu(actions) {
    if (menuUi.screen === "root")
        return updateRoot(actions);
    if (menuUi.screen === "level_select")
        return updateLevelSelect(actions);
    if (menuUi.screen === "reset_confirm")
        return updateResetConfirm(actions);
}
function updateRoot(actions) {
    const items = enabledRootItems();
    if (items.length === 0)
        return;
    if (wasPressed("arrowup", "w")) {
        menuUi.rootIndex = (menuUi.rootIndex - 1 + items.length) % items.length;
    }
    if (wasPressed("arrowdown", "s")) {
        menuUi.rootIndex = (menuUi.rootIndex + 1) % items.length;
    }
    menuUi.rootIndex = Math.min(menuUi.rootIndex, items.length - 1);
    if (wasPressed(" ", "enter")) {
        const it = items[menuUi.rootIndex];
        if (it.key === "continue") {
            return actions.enterLevel(saveData.highestLevelReached);
        }
        if (it.key === "new_game") {
            return actions.enterLevel("01");
        }
        if (it.key === "level_select") {
            menuUi.screen = "level_select";
            // Default the highlight to the highest reached level so cursor lands where you left off.
            const idx = levelList.findIndex((l) => l.id === saveData.highestLevelReached);
            menuUi.levelIndex = idx >= 0 ? idx : 0;
            return;
        }
        if (it.key === "reset") {
            menuUi.screen = "reset_confirm";
            return;
        }
    }
}
const GRID_COLS = 4;
function updateLevelSelect(actions) {
    if (wasPressed("escape", "backspace")) {
        menuUi.screen = "root";
        return;
    }
    const total = levelList.length;
    if (total === 0) {
        menuUi.screen = "root";
        return;
    }
    if (wasPressed("arrowleft", "a"))
        menuUi.levelIndex = (menuUi.levelIndex - 1 + total) % total;
    if (wasPressed("arrowright", "d"))
        menuUi.levelIndex = (menuUi.levelIndex + 1) % total;
    if (wasPressed("arrowup", "w"))
        menuUi.levelIndex = (menuUi.levelIndex - GRID_COLS + total) % total;
    if (wasPressed("arrowdown", "s"))
        menuUi.levelIndex = (menuUi.levelIndex + GRID_COLS) % total;
    if (wasPressed(" ", "enter")) {
        const target = levelList[menuUi.levelIndex];
        // Only allow entry to levels the player has reached.
        if (target.id <= saveData.highestLevelReached) {
            return actions.enterLevel(target.id);
        }
    }
}
function updateResetConfirm(actions) {
    if (wasPressed("escape", "backspace", "n")) {
        menuUi.screen = "root";
        return;
    }
    if (wasPressed("y")) {
        actions.resetSave();
        menuUi.screen = "root";
        menuUi.rootIndex = 0;
    }
    // Also let Enter+Shift confirm as a fallback.
    if (wasPressed("enter") && isDown("shift")) {
        actions.resetSave();
        menuUi.screen = "root";
        menuUi.rootIndex = 0;
    }
}
// ---------- Render ----------
export function drawMenu(ctx) {
    // Full-screen dark background with a cyan wash.
    ctx.fillStyle = "#0e1428";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Subtle vignette
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 100, VIEW_W / 2, VIEW_H / 2, 500);
    g.addColorStop(0, "rgba(90, 220, 255, 0.08)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (menuUi.screen === "root")
        drawRoot(ctx);
    else if (menuUi.screen === "level_select")
        drawLevelSelect(ctx);
    else if (menuUi.screen === "reset_confirm")
        drawResetConfirm(ctx);
    drawFooter(ctx);
}
function drawTitle(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#5adcff";
    ctx.font = "42px system-ui, sans-serif";
    ctx.fillText("SLOOMOO", VIEW_W / 2, 90);
    ctx.fillStyle = "#EC1C86";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("a little platformer \u00b7 by Fish \ud83d\udc20", VIEW_W / 2, 114);
    ctx.restore();
}
function drawRoot(ctx) {
    drawTitle(ctx);
    const items = enabledRootItems();
    const startY = 200;
    const rowH = 44;
    ctx.textAlign = "center";
    ctx.font = "20px system-ui, sans-serif";
    for (let i = 0; i < items.length; i++) {
        const y = startY + i * rowH;
        const it = items[i];
        const selected = i === menuUi.rootIndex;
        if (selected) {
            // Highlight background bar.
            ctx.fillStyle = "rgba(90, 220, 255, 0.15)";
            ctx.fillRect(VIEW_W / 2 - 220, y - 26, 440, 36);
            ctx.fillStyle = "#5adcff";
        }
        else {
            ctx.fillStyle = "#c9d3e8";
        }
        ctx.fillText(it.label(hasProgress()), VIEW_W / 2, y);
        if (selected) {
            // Underline in pink.
            ctx.strokeStyle = "#EC1C86";
            ctx.lineWidth = 2;
            ctx.beginPath();
            const w = ctx.measureText(it.label(hasProgress())).width;
            ctx.moveTo(VIEW_W / 2 - w / 2, y + 6);
            ctx.lineTo(VIEW_W / 2 + w / 2, y + 6);
            ctx.stroke();
        }
    }
    ctx.textAlign = "start";
    // Controls hint.
    ctx.fillStyle = "#7089aa";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("\u2191\u2193 navigate  \u00b7  space/enter select  \u00b7  esc during play returns here", VIEW_W / 2, VIEW_H - 46);
    ctx.textAlign = "start";
}
function drawLevelSelect(ctx) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#5adcff";
    ctx.font = "28px system-ui, sans-serif";
    ctx.fillText("Level Select", VIEW_W / 2, 60);
    ctx.restore();
    const tileW = 150;
    const tileH = 70;
    const gap = 14;
    const cols = GRID_COLS;
    const totalW = cols * tileW + (cols - 1) * gap;
    const startX = (VIEW_W - totalW) / 2;
    const startY = 100;
    for (let i = 0; i < levelList.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (tileW + gap);
        const y = startY + row * (tileH + gap);
        const lv = levelList[i];
        const reached = lv.id <= saveData.highestLevelReached;
        const completed = saveData.levelsCompleted.includes(lv.id);
        const deaths = saveData.deathsPerLevel[lv.id] ?? 0;
        const selected = i === menuUi.levelIndex;
        // Card background.
        if (!reached) {
            ctx.fillStyle = "rgba(50, 60, 80, 0.55)";
        }
        else if (completed) {
            ctx.fillStyle = "rgba(90, 220, 255, 0.20)";
        }
        else {
            ctx.fillStyle = "rgba(90, 220, 255, 0.08)";
        }
        ctx.fillRect(x, y, tileW, tileH);
        // Border.
        ctx.strokeStyle = selected ? "#EC1C86" : reached ? "#5adcff" : "#3a4a68";
        ctx.lineWidth = selected ? 2.5 : 1.4;
        ctx.strokeRect(x, y, tileW, tileH);
        // Content.
        ctx.textAlign = "center";
        if (!reached) {
            ctx.fillStyle = "#5a6a86";
            ctx.font = "13px system-ui, sans-serif";
            ctx.fillText(`Level ${lv.id}`, x + tileW / 2, y + 26);
            ctx.font = "18px system-ui, sans-serif";
            ctx.fillText("\ud83d\udd12", x + tileW / 2, y + 52);
        }
        else {
            ctx.fillStyle = "#c9d3e8";
            ctx.font = "11px system-ui, sans-serif";
            ctx.fillText(`Level ${lv.id}${completed ? "  \u2713" : ""}`, x + tileW / 2, y + 18);
            ctx.fillStyle = "#5adcff";
            ctx.font = "16px system-ui, sans-serif";
            ctx.fillText(lv.name, x + tileW / 2, y + 42);
            ctx.fillStyle = "#7089aa";
            ctx.font = "10px system-ui, sans-serif";
            ctx.fillText(`deaths: ${deaths}`, x + tileW / 2, y + 60);
        }
    }
    ctx.textAlign = "start";
    // Controls hint.
    ctx.fillStyle = "#7089aa";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("arrows navigate  \u00b7  space/enter play  \u00b7  esc back", VIEW_W / 2, VIEW_H - 46);
    ctx.textAlign = "start";
}
function drawResetConfirm(ctx) {
    drawTitle(ctx);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#e63a5c";
    ctx.font = "22px system-ui, sans-serif";
    ctx.fillText("Reset save?", VIEW_W / 2, 220);
    ctx.fillStyle = "#c9d3e8";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("This wipes all progress, deaths, and playtime.", VIEW_W / 2, 250);
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "#5adcff";
    ctx.fillText("Press Y to confirm  \u00b7  N or Esc to cancel", VIEW_W / 2, 300);
    ctx.restore();
    ctx.textAlign = "start";
}
function drawFooter(ctx) {
    const totalDeaths = Object.values(saveData.deathsPerLevel).reduce((a, b) => a + b, 0);
    ctx.save();
    ctx.fillStyle = "#5a6a86";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    const time = formatPlayTime(saveData.totalPlayMs);
    ctx.fillText(`total time: ${time}  \u00b7  total deaths: ${totalDeaths}`, VIEW_W / 2, VIEW_H - 20);
    ctx.restore();
    ctx.textAlign = "start";
}
//# sourceMappingURL=menu.js.map