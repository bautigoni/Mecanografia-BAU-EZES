import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Gauge,
  GraduationCap,
  Home,
  KeyRound,
  Star,
  Target,
  TrendingDown,
  Users,
  Clock,
  Flame,
} from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Toast } from "../components/common/Toast";
import { DashboardShell, type DashNavItem } from "../components/dashboard/DashboardShell";
import { useAuth } from "../hooks/useAuth";
import { getClassesForTeacher, getUserById, resetUserPassword } from "../utils/storage";
import { STATUS_LABEL, studentStatus } from "../utils/studentStatus";
import { assets } from "../utils/assets";
import { api, type StudentDetail } from "../utils/api";
import { worlds } from "../data/worlds";

const NAV: DashNavItem[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cursos", label: "Mis cursos", icon: BookOpen },
  { id: "estudiantes", label: "Estudiantes", icon: Users },
];

const statToneCls: Record<string, string> = {
  blue: "border-l-4 border-l-accent-sky",
  violet: "border-l-4 border-l-accent",
  green: "border-l-4 border-l-mint",
  gold: "border-l-4 border-l-yellow-400",
  pink: "border-l-4 border-l-accent-pink",
  orange: "border-l-4 border-l-orange-400",
};

const chipCls: Record<string, string> = {
  flying: "bg-mint/20 text-accent-teal",
  atRisk: "bg-rose/20 text-rose",
  idle: "bg-white/40 text-muted",
  neutral: "bg-accent-sky/20 text-accent-sky",
};

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

function worldLabel(worldId: string): string {
  return worlds.find((w) => w.id === worldId)?.title ?? worldId;
}

export function TeacherStudentPage() {
  const { studentId } = useParams();
  const { user, logout, usingApi } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [tempPw, setTempPw] = useState("");

  /* ── Local (localStorage) path ── */
  const classes = useMemo(() => getClassesForTeacher(user), [user]);
  const localStudent = useMemo(() => getUserById(studentId), [studentId]);
  const localCourse = classes.find((c) => localStudent && c.studentIds.includes(localStudent.id));

  /* ── API path ── */
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [apiLoading, setApiLoading] = useState(usingApi);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    if (!usingApi || !studentId) { setApiLoading(false); return; }
    let cancelled = false;
    (async () => {
      setApiLoading(true);
      try {
        const d = await api.studentDetail(studentId);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setApiError(true);
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [usingApi, studentId]);

  /* ── Gate: scope check ── */
  if (usingApi && apiLoading) return null;
  if (usingApi && (apiError || !detail)) return <Navigate to="/profesor" replace />;
  if (!usingApi && (!localStudent || localStudent.role !== "alumno" || !localCourse)) {
    return <Navigate to="/profesor" replace />;
  }

  /* ── Shared values (works for both paths) ── */
  const name = usingApi ? detail!.student.fullName : localStudent!.name;
  const username = usingApi ? (detail!.student.username ?? "—") : localStudent!.username;
  const email = usingApi ? detail!.student.email : localStudent!.email;
  const courseName = usingApi ? (detail!.student.className ?? "Curso") : localCourse!.name;
  const courseId = usingApi ? (detail!.student.classId ?? "") : localCourse!.id;

  /* Status chip for local path */
  const localSt = !usingApi ? studentStatus(localStudent!) : "neutral";

  function leave() {
    void logout();
    navigate("/login");
  }

  async function resetPw() {
    if (usingApi) {
      try {
        const res = await api.resetUserPassword(studentId!);
        setTempPw(res.temporaryPassword);
        setMessage(`Contraseña restablecida para ${name}.`);
      } catch {
        setMessage("No se pudo restablecer la contraseña.");
      }
    } else {
      const pw = resetUserPassword(localStudent!.id);
      if (pw) {
        setTempPw(pw);
        setMessage(`Contraseña restablecida para ${name}.`);
      }
    }
  }

  const hero = (
    <>
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-accent-teal uppercase tracking-wide">
        <Users size={18} /> Alumno · {courseName}
      </span>
      <h1 className="font-display text-3xl font-bold text-text">{name}</h1>
      <p className="text-muted font-semibold flex items-center gap-2 flex-wrap">
        {email ?? username}
        {!usingApi && (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${chipCls[localSt]}`}>
            {STATUS_LABEL[localSt]}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-3 mt-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-text/70 hover:text-text cursor-pointer bg-transparent border-0 transition-colors"
          onClick={() => navigate(`/profesor/curso/${courseId}`)}
        >
          <ArrowLeft size={18} /> Volver al curso
        </button>
      </div>
    </>
  );

  /* ── API-rich view ── */
  if (usingApi && detail) {
    const s = detail.stats;
    const kpis = [
      { icon: CheckCircle2, label: "Niveles completados", value: s.completedLevels, tone: "green" },
      { icon: Target, label: "Precisión promedio", value: `${Math.round(s.avgAccuracy)}%`, tone: "blue" },
      { icon: Star, label: "Estrellas totales", value: s.stars, tone: "gold" },
      { icon: Gauge, label: "Intentos totales", value: s.totalAttempts, tone: "violet" },
      { icon: Clock, label: "Tiempo jugado", value: fmt(s.totalSeconds), tone: "pink" },
      { icon: Flame, label: "Racha actual", value: `${s.streakDays}d`, tone: "orange" },
    ] as const;

    /* Where they're failing: timeline entries with low accuracy or incomplete */
    const struggling = detail.timeline
      .filter((e) => !e.completed || e.accuracy < 60)
      .slice(0, 5);

    /* Recent activity */
    const recent = [...detail.timeline].reverse().slice(0, 10);

    return (
      <DashboardShell
        accent="blue"
        roleLabel="DOCENTE"
        roleSubtitle={user?.name ?? "Docente"}
        roleIcon={GraduationCap}
        account={{ name: user?.name ?? "Docente", email: user?.email ?? "", initial: (user?.name ?? "D").charAt(0).toUpperCase() }}
        sidebarMascot={assets.mascotMaleProud}
        nav={NAV}
        activeId="estudiantes"
        onNavigate={() => navigate("/profesor")}
        onLogout={leave}
        onBell={() => setMessage("No tenés notificaciones nuevas.")}
        hero={hero}
      >
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpis.map((c) => (
            <article key={c.label} className={`glass-card p-4 flex items-center gap-3 ${statToneCls[c.tone]}`}>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent/10 text-accent shrink-0">
                <c.icon size={20} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wide leading-tight">{c.label}</span>
                <strong className="text-lg font-display font-bold text-text">{c.value}</strong>
              </div>
            </article>
          ))}
        </div>

        {/* Credenciales + password reset */}
        <section className="glass-card p-6 flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
            <Users size={20} /> Datos del alumno
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <p><strong>Nombre:</strong> {name}</p>
            <p><strong>Usuario:</strong> {username}</p>
            {email && <p><strong>Email:</strong> {email}</p>}
            {s.currentWorld && (
              <p><strong>Isla actual:</strong> {worldLabel(s.currentWorld)} · Nivel {s.currentLevel}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 mt-1">
            <button
              type="button"
              className="inline-flex items-center justify-center min-h-[2.75rem] px-4 gap-1.5 rounded-xl font-bold cursor-pointer transition-all duration-180 ease hover:-translate-y-0.5 active:scale-[0.985] bg-accent text-white shadow-btn hover:shadow-btn-hover self-start"
              onClick={resetPw}
            >
              <KeyRound size={16} /> Restablecer contraseña
            </button>
            {tempPw && (
              <p className="text-xs font-semibold text-accent-teal bg-accent-teal/10 px-3 py-1.5 rounded-lg">
                Clave temporal: <strong>{username} / {tempPw}</strong> — compartila una sola vez; el alumno la cambia al ingresar.
              </p>
            )}
          </div>
        </section>

        {/* Progreso por isla */}
        {detail.byWorld.length > 0 && (
          <section className="glass-card p-6 flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <BookOpen size={20} /> Progreso por isla
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {detail.byWorld.map((w) => (
                <div key={w.worldId} className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/40">
                  <span className="text-xs font-bold text-text truncate">{worldLabel(w.worldId)}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-white/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-teal"
                        style={{ width: `${Math.min(100, Math.round(w.avgAccuracy))}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-muted w-10 text-right">{Math.round(w.avgAccuracy)}%</span>
                  </div>
                  <span className="text-[11px] text-muted">{w.completed} niveles completados</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dónde está fallando */}
        {struggling.length > 0 && (
          <section className="glass-card p-6 flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <TrendingDown size={20} /> Niveles con dificultad
            </h2>
            <div className="flex flex-col gap-2">
              {struggling.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-rose/5 border border-rose/15">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose/15 text-rose shrink-0">
                    {Math.round(e.accuracy)}%
                  </span>
                  <span className="text-sm text-text flex-1">
                    {worldLabel(e.worldId)} · Nivel {e.levelNumber}
                  </span>
                  <span className="text-xs text-muted">
                    {e.completed ? "Completado con baja precisión" : "No completado"} · {e.errorCount} errores
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actividad reciente */}
        {recent.length > 0 && (
          <section className="glass-card p-6 flex flex-col gap-4">
            <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
              <Clock size={20} /> Actividad reciente
            </h2>
            <div className="flex flex-col gap-1.5">
              {recent.map((e, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/40 text-sm">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${e.completed ? "bg-mint" : "bg-rose/60"}`} />
                  <span className="flex-1 text-text">
                    {worldLabel(e.worldId)} · Nivel {e.levelNumber}
                  </span>
                  <span className="font-bold text-muted w-12 text-right">{Math.round(e.accuracy)}%</span>
                  <span className="text-muted/60 text-xs whitespace-nowrap">
                    {new Date(e.at).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <Toast message={message} />
      </DashboardShell>
    );
  }

  /* ── Fallback: localStorage path ── */
  const stats = localStudent!.stats ?? { precision: 0, speed: 0, completedLevels: 0, points: 0 };
  const localCards = [
    { icon: Target, label: "Precisión", value: `${Math.round(stats.precision)}%`, tone: "blue" },
    { icon: Gauge, label: "Velocidad", value: `${Math.round(stats.speed)} ppm`, tone: "violet" },
    { icon: CheckCircle2, label: "Niveles completados", value: stats.completedLevels, tone: "green" },
    { icon: Star, label: "Estrellas", value: stats.points, tone: "gold" },
  ] as const;

  return (
    <DashboardShell
      accent="blue"
      roleLabel="DOCENTE"
      roleSubtitle={user?.name ?? "Docente"}
      roleIcon={GraduationCap}
      account={{ name: user?.name ?? "Docente", email: user?.email ?? "", initial: (user?.name ?? "D").charAt(0).toUpperCase() }}
      sidebarMascot={assets.mascotMaleProud}
      nav={NAV}
      activeId="estudiantes"
      onNavigate={() => navigate("/profesor")}
      onLogout={leave}
      onBell={() => setMessage("No tenés notificaciones nuevas.")}
      hero={hero}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {localCards.map((c) => (
          <article key={c.label} className={`glass-card p-4 flex items-center gap-3 ${statToneCls[c.tone]}`}>
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent/10 text-accent shrink-0">
              <c.icon size={24} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted uppercase tracking-wide">{c.label}</span>
              <strong className="text-xl font-display font-bold text-text">{c.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <section className="glass-card p-6 flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
          <Users size={20} /> Datos del alumno
        </h2>
        <div className="flex flex-col gap-2 text-sm">
          <p><strong>Curso:</strong> {courseName}</p>
          <p><strong>Usuario:</strong> {username}</p>
          {email && <p><strong>Email:</strong> {email}</p>}
        </div>
      </section>

      <section className="glass-card p-6 flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold text-text flex items-center gap-2">
          <KeyRound size={20} /> Acceso
        </h2>
        <button
          type="button"
          className="inline-flex items-center justify-center min-h-[2.75rem] px-4 gap-1.5 rounded-xl font-bold cursor-pointer transition-all duration-180 ease hover:-translate-y-0.5 active:scale-[0.985] bg-accent text-white shadow-btn hover:shadow-btn-hover self-start"
          onClick={resetPw}
        >
          <KeyRound size={16} /> Restablecer contraseña
        </button>
        {tempPw && (
          <p className="text-xs font-semibold text-accent-teal bg-accent-teal/10 px-3 py-1.5 rounded-lg mt-1.5">
            Clave temporal: <strong>{username} / {tempPw}</strong> — compartila una sola vez.
          </p>
        )}
      </section>

      <Toast message={message} />
    </DashboardShell>
  );
}
