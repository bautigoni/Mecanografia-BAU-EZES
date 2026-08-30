/**
 * ShortcutLevelView.tsx
 *
 * Generic keyboard-shortcut engine used by every Activity with
 * inputType === "shortcut".
 *
 * REGLA DE SEGURIDAD: todo atajo se demuestra dentro de un entorno VIRTUAL
 * que vive entero en este componente, y se llama a event.preventDefault() en
 * todos los keydown de la fase de captura.
 *
 * PERO eso NO alcanza para todos, y conviene tenerlo claro porque acá se
 * había afirmado lo contrario: hay atajos que el navegador y el sistema se
 * reservan y que una página NO puede interceptar ni frenar. Ctrl+T abre una
 * pestaña de verdad, Ctrl+W CIERRA la pestaña y se lleva puesta la partida,
 * Ctrl+Tab cambia de pestaña y Alt+Tab cambia de ventana. En esos casos el
 * keydown ni siquiera llega a la página, así que tampoco se puede puntuar.
 *
 * Para esos hay UNA forma de capturarlos de verdad, y es la que usa este
 * archivo: la API Keyboard Lock (`navigator.keyboard.lock`), que sólo
 * funciona con la página en PANTALLA COMPLETA. Con eso Ctrl+T, Ctrl+W,
 * Ctrl+N y Ctrl+Tab llegan a la página y el navegador no los ejecuta.
 *
 * Tiene dos límites que conviene conocer antes de tocar esto:
 *   - Es de Chromium (Chrome, Edge, Chromebook). Firefox y Safari no la
 *     tienen, y ahí se cae al teclado de la pantalla, que sigue estando.
 *   - Alt+Tab es del sistema operativo, no del navegador, y NO se puede
 *     capturar con ninguna técnica. Por eso ya no se usa en ningún nivel.
 *
 * Los atajos que sí se pueden frenar sin nada de esto (Ctrl+A/C/V/Z/F/S/Y,
 * Enter, Escape) andan con el teclado real siempre, sin pantalla completa.
 *
 * Virtual environments available:
 *   "text-editor"   — Ctrl+C / Ctrl+V / Ctrl+A / Ctrl+Z / Enter / Escape
 *   "browser-tabs"  — Ctrl+T / Ctrl+W / Ctrl+Tab
 *   "find-box"      — Ctrl+F / Escape
 *   "app-switcher"  — Ctrl+N  (ventanas; antes Alt+Tab, ver arriba)
 *   "doc-editor"    — Ctrl+S / Ctrl+Y  (save / redo)
 *   "dialog"        — Enter / Escape
 */

import { Monitor, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Activity, ShortcutDialog, ShortcutScene } from "../data/activities";
import { assets } from "../utils/assets";
import { getGameplayBackground } from "../data/worlds";
import { StarCounter } from "../components/common/StarCounter";
import { getStarsFromAccuracy, markLevelComplete } from "../utils/progress";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
type VirtualEnvKind =
  | "text-editor"
  | "browser-tabs"
  | "find-box"
  | "doc-editor"
  | "app-switcher"
  | "dialog";

type Combo = {
  raw: string;
  mods: string[];   // "Ctrl" | "Shift" | "Alt"
  key: string;      // e.g. "C", "Tab", "Enter"
  caps: string[];   // ordered keycap labels
  env: VirtualEnvKind;
};

/* ------------------------------------------------------------------ */
/* Combo parsing                                                       */
/* ------------------------------------------------------------------ */
const MOD_TOKENS = new Set(["ctrl", "control", "shift", "alt", "meta", "cmd"]);

function comboEnv(mods: string[], key: string): VirtualEnvKind {
  const k = key.toLowerCase();
  if (mods.includes("Alt") && k === "tab") return "app-switcher";
  if (mods.includes("Ctrl")) {
    /* Ctrl+N y Ctrl+Shift+N abren una VENTANA, no una pestaña: van al
       simulador de ventanas para que se vea la diferencia. */
    if (k === "n") return "app-switcher";
    if (k === "t" || k === "w" || k === "tab") return "browser-tabs";
    if (k === "f") return "find-box";
    if (k === "s" || k === "y") return "doc-editor";
    if (k === "c" || k === "v" || k === "a" || k === "z") return "text-editor";
  }
  if (k === "enter" || k === "escape") return "dialog";
  return "text-editor";
}

/** Atajos que el navegador o el sistema operativo se quedan siempre: la
 *  página no los recibe y preventDefault() no los frena. Se hacen con el
 *  teclado de la pantalla.
 *
 *  Ctrl+T / Ctrl+N abren pestaña o ventana, Ctrl+W cierra la pestaña — esa
 *  es la peor, porque se lleva la partida —, Ctrl+Tab cambia de pestaña y
 *  Alt+Tab es del sistema. Cubre también las variantes con Shift
 *  (Ctrl+Shift+T, Ctrl+Shift+N, Ctrl+Shift+Tab) por la misma razón. */
function esReservado(combo: Combo): boolean {
  const k = combo.key.toLowerCase();
  if (combo.mods.includes("Alt") && k === "tab") return true;
  if (combo.mods.includes("Ctrl")) {
    if (k === "t" || k === "w" || k === "n" || k === "tab") return true;
  }
  return false;
}

/** El `code` de KeyboardEvent que hay que pedirle a Keyboard Lock para cada
 *  atajo reservado. La API bloquea TECLAS, no combinaciones: pidiendo "KeyW"
 *  el navegador deja de quedarse con Ctrl+W y el evento llega a la página. */
function codigoParaBloquear(combo: Combo): string | null {
  const k = combo.key.toLowerCase();
  if (k === "tab") return "Tab";
  if (k.length === 1 && k >= "a" && k <= "z") return `Key${k.toUpperCase()}`;
  return null;
}

type EstadoBloqueo = "no-hace-falta" | "sin-soporte" | "pendiente" | "activo";

/** Pantalla completa + Keyboard Lock, que es lo único que hace que los
 *  atajos del navegador lleguen a la página.
 *
 *  Pide un gesto del alumno (un botón), porque pantalla completa no se puede
 *  pedir sola. Si el navegador no tiene la API, o si el alumno se sale de
 *  pantalla completa, vuelve a "pendiente" y el nivel sigue jugable con el
 *  teclado de la pantalla — nunca queda trabado. */
function useBloqueoDeTeclado(combos: Combo[], activo: boolean) {
  const reservados = combos.filter(esReservado);
  const hacenFalta = reservados.length > 0;
  const soporta =
    typeof navigator !== "undefined" &&
    !!(navigator as Navigator & { keyboard?: { lock?: unknown } }).keyboard?.lock &&
    !!document.documentElement.requestFullscreen;

  const [enMarcha, setEnMarcha] = useState(false);
  /* Si pantalla completa o el bloqueo fallan, o si el alumno prefiere no
     usarlos, el nivel NO puede quedar trabado detrás del cartel: se juega
     con el teclado de la pantalla, que siempre funciona. */
  const [seJuegaSinBloqueo, setSeJuegaSinBloqueo] = useState(false);

  const soltar = useCallback(() => {
    const teclado = (navigator as Navigator & { keyboard?: { unlock?: () => void } }).keyboard;
    try { teclado?.unlock?.(); } catch { /* al navegador no le importa */ }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setEnMarcha(false);
  }, []);

  const tomar = useCallback(async () => {
    if (!soporta) return;
    const codigos = [...new Set(reservados.map(codigoParaBloquear).filter((c): c is string => !!c))];
    try {
      await document.documentElement.requestFullscreen();
      const teclado = (navigator as Navigator & {
        keyboard?: { lock?: (k: string[]) => Promise<void> };
      }).keyboard;
      await teclado?.lock?.(codigos);
      setEnMarcha(true);
    } catch {
      /* Falla, por ejemplo, si el navegador no considera el clic un gesto
         válido, o si una política de la escuela bloquea pantalla completa.
         En ese caso se sigue con el teclado de la pantalla en vez de dejar
         al alumno mirando un cartel que no avanza. */
      setEnMarcha(false);
      setSeJuegaSinBloqueo(true);
    }
    // reservados se recalcula por render; las teclas del nivel no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soporta]);

  /* Salirse de pantalla completa suelta el bloqueo del lado del navegador,
     así que hay que enterarse para volver a ofrecer el botón. */
  useEffect(() => {
    if (!hacenFalta) return;
    const alCambiar = () => { if (!document.fullscreenElement) setEnMarcha(false); };
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, [hacenFalta]);

  /* Al terminar el nivel o al irse, devolver el teclado y salir de pantalla
     completa: que el juego no se quede con el navegador tomado. */
  useEffect(() => {
    if (!activo && enMarcha) soltar();
  }, [activo, enMarcha, soltar]);
  useEffect(() => () => { soltar(); }, [soltar]);

  const estado: EstadoBloqueo =
    !hacenFalta ? "no-hace-falta"
    : !soporta || seJuegaSinBloqueo ? "sin-soporte"
    : enMarcha ? "activo"
    : "pendiente";
  return { estado, tomar, seguirSinBloqueo: () => setSeJuegaSinBloqueo(true) };
}

/* Clear, simulator-safe copy per combo (§6) — never just "hacé el atajo". */
function comboActionHint(combo: Combo): string {
  const k = combo.key.toLowerCase();
  if (combo.mods.includes("Alt") && k === "tab") return "Cambiá de ventana en el simulador (o tocá las teclas).";
  if (combo.mods.includes("Ctrl")) {
    if (k === "t") return "Creá una pestaña dentro del simulador.";
    if (k === "w") return "Cerrá la pestaña del simulador.";
    if (k === "tab") return combo.mods.includes("Shift") ? "Volvé a la pestaña anterior del simulador." : "Cambiá de pestaña en el simulador.";
    if (k === "a") return "Seleccioná todo el texto del cuadro.";
    if (k === "c") return "Copiá el texto seleccionado.";
    if (k === "v") return "Pegá el texto en el área de trabajo.";
    if (k === "z") return "Deshacé el último cambio.";
    if (k === "y") return "Rehacé el cambio en el simulador.";
    if (k === "f") return "Abrí el buscador del simulador.";
    if (k === "s") return "Guardá el documento del simulador.";
    if (k === "n") return "Abrí una ventana nueva en el simulador.";
  }
  if (k === "enter") return "Aceptá con Enter en el simulador.";
  if (k === "escape") return "Cerrá con Escape en el simulador.";
  return "Hacé el atajo dentro del simulador.";
}

function parseCombo(raw: string): Combo {
  const tokens = raw.split("+").map((t) => t.trim()).filter(Boolean);
  const mods: string[] = [];
  let key = "";
  for (const token of tokens) {
    const low = token.toLowerCase();
    if (MOD_TOKENS.has(low)) {
      if (["ctrl", "control", "meta", "cmd"].includes(low)) mods.push("Ctrl");
      else if (low === "shift") mods.push("Shift");
      else if (low === "alt") mods.push("Alt");
    } else {
      key = token;
    }
  }
  return { raw, mods, key, caps: [...mods, key], env: comboEnv(mods, key) };
}

function eventMatchesCombo(ev: KeyboardEvent, combo: Combo): boolean {
  if (combo.mods.includes("Ctrl") !== (ev.ctrlKey || ev.metaKey)) return false;
  if (combo.mods.includes("Shift") !== ev.shiftKey) return false;
  if (combo.mods.includes("Alt") !== ev.altKey) return false;
  return ev.key.toLowerCase() === combo.key.toLowerCase();
}

/* A keydown whose key is *only* a modifier (Ctrl / Shift / Alt / Meta). These
   must never count as an attempt — a shortcut isn't formed until the action
   key is pressed. */
function isModifierOnly(ev: KeyboardEvent): boolean {
  return ev.key === "Control" || ev.key === "Shift" || ev.key === "Alt" || ev.key === "Meta" || ev.key === "OS";
}

/* Returns a normalized combo string ("ctrl+a", "alt+tab", "enter"…) when the
   keydown forms a FULL shortcut attempt, or null when it should be ignored for
   scoring (a lone modifier, or a plain key with no modifier that isn't
   Enter/Escape). */
function normalizeShortcut(ev: KeyboardEvent): string | null {
  if (isModifierOnly(ev)) return null;
  const hasMod = ev.ctrlKey || ev.metaKey || ev.altKey;
  const key = ev.key;
  const isStandalone = key === "Enter" || key === "Escape";
  if (!hasMod && !isStandalone) return null; // plain key → not a shortcut attempt
  const parts: string[] = [];
  if (ev.ctrlKey || ev.metaKey) parts.push("ctrl");
  if (ev.shiftKey) parts.push("shift");
  if (ev.altKey) parts.push("alt");
  parts.push(key.toLowerCase());
  return parts.join("+");
}

/* Runs the simulator's visual action when the parent signals a correct combo
   was performed via the real keyboard or the on-screen keycaps — so those
   paths update the simulation exactly like clicking the action button does.
   The env remounts per combo, so we baseline the signal on mount and only fire
   when it next increments. */
function useKeyboardTrigger(signal: number, act: () => void) {
  const baseline = useRef(signal);
  useEffect(() => {
    if (signal > baseline.current) {
      baseline.current = signal;
      act();
    }
    // act is captured from the latest render; deps intentionally only [signal].
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal]);
}

/* ------------------------------------------------------------------ */
/* Shared progress hook                                                */
/* ------------------------------------------------------------------ */
function useLevelProgress(activity: Activity, total: number) {
  const [progress, setProgress] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [errors, setErrors] = useState(0);
  const [completed, setCompleted] = useState(false);
  const persistedRef = useRef(false);
  const attemptsRef = useRef(0);
  const errorsRef = useRef(0);
  attemptsRef.current = attempts;
  errorsRef.current = errors;

  const tickCorrect = useCallback(() => {
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    setProgress((p) => {
      const next = Math.min(total, p + 1);
      if (next >= total && !persistedRef.current) {
        persistedRef.current = true;
        const a = attemptsRef.current;
        const e = errorsRef.current;
        const acc = Math.max(0, Math.round(((a - e) / Math.max(1, a)) * 100));
        markLevelComplete(activity.worldId, activity.levelNumber, acc, Math.max(1, a));
        setCompleted(true);
      }
      return next;
    });
  }, [activity.worldId, activity.levelNumber, total]);

  const tickWrong = useCallback(() => {
    setAttempts((a) => { attemptsRef.current = a + 1; return a + 1; });
    setErrors((e) => { errorsRef.current = e + 1; return e + 1; });
  }, []);

  const reset = useCallback(() => {
    persistedRef.current = false;
    setProgress(0); setAttempts(0); setErrors(0); setCompleted(false);
  }, []);

  const precision = Math.round(
    ((attempts - errors) / Math.max(1, attempts)) * 100,
  );
  return { progress, attempts, errors, completed, precision, tickCorrect, tickWrong, reset };
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export function ShortcutLevelView({ activity }: { activity: Activity }) {
  const navigate = useNavigate();
  /* Un nivel con `steps` es UNA tarea contada paso a paso; sin ellos, la
     lista suelta de siempre. Los combos salen del guion cuando existe. */
  const steps = activity.steps;
  const scene = activity.scene;
  const combos = (steps ? steps.map((s) => s.combo) : activity.targets).map(parseCombo);
  const total = combos.length;
  const background = getGameplayBackground(activity.worldId);
  const prog = useLevelProgress(activity, total);
  const progressRef = useRef(0);
  progressRef.current = prog.progress;

  const [clicked, setClicked] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<string | undefined>();
  const [kbTrigger, setKbTrigger] = useState(0);
  const feedbackTimer = useRef<number | null>(null);
  /* Set while the just-performed action is being shown before advancing, so a
     single combo can't be scored twice during the short pause. */
  const advancingRef = useRef(false);

  function flash(msg: string) {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    setFeedback(msg);
    feedbackTimer.current = window.setTimeout(() => setFeedback(undefined), 1800);
  }

  /* Called by the simulator's act() once it has performed the visual action.
     We hold ~450 ms so the result (selected text, new tab…) is visible, then
     advance. The guard makes ONE combo = ONE scored attempt. */
  function succeed() {
    if (advancingRef.current) return;
    advancingRef.current = true;
    flash("¡Muy bien!");
    window.setTimeout(() => {
      setClicked({});
      prog.tickCorrect();
      advancingRef.current = false;
    }, 450);
  }
  function fail() {
    if (advancingRef.current) return;
    flash("Casi… probá el atajo que se muestra.");
    prog.tickWrong();
  }

  /* A correct combo (keyboard or keycaps) tells the live simulator to perform
     its visual action; the simulator then calls succeed(). This keeps ONE
     code path for visual + scoring. */
  function triggerVirtualAction() {
    if (advancingRef.current) return;
    setKbTrigger((t) => t + 1);
  }

  /* ---- Physical keyboard handler ----
     Captures shortcuts INSIDE the game so the browser/OS never runs them:
       - Ctrl+T won't open a tab, Ctrl+W won't close it, Ctrl+A won't select
         the page, Alt+Tab won't switch apps (best effort — see §5).
     Scoring rule: ONE full combo = ONE attempt. Lone modifiers never count. */
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (prog.completed) return;
      const current = combos[progressRef.current];
      if (!current) return;

      const modifierOnly = isModifierOnly(ev);
      const hasMod = ev.ctrlKey || ev.metaKey || ev.altKey;
      const blockable =
        hasMod || modifierOnly ||
        ["Tab", "Enter", "Escape", "F1", "F2", "F3", "F4", "F5", "F6",
          "F7", "F8", "F9", "F10", "F11", "F12"].includes(ev.key);
      // Block the browser/OS default for anything shortcut-like.
      if (blockable) {
        ev.preventDefault();
        ev.stopPropagation();
      }

      // Only EVALUATE a full combo. Lone Ctrl/Shift/Alt, or a plain key with
      // no modifier (other than Enter/Escape), are ignored for scoring.
      const combo = normalizeShortcut(ev);
      if (!combo) return;

      if (eventMatchesCombo(ev, current)) {
        triggerVirtualAction(); // visual action → succeed()
      } else {
        fail();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prog.completed, combos]);

  /* ---- On-screen keycap clicking (always works, even when OS intercepts) ----
     Completing the keycap combo also drives the visual simulator action. */
  function onKeycapClick(capIdx: number, label: string) {
    if (prog.completed) return;
    const current = combos[prog.progress];
    if (!current) return;
    const key = `${capIdx}:${label}`;
    const next = { ...clicked, [key]: true };
    const allDone = current.caps.every((c, i) => next[`${i}:${c}`]);
    if (allDone) {
      triggerVirtualAction(); // visual action → succeed()
    } else {
      setClicked(next);
    }
  }

  /* Ctrl+W cierra la pestaña de verdad y se lleva la partida a medio hacer, y
     es un accidente probable justamente en los niveles que enseñan a cerrar
     pestañas. Mientras el nivel tenga atajos reservados y no esté terminado
     se pide confirmación antes de descargar la página: no lo evita, pero
     convierte "perdí todo" en "¿seguro que querés salir?".
     Se saca al completar el nivel, así el final no queda con el cartel. */
  const hayReservados = combos.some(esReservado);
  useEffect(() => {
    if (!hayReservados || prog.completed) return;
    const alSalir = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ""; };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, [hayReservados, prog.completed]);

  function retry() {
    prog.reset();
    setClicked({});
    setFeedback(undefined);
  }

  function speak() {
    if (!("speechSynthesis" in window)) return;
    const utter = new SpeechSynthesisUtterance(`${activity.title}. ${activity.listenText}`);
    utter.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  }

  const currentIdx = Math.min(prog.progress, total - 1);
  const current = combos[currentIdx];
  const currentStep = steps?.[currentIdx];
  /* El escenario sale del atajo salvo que el guion diga otra cosa. */
  const currentEnv = (currentStep?.env as VirtualEnvKind | undefined) ?? current?.env;
  /* ¿Este atajo se lo queda el navegador? Con el bloqueo activo ya no, y se
     pide con el teclado real como cualquier otro. */
  const bloqueo = useBloqueoDeTeclado(combos, !prog.completed);
  const reservado = (current ? esReservado(current) : false) && bloqueo.estado !== "activo";

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden font-body text-text animate-page-fade">
      {/* Per-world background with pastel overlay */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url("${background}")` }}
        aria-hidden="true"
      />
      {/* Pastel wash so text stays readable over any world art */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-bg-soft/70 via-white/40 to-accent-sky/20 pointer-events-none" aria-hidden="true" />

      {/* Sparkles */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span
            key={i}
            className={`absolute block rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-twinkle ${
              i % 5 === 0 ? "h-2 w-2 top-[8%] left-[10%]" :
              i % 5 === 1 ? "h-1.5 w-1.5 top-[18%] left-[82%] animation-delay-300" :
              i % 5 === 2 ? "h-2.5 w-2.5 top-[36%] left-[6%] animation-delay-700" :
              i % 5 === 3 ? "h-1 w-1 top-[55%] left-[92%] animation-delay-500" :
                             "h-2 w-2 top-[72%] left-[16%] animation-delay-900"
            }`}
            style={{ animationDelay: `${(i % 5) * 300}ms` }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-8">
        <div className="glass-card-smooth flex flex-col gap-0.5 rounded-2xl px-4 py-3 shadow-card max-w-[72%]">
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-strong">
            NIVEL {activity.levelNumber}
          </span>
          <strong className="font-display text-base sm:text-lg text-text leading-tight">{activity.title}</strong>
          <em className="text-xs text-muted not-italic">{activity.subtitle}</em>
        </div>
        <div className="flex items-center gap-2">
          <StarCounter />
          <button
            type="button"
            className="glass rounded-full px-3 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
            onClick={() => navigate(`/worlds/${activity.worldId}`)}
            aria-label="Salir"
          >
            <X size={16} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Goal strip. Con guion manda la consigna DEL PASO: la del nivel sola
          no alcanzaba para saber qué había que hacer en cada momento. */}
      <div className="mx-4 mt-4 sm:mx-8 glass-card-smooth rounded-2xl px-4 py-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-accent/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-strong">
            {steps ? "Paso" : "Atajo"} {Math.min(prog.progress + (prog.completed ? 0 : 1), total)} / {total}
          </span>
          {steps && (
            <span className="text-xs font-semibold text-muted">{activity.instruction}</span>
          )}
        </div>
        <h2 className="mt-1 font-display text-lg sm:text-2xl leading-snug text-text">
          {currentStep?.prompt ?? activity.instruction}
        </h2>
        {steps && (
          /* Los pasos ya hechos quedan a la vista: así se entiende que
             seleccionar, copiar y pegar son partes de una misma tarea. */
          <ol className="mt-2 flex flex-wrap gap-1.5" aria-label="Pasos de la tarea">
            {steps.map((s, i) => (
              <li
                key={i}
                className={[
                  "rounded-full px-2.5 py-0.5 text-[11px] font-bold transition",
                  i < prog.progress
                    ? "bg-mint/30 text-accent-teal"
                    : i === prog.progress && !prog.completed
                      ? "bg-accent/25 text-accent-strong ring-1 ring-accent/40"
                      : "bg-white/50 text-muted",
                ].join(" ")}
              >
                {i < prog.progress ? "✓ " : ""}{s.combo}
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Stage: mascots + virtual environment */}
      <section
        className="relative mx-4 mt-4 flex flex-1 flex-col items-center justify-center gap-4 sm:mx-8"
        aria-label="Escena"
      >
        <img
          className="hidden sm:block absolute left-0 bottom-4 w-24 md:w-32 animate-mascot-float drop-shadow-xl"
          src={assets.mascotFemaleWave}
          alt=""
          decoding="async"
        />
        <span className="hidden sm:block absolute left-24 md:left-36 bottom-24 glass-card-smooth rounded-2xl rounded-bl-sm px-3 py-1.5 text-xs font-semibold text-text shadow-card animate-bubble-pop">
          ¡Vos podés!
        </span>
        <img
          className="hidden sm:block absolute right-0 bottom-4 w-24 md:w-32 animate-mascot-float drop-shadow-xl"
          style={{ animationDelay: "1.2s" }}
          src={assets.mascotMaleProud}
          alt=""
          decoding="async"
        />
        <span className="hidden sm:block absolute right-24 md:right-36 bottom-24 glass-card-smooth rounded-2xl rounded-br-sm px-3 py-1.5 text-xs font-semibold text-text shadow-card animate-bubble-pop"
          style={{ animationDelay: "400ms" }}>
          ¡Sos un crack!
        </span>

        <div className="relative z-10 w-full max-w-3xl glass-card p-4 sm:p-6 shadow-card flex flex-col gap-4">
          {/* Sin guion, un montaje nuevo por combo: cada atajo es su propio
              ejercicio y conviene que el simulador arranque limpio.

              CON guion NO se remonta mientras el escenario sea el mismo, y
              ahí está la diferencia: si el simulador se reinicia entre pasos,
              lo que seleccionaste deja de estar pintado cuando vas a copiar y
              el portapapeles llega vacío al pegar, que era justamente lo que
              hacía que copiar y pegar no se entendieran. Al cambiar de
              escenario (del editor al cartel, por ejemplo) sí se remonta. */}
          <VirtualEnv
            key={steps ? `${currentEnv ?? "none"}` : prog.progress}
            combo={current}
            progress={prog.progress}
            completed={prog.completed}
            triggerSignal={kbTrigger}
            onVirtualAction={succeed}
            scene={scene}
            dialog={currentStep?.dialog}
            stepIndex={currentIdx}
            envOverride={currentEnv}
          />

          {/* Teclado en pantalla. Para los atajos reservados no es un plan B:
              es el ÚNICO camino, porque el navegador se queda con la tecla. */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs sm:text-sm font-medium text-text shadow-sm backdrop-blur">
              <Monitor size={16} className="text-accent-strong" />
              {current ? comboActionHint(current) : "Hacé el atajo dentro del simulador."}
            </span>
            {reservado ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100/90 px-3 py-1 text-[11px] sm:text-xs font-bold text-amber-900 shadow-sm">
                <span aria-hidden="true">👇</span>
                Este atajo lo maneja el navegador: tocá las teclas de acá abajo.
              </span>
            ) : bloqueo.estado === "activo" ? (
              <span className="flex items-center gap-1.5 rounded-full bg-mint/25 px-3 py-1 text-[11px] sm:text-xs font-bold text-accent-teal shadow-sm">
                🔒 Teclado capturado: apretá el atajo de verdad, no le pasa nada al navegador.
              </span>
            ) : (
              <span className="text-[11px] text-muted">Usá las teclas del juego o el teclado.</span>
            )}
            <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label={`Atajo: ${current?.raw ?? ""}`}>
              {current?.caps.map((cap, i) => (
                <span key={`${i}:${cap}`} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className={[
                      "min-w-[2.5rem] select-none rounded-xl border px-3 py-2 text-sm sm:text-base font-bold shadow-btn transition",
                      clicked[`${i}:${cap}`]
                        ? "border-white/80 bg-gradient-to-b from-accent to-accent-strong text-white scale-95 shadow-inner"
                        : reservado
                          /* Resaltadas: son el camino real, no un adorno. */
                          ? "border-amber-300 bg-gradient-to-b from-amber-50 to-amber-100 text-amber-900 ring-2 ring-amber-300/70 hover:-translate-y-0.5 hover:shadow-btn-hover active:scale-95"
                          : "border-white/80 bg-gradient-to-b from-white to-bg-soft text-text hover:-translate-y-0.5 hover:shadow-btn-hover active:scale-95",
                    ].join(" ")}
                    onClick={() => onKeycapClick(i, cap)}
                    tabIndex={-1}
                  >
                    {cap}
                  </button>
                  {i < current.caps.length - 1 && (
                    <span className="px-1 text-lg font-bold text-muted">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Puerta de pantalla completa. Sólo aparece en los niveles con atajos
          del navegador y sólo donde la API existe. Hace falta un clic porque
          pantalla completa no se puede pedir sin un gesto del alumno. */}
      {bloqueo.estado === "pendiente" && !prog.completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-text/45 backdrop-blur-sm" />
          <div className="glass-card-smooth relative w-full max-w-md rounded-3xl p-7 text-center shadow-card animate-modal-in">
            <div className="text-5xl" aria-hidden="true">🔒</div>
            <h3 className="mt-3 font-display text-2xl text-text">Modo pantalla completa</h3>
            <p className="mt-2 text-sm text-muted">
              Este nivel usa atajos que normalmente maneja el navegador, como abrir y
              cerrar pestañas. En pantalla completa el juego se queda con esas teclas,
              así podés apretarlas de verdad sin que se te abra ni se te cierre nada.
            </p>
            <button
              type="button"
              className="mt-5 rounded-full bg-gradient-to-br from-accent to-accent-strong px-6 py-3 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
              onClick={bloqueo.tomar}
            >
              Empezar el nivel
            </button>
            <p className="mt-3 text-[11px] text-muted">
              Para salir, apretá Escape sin soltar o usá el botón «Salir».
            </p>
            {/* Salida siempre disponible: si la escuela bloquea pantalla
                completa, el nivel igual se juega con el teclado de abajo. */}
            <button
              type="button"
              className="mt-2 text-[11px] font-semibold text-accent-strong underline underline-offset-2 transition hover:text-accent"
              onClick={bloqueo.seguirSinBloqueo}
            >
              Seguir sin pantalla completa
            </button>
          </div>
        </div>
      )}

      {/* Metrics bar */}
      <div className="mx-4 mt-4 mb-2 sm:mx-8 flex items-center justify-center gap-3 rounded-2xl bg-white/60 px-4 py-2 text-sm font-semibold text-text shadow-card backdrop-blur-md">
        <span className="text-amber-400">★</span>
        <div><b>Intentos:</b> {prog.attempts}</div>
        <div className="h-4 w-px bg-text/15" />
        <div><b>Aciertos:</b> {prog.progress}</div>
        <div className="h-4 w-px bg-text/15" />
        <div><b>Precisión:</b> {prog.precision}%</div>
        <span className="text-amber-400">★</span>
      </div>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 sm:px-8">
        <div className="glass-card-smooth flex-1 rounded-2xl px-4 py-2 text-sm font-medium text-text shadow-card min-w-[200px]">
          <span aria-hidden="true" className="mr-1 text-amber-400">★</span>
          {feedback ?? activity.description}
        </div>
        <button
          type="button"
          className="glass-card-smooth rounded-full px-4 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
          onClick={speak}
        >
          <span aria-hidden="true">🔊</span> Escuchar consigna
        </button>
        <button
          type="button"
          className="glass-card-smooth rounded-full px-4 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
          onClick={retry}
        >
          <RotateCcw size={16} /> Reintentar
        </button>
      </footer>

      {/* Completion modal */}
      {prog.completed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-text/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md animate-modal-in">
            <div className="glass-card-smooth relative overflow-hidden rounded-3xl p-8 text-center shadow-card">
              <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => (
                  <span
                    key={i}
                    className={`absolute block h-2 w-2 rounded-full animate-fall ${
                      i % 6 === 0 ? "bg-accent-pink" :
                      i % 6 === 1 ? "bg-accent-sky" :
                      i % 6 === 2 ? "bg-mint" :
                      i % 6 === 3 ? "bg-accent" :
                      i % 6 === 4 ? "bg-rose" :
                                    "bg-accent-teal"
                    }`}
                    style={{
                      left: `${(i * 53) % 100}%`,
                      animationDelay: `${(i * 120) % 1200}ms`,
                      animationDuration: `${1800 + ((i * 300) % 800)}ms`,
                    }}
                  />
                ))}
              </div>
              <div className="text-5xl animate-bounce-trophy" aria-hidden="true">🏆</div>
              <h3 className="mt-3 font-display text-2xl text-text">¡Muy bien!</h3>
              <p className="text-sm text-muted">Completaste el nivel</p>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-2xl" aria-hidden="true">
                {[1, 2, 3].map((i) => {
                  const earned = getStarsFromAccuracy(prog.precision);
                  return (
                    <span
                      key={i}
                      className={earned >= i ? "animate-star-pop-i5 text-amber-400" : "text-text/25"}
                      style={earned >= i ? { animationDelay: `${i * 180}ms` } : undefined}
                    >
                      {earned >= i ? "★" : "☆"}
                    </span>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-br from-accent to-accent-strong px-5 py-2.5 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
                  onClick={() => navigate(`/worlds/${activity.worldId}`)}
                >
                  Volver a la isla
                </button>
                <button
                  type="button"
                  className="glass-card-smooth rounded-full px-4 py-2 text-sm font-semibold text-text shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0 flex items-center gap-1.5"
                  onClick={retry}
                >
                  <RotateCcw size={16} /> Repetir nivel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ================================================================== */
/* Virtual Environment — renders the simulated context for each combo  */
/* ================================================================== */

interface VirtualEnvProps {
  combo: Combo | undefined;
  progress: number;
  completed: boolean;
  triggerSignal: number;
  onVirtualAction: () => void;
  /** Contenido propio del nivel (island11); sin esto van los textos genéricos. */
  scene?: ShortcutScene;
  /** Cartel concreto del paso, para Enter/Escape. */
  dialog?: ShortcutDialog;
  /** Índice del paso: los escenarios que persisten lo usan para reiniciarse
   *  cuando el paso cambia sin que cambie el escenario (dos carteles seguidos). */
  stepIndex: number;
  /** Escenario elegido por el guion, cuando el atajo solo no alcanza. */
  envOverride?: VirtualEnvKind;
}

type EnvProps = {
  combo: Combo;
  completed: boolean;
  triggerSignal: number;
  onAction: () => void;
  scene?: ShortcutScene;
  dialog?: ShortcutDialog;
  stepIndex: number;
};

function VirtualEnv({ combo, completed, triggerSignal, onVirtualAction, scene, dialog, stepIndex, envOverride }: VirtualEnvProps) {
  if (!combo) return null;
  const props: EnvProps = { combo, completed, triggerSignal, onAction: onVirtualAction, scene, dialog, stepIndex };
  switch (envOverride ?? combo.env) {
    case "browser-tabs":
      return <VirtualBrowser {...props} />;
    case "find-box":
      return <VirtualFindBox {...props} />;
    case "app-switcher":
      return <VirtualAppSwitcher {...props} />;
    case "doc-editor":
      return <VirtualDocEditor {...props} />;
    case "dialog":
      return <VirtualDialog {...props} />;
    default:
      return <VirtualTextEditor {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/* Virtual Browser (Ctrl+T, Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab)         */
/* ------------------------------------------------------------------ */
function VirtualBrowser({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [tabs, setTabs] = useState(["Inicio", "Música", "Juegos"]);
  const [active, setActive] = useState(0);
  const [justActed, setJustActed] = useState(false);
  useKeyboardTrigger(triggerSignal, () => act("kbd"));

  function act(label: string) {
    if (completed || justActed) return;
    setJustActed(true);
    window.setTimeout(() => setJustActed(false), 600);

    const key = combo.key.toLowerCase();
    const hasShift = combo.mods.includes("Shift");

    if (key === "t") {
      setTabs((prev) => [...prev, `Pestaña ${prev.length + 1}`]);
      setActive((prev) => tabs.length); // new tab at end
      onAction();
    } else if (key === "w") {
      setTabs((prev) => {
        if (prev.length <= 1) { onAction(); return prev; }
        const next = prev.filter((_, i) => i !== active);
        setActive(Math.min(active, next.length - 1));
        onAction();
        return next;
      });
    } else if (key === "tab") {
      setTabs((prev) => {
        if (hasShift) {
          setActive((a) => (a - 1 + prev.length) % prev.length);
        } else {
          setActive((a) => (a + 1) % prev.length);
        }
        onAction();
        return prev;
      });
    } else {
      onAction();
    }
    void label;
  }

  const actionLabel =
    combo.key.toLowerCase() === "t" ? "Abrir pestaña" :
    combo.key.toLowerCase() === "w" ? "Cerrar pestaña" :
    "Cambiar pestaña";

  return (
    <div className="glass-surface flex flex-col gap-3 p-4">
      {/* Browser toolbar */}
      <div className="flex items-center gap-1 rounded-xl bg-white/80 p-1.5 shadow-sm">
        {tabs.map((tab, i) => (
          <button
            key={`${tab}-${i}`}
            type="button"
            className={[
              "group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              i === active
                ? "bg-gradient-to-b from-accent-sky/30 to-accent/20 text-text shadow-sm"
                : "text-muted hover:bg-white/60 hover:text-text",
              justActed && i === active ? "animate-reward-pop" : "",
            ].join(" ")}
            onClick={() => setActive(i)}
          >
            <span className="truncate max-w-[6rem] sm:max-w-[8rem]">{tab}</span>
            {tabs.length > 1 && (
              <span
                className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-muted transition hover:bg-rose/20 hover:text-rose"
                onClick={(e) => {
                  e.stopPropagation();
                  if (combo.key.toLowerCase() === "w") act("close");
                }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-lg font-bold text-muted transition hover:bg-accent/15 hover:text-accent-strong"
          onClick={() => combo.key.toLowerCase() === "t" && act("new")}
        >
          +
        </button>
      </div>
      {/* Browser content */}
      <div className="flex min-h-[8rem] flex-col items-center justify-center rounded-xl bg-white/70 p-4 text-center shadow-inner">
        <p className="font-display text-lg text-text">{tabs[active]}</p>
        <p className="mt-1 text-xs text-muted">Contenido de la página</p>
      </div>
      <button
        type="button"
        className={[
          "self-center rounded-full px-4 py-2 text-sm font-bold shadow-btn transition",
          justActed
            ? "bg-gradient-to-br from-mint to-accent-teal text-white scale-95"
            : "bg-gradient-to-br from-accent to-accent-strong text-white hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
        ].join(" ")}
        onClick={() => act("click")}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Find Box (Ctrl+F, Escape)                                   */
/* ------------------------------------------------------------------ */
function VirtualFindBox({ combo, completed, triggerSignal, onAction, scene }: EnvProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const SAMPLE = "El gato saltó sobre la mesa. El perro corrió por el jardín. El niño leyó un libro.";
  const texto = scene?.page ?? SAMPLE;
  const buscado = scene?.find;
  /* Posición de la coincidencia, para poder partir el texto y pintarla. */
  const corte = buscado ? texto.indexOf(buscado) : -1;
  const resaltar = open && corte >= 0;

  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "f") {
      setOpen(true);
      /* El buscador aparece YA con lo buscado escrito y resaltado en el
         texto: si no, abrirlo no mostraba ningún resultado y no se entendía
         para qué sirve Ctrl+F. */
      if (buscado) setQuery(buscado);
      window.setTimeout(() => inputRef.current?.focus(), 50);
      onAction();
    } else if (k === "escape" && open) {
      setOpen(false);
      onAction();
    } else if (!open) {
      onAction();
    }
  }

  return (
    <div className="glass-surface flex flex-col gap-3 p-4">
      <div className="relative min-h-[8rem] rounded-xl bg-white/80 p-4 text-sm text-text shadow-inner">
        <p>
          {resaltar ? (
            <>
              {texto.slice(0, corte)}
              <mark className="rounded bg-amber-300/70 px-0.5 font-semibold text-text animate-reward-pop">
                {buscado}
              </mark>
              {texto.slice(corte + (buscado?.length ?? 0))}
            </>
          ) : (
            texto
          )}
        </p>
        {open && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-lg border border-white/80 bg-white/90 px-2 py-1 shadow-card animate-modal-in">
            <input
              ref={inputRef}
              className="w-40 sm:w-56 bg-transparent text-xs text-text placeholder:text-muted/70 outline-none"
              placeholder="Buscar en la página…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {resaltar && (
              <span className="whitespace-nowrap rounded-full bg-mint/30 px-1.5 text-[10px] font-bold text-accent-teal">
                1 de 1
              </span>
            )}
            <button
              type="button"
              className="flex h-5 w-5 items-center justify-center rounded-full text-sm text-muted transition hover:bg-rose/20 hover:text-rose"
              onClick={() => { setOpen(false); setQuery(""); }}
            >
              ×
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className={[
          "self-center rounded-full px-4 py-2 text-sm font-bold shadow-btn transition",
          open
            ? "bg-gradient-to-br from-mint to-accent-teal text-white"
            : "bg-gradient-to-br from-accent to-accent-strong text-white hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
        ].join(" ")}
        onClick={act}
      >
        {combo.key.toLowerCase() === "f"
          ? open ? "Buscar abierto ✓" : "Abrir buscador"
          : "Cerrar buscador"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual App Switcher (Alt+Tab — simulated, OS-safe)                 */
/* ------------------------------------------------------------------ */
const VIRT_APPS = ["TYPELY", "Música", "Notas", "Dibujo"];

function VirtualAppSwitcher({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [ventanas, setVentanas] = useState(VIRT_APPS);
  const [focused, setFocused] = useState(0);
  const [switching, setSwitching] = useState(false);
  useKeyboardTrigger(triggerSignal, () => act());

  const esNueva = combo.key.toLowerCase() === "n";
  const incognito = esNueva && combo.mods.includes("Shift");

  function act() {
    if (completed) return;
    setSwitching(true);
    if (esNueva) {
      /* Ctrl+N abre una ventana NUEVA y el foco se va a ella: eso es lo que
         hay que ver, que aparece una ventana más y no una pestaña. */
      setVentanas((prev) => {
        const nombre = incognito ? "Ventana privada" : `Ventana ${prev.length + 1}`;
        setFocused(prev.length);
        return [...prev, nombre];
      });
    } else {
      setFocused((f) => (f + 1) % ventanas.length);
    }
    window.setTimeout(() => setSwitching(false), 400);
    onAction();
  }

  const iconos = ["🎮", "🎵", "📝", "🎨"];

  return (
    <div className="glass-surface flex flex-col items-center gap-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ventanas abiertas:</p>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
        {ventanas.map((app, i) => (
          <div
            key={`${app}-${i}`}
            className={[
              "flex flex-col items-center gap-1 rounded-2xl border border-white/70 bg-white/60 p-3 text-xs font-semibold text-text shadow-sm transition",
              i === focused ? "ring-2 ring-accent bg-gradient-to-b from-accent-sky/25 to-accent/15 scale-105" : "",
              switching && i === focused ? "animate-reward-pop" : "",
            ].join(" ")}
          >
            <span className="text-2xl">{iconos[i] ?? (incognito && i === ventanas.length - 1 ? "🕶️" : "🪟")}</span>
            <span className="truncate max-w-full">{app}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={[
          "self-center rounded-full px-4 py-2 text-sm font-bold shadow-btn transition",
          switching
            ? "bg-gradient-to-br from-mint to-accent-teal text-white scale-95"
            : "bg-gradient-to-br from-accent to-accent-strong text-white hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
        ].join(" ")}
        onClick={act}
      >
        {esNueva ? (incognito ? "Abrir ventana privada" : "Abrir ventana nueva") : "Cambiar de ventana"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Document Editor (Ctrl+S save, Ctrl+Y redo)                 */
/* ------------------------------------------------------------------ */
function VirtualDocEditor({ combo, completed, triggerSignal, onAction }: EnvProps) {
  const [saved, setSaved] = useState(false);
  const [history] = useState(["Hola mundo", "Hola, ¡mundo!"]);
  const [histIdx, setHistIdx] = useState(1);
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "s") { setSaved(true); window.setTimeout(() => setSaved(false), 1200); onAction(); }
    else if (k === "y") { setHistIdx((i) => Math.min(history.length - 1, i + 1)); onAction(); }
    else onAction();
  }

  return (
    <div className="glass-surface flex flex-col gap-3 p-4">
      <div className="flex flex-col overflow-hidden rounded-xl bg-white/85 shadow-inner">
        <div className="flex items-center gap-3 border-b border-white/60 bg-gradient-to-b from-white/90 to-bg-soft/60 px-3 py-1.5 text-xs font-semibold text-muted">
          <span>Archivo</span>
          <span>Editar</span>
          <span>Vista</span>
          {saved && (
            <span className="ml-auto rounded-full bg-mint/25 px-2 py-0.5 text-[11px] font-bold text-accent-teal animate-reward-pop">
              ✓ Guardado
            </span>
          )}
        </div>
        <div className="min-h-[6rem] p-4 text-sm text-text">{history[histIdx]}</div>
      </div>
      <button
        type="button"
        className={[
          "self-center rounded-full px-4 py-2 text-sm font-bold shadow-btn transition",
          saved
            ? "bg-gradient-to-br from-mint to-accent-teal text-white"
            : "bg-gradient-to-br from-accent to-accent-strong text-white hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
        ].join(" ")}
        onClick={act}
      >
        {combo.key.toLowerCase() === "s" ? "Guardar documento" : "Rehacer cambio"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Dialog (Enter / Escape)                                     */
/* ------------------------------------------------------------------ */
function VirtualDialog({ combo, completed, triggerSignal, onAction, dialog, stepIndex }: EnvProps) {
  const [state, setState] = useState<"idle" | "open" | "done">("open");
  useKeyboardTrigger(triggerSignal, () => act());

  /* Con guion el escenario no se remonta entre pasos, así que dos carteles
     seguidos compartirían el estado y el segundo ya aparecería contestado.
     Al cambiar de paso el cartel vuelve a abrirse. */
  useEffect(() => { setState("open"); }, [stepIndex]);

  function act() {
    if (completed || state === "done") return;
    const k = combo.key.toLowerCase();
    if (k === "enter") { setState("done"); onAction(); }
    else if (k === "escape") { setState("idle"); onAction(); }
    else onAction();
  }

  const peligro = dialog?.danger === true;

  return (
    <div className="glass-surface flex flex-col items-center gap-3 p-4">
      <div className="relative flex w-full min-h-[8rem] flex-col items-center justify-center rounded-xl bg-white/80 p-4 text-center text-sm text-text shadow-inner">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          {dialog?.app ?? "Una app"}
        </p>
        {state === "open" && (
          <div
            className={[
              "mt-3 w-full max-w-sm animate-modal-in rounded-2xl border p-4 shadow-card",
              peligro
                ? "border-rose/40 bg-rose/10 ring-2 ring-rose/30"
                : "border-white/80 bg-white/95",
            ].join(" ")}
          >
            {peligro && (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-rose">
                ⚠ Cuidado
              </p>
            )}
            <p className="text-sm font-semibold text-text">
              {dialog?.question ?? "¿Guardar antes de salir?"}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className={[
                  "rounded-full px-4 py-1.5 text-xs font-bold shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
                  peligro
                    ? "border border-text/15 bg-white text-text"
                    : "bg-gradient-to-br from-accent to-accent-strong text-white",
                ].join(" ")}
                onClick={() => { setState("done"); if (!completed) onAction(); }}
              >
                {dialog?.accept ?? "Aceptar"} (Enter)
              </button>
              <button
                type="button"
                className={[
                  "rounded-full px-4 py-1.5 text-xs font-bold shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0",
                  peligro
                    ? "bg-gradient-to-br from-rose to-accent-pink text-white"
                    : "border border-text/15 bg-white text-text",
                ].join(" ")}
                onClick={() => { setState("idle"); if (!completed) onAction(); }}
              >
                {dialog?.cancel ?? "Cancelar"} (Escape)
              </button>
            </div>
          </div>
        )}
        {state === "done" && (
          <p className="mt-2 rounded-full bg-mint/25 px-3 py-1 text-xs font-bold text-accent-teal animate-reward-pop">
            ✓ {dialog?.resultAccept ?? "¡Aceptado!"}
          </p>
        )}
        {state === "idle" && (
          <p className="mt-2 rounded-full bg-rose/20 px-3 py-1 text-xs font-bold text-rose animate-reward-pop">
            ✗ {dialog?.resultCancel ?? "Cancelado."}
          </p>
        )}
      </div>
      {state !== "open" && (
        <button
          type="button"
          className="self-center rounded-full bg-gradient-to-br from-mint to-accent-teal px-4 py-2 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
          onClick={() => setState("open")}
        >
          Abrir diálogo otra vez
        </button>
      )}
      <button
        type="button"
        className="self-center rounded-full bg-gradient-to-br from-accent to-accent-strong px-4 py-2 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
        onClick={act}
        style={{ marginTop: state !== "open" ? "0.5rem" : undefined }}
      >
        {combo.key.toLowerCase() === "enter"
          ? `${dialog?.accept ?? "Aceptar"} (Enter)`
          : `${dialog?.cancel ?? "Cancelar"} (Escape)`}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Virtual Text Editor (Ctrl+C/V/A/Z)                                  */
/* ------------------------------------------------------------------ */
const SOURCE_TEXT = "¡Hola! Soy un texto para copiar.";

function VirtualTextEditor({ combo, completed, triggerSignal, onAction, scene }: EnvProps) {
  const sourceText = scene?.source ?? SOURCE_TEXT;
  /* Selection is SIMULATED with internal state — we never touch the real DOM
     selection, so Ctrl+A can never select the whole page. The source starts
     UNSELECTED; only performing Ctrl+A (keyboard, keycaps or button) selects
     it inside the box. */
  const [selectedAll, setSelectedAll] = useState(false);
  const [clipboard, setClipboard] = useState("");
  const [pasted, setPasted] = useState("");
  const [undone, setUndone] = useState(false);
  useKeyboardTrigger(triggerSignal, () => act());

  function act() {
    if (completed) return;
    const k = combo.key.toLowerCase();
    if (k === "a") {
      setSelectedAll(true);            // visual select inside the simulator only
      onAction();
    } else if (k === "c") {
      // Copy the (simulated) selected text into internal game clipboard.
      setSelectedAll(true);
      setClipboard(sourceText);
      onAction();
    } else if (k === "v") {
      setPasted(clipboard || sourceText);
      onAction();
    } else if (k === "z") {
      setPasted("");
      setUndone(true);
      window.setTimeout(() => setUndone(false), 1200);
      onAction();
    } else {
      onAction();
    }
  }

  const label =
    combo.key.toLowerCase() === "a" ? "Seleccionar todo" :
    combo.key.toLowerCase() === "c" ? "Copiar" :
    combo.key.toLowerCase() === "v" ? "Pegar" :
    "Deshacer";

  return (
    <div className="glass-surface grid gap-3 p-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 shadow-inner">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {scene?.sourceLabel ?? "Texto fuente"}
        </span>
        {/* user-select:none keeps the browser from ever selecting it;
            the simulated selection highlight appears via conditional classes. */}
        <p
          className={[
            "rounded-lg p-2 text-sm transition select-none",
            selectedAll
              ? "bg-accent/25 text-text ring-2 ring-accent/40"
              : "text-text/80",
          ].join(" ")}
        >
          {sourceText}
        </p>
        {selectedAll && (
          <span className="self-start rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-bold text-accent-strong animate-reward-pop">
            ✓ seleccionado
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl bg-white/70 p-3 shadow-inner">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {scene?.targetLabel ?? "Área de trabajo"}
        </span>
        <div
          className="min-h-[4rem] rounded-lg border border-dashed border-white/80 bg-white/60 p-2 text-sm text-text"
          aria-label="Área de trabajo"
        >
          {pasted ? pasted : (
            <span className="text-muted/70 italic">Acá aparecerá lo que pegues…</span>
          )}
        </div>
        {undone && (
          <span className="self-start rounded-full bg-accent-sky/25 px-2 py-0.5 text-[11px] font-bold text-accent-strong animate-reward-pop">
            ↩ deshecho
          </span>
        )}
      </div>

      {/* El portapapeles, a la vista. Es lo único del copiar-y-pegar que en la
          computadora de verdad es invisible, y por eso copiar parecía no hacer
          nada: acá se ve que Ctrl+C lo llena y que Ctrl+V lo usa. */}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-2 rounded-xl bg-white/55 px-3 py-2 shadow-inner">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted">📋 Portapapeles</span>
        {clipboard ? (
          <span className="rounded-lg bg-mint/25 px-2 py-1 text-xs font-semibold text-accent-teal animate-reward-pop">
            «{clipboard}»
          </span>
        ) : (
          <span className="text-xs italic text-muted/70">vacío — todavía no copiaste nada</span>
        )}
      </div>
      <button
        type="button"
        className="sm:col-span-2 self-center rounded-full bg-gradient-to-br from-accent to-accent-strong px-4 py-2 text-sm font-bold text-white shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover active:translate-y-0"
        onClick={act}
      >
        {label}
      </button>
    </div>
  );
}
