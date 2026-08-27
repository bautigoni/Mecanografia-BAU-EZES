#!/usr/bin/env node
/**
 * MEDIDOR DE PEDESTAL
 * ===================
 * Mide el ANILLO INTERIOR de una plataforma pintada — el círculo que forman las
 * divisiones de los ladrillos — y devuelve los cuatro valores que van a
 * src/data/levelPositions.ts:
 *
 *   x, y      centro del anillo (el botón se centra ahí)
 *   rotateX   inclinación, sacada de cuán ovalado está el anillo
 *   scale     tamaño, para que el botón ocupe una fracción del anillo
 *
 * Por qué el anillo interior y no el borde del pedestal: el borde exterior se
 * confunde con el canto y con el pasto, y arrastra el centro. El anillo interior
 * es una línea limpia, y como los círculos concéntricos de un plano proyectan
 * elipses concéntricas, su centro ES el centro de la plataforma.
 *
 * Método: relleno por difusión desde una semilla en el centro liso del pedestal.
 * Se expande mientras el color se parezca al de la semilla, y frena solo al
 * llegar a la línea del anillo. El bbox del área rellenada es la elipse.
 *
 * Cómo sale rotateX: la base de level.png trae una elipse de ratio 0.553 horneada
 * (56.4° de cámara). rotateX(α) la achata por cos(α), así que para un anillo
 * cuya elipse mide r = alto/ancho EN PÍXELES:
 *
 *     α = acos(r / 0.553)
 *
 *   node scripts/measure-pedestal.mjs <imagen> "x,y;x,y;…" [tolerancia] [cobertura]
 *
 * `cobertura` = qué fracción del ancho del anillo debe ocupar el botón visible
 * (0.92 por defecto: el botón llena el anillo dejando un hilo de piedra).
 *
 * Ejemplo:
 *   node scripts/measure-pedestal.mjs public/assets/islands/island2/sky.webp "49.4,75.1;33.4,66.3"
 *
 * Necesita sharp:  npm install sharp --no-save
 */

import sharp from "sharp";

/** Elipse de la BASE del sprite: 454 px de ancho por 252 de alto → 0.553.
 *  OJO: NO es el ratio del bbox del dibujo (0.590). El bbox incluye la tapa
 *  azul, que sobresale hacia arriba y no toca el suelo. Lo que tiene que
 *  calzar con el anillo del pedestal es la base. */
const SPRITE_RATIO = 0.553;
/** El dibujo llena 454/600 del ancho de su lienzo, y el lienzo llena la caja
 *  del botón. O sea que el botón VISIBLE mide 0.7567 × el lado de la caja. */
const SPRITE_FILL = 454 / 600;
/** Lado de la caja del botón, en % del ancho del escenario (IslandDetailPage). */
const NODE_PCT = 5.34;

const file = process.argv[2];
const seeds = (process.argv[3] || "").split(";").filter(Boolean).map((s) => s.split(",").map(Number));
const tol = Number(process.argv[4] ?? 26);
const cobertura = Number(process.argv[5] ?? 0.92);

if (!file || !seeds.length) {
  console.error("uso: measure-pedestal.mjs <imagen> \"x,y;x,y\" [tolerancia] [cobertura]");
  process.exit(1);
}

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const at = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };

console.log(`${file}  ${W}x${H}\n`);
console.log("  semilla       centro %        ancho%  alto%   ratio   rotateX   scale");

const filas = [];
for (const [sx, sy] of seeds) {
  const x0 = Math.round((sx / 100) * W), y0 = Math.round((sy / 100) * H);
  // color de referencia: promedio de un parche chico en la semilla
  const acc = [0, 0, 0]; let n = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const [r, g, b, a] = at(Math.min(W - 1, Math.max(0, x0 + dx)), Math.min(H - 1, Math.max(0, y0 + dy)));
    if (a > 40) { acc[0] += r; acc[1] += g; acc[2] += b; n++; }
  }
  const ref = acc.map((v) => v / n);

  // relleno por difusión, acotado a una ventana para no escaparse por la isla
  const RAD = Math.round(0.09 * W);
  const seen = new Uint8Array(W * H);
  const stack = [y0 * W + x0];
  seen[y0 * W + x0] = 1;
  let minX = x0, maxX = x0, minY = y0, maxY = y0, area = 0;
  while (stack.length) {
    const p = stack.pop(), x = p % W, y = (p / W) | 0;
    area++;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (Math.abs(nx - x0) > RAD || Math.abs(ny - y0) > RAD) continue;
      const q = ny * W + nx;
      if (seen[q]) continue;
      const [r, g, b, a] = at(nx, ny);
      if (a < 40) continue;
      if (Math.abs(r - ref[0]) < tol && Math.abs(g - ref[1]) < tol && Math.abs(b - ref[2]) < tol) {
        seen[q] = 1; stack.push(q);
      }
    }
  }

  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cx = ((minX + maxX) / 2 / W) * 100, cy = ((minY + maxY) / 2 / H) * 100;
  const wPct = (w / W) * 100, hPct = (h / H) * 100;
  const ratio = h / w;
  const rot = ratio <= SPRITE_RATIO ? (Math.acos(ratio / SPRITE_RATIO) * 180) / Math.PI : 0;
  // botón visible = cobertura × ancho del anillo  →  lado de caja = eso / SPRITE_FILL
  const scale = (wPct * cobertura) / SPRITE_FILL / NODE_PCT;

  console.log(
    `  ${String(sx).padStart(5)},${String(sy).padEnd(5)}  ` +
    `${cx.toFixed(1).padStart(5)},${cy.toFixed(1).padStart(5)}   ` +
    `${wPct.toFixed(2).padStart(5)}  ${hPct.toFixed(2).padStart(5)}  ` +
    `${ratio.toFixed(3).padStart(6)}  ${rot.toFixed(1).padStart(6)}°  ${scale.toFixed(2).padStart(6)}` +
    (area < 400 ? "   <- área chica, revisá la semilla" : ""),
  );
  filas.push({ cx, cy, scale, rot });
}

console.log("\nPara pegar en levelPositions.ts:");
for (const f of filas) {
  console.log(`    { x: ${f.cx.toFixed(1)}, y: ${f.cy.toFixed(1)}, scale: ${f.scale.toFixed(2)}, rotateX: ${f.rot.toFixed(1)}, perspective: 4000 },`);
}
