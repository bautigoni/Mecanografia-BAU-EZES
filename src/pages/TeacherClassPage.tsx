import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, GraduationCap, Home, KeyRound, Power, PowerOff, Users } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Toast } from "../components/common/Toast";
import { DashboardShell, KpiCard, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { worlds } from "../data/worlds";
import { api } from "../utils/api";
import {
  getClassesForTeacher,
  getEnabledWorldsForClass,
  getStudentsInClass,
  resetUserPassword,
  updateTeacherWorldSelection,
} from "../utils/storage";
import { STATUS_LABEL, studentStatus } from "../utils/studentStatus";
import { assets } from "../utils/assets";
import type { EduTicUser } from "../types";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Mis cursos", icon: BookOpen },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
];

/* Student-status chip styles (replaces tch-chip--{st}). */
const chipCls: Record<string, string> = {
  flying: "bg-mint/20 text-accent-teal",
  atRisk: "bg-rose/20 text-rose",
  idle: "bg-white/40 text-muted",
  neutral: "bg-accent-sky/20 text-accent-sky",
};

export function TeacherClassPage() {
  const { classId } = useParams();
  const { user, logout, usingApi } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const toggleGridRef = useRef<HTMLElement>(null);

  /* Scope: a teacher can only open a class they teach. localStorage path. */
  const classes = useMemo(() => getClassesForTeacher(user), [user]);
  const localCourse = classes.find((c) => c.id === classId);
  const localStudents = useMemo(
    () => (classId ? getStudentsInClass(classId) : []),
    [classId, version],
  );

  /* API path: when usingApi, the class + roster + per-student progress come
     from the backend (Supabase), not localStorage. */
  const [apiCourse, setApiCourse] = useState<{ id: string; name: string } | null>(null);
  const [apiStudents, setApiStudents] = useState<EduTicUser[] | null>(null);
  const [loading, setLoading] = useState(usingApi);

  useEffect(() => {
    if (!usingApi || !classId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [m, prog] = await Promise.all([
          api.classMembers(classId),
          api.classProgress(classId).catch(() => ({ students: [] as Awaited<ReturnType<typeof api.classProgress>>["students"] })),
        ]);
        if (cancelled) return;
        const statById = new Map(prog.students.map((p) => [p.id, p]));
        const roster: EduTicUser[] = m.students.map((s) => {
          const p = statById.get(s.id);
          return {
            id: s.id,
            name: s.fullName,
            username: s.username ?? "",
            email: s.email,
            role: "alumno" as const,
            password: "",
            active: true,
            stats: p
              ? { precision: p.avgAccuracy, speed: 0, completedLevels: p.completedLevels, points: 0 }
              : undefined,
          };
        });
        setApiCourse({ id: m.class.id, name: m.class.name });
        setApiStudents(roster);
      } catch {
        if (!cancelled) { setApiCourse(null); setApiStudents([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [usingApi, classId]);

  const course = usingApi ? apiCourse : localCourse;
  const students = usingApi ? (apiStudents ?? []) : localStudents;

  const allWorldIds = useMemo(() => worlds.map((w) => w.id), []);
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(getEnabledWorldsForClass(classId) ?? allWorldIds),
  );

  // Don't bounce to /profesor while the API roster is still loading.
  if (usingApi && loading) return null;
  if (!course) return <Navigate to="/profesor" replace />;

  const avg = students.length
    ? Math.round(students.reduce((a, s) => a + (s.stats?.precision ?? 0), 0) / students.length)
    : 0;

  function leave() {
    void logout();
    navigate("/login");
  }
  function toggleWorld(worldId: string) {
    if (!classId) return;
    const next = !enabled.has(worldId);
    const updated = updateTeacherWorldSelection(classId, worldId, next, allWorldIds);
    setEnabled(new Set(updated));
    setMessage(next ? "Nivel habilitado para el curso." : "Nivel deshabilitado para el curso.");
  }
  async function resetPw(s: EduTicUser) {
    if (usingApi) {
      try {
        const res = await api.resetUserPassword(s.id);
        setMessage(`Clave temporal de ${s.name}: ${s.username} / ${res.temporaryPassword}`);
      } catch {
        setMessage("No se pudo restablecer la contraseña.");
      }
    } else {
      const pw = resetUserPassword(s.id);
      if (pw) {
        setMessage(`Clave temporal de ${s.name}: ${s.username} / ${pw}`);
        setVersion((v) => v + 1);
      }
    }
  }

  const hero = (
    <>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-teal uppercase tracking-wide">
        <BookOpen size={18} /> Curso
      </span>
      <h1 className="font-display text-3xl font-bold text-text">{course.name}</h1>
      <p className="text-muted font-semibold">{students.length} alumnos · {enabled.size}/{worlds.length} niveles habilitados.</p>
      <div className="flex flex-wrap gap-3 mt-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-text/70 hover:text-text cursor-pointer bg-transparent border-0 transition-colors"
          onClick={() => navigate("/profesor")}
        >
          <ArrowLeft size={18} /> Volver a mis cursos
        </button>
      </div>
    </>
  );

  return (
    <DashboardShell
      accent="blue"
      roleLabel="DOCENTE"
      roleSubtitle={user?.name ?? "Docente"}
      roleIcon={GraduationCap}
      account={{ name: user?.name ?? "Docente", email: user?.email ?? "docente@typely.com", initial: (user?.name ?? "D").charAt(0).toUpperCase() }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId="cursos"
      onNavigate={() => navigate("/profesor")}
      onLogout={leave}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      hero={hero}
    >
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard icon={Users} label="Alumnos" value={students.length} tone="pink" />
        <KpiCard icon={BookOpen} label="Niveles habilitados" value={`${enabled.size}/${worlds.length}`} tone="violet" onClick={() => toggleGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} />
        <KpiCard icon={GraduationCap} label="Precisión promedio" value={`${avg}%`} tone="blue" />
      </div>

      {/* Students table */}
      <section className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <Users size={20} /> Alumnos del curso
            </h2>
            <p className="text-sm text-muted font-semibold">Tocá un alumno para ver su detalle.</p>
          </div>
        </div>
        {students.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-6 px-4">
            <h3 className="font-display text-lg font-bold text-text">Este curso todavía no tiene alumnos</h3>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {students.map((s) => {
              const pct = Math.round(s.stats?.precision ?? 0);
              const st = studentStatus(s);
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/40">
                  <span className="grid place-items-center w-9 h-9 rounded-full bg-accent/15 text-accent font-bold text-sm shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex flex-col min-w-0 w-32 shrink-0">
                    <strong className="text-sm text-text truncate">{s.name}</strong>
                    <small className="text-xs text-muted truncate">{s.username}</small>
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-white/50 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-teal transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-bold text-muted w-12 text-right">{pct}%</span>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${chipCls[st]}`}>
                    {STATUS_LABEL[st]}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer bg-white/50 text-text hover:bg-white/70 border-0 transition-colors"
                      onClick={() => navigate(`/profesor/alumno/${s.id}`)}
                    >
                      Ver
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold cursor-pointer bg-white/50 text-text hover:bg-white/70 border-0 transition-colors"
                      onClick={() => resetPw(s)}
                      title="Restablecer contraseña"
                    >
                      <KeyRound size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Island toggle grid */}
      <section ref={toggleGridRef} className="glass-card p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <BookOpen size={20} /> Niveles a asignar
            </h2>
            <p className="text-sm text-muted font-semibold">Elegí qué niveles puede ver y jugar este curso. Se guarda automáticamente.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {worlds.map((world) => {
            const isOn = enabled.has(world.id);
            return (
              <article
                key={world.id}
                className={`glass-surface flex flex-col overflow-hidden animate-card-in ${!isOn ? "opacity-60" : ""}`}
              >
                <div className="relative h-28 overflow-hidden bg-accent-sky/10">
                  <img src={world.background} alt="" decoding="async" loading="lazy" className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 text-text">
                    #{world.order}
                  </span>
                </div>
                <div className="p-3 flex flex-col gap-0.5">
                  <strong className="text-sm text-text">{world.title}</strong>
                  <span className="text-xs text-muted">{world.topic}</span>
                  <span className="text-xs text-muted/70">{world.levels.length} niveles</span>
                </div>
                <button
                  type="button"
                  className={`flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold cursor-pointer border-0 transition-colors mx-3 mb-3 mt-0 rounded-xl ${
                    isOn ? "bg-mint/25 text-accent-teal" : "bg-white/40 text-muted"
                  }`}
                  onClick={() => toggleWorld(world.id)}
                  aria-pressed={isOn}
                >
                  {isOn ? <Power size={16} /> : <PowerOff size={16} />}
                  {isOn ? "Habilitado" : "Deshabilitado"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <Toast message={message} />
    </DashboardShell>
  );
}
