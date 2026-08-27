#!/usr/bin/env node
/**
 * DETECTOR DE PLATAFORMAS
 * =======================
 * Mide los discos pintados de una isla y devuelve, para cada uno, el centro,
 * el ancho, y los dos valores que hacen falta en levelPositions.ts:
 *
 *   rotateX  para que el boton se acueste igual que el disco
 *   scale    para que ocupe ~65 % del ancho del disco (como island1)
 *
 * Como sale el rotateX: level.png trae una elipse de ratio 0.590 horneada
 * (53.8 grados de camara). rotateX(alfa) la achata por cos(alfa), asi que para
 * un disco cuya elipse mide r = alto/ancho EN PIXELES:  alfa = acos(r / 0.590).
 * Los discos mas lejanos se ven mas achatados y piden mas angulo; copiar ese
 * gradiente es lo que hace que el boton se vea apoyado y no pegado encima.
 *
 * Se le pasa una o dos semillas: puntos en % que caigan sobre la cara de un
 * disco. Toma ese color como referencia y busca pixeles parecidos.
 *
 *   node scripts/detect-platforms.mjs <imagen> "x,y;x,y" [tolerancia] [areaMin]
 *
 * Ejemplo:
 *   node scripts/detect-platforms.mjs public/assets/islands/island2/sky.webp "49,75;32,49"
 *
 * OJO: el match por color pierde la parte sombreada de abajo del disco, asi
 * que el centro sale hasta ~1 % alto. Verificar siempre con
 * `preview-level-positions.mjs --zoom` antes de escribir los valores.
 *
 * Sirve donde la cara del disco tiene color propio (island2, island3, island13).
 * Donde el disco es del mismo tono que el suelo, medir a ojo con --zoom.
 *
 * Necesita sharp:  npm install sharp --no-save
 */

import sharp from "sharp";

const SPRITE_RATIO = 0.5903;   // elipse horneada en level.png (53.8°)
const NODE_PCT = 5.34;         // diámetro del nodo, % del escenario

const file = process.argv[2];
const seeds = (process.argv[3] || "").split(";").filter(Boolean)
  .map((s) => s.split(",").map(Number));      // "x,y;x,y" en %
const tol = Number(process.argv[4] ?? 34);
const minArea = Number(process.argv[5] ?? 900);

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const px = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };

// Colores de referencia tomados de las semillas
const refs = seeds.map(([sx, sy]) => {
  const x = Math.round((sx / 100) * W), y = Math.round((sy / 100) * H);
  const acc = [0, 0, 0]; let n = 0;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const [r, g, b, a] = px(Math.min(W - 1, Math.max(0, x + dx)), Math.min(H - 1, Math.max(0, y + dy)));
    if (a > 40) { acc[0] += r; acc[1] += g; acc[2] += b; n++; }
  }
  return acc.map((v) => v / n);
});
console.log("colores de referencia:", refs.map((r) => r.map(Math.round).join(",")).join("  |  "));

// Máscara
const mask = new Uint8Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const [r, g, b, a] = px(x, y);
  if (a < 40) continue;
  for (const ref of refs) {
    if (Math.abs(r - ref[0]) < tol && Math.abs(g - ref[1]) < tol && Math.abs(b - ref[2]) < tol) { mask[y * W + x] = 1; break; }
  }
}

// Blobs (flood fill iterativo)
const seen = new Uint8Array(W * H);
const blobs = [];
const stack = new Int32Array(W * H);
for (let i = 0; i < W * H; i++) {
  if (!mask[i] || seen[i]) continue;
  let sp = 0; stack[sp++] = i; seen[i] = 1;
  let minX = W, maxX = -1, minY = H, maxY = -1, area = 0, sumX = 0, sumY = 0;
  while (sp) {
    const p = stack[--sp], x = p % W, y = (p / W) | 0;
    area++; sumX += x; sumY += y;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const q = ny * W + nx;
      if (mask[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
    }
  }
  if (area >= minArea) blobs.push({ minX, maxX, minY, maxY, area, cx: sumX / area, cy: sumY / area });
}

blobs.sort((a, b) => b.area - a.area);
console.log(`\n${blobs.length} blobs >= ${minArea}px\n`);
console.log("  #   centro %        ancho%  alto%   ratio   rotateX   scale sugerida");
blobs.slice(0, 14).forEach((b, i) => {
  const w = (b.maxX - b.minX + 1), h = (b.maxY - b.minY + 1);
  const wPct = (w / W) * 100, hPct = (h / H) * 100;
  // ratio del elipse en el espacio de la IMAGEN (px cuadrados)
  const ratio = h / w;
  const cosA = Math.min(1, ratio / SPRITE_RATIO);
  const rot = ratio <= SPRITE_RATIO ? Math.acos(cosA) * 180 / Math.PI : 0;
  // el botón cubre ~78% del ancho del disco, como en island1
  const scale = (wPct * 0.78) / NODE_PCT;
  console.log(
    `  ${String(i + 1).padStart(2)}  ` +
    `${((b.minX + b.maxX) / 2 / W * 100).toFixed(1).padStart(5)},${((b.minY + b.maxY) / 2 / H * 100).toFixed(1).padStart(5)}   ` +
    `${wPct.toFixed(1).padStart(5)}  ${hPct.toFixed(1).padStart(5)}  ` +
    `${ratio.toFixed(3).padStart(6)}  ${rot.toFixed(1).padStart(6)}°  ${scale.toFixed(2).padStart(6)}`,
  );
});
