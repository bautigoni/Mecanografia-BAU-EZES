#!/usr/bin/env node
/**
 * PREVIEW DE POSICIONES DE NIVEL
 * ==============================
 * Dibuja los nodos de src/data/levelPositions.ts encima del arte real de cada
 * isla y escupe un PNG. Sirve para ver de un vistazo si un nivel cayó sobre su
 * plataforma pintada o quedó al lado, sin tener que abrir el navegador, entrar
 * como alumno y navegar hasta la isla.
 *
 * El marcador se dibuja al MISMO tamaño relativo que en la app (5.34 % del
 * ancho del escenario, ver CLAUDE.md §6.1), así que lo que ves acá es lo que
 * se ve en pantalla — a cualquier resolución, porque todo es proporcional.
 *
 *   node scripts/preview-level-positions.mjs              # todas las islas
 *   node scripts/preview-level-positions.mjs island6      # una sola
 *   node scripts/preview-level-positions.mjs island6 --grid
 *   node scripts/preview-level-positions.mjs --out /tmp/x
 *
 * --grid  superpone una grilla de porcentajes (cada 5 %, rotulada cada 10 %)
 *         para leer coordenadas directo de la imagen.
 *
 * Necesita sharp:  npm install sharp --no-save
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("Falta sharp.  Instalalo con:  npm install sharp --no-save");
  process.exit(1);
}

/* ── Mundo → arte que ancla los nodos ────────────────────────────────────
   Ojo: island1 NO usa island1.webp. IslandDetailPage lo sobreescribe con su
   PNG suelto (ISLAND_IMG), que es 4:3 y es el que define sus coordenadas. */
const ART = {
  island1: "public/assets/edutic-art/islands/1/island.png",
  island2: "public/assets/edutic-art/island2.webp",
  island3: "public/assets/edutic-art/island3.webp",
  island4: "public/assets/edutic-art/island4.webp",
  island5: "public/assets/edutic-art/island5.webp",
  island6: "public/typely_backgrounds_webp/bg01_crystal_portal.webp",
  island7: "public/typely_backgrounds_webp/bg02_garden_library.webp",
  island8: "public/typely_backgrounds_webp/bg03_frozen_clockwork.webp",
  island9: "public/typely_backgrounds_webp/bg04_autumn_artist.webp",
  island10: "public/typely_backgrounds_webp/bg05_jungle_ruins.webp",
  island11: "public/typely_backgrounds_webp/bg06_candyland.webp",
  island12: "public/typely_backgrounds_webp/bg07_desert_canyon.webp",
  island13: "public/typely_backgrounds_webp/bg08_rainbow_playground.webp",
  island14: "public/typely_backgrounds_webp/bg09_alchemy_lab.webp",
  island15: "public/typely_backgrounds_webp/bg10_lagoon.webp",
};

/** Diámetro del nodo como % del ancho del escenario (IslandDetailPage). */
const NODE_PCT = 5.34;

/* ── Parseo de levelPositions.ts ─────────────────────────────────────────
   Regex a propósito: el archivo es una tabla de datos plana y no vale la pena
   arrastrar un compilador de TS sólo para leerla. Si algún día deja de ser
   literal, esto grita fuerte en vez de mentir. */
function readPositions() {
  const src = fs.readFileSync(path.join(ROOT, "src/data/levelPositions.ts"), "utf8");
  const body = src.slice(src.indexOf("islandLevelLayouts"));
  const out = {};
  for (const m of body.matchAll(/(island\d+):\s*\[([\s\S]*?)\n {2}\],/g)) {
    const nodes = [];
    for (const n of m[2].matchAll(/\{([^}]*)\}/g)) {
      const get = (k) => {
        const v = n[1].match(new RegExp(`\\b${k}\\s*:\\s*(-?[\\d.]+)`));
        return v ? parseFloat(v[1]) : undefined;
      };
      const x = get("x"), y = get("y");
      if (x === undefined || y === undefined) continue;
      nodes.push({
        x, y,
        scale: get("scale") ?? 1,
        rotateX: get("rotateX") ?? 0,
        rotateZ: get("rotateZ") ?? 0,
      });
    }
    out[m[1]] = nodes;
  }
  return out;
}

/** Niveles REALES por mundo. La cantidad la manda activities.ts, no
 *  levelPositions.ts: si hay más coordenadas que actividades, las de más
 *  nunca se dibujan en la app. Acá se marcan en gris para no perder tiempo
 *  ajustando un nodo que no existe. */
function readLevelCounts() {
  const src = fs.readFileSync(path.join(ROOT, "src/data/activities.ts"), "utf8");
  const out = {};
  for (const m of src.matchAll(/worldId:\s*"(island\d+)"/g)) out[m[1]] = (out[m[1]] ?? 0) + 1;
  return out;
}

function buildOverlay(W, H, nodes, withGrid, liveCount) {
  const d = (NODE_PCT / 100) * W;           // diámetro del nodo, en px del arte
  const parts = [];

  if (withGrid) {
    for (let p = 5; p < 100; p += 5) {
      const gx = (p / 100) * W, gy = (p / 100) * H;
      const major = p % 10 === 0;
      const w = major ? 1.6 : 0.8;
      const o = major ? 0.55 : 0.28;
      parts.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${H}" stroke="#fff" stroke-width="${w}" opacity="${o}"/>`);
      parts.push(`<line x1="0" y1="${gy}" x2="${W}" y2="${gy}" stroke="#fff" stroke-width="${w}" opacity="${o}"/>`);
      if (major) {
        parts.push(`<text x="${gx + 4}" y="18" font-family="monospace" font-size="15" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${p}</text>`);
        parts.push(`<text x="4" y="${gy - 5}" font-family="monospace" font-size="15" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${p}</text>`);
      }
    }
  }

  nodes.forEach((n, i) => {
    const cx = (n.x / 100) * W, cy = (n.y / 100) * H;
    const r = (d / 2) * (n.scale ?? 1);
    const vivo = i < liveCount;
    const col = vivo ? "#00E5FF" : "#9E9E9E";
    const dash = vivo ? "" : ` stroke-dasharray="10 8"`;
    // Anillo del tamaño real del botón, hueco para ver el disco debajo.
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${col}" stroke-width="3.5" opacity="${vivo ? 0.95 : 0.6}"${dash}/>`);
    if (vivo) parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#00E5FF" opacity="0.10"/>`);
    // Cruz en el centro exacto — es el punto que guardan x/y.
    const cc = vivo ? "#FF1744" : "#9E9E9E";
    parts.push(`<line x1="${cx - 11}" y1="${cy}" x2="${cx + 11}" y2="${cy}" stroke="${cc}" stroke-width="2.5"/>`);
    parts.push(`<line x1="${cx}" y1="${cy - 11}" x2="${cx}" y2="${cy + 11}" stroke="${cc}" stroke-width="2.5"/>`);
    // Etiqueta con el número de nivel y sus coordenadas.
    parts.push(`<text x="${cx}" y="${cy - r - 9}" text-anchor="middle" font-family="monospace" font-size="19" font-weight="700" fill="${vivo ? "#fff" : "#BDBDBD"}" stroke="#000" stroke-width="4" paint-order="stroke">${vivo ? "N" + (i + 1) : "sin nivel"}</text>`);
    parts.push(`<text x="${cx}" y="${cy + r + 21}" text-anchor="middle" font-family="monospace" font-size="14" fill="${vivo ? "#FFD54F" : "#9E9E9E"}" stroke="#000" stroke-width="3.5" paint-order="stroke">${n.x} · ${n.y}</text>`);
  });

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`,
  );
}

/* ── Sprite real, con la inclinación aplicada ────────────────────────────
   El anillo de arriba dice DÓNDE cae el nodo, pero no si está bien ACOSTADO.
   Esto compone el level.png de verdad, escalado y achatado por cos(rotateX),
   que es lo que hace el transform de CSS. Así se ve si el botón se apoya en
   el disco o si flota parado sobre una superficie en escorzo.

   Geometría: el botón es cuadrado (aspect-square) de lado S, y level.png va
   adentro con object-contain. Como el PNG es 600×445, ocupa S de ancho por
   0.742·S de alto. rotateX(α) achata eso por cos(α).

   El PNG fue re-encuadrado a 600×445 para que el centro del lienzo caiga sobre
   el centro de la ELIPSE DE LA BASE — la parte que se apoya en el suelo. Antes
   el lienzo era 600×378 con el dibujo descentrado, y el botón salía corrido
   hacia abajo en todas las islas. */
const SPRITE_AR = 445 / 600;

async function spriteLayers(W, H, nodes, liveCount) {
  const spritePath = path.join(ROOT, "public/assets/level.png");
  if (!fs.existsSync(spritePath)) return [];
  const layers = [];
  for (let i = 0; i < Math.min(nodes.length, liveCount); i++) {
    const n = nodes[i];
    const S = (NODE_PCT / 100) * W * (n.scale ?? 1);
    const w = Math.max(8, Math.round(S));
    const h = Math.max(4, Math.round(S * SPRITE_AR * Math.cos(((n.rotateX ?? 0) * Math.PI) / 180)));
    let pipe = sharp(spritePath).resize(w, h, { fit: "fill" });
    if (n.rotateZ) pipe = pipe.rotate(n.rotateZ, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
    const out = await pipe.png().toBuffer();
    const meta = await sharp(out).metadata();
    const left = Math.round((n.x / 100) * W - meta.width / 2);
    const top = Math.round((n.y / 100) * H - meta.height / 2);
    // sharp rechaza composites que caigan fuera del lienzo
    if (left <= -meta.width || top <= -meta.height || left >= W || top >= H) continue;
    layers.push({ input: out, left: Math.max(0, left), top: Math.max(0, top) });
  }
  return layers;
}

/** Recorte ampliado alrededor de un punto, con grilla fina de % del arte
 *  completo — para leer la coordenada exacta del centro de una plataforma. */
async function renderZoom(src, isla, nodes, cx, cy, spanPct, outDir) {
  const img = sharp(src);
  const { width: W, height: H } = await img.metadata();
  const halfW = (spanPct / 100) * W / 2;
  const halfH = halfW * (H / W);
  const left = Math.max(0, Math.round((cx / 100) * W - halfW));
  const top = Math.max(0, Math.round((cy / 100) * H - halfH));
  const w = Math.min(W - left, Math.round(halfW * 2));
  const h = Math.min(H - top, Math.round(halfH * 2));
  const Z = Math.min(4, Math.max(2, Math.round(1400 / w)));   // ampliación

  const parts = [];
  const stepPct = spanPct <= 12 ? 0.5 : 1;                     // grilla fina
  for (let p = 0; p <= 100; p += stepPct) {
    const gx = ((p / 100) * W - left) * Z;
    if (gx >= 0 && gx <= w * Z) {
      const major = Math.abs(p % (stepPct * 4)) < 1e-6;
      parts.push(`<line x1="${gx}" y1="0" x2="${gx}" y2="${h * Z}" stroke="#fff" stroke-width="${major ? 1.4 : 0.7}" opacity="${major ? 0.65 : 0.3}"/>`);
      if (major) parts.push(`<text x="${gx + 3}" y="16" font-family="monospace" font-size="14" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${+p.toFixed(1)}</text>`);
    }
    const gy = ((p / 100) * H - top) * Z;
    if (gy >= 0 && gy <= h * Z) {
      const major = Math.abs(p % (stepPct * 4)) < 1e-6;
      parts.push(`<line x1="0" y1="${gy}" x2="${w * Z}" y2="${gy}" stroke="#fff" stroke-width="${major ? 1.4 : 0.7}" opacity="${major ? 0.65 : 0.3}"/>`);
      if (major) parts.push(`<text x="3" y="${gy - 4}" font-family="monospace" font-size="14" font-weight="700" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${+p.toFixed(1)}</text>`);
    }
  }
  const d = (NODE_PCT / 100) * W;
  nodes.forEach((n, i) => {
    const nx = ((n.x / 100) * W - left) * Z, ny = ((n.y / 100) * H - top) * Z;
    if (nx < -200 || ny < -200 || nx > w * Z + 200 || ny > h * Z + 200) return;
    const r = (d / 2) * (n.scale ?? 1) * Z;
    parts.push(`<circle cx="${nx}" cy="${ny}" r="${r}" fill="none" stroke="#00E5FF" stroke-width="4"/>`);
    parts.push(`<line x1="${nx - 16}" y1="${ny}" x2="${nx + 16}" y2="${ny}" stroke="#FF1744" stroke-width="3"/>`);
    parts.push(`<line x1="${nx}" y1="${ny - 16}" x2="${nx}" y2="${ny + 16}" stroke="#FF1744" stroke-width="3"/>`);
    parts.push(`<text x="${nx}" y="${ny - r - 10}" text-anchor="middle" font-family="monospace" font-size="20" font-weight="700" fill="#fff" stroke="#000" stroke-width="4" paint-order="stroke">N${i + 1}</text>`);
  });

  const dest = path.join(outDir, `${isla}-zoom-${cx}x${cy}.png`);
  await sharp(src)
    .extract({ left, top, width: w, height: h })
    .resize(w * Z, h * Z, { kernel: "lanczos3" })
    .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * Z}" height="${h * Z}">${parts.join("")}</svg>`), top: 0, left: 0 }])
    .png()
    .toFile(dest);
  console.log(`  zoom ${isla} @ ${cx},${cy} (span ${spanPct}%)  x${Z}  →  ${path.relative(ROOT, dest)}`);
}

/* ── main ─────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const withGrid = argv.includes("--grid");
const withSprite = argv.includes("--sprite");
const outIdx = argv.indexOf("--out");
const outDir = outIdx >= 0 ? argv[outIdx + 1] : path.join(ROOT, ".preview-niveles");
const zoomIdx = argv.indexOf("--zoom");
const zoomArg = zoomIdx >= 0 ? argv[zoomIdx + 1] : null;
const wanted = argv.filter((a) => /^island\d+$/.test(a));

const layouts = readPositions();
const levelCounts = readLevelCounts();
const islands = wanted.length ? wanted : Object.keys(ART);
fs.mkdirSync(outDir, { recursive: true });

for (const isla of islands) {
  const rel = ART[isla];
  if (!rel) { console.error(`  ${isla}: sin arte mapeado`); continue; }
  const src = path.join(ROOT, rel);
  if (!fs.existsSync(src)) { console.error(`  ${isla}: no existe ${rel}`); continue; }
  const nodes = layouts[isla] ?? [];
  const live = levelCounts[isla] ?? nodes.length;
  if (!nodes.length) { console.error(`  ${isla}: sin coordenadas`); continue; }

  if (zoomArg) {
    const [zx, zy, zs] = zoomArg.split(",").map(Number);
    await renderZoom(src, isla, nodes, zx, zy, zs || 16, outDir);
    continue;
  }

  const img = sharp(src);
  const { width: W, height: H } = await img.metadata();
  const dest = path.join(outDir, `${isla}${withGrid ? "-grilla" : ""}${withSprite ? "-sprite" : ""}.png`);
  await img
    .composite([
      ...(withSprite ? await spriteLayers(W, H, nodes, live) : []),
      { input: buildOverlay(W, H, nodes, withGrid, live), top: 0, left: 0 },
    ])
    .png()
    .toFile(dest);

  console.log(`  ${isla.padEnd(9)} ${live} niveles${nodes.length > live ? ` (+${nodes.length - live} sin nivel)` : ""}  ${W}x${H}  →  ${path.relative(ROOT, dest)}`);
}

console.log(`\nListo. Salida en ${path.relative(ROOT, outDir) || outDir}`);
