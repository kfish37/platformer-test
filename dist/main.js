/**
 * Bootstrap + game loop.
 *
 * Everything interesting lives in the module files. This is just the entry
 * point: canvas setup, first level load, and the rAF loop that drives
 * update() and draw() each frame.
 *
 * Flow:  menu → playing → level_complete (Space) → next level / game_complete
 * R:     in-level respawn at checkpoint; from game_complete goes to level 1.
 * Esc:   during play returns to the menu.
 * Shift+Backspace: dev-only save wipe (bypasses the menu confirm).
 */
import { clearFramePresses, installInputListeners, isDown, wasPressed } from "./input.js";
import { loadLevel } from "./world.js";
import { instantiateEnemies } from "./enemies.js";
import { instantiateCheckpoints } from "./checkpoints.js";
import { loadSloomooSprites } from "./sprites.js";
import { spawnInLevel, updatePlaying } from "./player.js";
import { menuUi, pauseState, session } from "./game.js";
import { draw } from "./render.js";
import { markLevelEntered, resetSave } from "./save.js";
import { FIRST_LEVEL_ID } from "./tuning.js";
import { discoverLevels, updateMenu } from "./menu.js";
import { installTouchControls } from "./touch.js";
async function enterLevel(id) {
    session.currentLevel = await loadLevel(id);
    instantiateEnemies(session.currentLevel);
    instantiateCheckpoints(session.currentLevel);
    markLevelEntered(id);
    spawnInLevel(session.currentLevel);
    session.state = "playing";
}
function returnToMenu() {
    session.state = "menu";
    menuUi.screen = "root";
    menuUi.rootIndex = 0;
}
async function update(dt) {
    // Shift+Backspace during any state = wipe save (dev shortcut, deliberately awkward).
    if (wasPressed("backspace") && isDown("shift")) {
        resetSave();
        returnToMenu();
        return;
    }
    // ---- Menu state ----
    if (session.state === "menu") {
        await updateMenu({
            enterLevel: enterLevel,
            resetSave: resetSave,
        });
        return;
    }
    // ---- In-game states below need a current level. ----
    if (!session.currentLevel)
        return;
    // Escape behavior depends on state:
    //   playing  -> pause (freeze run in place)
    //   paused   -> resume
    //   level_complete -> back to main menu (run is already effectively over)
    if (wasPressed("escape")) {
        if (session.state === "playing") {
            pauseState.pausedAtMs = performance.now();
            session.state = "paused";
            return;
        }
        if (session.state === "paused") {
            pauseState.pausedAtMs = null;
            session.state = "playing";
            return;
        }
        if (session.state === "level_complete") {
            returnToMenu();
            return;
        }
    }
    // ---- Paused state: handle its own input, don't tick the world. ----
    if (session.state === "paused") {
        // Space/Enter also resumes (common muscle-memory pattern).
        if (wasPressed(" ", "enter")) {
            pauseState.pausedAtMs = null;
            session.state = "playing";
            return;
        }
        // R while paused restarts at last checkpoint (counted as manual reset, no death).
        if (wasPressed("r")) {
            spawnInLevel(session.currentLevel);
            pauseState.pausedAtMs = null;
            session.state = "playing";
            return;
        }
        // Q or M drops back to the main menu (destroys current run).
        if (wasPressed("q", "m")) {
            pauseState.pausedAtMs = null;
            returnToMenu();
            return;
        }
        return;
    }
    // R resets in-game (menu handles its own inputs; paused handled above).
    if (wasPressed("r")) {
        if (session.state === "game_complete") {
            await enterLevel(FIRST_LEVEL_ID);
            return;
        }
        // In-level R respawns at current checkpoint (or spawn if none).
        // Does NOT count as a death — R is a manual reset, not a fail state.
        spawnInLevel(session.currentLevel);
        return;
    }
    if (session.state === "playing") {
        updatePlaying(dt, session.currentLevel);
    }
    else if (session.state === "level_complete") {
        if (wasPressed(" ", "arrowup", "w", "enter")) {
            if (session.currentLevel.next) {
                await enterLevel(session.currentLevel.next);
            }
            else {
                session.state = "game_complete";
            }
        }
    }
    // game_complete: static overlay, R handled above.
}
async function main() {
    const canvas = document.getElementById("game");
    if (!canvas)
        throw new Error("no #game canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("no 2d context");
    installInputListeners();
    installTouchControls();
    loadSloomooSprites();
    await discoverLevels();
    // Boot straight into the menu. The player picks Continue / New Game / etc.
    session.state = "menu";
    menuUi.screen = "root";
    menuUi.rootIndex = 0;
    let last = performance.now();
    const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        // update is async because level transitions fetch JSON. Fire-and-forget —
        // the next frame just sees the new level state when the fetch resolves.
        void update(dt);
        draw(ctx);
        clearFramePresses();
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}
void main();
//# sourceMappingURL=main.js.map