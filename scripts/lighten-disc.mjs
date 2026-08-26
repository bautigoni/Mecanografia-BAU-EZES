import sharp from "sharp";

/* Aclara SOLO el disco central de un botón de nivel, dejando intacto el resto
   (galleta, glaseado, grageas, merengues). El disco es la parte sobre la que
   el juego dibuja el número blanco, así que subirle luminosidad es un
   compromiso directo con la legibilidad de ese número: pasado +30 % el blanco
   empieza a competir con el fondo y el disco pierde el borde contra el
   glaseado.

   Uso:  node scripts/lighten-disc.mjs <k> <entrada> <salida> <cx> <cy> <rx> <ry>

   La elipse hay que medirla por estado: al apretarse, el disco se hunde, así
   que baja de centro y se achata. Se mide con una banda central de la imagen,
   descartando las gotas de glaseado de los costados. */
const [k, SRC, DST, cx, cy, rx, ry] = [
  Number(process.argv[2]),
  process.argv[3],
  process.argv[4],
  ...process.argv.slice(5, 9).map(Number),
];
const DISC = { cx, cy, rx, ry };

function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hue2rgb(p, q, t) {
  if (t < 0) t += 1; if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hsl2rgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)]
    .map((v) => Math.round(v * 255));
}

const { data, info } = await sharp(SRC).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info, C = 4;
let touched = 0;

/* Tono del disco, muestreado en su centro. Antes el filtro de color estaba
   escrito a mano para el frambuesa de la isla 11 y no tocaba ni un pixel en
   ninguna otra: ahora se mide, y el script sirve para las quince.
   Se compara por TONO y SATURACIÓN, nunca por luminosidad — el disco tiene
   degradé y brillo, y filtrar por claro/oscuro le comería medio disco. */
const muestra = [[], [], []];
for (let y = cy - 12; y <= cy + 12; y++) {
  for (let x = cx - 12; x <= cx + 12; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = (y * W + x) * C;
    if (data[i + 3] < 200) continue;
    for (let k = 0; k < 3; k++) muestra[k].push(data[i + k]);
  }
}
const centro = muestra.map((m) => m.sort((a, b) => a - b)[m.length >> 1]);
const [hRef, sRef] = rgb2hsl(centro[0], centro[1], centro[2]);
/* Distancia de tono en la rueda: 0.5 es el opuesto, así que hay que dar la
   vuelta corta. */
const dHue = (h) => { const d = Math.abs(h - hRef); return Math.min(d, 1 - d); };

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * C;
    if (data[i + 3] < 40) continue;
    const dx = (x - DISC.cx) / DISC.rx, dy = (y - DISC.cy) / DISC.ry;
    const d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [h, s, l] = rgb2hsl(r, g, b);
    /* Mismo tono que el centro del disco: así pasan las grageas, el pasto y
       las flores que caen dentro de la elipse sin que se les toque el color. */
    if (dHue(h) > 0.09 || Math.abs(s - sRef) > 0.45) continue;
    /* Sube la luminosidad conservando tono y saturación, así el disco se
       aclara pero sigue siendo frambuesa y no rosa lavado. El efecto se
       desvanece en el 8 % exterior de la elipse para que no quede un escalón
       de color donde el recorte no coincide exactamente con el borde. */
    const fade = d2 > 0.85 ? (1 - d2) / 0.15 : 1;
    /* k > 0 aclara acercándose al blanco; k < 0 oscurece proporcionalmente.
       Son curvas distintas a propósito: al aclarar hay que frenar cerca del
       blanco para no quemar el color, y al oscurecer no hay techo del que
       cuidarse. Oscurecer sirve cuando el disco quedó tan claro que el número
       blanco no se lee — la isla 1 con su turquesa. */
    const nl2 = k >= 0 ? l + k * fade * (1 - l) : l * (1 + k * fade);
    const [nr, ng, nb] = hsl2rgb(h, s, nl2);
    data[i] = nr; data[i + 1] = ng; data[i + 2] = nb;
    touched++;
  }
}

await sharp(data, { raw: { width: W, height: H, channels: 4 } })
  .webp({ quality: 92, alphaQuality: 100 }).toFile(DST);
console.log(`ok ${DST}  k=${k}  px=${touched}`);
