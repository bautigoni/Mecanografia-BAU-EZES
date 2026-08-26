import sharp from "sharp";

/* Mide una lámina de botón recién generada antes de procesarla: dónde están
   los dos estados, si coinciden entre sí y qué tamaño tiene cada uno. Sale
   barato equivocarse acá y carísimo más adelante, cuando una isla entera
   queda desalineada.

   El color del fondo se MIDE (mediana del borde) en vez de asumirse blanco:
   las láminas vienen sobre blanco, sobre gris azulado o sobre gris cálido
   según el día, y un umbral fijo de "casi blanco" no detecta nada en las que
   no son blancas. */

const file = process.argv[2];
const { data, info } = await sharp(file).flatten({ background: "#ffffff" })
  .raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const muestras = [[], [], []];
for (let x = 0; x < W; x += 2) for (const y of [0, H - 1]) {
  const i = (y * W + x) * C;
  for (let k = 0; k < 3; k++) muestras[k].push(data[i + k]);
}
for (let y = 0; y < H; y += 2) for (const x of [0, W - 1]) {
  const i = (y * W + x) * C;
  for (let k = 0; k < 3; k++) muestras[k].push(data[i + k]);
}
const fondo = muestras.map((m) => m.sort((a, b) => a - b)[m.length >> 1]);
const TOL = 30;
const esFondo = (x, y) => {
  const i = (y * W + x) * C;
  return Math.abs(data[i] - fondo[0]) + Math.abs(data[i + 1] - fondo[1]) + Math.abs(data[i + 2] - fondo[2]) < TOL;
};

const cols = [];
for (let x = 0; x < W; x++) {
  let n = 0;
  for (let y = 0; y < H; y++) if (!esFondo(x, y)) n++;
  cols.push(n);
}
const runs = [];
let start = null;
for (let x = 0; x < W; x++) {
  if (cols[x] > 2) { if (start === null) start = x; }
  else if (start !== null) { if (x - start > 40) runs.push([start, x - 1]); start = null; }
}
if (start !== null && W - start > 40) runs.push([start, W - 1]);

console.log(`\n${file}  ${W}x${H}   fondo rgb(${fondo.join(",")})`);
console.log(`estados detectados: ${runs.length}  ${JSON.stringify(runs)}`);
if (runs.length === 2) console.log(`gap sugerido: ${runs[1][0] - runs[0][0]}`);

for (let k = 0; k < runs.length; k++) {
  const [x0, x1] = runs[k];
  const rows = [];
  for (let y = 0; y < H; y++) {
    let minx = 1e9, maxx = -1;
    for (let x = x0; x <= x1; x++) if (!esFondo(x, y)) { if (x < minx) minx = x; if (x > maxx) maxx = x; }
    if (maxx >= 0) rows.push([y, minx, maxx]);
  }
  const top = rows[0][0], bot = rows[rows.length - 1][0];
  let best = rows[0];
  for (const r of rows) if (r[2] - r[1] > best[2] - best[1]) best = r;
  console.log(
    `  [${k}] x ${x0}..${x1}  y ${top}..${bot}  alto ${bot - top + 1}` +
    `  ancho ${best[2] - best[1] + 1}  centroX ${((best[1] + best[2]) / 2).toFixed(1)}  equatorY ${best[0]}`
  );
}
