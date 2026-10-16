/**
 * Save/load — localStorage progress persistence.
 *
 * What we persist:
 *   - highestLevelReached: highest level id the player has ever set foot in.
 *   - deathsPerLevel:      map of level id → death count (across all sessions).
 *   - totalPlayMs:         cumulative wall-clock time in "playing" state.
 *   - levelsCompleted:     set of level ids the player has beaten.
 *
 * What we DON'T persist:
 *   - Checkpoint activation state (within-run only).
 *   - Player HP / dash / physics state (fresh each session).
 *
 * Storage key + shape are versioned via SAVE_VERSION. Reads tolerate
 * missing/corrupt data (returns default), writes are best-effort.
 */
const SAVE_KEY = "platformer.save.v1";
const SAVE_VERSION = 1;
function defaultSave() {
    return {
        version: SAVE_VERSION,
        highestLevelReached: "01",
        levelsCompleted: [],
        deathsPerLevel: {},
        totalPlayMs: 0,
        lastPlayedAt: 0,
    };
}
// In-memory copy — the game mutates this and calls flushSave() to persist.
export const saveData = loadSaveInternal();
function loadSaveInternal() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw)
            return defaultSave();
        const parsed = JSON.parse(raw);
        if (parsed.version !== SAVE_VERSION)
            return defaultSave();
        // Coerce with defaults for missing fields.
        const d = defaultSave();
        return {
            version: SAVE_VERSION,
            highestLevelReached: typeof parsed.highestLevelReached === "string" ? parsed.highestLevelReached : d.highestLevelReached,
            levelsCompleted: Array.isArray(parsed.levelsCompleted) ? parsed.levelsCompleted.filter((x) => typeof x === "string") : d.levelsCompleted,
            deathsPerLevel: parsed.deathsPerLevel && typeof parsed.deathsPerLevel === "object" ? { ...d.deathsPerLevel, ...parsed.deathsPerLevel } : d.deathsPerLevel,
            totalPlayMs: typeof parsed.totalPlayMs === "number" ? parsed.totalPlayMs : d.totalPlayMs,
            lastPlayedAt: typeof parsed.lastPlayedAt === "number" ? parsed.lastPlayedAt : d.lastPlayedAt,
        };
    }
    catch {
        return defaultSave();
    }
}
export function flushSave() {
    try {
        saveData.lastPlayedAt = Date.now();
        localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    }
    catch {
        // Quota exceeded, storage disabled, or private mode — best effort only.
    }
}
export function markLevelEntered(levelId) {
    // Ordering: numeric compare on the id (safe because ids are zero-padded strings like "01"..."07").
    if (levelId > saveData.highestLevelReached) {
        saveData.highestLevelReached = levelId;
        flushSave();
    }
}
export function markLevelCompleted(levelId) {
    if (!saveData.levelsCompleted.includes(levelId)) {
        saveData.levelsCompleted.push(levelId);
        flushSave();
    }
}
export function recordDeath(levelId) {
    saveData.deathsPerLevel[levelId] = (saveData.deathsPerLevel[levelId] ?? 0) + 1;
    flushSave();
}
// Called every frame while state === "playing". Accumulates but only flushes
// every ~5s to avoid hammering localStorage.
let unsavedPlayMs = 0;
export function tickPlayTime(dtMs) {
    saveData.totalPlayMs += dtMs;
    unsavedPlayMs += dtMs;
    if (unsavedPlayMs >= 5000) {
        unsavedPlayMs = 0;
        flushSave();
    }
}
// Manual reset for debug / "start over" UI.
export function resetSave() {
    const fresh = defaultSave();
    saveData.version = fresh.version;
    saveData.highestLevelReached = fresh.highestLevelReached;
    saveData.levelsCompleted = fresh.levelsCompleted;
    saveData.deathsPerLevel = fresh.deathsPerLevel;
    saveData.totalPlayMs = fresh.totalPlayMs;
    saveData.lastPlayedAt = fresh.lastPlayedAt;
    flushSave();
}
// Format ms → "H:MM:SS" for HUD display.
export function formatPlayTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mm = m.toString().padStart(2, "0");
    const ss = s.toString().padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
//# sourceMappingURL=save.js.map