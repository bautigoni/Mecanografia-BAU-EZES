import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Crosshair, Grid3x3, Maximize, MousePointerClick, Move, RotateCcw, Save, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LevelPosition } from "../../data/levelPositions";

/* =====================================================================
   LevelPositionEditor — DEV-ONLY level marker placement helper.

   Renders the in-map grid + crosshair, a fixed HUD panel with position
   array, and 3D perspective controls (scale, rotateX/Y/Z, perspective
   depth) for the currently selected level node.

   Keyboard shortcuts (toggle-based — press once to enter, again to exit):
     ←↑↓→            move position by 0.5 %
     S                toggle SCALE mode   ↑↓ adjust
     X                toggle ROTATE X mode   ↑↓ adjust (tilt fwd/back)
     Y                toggle ROTATE Y mode   ←→ adjust (tilt left/right)
     Z                toggle ROTATE Z mode   ←→ adjust (spin)
     P                toggle PERSPECTIVE mode   ↑↓ adjust (depth)
     N                toggle NUMBER mode   ←↑↓→ move the number over the button
     M                toggle NUMBER SIZE mode   ↑↓ adjust
                      With "Ver apretado" on, N writes the PRESSED number
                      position (numXHover/numYHover) instead of the resting one
     Shift + arrows   coarse step (x10)
     Alt   + arrows   fine step
     + / - / 0        zoom in / out / fit (lens only — never touches data)
     wheel            zoom at the cursor
     Space + drag     pan  (also middle mouse button)
     Escape           deselect node + exit mode
     Ctrl/Cmd + C     copy config array to clipboard + console
     Ctrl/Cmd + S     GUARDAR en src/data/levelPositions.ts (sin copiar/pegar)
   ===================================================================== */

export interface EditorLevel {
  activityId: string;
  levelNumber: number;
}

/** Modo activo del editor: qué mueven las flechas. `null` = mover el nodo. */
export type PerspMode =
  | "scale" | "rotateX" | "rotateY" | "rotateZ" | "persp"
  | "numpos" | "numsize"
  | null;

/** Campo de LevelPosition que tocan los sliders del panel. */
export type PerspField =
  | "scale" | "rotateX" | "rotateY" | "rotateZ" | "perspective"
  | "numX" | "numY" | "numSize"
  | "numXHover" | "numYHover";

interface LevelPositionEditorProps {
  worldSlug: string;
  positions: LevelPosition[];
  levels: EditorLevel[];
  cursor: LevelPosition | null;
  lastClick: LevelPosition | null;
  gridOn: boolean;
  selectedIndex: number;
  perspMode: PerspMode;
  numScale: number;
  onNumScaleChange: (v: number) => void;
  onSelectIndex: (index: number) => void;
  onToggleGrid: () => void;
  onReset: () => void;
  onClose: () => void;
  onCursorMove: (clientX: number, clientY: number) => void;
  onCopyAt: (clientX: number, clientY: number) => void;
  onUpdatePerspective: (index: number, field: PerspField, value: number) => void;
  onToast: (text: string) => void;
  /* Lupa: sólo cambia cómo se ve el escenario, nunca los datos. */
  zoom: number;
  onZoom: (factor: number) => void;
  onZoomReset: () => void;
  /* Ver el nodo seleccionado en su estado apretado, para poder acomodar el
     número de ese estado sin tener el mouse encima. */
  previewPressed: boolean;
  onTogglePressed: () => void;
}

const GRID_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];
const R1 = (v: number) => Math.round(v * 10) / 10;
const R2 = (v: number) => Math.round(v * 100) / 100;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function posString(p: LevelPosition): string {
  const parts: string[] = [];
  if (p.scale !== undefined && p.scale !== 1) parts.push(`scale: ${R2(p.scale)}`);
  if (p.rotateX !== undefined && p.rotateX !== 0) parts.push(`rotateX: ${R1(p.rotateX)}`);
  if (p.rotateY !== undefined && p.rotateY !== 0) parts.push(`rotateY: ${R1(p.rotateY)}`);
  if (p.rotateZ !== undefined && p.rotateZ !== 0) parts.push(`rotateZ: ${R1(p.rotateZ)}`);
  if (p.perspective !== undefined && p.perspective !== 500) parts.push(`perspective: ${R1(p.perspective)}`);
  if (p.numX !== undefined && p.numX !== 0) parts.push(`numX: ${R1(p.numX)}`);
  if (p.numY !== undefined && p.numY !== 0) parts.push(`numY: ${R1(p.numY)}`);
  if (p.numSize !== undefined && p.numSize !== 1) parts.push(`numSize: ${R2(p.numSize)}`);
  if (p.numXHover !== undefined) parts.push(`numXHover: ${R1(p.numXHover)}`);
  if (p.numYHover !== undefined) parts.push(`numYHover: ${R1(p.numYHover)}`);
  let line = `{ x: ${p.x}, y: ${p.y}`;
  if (parts.length > 0) line += `, ${parts.join(", ")}`;
  return line + " },";
}

function arrayLiteral(positions: LevelPosition[]): string {
  return `[\n${positions.map((p) => `  ${posString(p)}`).join("\n")}\n]`;
}

function fullJson(worldSlug: string, positions: LevelPosition[], levels: EditorLevel[]): string {
  return JSON.stringify(
    {
      worldId: worldSlug,
      islandId: worldSlug,
      levels: positions.map((p, i) => ({
        id: levels[i]?.activityId ?? `level-${i + 1}`,
        levelNumber: levels[i]?.levelNumber ?? i + 1,
        x: p.x,
        y: p.y,
        ...(p.scale !== undefined && p.scale !== 1 ? { scale: R2(p.scale) } : {}),
        ...(p.rotateX !== undefined && p.rotateX !== 0 ? { rotateX: R1(p.rotateX) } : {}),
        ...(p.rotateY !== undefined && p.rotateY !== 0 ? { rotateY: R1(p.rotateY) } : {}),
        ...(p.rotateZ !== undefined && p.rotateZ !== 0 ? { rotateZ: R1(p.rotateZ) } : {}),
        ...(p.perspective !== undefined && p.perspective !== 500 ? { perspective: R1(p.perspective) } : {}),
        ...(p.numX !== undefined && p.numX !== 0 ? { numX: R1(p.numX) } : {}),
        ...(p.numY !== undefined && p.numY !== 0 ? { numY: R1(p.numY) } : {}),
        ...(p.numSize !== undefined && p.numSize !== 1 ? { numSize: R2(p.numSize) } : {}),
        ...(p.numXHover !== undefined ? { numXHover: R1(p.numXHover) } : {}),
        ...(p.numYHover !== undefined ? { numYHover: R1(p.numYHover) } : {}),
      })),
    },
    null,
    2,
  );
}

function TinySlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          className="flex-1 h-1.5 accent-accent-strong cursor-pointer"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {/* Dos decimales cuando el paso es fino (escala, tamaño del número):
            con uno solo, un 1.97 se leía "2" y no se veía el ajuste. */}
        <span className="text-xs font-mono font-bold text-text min-w-[3rem] text-right tabular-nums">
          {step < 0.1 ? R2(value) : R1(value)}
        </span>
      </div>
    </label>
  );
}

export function LevelPositionEditor({
  worldSlug,
  positions,
  levels,
  cursor,
  lastClick,
  gridOn,
  selectedIndex,
  perspMode,
  numScale,
  onNumScaleChange,
  onSelectIndex,
  onToggleGrid,
  onReset,
  onClose,
  onCursorMove,
  onCopyAt,
  onUpdatePerspective,
  onToast,
  zoom,
  onZoom,
  onZoomReset,
  previewPressed,
  onTogglePressed,
}: LevelPositionEditorProps) {
  const sel = selectedIndex >= 0 && selectedIndex < positions.length ? positions[selectedIndex] : null;

  /* Drag-to-move the HUD panel so it never permanently covers a level node. */
  const [hudPos, setHudPos] = useState<{ left: number; top: number } | null>(null);
  const hudDrag = useRef<{ sx: number; sy: number; bl: number; bt: number } | null>(null);
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = hudDrag.current;
      if (!d) return;
      const left = Math.max(0, Math.min(window.innerWidth - 80, d.bl + (e.clientX - d.sx)));
      const top = Math.max(0, Math.min(window.innerHeight - 40, d.bt + (e.clientY - d.sy)));
      setHudPos({ left, top });
    }
    function onUp() { hudDrag.current = null; }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);
  function startHudDrag(e: React.PointerEvent) {
    const panel = (e.currentTarget as HTMLElement).closest("[data-hud]") as HTMLElement | null;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    hudDrag.current = { sx: e.clientX, sy: e.clientY, bl: r.left, bt: r.top };
    setHudPos({ left: r.left, top: r.top });
  }

  /* Ctrl/Cmd + S guarda, como en cualquier editor. Va acá adentro y no en
     IslandDetailPage porque saveToFile vive en este componente. Sin lista de
     dependencias a propósito: se re-suscribe en cada render para que el
     handler siempre vea las `positions` del momento. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        void saveToFile();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-hud]")) return;
    onCursorMove(e.clientX, e.clientY);
  }
  function handlePointerLeave() {
    onCursorMove(-99999, -99999);
  }
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("[data-hud]")) return;
    onCopyAt(e.clientX, e.clientY);
  }

  const modeLabel =
    perspMode === "scale" ? "ESCALA" :
    perspMode === "rotateX" ? "ROTATE X (inclinar fwd/back)" :
    perspMode === "rotateY" ? "ROTATE Y (inclinar izq/der)" :
    perspMode === "rotateZ" ? "ROTATE Z (girar)" :
    perspMode === "persp" ? "PERSPECTIVA (profundidad)" :
    perspMode === "numpos" ? (previewPressed ? "NUMERO APRETADO (mover)" : "NUMERO (mover)") :
    perspMode === "numsize" ? "NUMERO (tamaño)" :
    "posicion";

  const [saving, setSaving] = useState(false);

  async function copyArray() {
    const ok = await copyText(`${arrayLiteral(positions)}`);
    onToast(ok ? "Arreglo copiado · pegalo en levelPositions.ts" : "No se pudo copiar.");
  }

  /* Guarda directo en src/data/levelPositions.ts a través del endpoint que
     levanta scripts/vite-plugin-level-positions.ts. Sin copiar ni pegar: al
     escribirse el archivo, el HMR de Vite recarga y ves el resultado. El
     endpoint sólo existe en `vite dev`, así que en producción esto no puede
     hacer nada — de ahí el mensaje de error explícito si falta. */
  async function saveToFile() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/__typely/level-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId: worldSlug, positions }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onToast(`✓ Guardado en levelPositions.ts — ${data.count} niveles de ${worldSlug}`);
      } else {
        onToast(`No se pudo guardar: ${data.error ?? res.status}. Usá "Copiar arreglo".`);
      }
    } catch {
      onToast('Sin conexión con el server de dev. Usá "Copiar arreglo".');
    } finally {
      setSaving(false);
    }
  }
  async function copyJson() {
    const ok = await copyText(fullJson(worldSlug, positions, levels));
    onToast(ok ? "JSON completo copiado al portapapeles." : "No se pudo copiar.");
  }

  return (
    <>
      {/* ── In-map layer: grid + crosshair + click/move capture. ── */}
      <div className="absolute inset-0 z-[7] pointer-events-none" aria-hidden="true">
        {gridOn && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {GRID_LINES.map((n) => (
              <line
                key={`v${n}`}
                x1={n} y1={0} x2={n} y2={100}
                stroke={n === 50 ? "rgba(49,89,232,0.55)" : "rgba(49,89,232,0.18)"}
                strokeWidth={n === 50 ? "0.35" : "0.15"}
              />
            ))}
            {GRID_LINES.map((n) => (
              <line
                key={`h${n}`}
                x1={0} y1={n} x2={100} y2={n}
                stroke={n === 50 ? "rgba(49,89,232,0.55)" : "rgba(49,89,232,0.18)"}
                strokeWidth={n === 50 ? "0.35" : "0.15"}
              />
            ))}
          </svg>
        )}

        {cursor && (
          <>
            {/* Vertical crosshair */}
            <div
              className="absolute top-0 bottom-0 w-px bg-accent-strong/60"
              style={{ left: `${cursor.x}%` }}
            />
            {/* Horizontal crosshair */}
            <div
              className="absolute left-0 right-0 h-px bg-accent-strong/60"
              style={{ top: `${cursor.y}%` }}
            />
            {/* Cursor coordinate label */}
            <div
              className="absolute -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded bg-accent-strong/90 text-white text-[10px] font-mono font-bold whitespace-nowrap pointer-events-none"
              style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
            >
              x {cursor.x} · y {cursor.y}
            </div>
          </>
        )}

        <div
          className="pointer-events-auto cursor-crosshair absolute inset-0"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          onClick={handleClick}
        />
      </div>

      {/* ── Panel fijo del editor ──
          Sale por un portal a <body> a propósito: si quedara adentro del
          escenario, el transform de la lupa lo agrandaría junto con el mapa
          y el panel se volvería inusable justo cuando más zoom necesitás.
          El árbol de React no cambia, así que los props y los eventos
          siguen funcionando igual. */}
      {createPortal(
      <div
        data-hud
        className="fixed right-4 top-4 z-20 pointer-events-auto glass-surface p-4 rounded-xl w-72 flex flex-col gap-3 max-h-[calc(100dvh-2rem)] overflow-y-auto animate-hud-in"
        style={hudPos ? { left: hudPos.left, top: hudPos.top, right: "auto" } : undefined}
        role="dialog"
        aria-label="Editor de posiciones de niveles"
      >
        {/* Head — drag handle (move the panel so it never covers a node). */}
        <div className="flex items-center justify-between gap-2">
          <strong
            onPointerDown={startHudDrag}
            className="flex items-center gap-1.5 text-text text-sm font-extrabold cursor-move select-none touch-none"
            title="Arrastrá para mover el editor"
          >
            <Move size={14} className="text-muted" /> Editor · {worldSlug}
          </strong>
          <button
            type="button"
            className="grid place-items-center w-7 h-7 rounded-lg text-muted hover:bg-rose/10 hover:text-rose transition cursor-pointer"
            aria-label="Cerrar editor"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted leading-relaxed">
          Arrastra cada numero hasta su plataforma. Clic en un nodo para editar
          su perspectiva 3D y la posicion del numero, en los dos estados del
          boton.
        </p>

        {/* Readout */}
        <div className="flex flex-col gap-1.5 text-xs text-muted font-mono">
          <span>Cursor: {cursor ? `x ${cursor.x} · y ${cursor.y}` : "—"}</span>
          <span>Ultimo clic: {lastClick ? `x ${lastClick.x} · y ${lastClick.y}` : "—"}</span>
          <span>
            Nodo seleccionado:{" "}
            {sel ? `Nivel ${selectedIndex + 1}  x ${sel.x} · y ${sel.y}` : "ninguno"}
          </span>
          <span className="flex items-center gap-1.5 flex-wrap">
            Modo:{" "}
            <strong
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                perspMode
                  ? "bg-accent-strong text-white"
                  : "bg-white/60 text-muted"
              }`}
            >
              {modeLabel}
            </strong>
            {" "}(teclea S / X / Y / Z / P / N / M para cambiar)
          </span>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              gridOn
                ? "bg-accent-strong text-white shadow-sm"
                : "glass-surface text-muted hover:text-text"
            }`}
            onClick={onToggleGrid}
          >
            <Grid3x3 size={14} /> Grilla 10%
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold glass-surface text-muted hover:text-text transition cursor-pointer"
            onClick={onReset}
          >
            <RotateCcw size={14} /> Restaurar
          </button>
        </div>

        {/* ── Lupa ──────────────────────────────────────────────────────
            Sólo agranda la vista. No toca ni un número: los datos son % del
            escenario y el zoom es un transform encima de todo, así que
            arrastrar un nodo con 4x de aumento guarda exactamente lo mismo
            que arrastrarlo sin zoom, pero con cuatro veces más precisión. */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Alejar  ·  tecla −"
            className="grid place-items-center w-8 h-8 rounded-lg glass-surface text-muted hover:text-text transition cursor-pointer disabled:opacity-40"
            disabled={zoom <= 1}
            onClick={() => onZoom(1 / 1.25)}
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-xs font-mono font-bold text-text tabular-nums min-w-[3rem] text-center">
            {zoom.toFixed(2)}×
          </span>
          <button
            type="button"
            title="Acercar  ·  tecla +  ·  rueda del mouse"
            className="grid place-items-center w-8 h-8 rounded-lg glass-surface text-muted hover:text-text transition cursor-pointer disabled:opacity-40"
            disabled={zoom >= 8}
            onClick={() => onZoom(1.25)}
          >
            <ZoomIn size={15} />
          </button>
          <button
            type="button"
            title="Volver a 1x y centrar  ·  tecla 0"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold glass-surface text-muted hover:text-text transition cursor-pointer disabled:opacity-40"
            disabled={zoom === 1}
            onClick={onZoomReset}
          >
            <Maximize size={14} /> Encajar
          </button>
        </div>
        {zoom > 1 && (
          <p className="text-[11px] text-muted leading-relaxed -mt-1">
            Para desplazarte: barra espaciadora + arrastrar, o el botón del
            medio del mouse.
          </p>
        )}

        {/* ── Tamaño global del número — sólo vista previa ──
            Multiplica el tamaño de TODOS los números de la isla y NO se
            guarda: sirve para probar un tamaño general antes de fijarlo en
            IslandDetailPage. El que sí se guarda es "Num tamaño", que es
            por nivel y está más abajo. */}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wide">
            NumSize global <span className="text-[9px] normal-case font-semibold text-rose">no se guarda</span>
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              className="flex-1 h-1.5 accent-accent-strong cursor-pointer"
              min={0.5}
              max={2.5}
              step={0.05}
              value={numScale}
              onChange={(e) => onNumScaleChange(Number(e.target.value))}
            />
            <span className="text-xs font-mono font-bold text-text min-w-[3rem] text-right tabular-nums">
              {R1(numScale)}
            </span>
          </div>
        </label>

        {/* ── 3D Perspective controls (visible only when a node is selected) ── */}
        {sel && (
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white/40 border border-white/50">
            <strong className="text-xs font-extrabold text-text uppercase tracking-wide">
              Perspectiva 3D — Nivel {selectedIndex + 1}
            </strong>
            <TinySlider
              label="Scale"
              value={sel.scale ?? 1}
              min={0.1}
              max={2.5}
              step={0.01}
              onChange={(v) => onUpdatePerspective(selectedIndex, "scale", v)}
            />
            <TinySlider
              label="Rotate X"
              value={sel.rotateX ?? 0}
              min={-85}
              max={85}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, "rotateX", v)}
            />
            <TinySlider
              label="Rotate Y"
              value={sel.rotateY ?? 0}
              min={-85}
              max={85}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, "rotateY", v)}
            />
            <TinySlider
              label="Rotate Z"
              value={sel.rotateZ ?? 0}
              min={-180}
              max={180}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, "rotateZ", v)}
            />
            <TinySlider
              label="Perspective"
              value={sel.perspective ?? 500}
              min={50}
              max={2000}
              step={10}
              onChange={(v) => onUpdatePerspective(selectedIndex, "perspective", v)}
            />
          </div>
        )}

        {/* ── El número encima del botón (sólo con un nodo seleccionado) ──
            El número se dibuja en el centro del PNG. Apenas el nodo se
            inclina o se agranda, ese centro deja de caer sobre el centro
            visible del disco y el número queda corrido: esto lo reacomoda.
            Las unidades son % del ancho del botón, así que la corrección
            aguanta cualquier resolución. */}
        {sel && (
          <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-white/40 border border-white/50">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-xs font-extrabold text-text uppercase tracking-wide">
                Numero — Nivel {selectedIndex + 1}
              </strong>
              <button
                type="button"
                title="Volver el número al centro del botón"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold glass-surface text-muted hover:text-text transition cursor-pointer"
                onClick={() => {
                  onUpdatePerspective(selectedIndex, "numX", 0);
                  onUpdatePerspective(selectedIndex, "numY", 0);
                  onUpdatePerspective(selectedIndex, "numSize", 1);
                  /* También el par del apretado: si no, queda una posición de
                     hover colgada de un número que ya se movió. */
                  onUpdatePerspective(selectedIndex, "numXHover", NaN);
                  onUpdatePerspective(selectedIndex, "numYHover", NaN);
                }}
              >
                <Crosshair size={11} /> Centrar
              </button>
            </div>
            {/* Alternar entre los dos estados del botón. El número no cae en
                el mismo lugar en los dos: al apretarse el disco se hunde, y
                cuánto se hunde lo decide el dibujo de cada isla. Sin esto
                había que sostener el mouse encima para ver el estado apretado,
                y entonces no se podía usar el teclado para acomodarlo. */}
            <button
              type="button"
              title="Ver y ajustar el nodo en su estado apretado"
              className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                previewPressed
                  ? "bg-accent-strong text-white shadow-sm"
                  : "glass-surface text-muted hover:text-text"
              }`}
              onClick={onTogglePressed}
            >
              <MousePointerClick size={14} />
              {previewPressed ? "Viendo APRETADO" : "Ver apretado"}
            </button>
            {previewPressed && (
              <p className="text-[11px] text-muted leading-relaxed -mt-1">
                Los controles de abajo mueven el número del estado apretado.
                Arranca donde esté el de reposo.
              </p>
            )}
            <TinySlider
              label={previewPressed ? "Num ← →  (apretado)" : "Num ← →"}
              value={previewPressed ? sel.numXHover ?? sel.numX ?? 0 : sel.numX ?? 0}
              min={-40}
              max={40}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, previewPressed ? "numXHover" : "numX", v)}
            />
            <TinySlider
              label={previewPressed ? "Num ↑ ↓  (apretado)" : "Num ↑ ↓"}
              value={previewPressed ? sel.numYHover ?? sel.numY ?? 0 : sel.numY ?? 0}
              min={-40}
              max={40}
              step={0.5}
              onChange={(v) => onUpdatePerspective(selectedIndex, previewPressed ? "numYHover" : "numY", v)}
            />
            <TinySlider
              label="Num tamaño"
              value={sel.numSize ?? 1}
              min={0.3}
              max={2.5}
              step={0.01}
              onChange={(v) => onUpdatePerspective(selectedIndex, "numSize", v)}
            />
          </div>
        )}

        {/* ── Keyboard shortcut cheatsheet ── */}
        <details className="flex flex-col gap-1">
          <summary className="text-xs font-bold text-muted cursor-pointer hover:text-text transition select-none">
            Atajos de teclado
          </summary>
          <table className="text-[11px] text-muted mt-1 border-separate border-spacing-y-0.5">
            <tbody>
              <tr>
                <td className="pr-2">
                  <span className="inline-flex gap-0.5">
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowLeft size={10} /></kbd>
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowRight size={10} /></kbd>
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowUp size={10} /></kbd>
                    <kbd className="grid place-items-center w-5 h-5 rounded bg-white/70 border border-white/80 text-text shadow-sm"><ArrowDown size={10} /></kbd>
                  </span>
                </td>
                <td>Mover nodo (posicion)</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">S</kbd></td>
                <td><strong className="text-text">Toggle modo ESCALA</strong> (↑↓)</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">X</kbd></td>
                <td><strong className="text-text">Toggle modo ROTATE X</strong> (↑↓) — inclina adelante/atras como apoyado en el piso</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Y</kbd></td>
                <td><strong className="text-text">Toggle modo ROTATE Y</strong> (←→) — inclina izquierda/derecha</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Z</kbd></td>
                <td><strong className="text-text">Toggle modo ROTATE Z</strong> (←→) — gira sobre su centro</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">P</kbd></td>
                <td><strong className="text-text">Toggle modo PERSPECTIVA</strong> (↑↓) — profundidad 3D</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">N</kbd></td>
                <td><strong className="text-text">Toggle modo NUMERO</strong> (←→↑↓) — mueve sólo el número sobre el botón</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">M</kbd></td>
                <td><strong className="text-text">Toggle modo NUMERO TAMAÑO</strong> (↑↓)</td>
              </tr>
              <tr>
                <td className="pr-2 text-[10px] text-muted">boton <em>Ver apretado</em></td>
                <td>Con eso prendido, <strong className="text-text">N</strong> mueve el numero del estado APRETADO</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Shift</kbd> + flechas</td>
                <td>Multiplica el paso por 10</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Alt</kbd> + flechas</td>
                <td><strong className="text-text">Paso fino</strong> — para rematar el ajuste cuando el normal ya se pasa</td>
              </tr>
              <tr>
                <td className="pr-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">+</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">−</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">0</kbd>
                </td>
                <td>Acercar / alejar / encajar — la rueda hace zoom sobre el cursor</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Espacio</kbd> + arrastrar</td>
                <td>Desplazar el mapa (o el boton del medio del mouse)</td>
              </tr>
              <tr>
                <td className="pr-2"><kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Escape</kbd></td>
                <td>Deseleccionar nodo + salir de modo</td>
              </tr>
              <tr>
                <td className="pr-2">
                  <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/70 border border-white/80 text-text text-[10px] font-bold shadow-sm">C</kbd>
                </td>
                <td>Copiar config a portapapeles + consola</td>
              </tr>
            </tbody>
          </table>
        </details>

        {/* JSON preview */}
        <pre className="text-[10px] font-mono text-muted bg-white/40 border border-white/50 rounded-lg p-2 overflow-x-auto whitespace-pre leading-relaxed max-h-40">
          {arrayLiteral(positions)}
        </pre>

        {/* Action buttons — Guardar es la acción principal: escribe el archivo
            y el HMR recarga. Copiar queda como salida de emergencia si el
            endpoint de dev no está (build de producción, server caído). */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={saving}
            title="Escribe src/data/levelPositions.ts y recarga por HMR · Ctrl+S"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-btn hover:shadow-btn-hover hover:-translate-y-0.5 transition cursor-pointer disabled:opacity-60 disabled:cursor-wait"
            onClick={saveToFile}
          >
            <Save size={15} /> {saving ? "Guardando…" : "Guardar en el archivo"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold glass-surface text-text hover:bg-white/80 transition cursor-pointer"
            onClick={copyArray}
          >
            <Copy size={15} /> Copiar arreglo
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold glass-surface text-text hover:bg-white/80 transition cursor-pointer"
            onClick={copyJson}
          >
            <Copy size={15} /> Copiar JSON
          </button>
        </div>
      </div>,
      document.body,
      )}
    </>
  );
}
