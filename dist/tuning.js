/**
 * Tuning constants — all physics/gameplay knobs live here.
 *
 * Keep this file boring. If a value is being tweaked repeatedly during
 * playtest, that's fine — but if it *depends* on other logic, it belongs
 * next to that logic, not here.
 */
// ---------- Viewport ----------
export const VIEW_W = 1200;
export const VIEW_H = 675;
// ---------- Player physics ----------
export const GRAVITY = 1800; // px / s²
export const JUMP_V = 650; // upward velocity when a jump is committed
export const RUN_V = 260; // horizontal ground speed
export const AIR_ACCEL = 1400; // horizontal acceleration while airborne
export const GROUND_ACCEL = 3000; // horizontal acceleration while grounded
export const FRICTION = 2400; // deceleration when no input on ground
export const MAX_FALL_V = 900; // terminal fall speed (px / s)
export const COYOTE_MS = 100; // grace after walking off a ledge
export const JUMP_BUFFER_MS = 100; // press-jump-just-before-landing tolerance
export const JUMP_CUT_V = 200; // if released mid-jump, clamp upward velocity to this
// ---------- Wall jump / slide / grip (Flavor B — modern) ----------
export const WALL_SLIDE_MAX_V = 200;
export const WALL_GRIP_MAX_V = 50;
export const WALL_JUMP_V_X = 400;
export const WALL_JUMP_V_Y = 690;
export const WALL_LOCKOUT_MS = 190;
export const WALL_COYOTE_MS = 80;
// ---------- Dash (Celeste-style) ----------
export const DASH_V = 500;
export const DASH_DURATION_MS = 240;
export const DASH_HITSTOP_MS = 50;
export const DASH_COOLDOWN_MS = 100;
export const DASH_CARRY_X = 0.6;
export const DASH_CARRY_Y_UP = -300;
export const DASH_TRAIL_MS = 300;
export const DASH_TRAIL_STEP_MS = 25;
export const DASH_JUMP_WINDOW_MS = 150;
export const DASH_JUMP_CARRY_X_MIN = 320;
export const DASH_SHAKE_MS = 80;
export const DASH_SHAKE_AMPL = 3;
// ---------- Level rules ----------
export const CORNER_CORRECTION_PX = 4;
export const DEFAULT_LEVEL_HEIGHT = VIEW_H;
export const FALL_OFF_BUFFER = 200;
// ---------- Camera ----------
export const CAM_DEADZONE_W = 60;
export const CAM_DEADZONE_H = 80;
export const CAM_LERP = 8;
// ---------- Combat / enemies ----------
export const PLAYER_MAX_HP = 3;
export const PLAYER_IFRAME_MS = 900;
export const DAMAGE_KNOCKBACK_X = 220;
export const DAMAGE_KNOCKBACK_Y = -300;
export const ENEMY_PATROL_V = 80;
export const ENEMY_GRAVITY = 1800;
export const ENEMY_MAX_FALL_V = 900;
// ---------- Progression ----------
export const FIRST_LEVEL_ID = "01";
//# sourceMappingURL=tuning.js.map