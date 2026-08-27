import sharp from "sharp";
import fs from "fs";

/* Compone los nodos de una isla sobre su arte real, con el botón propio de esa
   isla, sin abrir la app. Sirve para ver de un vistazo cuáles quedaron sobre su
   plataforma y cuáles no.

   Es una APROXIMACIÓN: la inclinación se simula achatando el sprite por
   cos(rotateX), que es el término dominante, pero no reproduce el trapecio de
   la perspectiva ni el sombreado. No distingue +51 de −51 grados. Para juzgar
   el signo de una rotación hay que mirar la app.

   Uso:  node scripts/preview-island.mjs            (las 15)
         node scripts/preview-island.mjs island6    (una)
*/

const NODE_PCT = 5.34;          // el nodo mide 5.34 % del ancho del escenario
const OUT_DIR = ".preview-niveles";

/* Arte de fondo de cada isla — el mismo que usa IslandDetailPage. */
const EXPANSION = [
  "bg01_crystal_portal", "bg02_garden_library", "bg03_frozen_clockwork",
  "bg04_autumn_artist", "bg05_jungle_ruins", "bg06_candyland",
  "bg07_desert_canyon", "bg08_rainbow_playground", "bg09_alchemy_lab",
  "bg10_lagoon",
];
function arteDe(n) {
  if (n === 1) return "public/assets/edutic-art/islands/1/island.png";
  if (n <= 5) return `public/assets/edutic-art/island${n}.webp`;
  return `public/typely_backgrounds_webp/${EXPANSION[n - 6]}.webp`;
}

/* Lee el arreglo de una isla de levelPositions.ts sin parsear TypeScript. */
const fuente = fs.readFileSync("src/data/levelPositions.ts", "utf8");
function posicionesDe(id) {
  const abre = fuente.indexOf(`  ${id}: [`);
  if (abre < 0) return [];
  const cierra = fuente.indexOf("\n  ],", abre);
  const cuerpo = fuente.slice(abre, cierra);
  return [...cuerpo.matchAll(/\{ x: ([-\d.]+), y: ([-\d.]+)([^}]*)\}/g)].map((m) => ({
    x: +m[1], y: +m[2],
    scale: +(m[3].match(/scale: ([-\d.]+)/)?.[1] ?? 1),
    rotateX: +(m[3].match(/rotateX: ([-\d.]+)/)?.[1] ?? 0),
  }));
}

/* Cuántos niveles tiene de verdad cada isla: el arreglo puede traer entradas
   de más, que el juego no dibuja. Se cuentan las actividades. */
const actividades = fs.readFileSync("src/data/activities.ts", "utf8");
function nivelesDe(id) {
  return (actividades.match(new RegExp(`worldId: "${id}"`, "g")) ?? []).length;
}

async function render(n) {
  const id = `island${n}`;
  const art = arteDe(id === "island1" ? 1 : n);
  if (!fs.existsSync(art)) { console.log(`${id.padEnd(9)} sin arte (${art})`); return; }

  const nodos = posicionesDe(id);
  const reales = nivelesDe(id) || nodos.length;
  const base = sharp(art);
  const { width: W, height: H } = await base.metadata();
  const caja = Math.round((W * NODE_PCT) / 100);
  const btn = `public/assets/level-buttons/btn-${id}.webp`;
  const capas = [];

  for (let i = 0; i < nodos.length; i++) {
    const nodo = nodos[i];
    const fantasma = i >= reales;          // entrada de más: el juego no la dibuja
    const w = Math.round(caja * nodo.scale);
    const png = await sharp(btn).resize({ width: w }).png().toBuffer();
    const meta = await sharp(png).metadata();
    const h = Math.max(1, Math.round(meta.height * Math.cos((nodo.rotateX * Math.PI) / 180)));
    let img = sharp(png).resize(meta.width, h, { fit: "fill" });
    if (fantasma) img = img.grayscale().modulate({ brightness: 1.3 });
    const cx = Math.round((W * nodo.x) / 100), cy = Math.round((H * nodo.y) / 100);
    capas.push({ input: await img.png().toBuffer(), left: cx - Math.round(meta.width / 2), top: cy - Math.round(h / 2) });
    capas.push({
      input: Buffer.from(
        `<svg width="${w}" height="46"><text x="${w / 2}" y="34" text-anchor="middle" ` +
        `font-family="Arial Black,Arial" font-size="34" font-weight="900" ` +
        `fill="${fantasma ? "#bbbbbb" : "#ffffff"}" stroke="#000" stroke-width="5" paint-order="stroke">${i + 1}</text></svg>`
      ),
      left: cx - Math.round(w / 2), top: cy - 23,
    });
  }

  await base.composite(capas).png().toFile(`${OUT_DIR}/${id}-actual.png`);
  const sobrantes = nodos.length - reales;
  console.log(
    `${id.padEnd(9)} ${reales} niveles` +
    (sobrantes > 0 ? ` (+${sobrantes} de más en el arreglo)` : "") +
    `  ${W}x${H}`
  );
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const arg = process.argv[2];
if (arg) await render(Number(arg.replace("island", "")));
else for (let n = 1; n <= 15; n++) await render(n);
