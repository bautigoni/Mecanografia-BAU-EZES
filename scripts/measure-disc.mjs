import sharp from "sharp";

/* Mide el DISCO CENTRAL de un botón por barrido de bordes desde adentro.
   No sirve medir la silueta: la decoración (pasto, cristales, flores) se sale
   de la huella a propósito y cada isla la saca distinto. Tampoco sirve
   inundar por color: los discos tienen degradé y brillo, y la inundación se
   escapa por el antialias. El barrido desde el centro hacia afuera se frena
   en el primer salto fuerte de color, que es siempre el borde del disco.

   El disco es concéntrico con la base, así que su centro es el centro del
   botón, y su ancho es una medida estable de escala entre islas. */

const [file, L, T, Wd, Ht] = [process.argv[2], ...process.argv.slice(3, 7).map(Number)];
let img = sharp(file).flatten({ background: "#ffffff" });
if (Number.isFinite(L)) img = img.extract({ left: L, top: T, width: Wd, height: Ht });
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const at = (x, y) => { const i = (y * W + x) * C; return [data[i], data[i + 1], data[i + 2]]; };
const isBg = (x, y) => { const p = at(x, y); return p[0] > 238 && p[1] > 238 && p[2] > 238; };
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/* Caja del dibujo. */
let x0 = W, x1 = -1, y0 = H, y1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!isBg(x, y)) {
  if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
}

/* Primer pixel de dibujo bajando por el centro: la tapa del disco. */
let cx = Math.round((x0 + x1) / 2);
let topY = y0;
for (let y = y0; y <= y1; y++) if (!isBg(cx, y)) { topY = y; break; }

const EDGE = 60;                     // salto de color que cuenta como borde
/* Un borde tiene que sostenerse unos pixeles: así el barrido no se frena en
   un brillo especular ni en una veta del degradé. */
function walk(sx, sy, dx, dy) {
  const ref = at(sx, sy);
  let last = sx, lastY = sy;
  for (let k = 1; k < Math.max(W, H); k++) {
    const x = sx + dx * k, y = sy + dy * k;
    if (x < 0 || y < 0 || x >= W || y >= H) break;
    if (dist(at(x, y), ref) > EDGE) {
      let firme = true;
      for (let j = 1; j <= 3; j++) {
        const xx = x + dx * j, yy = y + dy * j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
        if (dist(at(xx, yy), ref) <= EDGE) { firme = false; break; }
      }
      if (firme) break;
    }
    last = x; lastY = y;
  }
  return dx !== 0 ? last : lastY;
}

/* Dos pasadas: la primera centra, la segunda mide sobre el centro corregido. */
let cy = topY + Math.round((y1 - topY) * 0.18);
for (let it = 0; it < 3; it++) {
  const l = walk(cx, cy, -1, 0), r = walk(cx, cy, 1, 0);
  cx = Math.round((l + r) / 2);
  const t = walk(cx, cy, 0, -1), b = walk(cx, cy, 0, 1);
  cy = Math.round((t + b) / 2);
}
const l = walk(cx, cy, -1, 0), r = walk(cx, cy, 1, 0);
const t = walk(cx, cy, 0, -1), b = walk(cx, cy, 0, 1);
const dw = r - l + 1, dh = b - t + 1;

console.log(
  `${file}${Number.isFinite(L) ? `  [${L},${T},${Wd},${Ht}]` : ""}\n` +
  `  dibujo  ancho ${x1 - x0 + 1}  alto ${y1 - y0 + 1}  centroX ${((x0 + x1) / 2).toFixed(1)}  topY ${y0}\n` +
  `  disco   ancho ${dw}  alto ${dh}  centro (${((l + r) / 2).toFixed(1)}, ${((t + b) / 2).toFixed(1)})  ratio ${(dh / dw).toFixed(3)}\n` +
  `  disco/dibujo ${(dw / (x1 - x0 + 1)).toFixed(3)}`
);
