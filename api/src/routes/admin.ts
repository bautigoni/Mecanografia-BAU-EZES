/* Admin dashboard aggregation — one call powers the Inicio executive
 * dashboard (KPIs + weekly activity + alerts + attention courses + recent
 * activity). Scoped to the actor's sede (superadmin may pass ?sedeId). */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { db, schema } from "../db/index.js";
import { and, eq, inArray, gte, sql, desc } from "drizzle-orm";
import { verifyAccessToken } from "../auth.js";
import { canActOnSede } from "../rbac.js";
import { getAchievements } from "../stats.js";
import type { AccessClaims } from "../auth.js";

async function requireStaff(req: FastifyRequest): Promise<AccessClaims> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) throw Object.assign(new Error("Sin sesión."), { status: 401 });
  const claims = await verifyAccessToken(auth.slice("Bearer ".length));
  if (claims.role === "alumno" || claims.role === "profesor") {
    throw Object.assign(new Error("No autorizado."), { status: 403 });
  }
  return claims;
}

const DAY = 86400000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/overview", async (req, reply) => {
    const actor = await requireStaff(req);
    const q = req.query as { sedeId?: string };
    const sedeId = actor.role === "admin-sede" ? actor.sede : q.sedeId ?? actor.sede;
    if (!sedeId) {
      return reply.send({
        counts: { courses: 0, teachers: 0, students: 0 },
        activeToday: 0, avgProgress: 0, weekly: [], alerts: {}, attentionCourses: [], recent: [],
      });
    }

    const [courses, teachers, students] = await Promise.all([
      db.select({ id: schema.classes.id, name: schema.classes.name }).from(schema.classes).where(eq(schema.classes.sedeId, sedeId)),
      db.select({ id: schema.users.id, lastLoginAt: schema.users.lastLoginAt }).from(schema.users).where(and(eq(schema.users.role, "profesor"), eq(schema.users.sedeId, sedeId))),
      db.select({ id: schema.users.id, fullName: schema.users.fullName }).from(schema.users).where(and(eq(schema.users.role, "alumno"), eq(schema.users.sedeId, sedeId))),
    ]);
    const studentIds = students.map((s) => s.id);
    const nameById = new Map(students.map((s) => [s.id, s.fullName]));
    const courseIds = courses.map((c) => c.id);

    const now = Date.now();
    const since7 = new Date(now - 7 * DAY);
    const since14 = new Date(now - 14 * DAY);
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);

    /* Per-student last attempt + per-student avg accuracy + overall avg. */
    const [lastAttempts, perUserAcc, recent, weeklyRows, teacherCounts] = await Promise.all([
      studentIds.length
        ? db.select({ userId: schema.attempts.userId, last: sql<string>`max(${schema.attempts.endedAt})` }).from(schema.attempts).where(inArray(schema.attempts.userId, studentIds)).groupBy(schema.attempts.userId)
        : Promise.resolve([] as { userId: string; last: string }[]),
      studentIds.length
        ? db.select({ userId: schema.levelProgress.userId, avg: sql<number>`round(avg(${schema.levelProgress.bestAccuracy}))::int`, done: sql<number>`count(*) filter (where ${schema.levelProgress.completed})::int` }).from(schema.levelProgress).where(inArray(schema.levelProgress.userId, studentIds)).groupBy(schema.levelProgress.userId)
        : Promise.resolve([] as { userId: string; avg: number; done: number }[]),
      studentIds.length
        ? db.select({ userId: schema.attempts.userId, worldId: schema.attempts.worldId, endedAt: schema.attempts.endedAt, completed: schema.attempts.completed }).from(schema.attempts).where(inArray(schema.attempts.userId, studentIds)).orderBy(desc(schema.attempts.endedAt)).limit(8)
        : Promise.resolve([] as { userId: string; worldId: string; endedAt: string; completed: boolean }[]),
      studentIds.length
        ? db.select({ day: sql<string>`to_char(date_trunc('day', ${schema.attempts.endedAt}), 'YYYY-MM-DD')`, c: sql<number>`count(*)::int` }).from(schema.attempts).where(and(inArray(schema.attempts.userId, studentIds), gte(schema.attempts.endedAt, since7))).groupBy(sql`date_trunc('day', ${schema.attempts.endedAt})`)
        : Promise.resolve([] as { day: string; c: number }[]),
      courseIds.length
        ? db.select({ classId: schema.classTeachers.classId, n: sql<number>`count(*)::int` }).from(schema.classTeachers).where(inArray(schema.classTeachers.classId, courseIds)).groupBy(schema.classTeachers.classId)
        : Promise.resolve([] as { classId: string; n: number }[]),
    ]);

    const lastById = new Map(lastAttempts.map((r) => [r.userId, new Date(r.last).getTime()]));
    const accById = new Map(perUserAcc.map((r) => [r.userId, r.avg]));
    const teacherCountById = new Map(teacherCounts.map((r) => [r.classId, r.n]));

    /* Overall avg progress (avg of per-student avg accuracy). */
    const avgProgress = perUserAcc.length ? Math.round(perUserAcc.reduce((a, r) => a + r.avg, 0) / perUserAcc.length) : 0;
    const activeToday = [...lastById.values()].filter((t) => t >= startToday.getTime()).length;

    /* Weekly activity: fill the last 7 days with zeros. */
    const weeklyMap = new Map(weeklyRows.map((r) => [r.day, r.c]));
    const weekly: { date: string; label: string; count: number }[] = [];
    const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      weekly.push({ date: dayKey(d), label: DOW[d.getDay()] ?? "", count: weeklyMap.get(dayKey(d)) ?? 0 });
    }

    /* Student-course map (for course inactivity). */
    const classStudents = courseIds.length
      ? await db.select({ classId: schema.classStudents.classId, userId: schema.classStudents.userId }).from(schema.classStudents).where(inArray(schema.classStudents.classId, courseIds))
      : [];
    const studentsByCourse = new Map<string, string[]>();
    for (const r of classStudents) {
      const arr = studentsByCourse.get(r.classId) ?? [];
      arr.push(r.userId); studentsByCourse.set(r.classId, arr);
    }

    /* Alerts. */
    const inactiveStudents = students.filter((s) => (lastById.get(s.id) ?? 0) < since7.getTime()).length;
    const lowPrecisionStudents = perUserAcc.filter((r) => r.avg < 60).length;
    const inactiveTeachers = teachers.filter((t) => !t.lastLoginAt || new Date(t.lastLoginAt).getTime() < since14.getTime()).length;

    const attentionCourses: { id: string; name: string; reason: string }[] = [];
    for (const c of courses) {
      const roster = studentsByCourse.get(c.id) ?? [];
      const hasTeacher = (teacherCountById.get(c.id) ?? 0) > 0;
      const anyActive7d = roster.some((uid) => (lastById.get(uid) ?? 0) >= since7.getTime());
      const atRisk = roster.filter((uid) => (accById.get(uid) ?? 100) < 60).length;
      if (!hasTeacher) attentionCourses.push({ id: c.id, name: c.name, reason: "Sin docente asignado" });
      else if (roster.length > 0 && !anyActive7d) attentionCourses.push({ id: c.id, name: c.name, reason: "Sin actividad hace 7 días" });
      else if (atRisk >= 3) attentionCourses.push({ id: c.id, name: c.name, reason: `${atRisk} alumnos en riesgo` });
    }
    const coursesNoTeacher = courses.filter((c) => (teacherCountById.get(c.id) ?? 0) === 0).length;

    const recentActivity = recent.map((r) => ({
      studentName: nameById.get(r.userId) ?? "Alumno",
      worldId: r.worldId,
      completed: r.completed,
      at: new Date(r.endedAt).toISOString(),
    }));

    return reply.send({
      counts: { courses: courses.length, teachers: teachers.length, students: students.length },
      activeToday,
      avgProgress,
      weekly,
      alerts: { inactiveStudents, lowPrecisionStudents, inactiveTeachers, coursesNoTeacher },
      attentionCourses: attentionCourses.slice(0, 6),
      recent: recentActivity,
    });
  });

  /* ----- GET /api/students/:id (Duolingo-style detail) ----- */
  app.get("/api/students/:id", async (req, reply) => {
    const actor = await requireStaff(req);
    const { id } = req.params as { id: string };
    const [s] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!s || s.role !== "alumno") return reply.code(404).send({ error: "Alumno no encontrado." });
    if (actor.role === "profesor") {
      // Professors can only see students in their own classes.
      if (!s.classId) return reply.code(403).send({ error: "El alumno no pertenece a ninguno de tus cursos." });
      const [membership] = await db
        .select({ classId: schema.classTeachers.classId })
        .from(schema.classTeachers)
        .where(and(eq(schema.classTeachers.classId, s.classId), eq(schema.classTeachers.userId, actor.sub)))
        .limit(1);
      if (!membership) return reply.code(403).send({ error: "El alumno no pertenece a ninguno de tus cursos." });
    } else if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, s.sedeId)) {
      return reply.code(403).send({ error: "El alumno es de otra sede." });
    }
    let className: string | null = null;
    if (s.classId) {
      const [c] = await db.select({ name: schema.classes.name }).from(schema.classes).where(eq(schema.classes.id, s.classId)).limit(1);
      className = c?.name ?? null;
    }

    const lp = await db
      .select({ worldId: schema.levelProgress.worldId, levelNumber: schema.levelProgress.levelNumber, completed: schema.levelProgress.completed, bestAccuracy: schema.levelProgress.bestAccuracy, attempts: schema.levelProgress.attempts })
      .from(schema.levelProgress).where(eq(schema.levelProgress.userId, id));
    const att = await db
      .select({ worldId: schema.attempts.worldId, levelNumber: schema.attempts.levelNumber, accuracy: schema.attempts.accuracy, completed: schema.attempts.completed, errorCount: schema.attempts.errorCount, startedAt: schema.attempts.startedAt, endedAt: schema.attempts.endedAt })
      .from(schema.attempts).where(eq(schema.attempts.userId, id)).orderBy(desc(schema.attempts.endedAt)).limit(200);

    // Per-world aggregate.
    const wMap = new Map<string, { completed: number; accSum: number; n: number }>();
    let accSum = 0, completedLevels = 0;
    for (const r of lp) {
      const w = wMap.get(r.worldId) ?? { completed: 0, accSum: 0, n: 0 };
      if (r.completed) { w.completed++; completedLevels++; }
      w.accSum += r.bestAccuracy; w.n++; accSum += r.bestAccuracy;
      wMap.set(r.worldId, w);
    }
    const byWorld = [...wMap.entries()].map(([worldId, v]) => ({ worldId, completed: v.completed, avgAccuracy: Math.round(v.accSum / v.n) }));
    const avgAccuracy = lp.length ? Math.round(accSum / lp.length) : 0;
    const worldNum = (w: string) => Number(w.replace("island", "")) || 0;
    const currentWorld = byWorld.length ? byWorld.map((b) => worldNum(b.worldId)).reduce((a, b) => Math.max(a, b), 0) : 0;
    const currentLevel = lp.filter((r) => worldNum(r.worldId) === currentWorld).map((r) => r.levelNumber).reduce((a, b) => Math.max(a, b), 0);

    // Total time (cap each attempt at 600s) + streak from distinct days.
    let totalSeconds = 0;
    const dayset = new Set<string>();
    for (const a of att) {
      const dur = Math.min(600, Math.max(0, (new Date(a.endedAt).getTime() - new Date(a.startedAt).getTime()) / 1000));
      totalSeconds += dur;
      dayset.add(new Date(a.endedAt).toISOString().slice(0, 10));
    }
    let streakDays = 0;
    const d = new Date(); d.setHours(0, 0, 0, 0);
    // allow today OR yesterday as the streak anchor
    if (!dayset.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
    while (dayset.has(d.toISOString().slice(0, 10))) { streakDays++; d.setDate(d.getDate() - 1); }

    // Stars (1-3 per completed level by accuracy) + simple XP proxy.
    let stars = 0;
    for (const r of lp) if (r.completed) stars += r.bestAccuracy >= 90 ? 3 : r.bestAccuracy >= 75 ? 2 : 1;
    const xp = completedLevels * 10 + (avgAccuracy >= 90 ? completedLevels * 2 : 0);

    const achievements = await getAchievements(id);
    return reply.send({
      student: { id: s.id, fullName: s.fullName, username: s.username, email: s.email, classId: s.classId, className },
      stats: { completedLevels, avgAccuracy, currentWorld: currentWorld ? `island${currentWorld}` : null, currentLevel, totalSeconds: Math.round(totalSeconds), streakDays, totalAttempts: att.length, xp, stars },
      byWorld,
      achievements,
      timeline: att.slice(0, 20).map((a) => ({ worldId: a.worldId, levelNumber: a.levelNumber, accuracy: a.accuracy, completed: a.completed, errorCount: a.errorCount, at: new Date(a.endedAt).toISOString() })),
    });
  });

  /* ----- GET /api/audit?sedeId=&limit= (F6: audit log) ----- */
  app.get("/api/audit", async (req, reply) => {
    const actor = await requireStaff(req);
    if (actor.role === "alumno" || actor.role === "profesor") {
      return reply.code(403).send({ error: "No autorizado." });
    }
    const { sedeId, limit } = req.query as { sedeId?: string; limit?: string };
    const conditions: any[] = [];
    if (actor.role === "admin-sede") {
      if (!actor.sede) return reply.send([]);
      conditions.push(eq(schema.auditLog.sedeId, actor.sede));
    } else if (sedeId) {
      conditions.push(eq(schema.auditLog.sedeId, sedeId));
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select({
        id: schema.auditLog.id,
        action: schema.auditLog.action,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        meta: schema.auditLog.meta,
        at: schema.auditLog.at,
        actorId: schema.auditLog.actorId,
        actorName: schema.users.fullName,
      })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
      .where(where as any)
      .orderBy(desc(schema.auditLog.at))
      .limit(Math.min(500, Math.max(10, Number(limit) || 100)));
    return reply.send(rows);
  });

  /* ----- GET /api/teachers/:id (detail) ----- */
  app.get("/api/teachers/:id", async (req, reply) => {
    const actor = await requireStaff(req);
    const { id } = req.params as { id: string };
    const [t] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    if (!t || t.role !== "profesor") return reply.code(404).send({ error: "Docente no encontrado." });
    if (!canActOnSede({ role: actor.role, sedeId: actor.sede }, t.sedeId)) {
      return reply.code(403).send({ error: "El docente es de otra sede." });
    }
    const classRows = await db
      .select({ id: schema.classes.id, name: schema.classes.name, grade: schema.classes.grade })
      .from(schema.classTeachers)
      .innerJoin(schema.classes, eq(schema.classes.id, schema.classTeachers.classId))
      .where(eq(schema.classTeachers.userId, id))
      .orderBy(schema.classes.name);
    const classIds = classRows.map((c) => c.id);
    const counts = classIds.length
      ? await db.select({ classId: schema.classStudents.classId, n: sql<number>`count(*)::int` }).from(schema.classStudents).where(inArray(schema.classStudents.classId, classIds)).groupBy(schema.classStudents.classId)
      : [];
    const countById = new Map(counts.map((c) => [c.classId, c.n]));
    const classes = classRows.map((c) => ({ ...c, studentCount: countById.get(c.id) ?? 0 }));
    const studentCount = classes.reduce((a, c) => a + c.studentCount, 0);

    // Recent activity from this teacher's students.
    const studentIds = classIds.length
      ? (await db.select({ userId: schema.classStudents.userId }).from(schema.classStudents).where(inArray(schema.classStudents.classId, classIds))).map((r) => r.userId)
      : [];
    const recent = studentIds.length
      ? await db.select({ userId: schema.attempts.userId, worldId: schema.attempts.worldId, completed: schema.attempts.completed, endedAt: schema.attempts.endedAt }).from(schema.attempts).where(inArray(schema.attempts.userId, studentIds)).orderBy(desc(schema.attempts.endedAt)).limit(8)
      : [];
    const nameRows = studentIds.length
      ? await db.select({ id: schema.users.id, fullName: schema.users.fullName }).from(schema.users).where(inArray(schema.users.id, studentIds))
      : [];
    const nameById = new Map(nameRows.map((n) => [n.id, n.fullName]));

    return reply.send({
      teacher: { id: t.id, fullName: t.fullName, username: t.username, email: t.email, lastLoginAt: t.lastLoginAt },
      classes,
      stats: { classCount: classes.length, studentCount },
      recent: recent.map((r) => ({ studentName: nameById.get(r.userId) ?? "Alumno", worldId: r.worldId, completed: r.completed, at: new Date(r.endedAt).toISOString() })),
    });
  });
}
