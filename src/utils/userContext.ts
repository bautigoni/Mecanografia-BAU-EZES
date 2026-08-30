/**
 * userContext.ts
 *
 * Single source of truth for:
 *  - role detection  (alumno / profesor / admin-sede / admin-general)
 *  - course/grade resolution from the user's classId
 *  - path selection  (course path vs. free path)
 *  - world/level visibility per user
 *
 * This is intentionally a pure utility module — no React hooks — so it can
 * be called from anywhere (WorldsPage, App routing, server-side in the future).
 */

import type { ActiveUser, GradeId, Role } from "../types";
import { getDemoData, getActiveUser, getEnabledWorldsForClass, isDemoMode } from "./storage";
import type { Activity } from "../data/activities";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface UserContext {
  user: ActiveUser | null;
  role: Role | "guest";
  grade: GradeId;
  /** true  → show only worlds that belong to the student's course
   *  false → show all worlds (teacher / admin / superadmin / demo / free)  */
  isCoursePath: boolean;
  /** Superadmin (admin/admin) — sees everything. */
  isSuperAdmin: boolean;
  /** Demo mode — full free-path preview of every world. */
  isDemo: boolean;
}

export function isSuperAdmin(user: ActiveUser | null): boolean {
  return user?.role === "superadmin";
}

/* ------------------------------------------------------------------ */
/* Grade derivation                                                    */
/* ------------------------------------------------------------------ */

/** Derives the student's grade from their classId.  Falls back to the
 *  classroom name pattern ("3ro", "4to", etc.) if no explicit grade is
 *  stored, and finally returns "libre" so they always get *some* worlds. */
export function getGradeForUser(user: ActiveUser | null): GradeId {
  if (!user) return "libre";

  // Non-students always get the full free path.
  if (user.role !== "alumno") return "libre";

  // If the user belongs to a classroom, read the grade from it.
  if (user.classId) {
    const data = getDemoData();
    const classroom = data.classes.find((c) => c.id === user.classId);
    if (classroom?.grade) return classroom.grade;

    // Fallback: parse grade from classroom name pattern.
    const name = (classroom?.name ?? "").toLowerCase();
    if (name.includes("inicial") || name.includes("sala")) return "inicial";
    if (name.startsWith("1")) return "1ep";
    if (name.startsWith("2")) return "2ep";
    if (name.startsWith("3")) return "3ep";
    if (name.startsWith("4")) return "4ep";
    if (name.startsWith("5")) return "5ep";
    if (name.startsWith("6")) return "6ep";
    if (name.includes("sec") || name.includes("1ro b") || name.includes("secundaria")) return "sec";
  }

  // Student with no classroom → show the initial course
  return "1ep";
}

/* ------------------------------------------------------------------ */
/* Context factory                                                     */
/* ------------------------------------------------------------------ */

export function getUserContext(user?: ActiveUser | null): UserContext {
  const activeUser = user ?? getActiveUser();
  const role: Role | "guest" = activeUser?.role ?? "guest";
  const superAdmin = isSuperAdmin(activeUser);
  const demo = isDemoMode();

  // Superadmin and demo mode both get the FULL free path (all worlds).
  const freePath = superAdmin || demo || (role !== "alumno");
  const grade = freePath ? "libre" : getGradeForUser(activeUser);
  const isCoursePath = !freePath;

  return {
    user: activeUser,
    role,
    grade,
    isCoursePath,
    isSuperAdmin: superAdmin,
    isDemo: demo,
  };
}

/* ------------------------------------------------------------------ */
/* Course → worlds mapping                                             */
/* ------------------------------------------------------------------ */

/** Maps each grade to the set of worldIds that are appropriate.
 *  Worlds are listed in the exact difficulty order so the first unlocked
 *  world the student reaches is always grade-appropriate. */
export const GRADE_WORLDS: Record<GradeId, Activity["worldId"][]> = {
  // Inicial (Pre-K / Sala 5): letters only
  inicial: ["island1", "island6"],

  // 1º EP: letters + basic words
  "1ep": ["island1", "island6", "island2"],

  // 2º EP: words + phrases
  "2ep": ["island1", "island6", "island2", "island7", "island13"],

  // 3º EP: typing basics + accents + punctuation
  "3ep": ["island1", "island6", "island2", "island7", "island13", "island3", "island8"],

  // 4º EP: full typing + email + searches
  "4ep": [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
  ],

  // 5º EP: all typing + mouse skills + basic shortcuts
  "5ep": [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11",
  ],

  // 6º EP: everything
  "6ep": [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11", "island12", "island14", "island15",
  ],

  // Secundaria: same as 6EP (could add advanced content later)
  sec: [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11", "island12", "island14", "island15",
  ],

  // Libre: all worlds (teachers, admins, free exploration)
  libre: [
    "island1", "island6", "island2", "island7", "island13",
    "island3", "island8", "island9", "island4", "island10",
    "island5", "island11", "island12", "island14", "island15",
  ],
};

/** Returns the ordered list of worldIds visible to a user.
 *  - Superadmin / demo / teacher / free-path  → every world (libre).
 *  - Students on the course path → worlds for their grade, further
 *    narrowed by any island selection their teacher saved for the class. */
export function getVisibleWorldIds(context: UserContext): Activity["worldId"][] {
  const base = GRADE_WORLDS[context.grade] ?? GRADE_WORLDS.libre;

  // Free-path roles (superadmin / demo / teacher / admin) ignore the
  // per-class teacher selection — they always see everything.
  if (!context.isCoursePath) return base;

  // Course-path student: respect the teacher's enabled-islands selection.
  const enabled = getEnabledWorldsForClass(context.user?.classId);
  if (!enabled) return base; // teacher never customised → all grade worlds
  return base.filter((id) => enabled.includes(id));
}

/** Returns true if the given world is accessible at all for this user.
 *  Note: this is about visibility, not progression lock (that's handled
 *  separately by getWorldStates). */
export function canAccessWorld(
  worldId: Activity["worldId"],
  context: UserContext,
): boolean {
  return getVisibleWorldIds(context).includes(worldId);
}

/* ------------------------------------------------------------------ */
/* Dev-bypass helper (5-click shortcut)                                */
/* ------------------------------------------------------------------ */

/** Shared rapid-click tracker for the 5-click dev bypass.
 *  Call `registerClick(id)` on every click; returns `true` when 5 rapid
 *  clicks on the same id have been detected.  Resets after detection. */
export function makeRapidClickDetector(windowMs = 450, required = 5) {
  let lastId = "";
  let count = 0;
  let lastTime = 0;

  return function registerClick(id: string): boolean {
    const now = Date.now();
    if (id === lastId && now - lastTime <= windowMs) {
      count += 1;
    } else {
      count = 1;
      lastId = id;
    }
    lastTime = now;
    if (count >= required) {
      count = 0;
      lastId = "";
      return true;
    }
    return false;
  };
}

/* ------------------------------------------------------------------ */
/* Convenience re-exports used by WorldsPage / IslandDetailPage        */
/* ------------------------------------------------------------------ */

export { getActiveUser };
